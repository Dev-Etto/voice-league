import type { Client } from "discord.js";
import { getActivePlayers, updateLastGameId, updatePlayerActivity, deactivateInactivePlayers, type Player } from "../database/db.ts";
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
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isPolling = false;

  constructor(client: Client) {
    this.voiceManager = new VoiceChannelManager(client);
    this.pollingIntervalMs = getEnv().POLLING_INTERVAL_MS;
  }

  async start(): Promise<void> {
    if (this.intervalId) return;

    await this.voiceManager.initializeFromGuild();

    console.log(`🐕 Watchdog iniciado (polling a cada ${this.pollingIntervalMs / 1000}s)`);
    this.poll();
    this.intervalId = setInterval(() => this.poll(), this.pollingIntervalMs);
  }

  stop(): void {
    if (!this.intervalId) return;

    clearInterval(this.intervalId);
    this.intervalId = null;
    this.isPolling = false;
    console.log("🐕 Watchdog parado.");
  }

  private async poll(): Promise<void> {
    if (this.isPolling) return;
    this.isPolling = true;

    const guildId = getEnv().GUILD_ID;
    const guildResult = await safeAsync(this.voiceManager.client.guilds.fetch(guildId));
    
    if (!guildResult.success) {
      console.error("❌ Erro ao buscar guild:", guildResult.error.message);
      this.isPolling = false;
      return;
    }

    const guild = guildResult.data;
    console.log(`🔍 Verificando players ativos...`);
    this.checkedPuuids.clear();

    const playersList = getActivePlayers();

    for (const player of playersList) {
      if (this.checkedPuuids.has(player.puuid)) continue;

      const memberResult = await safeAsync(guild.members.fetch(player.discordId));
      const member = memberResult.success ? memberResult.data : null;

      const isPlayingLoL = member?.presence?.activities.some(
        act => act.name.toLowerCase().includes("league of legends")
      );

      if (isPlayingLoL || member?.presence?.status === "online" || member?.presence?.status === "dnd") {
        updatePlayerActivity(player.puuid);
      }

      if (!isPlayingLoL && !player.lastGameId) {
        continue;
      }

      const checkResult = await safeAsync(this.checkPlayer(player, playersList));
      
      if (!checkResult.success) {
        const { error } = checkResult;
        
        if (error instanceof RateLimitError) {
          console.warn(`⏳ Rate limit atingido. Pausando poll por ${error.retryAfterSeconds}s.`);
          await this.sleep(error.retryAfterSeconds * 1000);
          this.isPolling = false;
          return;
        }
        
        if (error instanceof RiotApiError && error.riotStatusCode === 401) {
          console.error(`🛑 ERRO CRÍTICO: ${error.message}`);
          this.stop();
          this.isPolling = false;
          return;
        }

        console.error(`Erro ao verificar jogador ${player.gameName}:`, error.message);
      }

      await this.sleep(1200);
    }

    await this.cleanupFinishedGames();

    const activeGameIds = new Set(this.activeGames.keys());
    await this.voiceManager.pruneEmptyChannels(activeGameIds);

    await this.processInactivityCleanup();
    this.isPolling = false;
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
    const isAlreadyTracked = this.activeGames.has(game.gameId);

    if (isAlreadyTracked) {
      await this.handleExistingGame(game, player);
      return;
    }

    await this.handleNewGame(game, player);
  }

  private async handleNewGame(game: ActiveGame, triggerPlayer: Player): Promise<void> {
    const teamId = this.getPlayerTeam(game, triggerPlayer.puuid);

    const trackedGame: TrackedGame = {
      gameId: game.gameId,
      teamPlayers: new Map([[teamId, [triggerPlayer]]]),
      detectedAt: Date.now(),
    };

    this.activeGames.set(game.gameId, trackedGame);
    console.log(`🎮 Nova partida detectada: ${game.gameId} | Jogador: ${triggerPlayer.gameName}`);

    const championId = this.getPlayerChampionId(game, triggerPlayer.puuid);
    await this.voiceManager.createGameChannel(game.gameId, teamId, triggerPlayer, championId);
  }

  private async handleExistingGame(game: ActiveGame, player: Player): Promise<void> {
    const tracked = this.activeGames.get(game.gameId);
    if (!tracked) return;

    const teamId = this.getPlayerTeam(game, player.puuid);
    const teamPlayers = tracked.teamPlayers.get(teamId) ?? [];

    const isAlreadyInTeam = teamPlayers.some((p) => p.puuid === player.puuid);
    if (isAlreadyInTeam) return;

    teamPlayers.push(player);
    tracked.teamPlayers.set(teamId, teamPlayers);

    const championId = this.getPlayerChampionId(game, player.puuid);
    if (!this.voiceManager.hasChannelForGame(game.gameId, teamId)) {
      await this.voiceManager.createGameChannel(game.gameId, teamId, player, championId);
    } else {
      await this.voiceManager.notifyPlayer(player, game.gameId, teamId, championId);
    }
  }

  private getPlayerTeam(game: ActiveGame, puuid: string): number {
    const participant = game.participants.find((p) => p.puuid === puuid);
    return participant?.teamId ?? 0;
  }

  private getPlayerChampionId(game: ActiveGame, puuid: string): number | undefined {
    const participant = game.participants.find((p) => p.puuid === puuid);
    return participant?.championId;
  }

  private async cleanupFinishedGames(): Promise<void> {
    const playersFromDb = getActivePlayers();

    for (const [gameId] of this.activeGames) {
      const hasActivePlayersInDb = playersFromDb.some(p => p.lastGameId === String(gameId));

      if (!hasActivePlayersInDb) {
        this.activeGames.delete(gameId);
        await this.voiceManager.scheduleChannelDeletion(gameId);
        console.log(`🧹 Partida ${gameId} removida do tracking.`);
      }
    }
  }

  private async processInactivityCleanup(): Promise<void> {
    const inactiveDays = getEnv().INACTIVITY_DAYS;
    const deactivatedCount = deactivateInactivePlayers(inactiveDays);

    for (const player of deactivatedCount) {
      console.log(`💤 Jogador inativado por ausência: ${player.gameName}`);
      
      const userRes = await safeAsync(this.voiceManager.client.users.fetch(player.discordId));
      if (userRes.success) {
        const dmRes = await safeAsync(userRes.data.send(
          `😴 **Notificação de Inatividade - VoiceLeague**\n\n` +
          `Olá! Notamos que você está ausente do League of Legends há mais de ${inactiveDays} dias.\n` +
          `Para economizar recursos, pausamos o monitoramento automático da sua conta.\n\n` +
          `✨ **Como voltar?**\n` +
          `Basta usar o comando \`/register\` novamente e você voltará a ser monitorado imediatamente!`
        ));

        if (!dmRes.success) {
          console.warn(`⚠️ Não foi possível avisar o jogador ${player.gameName} sobre a inativação.`);
        }
      }
    }
  }


  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
