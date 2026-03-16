import { mock } from "bun:test";

/**
 * Centraliza todos os mocks globais necessários para os testes da aplicação.
 * Evita a importação direta de módulos que tocam infraestrutura (DB, Riot API).
 */
export function setupGlobalMocks() {
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

  mock.module("drizzle-orm", () => ({
    eq: mock(() => ({})),
    sql: mock(() => ({})),
  }));

  mock.module("drizzle-orm/bun-sqlite", () => ({
    drizzle: mock(() => ({})),
  }));

  mock.module("../src/database/db.ts", () => ({
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
  }));

  mock.module("../src/services/riot.ts", () => ({
    getActiveGameByPuuid: mock(() => Promise.resolve(null)),
    getAccountByRiotId: mock(() => Promise.resolve(null)),
  }));

  mock.module("../src/services/data-dragon.ts", () => ({
    DataDragonService: {
      getInstance: () => ({
        getChampionName: mock(() => Promise.resolve("ChampionName"))
      })
    }
  }));
}
