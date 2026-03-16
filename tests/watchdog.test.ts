import { afterEach, beforeEach, describe, expect, it, mock, spyOn, afterAll } from "bun:test";
import * as db from "../src/database/db.ts";
import * as riot from "../src/services/riot.ts";
import * as env from "../src/utils/env.ts";

import type { Player } from "../src/database/db.ts";
import { WatchdogEngine } from "../src/engine/watchdog.ts";
import { RateLimitError } from "../src/utils/errors.ts";
import "./../.mocks/global.mock.ts";
import { createMockClient } from "./../.mocks/discord.mock.ts";

const createFakePlayer = (overrides: Partial<Player> = {}): Player => ({
  puuid: "p-123",
  discordId: "d-123",
  gameName: "Player",
  tagLine: "BR1",
  lastGameId: null,
  isActive: true,
  createdAt: new Date().toISOString(),
  lastSeenAt: new Date().toISOString(),
  originalNickname: null,
  autoJoin: false,
  ...overrides
});

describe("WatchdogEngine", () => {
  let engine: WatchdogEngine;
  let mockVoiceManager: any;
  const mockClient = createMockClient();

  const getActivePlayersSpy = spyOn(db, "getActivePlayers");
  const updatePlayerActivitySpy = spyOn(db, "updatePlayerActivity");
  const updateLastGameIdSpy = spyOn(db, "updateLastGameId");
  const deactivateInactivePlayersSpy = spyOn(db, "deactivateInactivePlayers");
  const getActiveGameSpy = spyOn(riot, "getActiveGameByPuuid");
  const getEnvSpy = spyOn(env, "getEnv");

  beforeEach(() => {
    mockVoiceManager = {
      client: mockClient,
      initializeFromGuild: mock(() => Promise.resolve()),
      pruneEmptyChannels: mock(() => Promise.resolve()),
      createGameChannel: mock(() => Promise.resolve()),
      notifyPlayer: mock(() => Promise.resolve()),
      hasChannelForGame: mock(() => false),
      scheduleChannelDeletion: mock(() => Promise.resolve()),
    };

    getEnvSpy.mockReturnValue({
      GUILD_ID: "g1",
      POLLING_INTERVAL_MS: 100,
      INACTIVITY_DAYS: 30,
      CLIENT_ID: "c1",
      DISCORD_TOKEN: "t1",
      RIOT_API_KEY: "k1"
    } as any);

    getActivePlayersSpy.mockReturnValue([]);
    updatePlayerActivitySpy.mockImplementation(() => {});
    updateLastGameIdSpy.mockImplementation(() => {});
    deactivateInactivePlayersSpy.mockReturnValue([]);
    getActiveGameSpy.mockResolvedValue(null);
    
    engine = new WatchdogEngine(mockClient, mockVoiceManager, 100);
    
    spyOn(engine as any, "delay").mockImplementation(() => Promise.resolve());
  });

  afterEach(() => {
    engine.stop();
  });

  afterAll(() => {
    getActivePlayersSpy.mockRestore();
    updatePlayerActivitySpy.mockRestore();
    updateLastGameIdSpy.mockRestore();
    deactivateInactivePlayersSpy.mockRestore();
    getActiveGameSpy.mockRestore();
    getEnvSpy.mockRestore();
  });

  it("deve gerenciar o ciclo de vida do polling corretamente", async () => {
    const pollSpy = spyOn(engine, "poll").mockImplementation(() => Promise.resolve());
    
    await engine.start();
    expect(engine.isMonitoring()).toBe(true);
    
    engine.stop();
    expect(engine.isMonitoring()).toBe(false);
    pollSpy.mockRestore();
  });

  describe("Polling Logic", () => {
    it("deve atualizar atividade do jogador se estiver jogando LoL", async () => {
      const player = createFakePlayer({ puuid: "p1" });
      getActivePlayersSpy.mockReturnValue([player]);
      getActiveGameSpy.mockResolvedValue(null);

      const mockGuild = await mockClient.guilds.fetch("g1");
      const mockMember = {
        presence: {
          status: "online",
          activities: [{ name: "League of Legends" }]
        }
      };
      (mockGuild.members.cache.get as any).mockReturnValue(mockMember);

      await engine.poll();

      expect(db.updatePlayerActivity).toHaveBeenCalledWith("p1");
    });

    it("deve lidar com RateLimitError durante o poll", async () => {
      const player = createFakePlayer({ lastGameId: "playing" });
      getActivePlayersSpy.mockReturnValue([player]);
      getActiveGameSpy.mockRejectedValue(new RateLimitError(5));

      const mockGuild = await mockClient.guilds.fetch("g1");
      const mockMember = { presence: { status: "online", activities: [{ name: "League of Legends" }] } };
      (mockGuild.members.cache.get as any).mockReturnValue(mockMember);

      const consoleWarnSpy = spyOn(console, "warn").mockImplementation(() => {});
      
      await engine.poll();

      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("Rate limit atingido"));
      consoleWarnSpy.mockRestore();
    });
  });

  describe("Player Checking", () => {
    it("deve identificar aliados e atualizar o lastGameId para todos", async () => {
      const player = createFakePlayer({ puuid: "p1" });
      const ally = createFakePlayer({ puuid: "ally-1", discordId: "d-ally" });
      const allPlayers = [player, ally];

      getActiveGameSpy.mockResolvedValue({
        gameId: 777,
        participants: [
          { puuid: "p1", teamId: 100 },
          { puuid: "ally-1", teamId: 100 }
        ]
      } as any);

      const processSpy = spyOn(engine, "processMatchData").mockImplementation(() => Promise.resolve());

      await engine.checkPlayerMatch(player, allPlayers);

      expect(db.updateLastGameId).toHaveBeenCalledWith("p1", "777");
      expect(db.updateLastGameId).toHaveBeenCalledWith("ally-1", "777");
      expect(processSpy).toHaveBeenCalledTimes(2);
      
      processSpy.mockRestore();
    });
  });

  describe("Game Processing", () => {
    it("deve detectar novos aliados no mesmo jogo e notificar", async () => {
      const player1 = createFakePlayer({ puuid: "p1" });
      const player2 = createFakePlayer({ puuid: "p2", discordId: "d2" });
      const game = {
        gameId: 999,
        participants: [
          { puuid: "p1", teamId: 100, championId: 10 },
          { puuid: "p2", teamId: 100, championId: 20 }
        ]
      } as any;

      mockVoiceManager.hasChannelForGame.mockReturnValue(true);

      engine._injectTrackedGame(999, {
        gameId: 999,
        teamPlayers: new Map([[100, [player1]]]),
        detectedAt: Date.now()
      });

      await engine.processMatchData(game, player2);

      expect(mockVoiceManager.notifyPlayer).toHaveBeenCalledWith(player2, 999, 100, 20);
    });

    it("deve limpar jogos finalizados e agendar deleção de canais", async () => {
      const player = createFakePlayer({ puuid: "p1", lastGameId: "123" });
      
      engine._injectTrackedGame(123, {
        gameId: 123,
        teamPlayers: new Map([[100, [player]]]),
        detectedAt: Date.now()
      });

      getActivePlayersSpy.mockReturnValue([createFakePlayer({ puuid: "p1", lastGameId: null })]);

      await engine.cleanupFinishedGames();

      expect(engine.getTrackedGameCount()).toBe(0);
      expect(mockVoiceManager.scheduleChannelDeletion).toHaveBeenCalledWith(123, [player]);
    });
  });

  describe("Inactivity", () => {
    it("deve processar limpeza de inatividade e enviar DMs", async () => {
      const inactivePlayer = createFakePlayer({ discordId: "d-id", gameName: "Afker" });
      deactivateInactivePlayersSpy.mockReturnValue([inactivePlayer]);

      await engine.processInactivityCleanup();

      expect(db.deactivateInactivePlayers).toHaveBeenCalled();
      expect(mockClient.users.fetch).toHaveBeenCalledWith("d-id");
    });
  });
});
