import { mock } from "bun:test";
import type { Player } from "../src/database/db.ts";

export const createDbMocks = () => ({
  getActivePlayers: mock(() => [] as Player[]),
  updateLastGameId: mock(() => {}),
  updatePlayerActivity: mock(() => {}),
  deactivateInactivePlayers: mock(() => [] as Player[]),
  getPlayersByDiscordId: mock(() => [] as Player[]),
  deletePlayersByDiscordId: mock(() => {}),
  upsertPlayer: mock(() => {}),
  saveOriginalNickname: mock(() => {}),
  clearOriginalNickname: mock(() => {}),
  getPlayerByPuuid: mock(() => null as Player | null),
  updateGameId: mock(() => {}),
});

export const createRiotMocks = () => ({
  getActiveGameByPuuid: mock(() => Promise.resolve(null)),
  getAccountByRiotId: mock(() => Promise.resolve(null)),
});

export const createDataDragonMocks = () => ({
  getChampionName: mock(() => Promise.resolve("Aatrox")),
});

export const ENV_MOCK = {
  getEnv: () => ({
    POLLING_INTERVAL_MS: 100,
    GUILD_ID: "123456",
    INACTIVITY_DAYS: 7,
    CLIENT_ID: "client-123",
    DISCORD_TOKEN: "token-123",
    RIOT_API_KEY: "riot-123"
  }),
  loadEnv: () => ({})
};
