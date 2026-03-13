import type { Client } from "discord.js";
import { getActivePlayers, updateLastGameId, type PlayerRow } from "../database/db.ts";
import { riotService, type ActiveGame } from "../services/riot.ts";
import { VoiceChannelManager } from "../services/voice-channel.ts";
import { getEnv } from "../utils/env.ts";
import { RateLimitError } from "../utils/errors.ts";

interface TrackedGame {
  gameId: number;
  teamPlayers: Map<number, PlayerRow[]>;
  detectedAt: number;
}

export class WatchdogEngine {
  private readonly client: Client;
  private readonly voiceManager: VoiceChannelManager;
  private readonly pollingIntervalMs: number;
  private readonly activeGames = new Map<number, TrackedGame>();
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(client: Client) {
    this.client = client;
    this.voiceManager = new VoiceChannelManager(client);
    this.pollingIntervalMs = getEnv().POLLING_INTERVAL_MS;
  }

  start(): void {
    if (this.intervalId) return;

    console.log(`🐕 Watchdog iniciado (polling a cada ${this.pollingIntervalMs / 1000}s)`);
    this.poll();
    this.intervalId = setInterval(() => this.poll(), this.pollingIntervalMs);
  }

  stop(): void {
    if (!this.intervalId) return;

    clearInterval(this.intervalId);
    this.intervalId = null;
    console.log("🐕 Watchdog parado.");
  }

  private async poll(): Promise<void> {
    const players = getActivePlayers();
    if (players.length === 0) return;

    console.log(`🔍 Verificando ${players.length} jogador(es)...`);

    for (const player of players) {
      try {
        await this.checkPlayer(player);
      } catch (error) {
        if (error instanceof RateLimitError) {
          console.warn(`⏳ Rate limit atingido. Pausando poll por ${error.retryAfterSeconds}s.`);
          await this.sleep(error.retryAfterSeconds * 1000);
          return;
        }
        console.error(`Erro ao verificar jogador ${player.game_name}:`, error);
      }

      await this.sleep(1200);
    }

    await this.cleanupFinishedGames(players);
  }

  private async checkPlayer(player: PlayerRow): Promise<void> {
    const game = await riotService.getActiveGameByPuuid(player.puuid);

    if (!game) {
      if (player.last_game_id) {
        const previousGameId = Number(player.last_game_id);
        updateLastGameId(player.puuid, null);
        await this.voiceManager.scheduleChannelDeletion(previousGameId);
      }
      return;
    }

    const isAlreadyTracked = this.activeGames.has(game.gameId);

    if (isAlreadyTracked) {
      await this.handleExistingGame(game, player);
      return;
    }

    await this.handleNewGame(game, player);
    updateLastGameId(player.puuid, String(game.gameId));
  }

  private async handleNewGame(game: ActiveGame, triggerPlayer: PlayerRow): Promise<void> {
    const teamId = this.getPlayerTeam(game, triggerPlayer.puuid);

    const trackedGame: TrackedGame = {
      gameId: game.gameId,
      teamPlayers: new Map([[teamId, [triggerPlayer]]]),
      detectedAt: Date.now(),
    };

    this.activeGames.set(game.gameId, trackedGame);
    console.log(`🎮 Nova partida detectada: ${game.gameId} | Jogador: ${triggerPlayer.game_name}`);

    await this.voiceManager.createGameChannel(game.gameId, teamId, triggerPlayer);
  }

  private async handleExistingGame(game: ActiveGame, player: PlayerRow): Promise<void> {
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

  private async cleanupFinishedGames(currentPlayers: PlayerRow[]): Promise<void> {
    const activePuuids = new Set(currentPlayers.map((p) => p.puuid));

    for (const [gameId, tracked] of this.activeGames) {
      const hasActivePlayers = [...tracked.teamPlayers.values()]
        .flat()
        .some((p) => activePuuids.has(p.puuid));

      if (!hasActivePlayers) {
        this.activeGames.delete(gameId);
        await this.voiceManager.scheduleChannelDeletion(gameId);
        console.log(`🧹 Partida ${gameId} removida do tracking.`);
      }
    }
  }

  getActiveGames(): Map<number, TrackedGame> {
    return this.activeGames;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
