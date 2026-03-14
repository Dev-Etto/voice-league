import { Database } from "bun:sqlite";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { players } from "../src/database/schema.ts";

describe("Database (Drizzle)", () => {
  let sqlite: Database;
  let db: ReturnType<typeof drizzle>;

  beforeAll(async () => {
    sqlite = new Database(":memory:");
    db = drizzle(sqlite);
    
    await migrate(db, { migrationsFolder: "./drizzle" });
  });

  afterAll(() => {
    sqlite.close();
  });

  it("deve inserir um jogador via Drizzle", () => {
    db.insert(players)
      .values({ discordId: "123456", puuid: "puuid-abc", gameName: "Faker", tagLine: "KR1" })
      .run();

    const result = db.select().from(players).where(eq(players.puuid, "puuid-abc")).all();

    expect(result.length).toBe(1);
    expect(result[0].gameName).toBe("Faker");
    expect(result[0].tagLine).toBe("KR1");
    expect(result[0].isActive).toBe(true);
  });

  it("deve buscar jogadores ativos", () => {
    db.insert(players)
      .values({ discordId: "789", puuid: "puuid-inactive", gameName: "InactivePlayer", tagLine: "BR1", isActive: false })
      .run();

    const activePlayers = db.select().from(players).where(eq(players.isActive, true)).all();

    expect(activePlayers.length).toBe(1);
    expect(activePlayers[0].gameName).toBe("Faker");
  });

  it("deve atualizar lastGameId", () => {
    db.update(players)
      .set({ lastGameId: "game-123" })
      .where(eq(players.puuid, "puuid-abc"))
      .run();

    const result = db.select().from(players).where(eq(players.puuid, "puuid-abc")).all();

    expect(result[0].lastGameId).toBe("game-123");
  });

  it("deve limpar lastGameId quando partida acaba", () => {
    db.update(players)
      .set({ lastGameId: null })
      .where(eq(players.puuid, "puuid-abc"))
      .run();

    const result = db.select().from(players).where(eq(players.puuid, "puuid-abc")).all();

    expect(result[0].lastGameId).toBeNull();
  });

  it("deve fazer upsert (conflito no puuid)", () => {
    db.insert(players)
      .values({ discordId: "999", puuid: "puuid-abc", gameName: "NewName", tagLine: "NEW" })
      .onConflictDoUpdate({
        target: players.puuid,
        set: { discordId: "999", gameName: "NewName", tagLine: "NEW" },
      })
      .run();

    const result = db.select().from(players).where(eq(players.puuid, "puuid-abc")).all();

    expect(result.length).toBe(1);
    expect(result[0].gameName).toBe("NewName");
    expect(result[0].discordId).toBe("999");
  });

  it("deve deletar jogador por discordId", () => {
    db.delete(players)
      .where(eq(players.discordId, "999"))
      .run();

    const remaining = db.select().from(players).where(eq(players.puuid, "puuid-abc")).all();
    expect(remaining.length).toBe(0);
  });
});
