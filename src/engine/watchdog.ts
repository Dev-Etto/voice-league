import type { Client } from "discord.js";
import { getActivePlayers, updateLastGameId, type Player } from "../database/db.ts";
import { getActiveGameByPuuid, type ActiveGame } from "../services/riot.ts";
import { VoiceChannelManager } from "../services/voice-channel.ts";
import { getEnv } from "../utils/env.ts";
import { RateLimitError, RiotApiError } from "../utils/errors.ts";

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

    try {
      const playersList = getActivePlayers();
      
      const guildId = getEnv().GUILD_ID;
      const guild = await this.voiceManager.client.guilds.fetch(guildId).catch(() => null);
      
      if (!guild) {
        console.error("❌ Guild não encontrada. Verifique o GUILD_ID no .env");
        return;
      }

      console.log(`🔍 Verificando players ativos...`);
      this.checkedPuuids.clear();

      if (playersList.length > 0) {
        for (const player of playersList) {
          if (this.checkedPuuids.has(player.puuid)) continue;

        const member = await guild.members.fetch(player.discordId).catch(() => null);
        const isPlayingLoL = member?.presence?.activities.some(
          act => act.name.toLowerCase().includes("league of legends")
        );

        if (!isPlayingLoL && !player.lastGameId) {
          continue;
        }

        try {
          await this.checkPlayer(player, playersList);
        } catch (error) {
          if (error instanceof RateLimitError) {
            console.warn(`⏳ Rate limit atingido. Pausando poll por ${error.retryAfterSeconds}s.`);
            await this.sleep(error.retryAfterSeconds * 1000);
            return;
          }
          
          if (error instanceof RiotApiError && error.riotStatusCode === 401) {
            console.error(`🛑 ERRO CRÍTICO: ${error.message}`);
            this.stop();
            return;
          }

          console.error(`Erro ao verificar jogador ${player.gameName}:`, error);
        }

        await this.sleep(1200);
        }
      }

      await this.cleanupFinishedGames();

      const activeGameIds = new Set(this.activeGames.keys());
      await this.voiceManager.pruneEmptyChannels(activeGameIds);
    } finally {
      this.isPolling = false;
    }
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

    await this.voiceManager.createGameChannel(game.gameId, teamId, triggerPlayer);
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

    if (!this.voiceManager.hasChannelForGame(game.gameId, teamId)) {
      await this.voiceManager.createGameChannel(game.gameId, teamId, player);
    } else {
      await this.voiceManager.notifyPlayer(player, game.gameId, teamId);
    }
  }

  private getPlayerTeam(game: ActiveGame, puuid: string): number {
    const participant = game.participants.find((p) => p.puuid === puuid);
    return participant?.teamId ?? 0;
  }

  private async cleanupFinishedGames(): Promise<void> {
    const playersFromDb = getActivePlayers();

    for (const [gameId, tracked] of this.activeGames) {
      // Uma partida é considerada finalizada apenas quando NENHUM jogador associado a ela
      // tem o seu lastGameId apontando para este gameId no banco de dados.
      const hasActivePlayersInDb = playersFromDb.some(p => p.lastGameId === String(gameId));

      if (!hasActivePlayersInDb) {
        this.activeGames.delete(gameId);
        await this.voiceManager.scheduleChannelDeletion(gameId);
        console.log(`🧹 Partida ${gameId} removida do tracking.`);
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
