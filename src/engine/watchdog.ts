import type { Client, Guild, GuildMember } from "discord.js";
import { 
  getActivePlayers, 
  updateLastGameId, 
  updatePlayerActivity, 
  deactivateInactivePlayers, 
  type Player 
} from "../database/db.ts";
import { getActiveGameByPuuid, type ActiveGame } from "../services/riot.ts";
import { VoiceChannelManager } from "../services/voice-channel.ts";
import { getEnv } from "../utils/env.ts";
import { RateLimitError, RiotApiError } from "../utils/errors.ts";
import { safeAsync } from "../utils/safe-async.ts";

interface TrackedGame {
  gameId: number;
  teamPlayers: Map<number, Player[]>;
  detectedAt: number;
}

export class WatchdogEngine {
  private readonly voiceManager: VoiceChannelManager;
  private readonly pollingIntervalMs: number;
  private readonly activeGames = new Map<number, TrackedGame>();
  private readonly checkedPuuids = new Set<string>();
  private intervalId: Timer | null = null;
  private isPolling = false;

  constructor(
    client: Client, 
    voiceManager?: VoiceChannelManager,
    pollingIntervalMs?: number
  ) {
    this.voiceManager = voiceManager ?? new VoiceChannelManager(client);
    this.pollingIntervalMs = pollingIntervalMs ?? getEnv().POLLING_INTERVAL_MS;
  }

  public async start(): Promise<void> {
    if (this.intervalId) return;

    await this.voiceManager.initializeFromGuild();

    console.log(`🐕 Watchdog iniciado (polling a cada ${this.pollingIntervalMs / 1000}s)`);
    
    // Execução imediata seguida de intervalo
    void this.poll();
    this.intervalId = setInterval(() => void this.poll(), this.pollingIntervalMs);
  }

  public stop(): void {
    if (!this.intervalId) return;

    clearInterval(this.intervalId);
    this.intervalId = null;
    this.isPolling = false;
    console.log("🐕 Watchdog parado.");
  }

  private async poll(): Promise<void> {
    if (this.isPolling) return;
    
    this.isPolling = true;
    this.checkedPuuids.clear();

    const guildId = getEnv().GUILD_ID;
    const guildResult = await safeAsync<Guild>(this.voiceManager.client.guilds.fetch(guildId));
    
    if (!guildResult.success) {
      console.error("❌ Erro ao buscar guild:", guildResult.error.message);
      this.isPolling = false;
      return;
    }

    const playersList = getActivePlayers();
    const guild = guildResult.data;

    for (const player of playersList) {
      await this.processPlayerPoll(player, guild, playersList);
    }

    await this.cleanupFinishedGames();
    
    const activeGameIds = new Set(this.activeGames.keys());
    await this.voiceManager.pruneEmptyChannels(activeGameIds);
    await this.processInactivityCleanup();

    this.isPolling = false;
  }

  private async processPlayerPoll(player: Player, guild: Guild, allPlayers: Player[]): Promise<void> {
    if (this.checkedPuuids.has(player.puuid)) return;

    const memberResult = await safeAsync<GuildMember>(guild.members.fetch(player.discordId));
    if (!memberResult.success) return;

    const member = memberResult.data;
    const isPlayingLoL = member.presence?.activities.some(
      act => act.name.toLowerCase().includes("league of legends")
    );

    const isOnline = member.presence?.status === "online" || member.presence?.status === "dnd";

    if (isPlayingLoL || isOnline) {
      updatePlayerActivity(player.puuid);
    }

    if (!isPlayingLoL && !player.lastGameId) return;

    const checkResult = await safeAsync(this.checkPlayer(player, allPlayers));
    
    if (!checkResult.success) {
      this.handlePollError(checkResult.error, player);
    }

    await this.sleep(1200);
  }

  private handlePollError(error: Error, player: Player): void {
    if (error instanceof RateLimitError) {
      console.warn(`⏳ Rate limit atingido. Aguardando ${error.retryAfterSeconds}s.`);
      // Nota: O sleep aqui travaria o loop do poll atual, o que é desejado para respeitar a API
      return;
    }
    
    if (error instanceof RiotApiError && error.riotStatusCode === 401) {
      console.error(`🛑 ERRO CRÍTICO (Token expirado/inválido): ${error.message}`);
      this.stop();
      return;
    }

    console.error(`Erro ao verificar jogador ${player.gameName}:`, error.message);
  }

  private async checkPlayer(player: Player, allPlayers: Player[]): Promise<void> {
    const game = await getActiveGameByPuuid(player.puuid);
    this.checkedPuuids.add(player.puuid);

    if (!game) {
      if (player.lastGameId) {
        updateLastGameId(player.puuid, null);
      }
      return;
    }

    const participantPuuids = new Set(game.participants.map(p => p.puuid));
    const alliesInGame = allPlayers.filter(p => participantPuuids.has(p.puuid));

    for (const ally of alliesInGame) {
      this.checkedPuuids.add(ally.puuid);
      updateLastGameId(ally.puuid, String(game.gameId));
      await this.processPlayerInGame(game, ally);
    }
  }

  private async processPlayerInGame(game: ActiveGame, player: Player): Promise<void> {
    const tracked = this.activeGames.get(game.gameId);
    const teamId = this.getPlayerTeam(game, player.puuid);
    const championId = this.getPlayerChampionId(game, player.puuid);

    if (!tracked) {
      await this.handleNewGame(game, player, teamId, championId);
      return;
    }

    await this.handleExistingGame(tracked, game, player, teamId, championId);
  }

  private async handleNewGame(game: ActiveGame, player: Player, teamId: number, championId?: number): Promise<void> {
    const trackedGame: TrackedGame = {
      gameId: game.gameId,
      teamPlayers: new Map([[teamId, [player]]]),
      detectedAt: Date.now(),
    };

    this.activeGames.set(game.gameId, trackedGame);
    console.log(`🎮 Nova partida detectada: ${game.gameId} | Jogador: ${player.gameName}`);

    await this.voiceManager.createGameChannel(game.gameId, teamId, player, championId);
  }

  private async handleExistingGame(tracked: TrackedGame, game: ActiveGame, player: Player, teamId: number, championId?: number): Promise<void> {
    const teamPlayers = tracked.teamPlayers.get(teamId) ?? [];

    if (teamPlayers.some(p => p.puuid === player.puuid)) return;

    teamPlayers.push(player);
    tracked.teamPlayers.set(teamId, teamPlayers);

    if (!this.voiceManager.hasChannelForGame(game.gameId, teamId)) {
      await this.voiceManager.createGameChannel(game.gameId, teamId, player, championId);
      return;
    }

    await this.voiceManager.notifyPlayer(player, game.gameId, teamId, championId);
  }

  private getPlayerTeam(game: ActiveGame, puuid: string): number {
    return game.participants.find(p => p.puuid === puuid)?.teamId ?? 0;
  }

  private getPlayerChampionId(game: ActiveGame, puuid: string): number | undefined {
    return game.participants.find(p => p.puuid === puuid)?.championId;
  }

  private async cleanupFinishedGames(): Promise<void> {
    const playersFromDb = getActivePlayers();

    for (const [gameId, tracked] of this.activeGames.entries()) {
      const stillInGame = playersFromDb.some(p => p.lastGameId === String(gameId));
      if (stillInGame) continue;

      this.activeGames.delete(gameId);
      const playersToRestore = Array.from(tracked.teamPlayers.values()).flat();
      await this.voiceManager.scheduleChannelDeletion(gameId, playersToRestore);
      
      console.log(`🧹 Partida ${gameId} removida do tracking.`);
    }
  }

  private async processInactivityCleanup(): Promise<void> {
    const inactiveDays = getEnv().INACTIVITY_DAYS;
    const deactivatedPlayers = deactivateInactivePlayers(inactiveDays);

    for (const player of deactivatedPlayers) {
      await this.notifyInactivity(player, inactiveDays);
    }
  }

  private async notifyInactivity(player: Player, days: number): Promise<void> {
    console.log(`💤 Jogador inativado por ausência: ${player.gameName}`);
    
    const userRes = await safeAsync(this.voiceManager.client.users.fetch(player.discordId));
    if (!userRes.success) return;

    await safeAsync(userRes.data.send(
      `😴 **Notificação de Inatividade - VoiceLeague**\n\n` +
      `Olá! Notamos que você está ausente do League of Legends há mais de ${days} dias.\n` +
      `Pausamos o monitoramento automático da sua conta.\n\n` +
      `✨ **Como voltar?** Basta usar \`/register\` novamente!`
    ));
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
