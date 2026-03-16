import { mock } from "bun:test";

export const DbMocks = {
  getActivePlayers: mock(() => []),
  updateLastGameId: mock(() => {}),
  updatePlayerActivity: mock(() => {}),
  deactivateInactivePlayers: mock(() => []),
  getPlayersByDiscordId: mock(() => []),
  deletePlayersByDiscordId: mock(() => {}),
  upsertPlayer: mock(() => {}),
  saveOriginalNickname: mock(() => {}),
  clearOriginalNickname: mock(() => {}),
  getPlayerByPuuid: mock(() => null),
  updateGameId: mock(() => {}),
};

export const RiotMocks = {
  getActiveGameByPuuid: mock(() => Promise.resolve(null)),
  getAccountByRiotId: mock(() => Promise.resolve(null)),
};

export const DataDragonMocks = {
  getChampionName: mock(() => Promise.resolve("Aatrox")),
};

mock.module("../src/database/db.ts", () => DbMocks);
mock.module("../src/services/riot.ts", () => RiotMocks);
mock.module("../src/services/data-dragon.ts", () => ({
  DataDragonService: {
    getInstance: () => DataDragonMocks
  }
}));

mock.module("../src/utils/env.ts", () => ({
  getEnv: () => ({
    POLLING_INTERVAL_MS: 100,
    GUILD_ID: "123456",
    INACTIVITY_DAYS: 7,
    CLIENT_ID: "client-123",
    DISCORD_TOKEN: "token-123",
    RIOT_API_KEY: "riot-123"
  }),
  loadEnv: () => ({})
}));

export const MocksReady = true;
