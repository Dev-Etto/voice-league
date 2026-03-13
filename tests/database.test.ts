import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { Database } from "bun:sqlite";

const TEST_DB_PATH = ":memory:";

interface PlayerRow {
  discord_id: string;
  puuid: string;
  game_name: string;
  tag_line: string;
  last_game_id: string | null;
  is_active: number;
}

describe("Database", () => {
  let db: Database;

  beforeAll(() => {
    db = new Database(TEST_DB_PATH);
    db.run(`
      CREATE TABLE IF NOT EXISTS players (
        discord_id TEXT NOT NULL,
        puuid TEXT PRIMARY KEY,
        game_name TEXT NOT NULL,
        tag_line TEXT NOT NULL,
        last_game_id TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(discord_id, puuid)
      )
    `);
  });

  afterAll(() => {
    db.close();
  });

  it("deve inserir um jogador", () => {
    db.run(
      "INSERT INTO players (discord_id, puuid, game_name, tag_line) VALUES (?, ?, ?, ?)",
      ["123456", "puuid-abc", "Faker", "KR1"]
    );

    const player = db.query<PlayerRow, [string]>(
      "SELECT * FROM players WHERE puuid = ?"
    ).get("puuid-abc");

    expect(player).not.toBeNull();
    expect(player?.game_name).toBe("Faker");
    expect(player?.tag_line).toBe("KR1");
    expect(player?.is_active).toBe(1);
  });

  it("deve buscar jogadores ativos", () => {
    db.run(
      "INSERT INTO players (discord_id, puuid, game_name, tag_line, is_active) VALUES (?, ?, ?, ?, ?)",
      ["789", "puuid-inactive", "InactivePlayer", "BR1", 0]
    );

    const activePlayers = db.query<PlayerRow, []>(
      "SELECT * FROM players WHERE is_active = 1"
    ).all();

    expect(activePlayers.length).toBe(1);
    expect(activePlayers[0].game_name).toBe("Faker");
  });

  it("deve atualizar last_game_id", () => {
    db.run(
      "UPDATE players SET last_game_id = ? WHERE puuid = ?",
      ["game-123", "puuid-abc"]
    );

    const player = db.query<PlayerRow, [string]>(
      "SELECT * FROM players WHERE puuid = ?"
    ).get("puuid-abc");

    expect(player?.last_game_id).toBe("game-123");
  });

  it("deve limpar last_game_id quando partida acaba", () => {
    db.run(
      "UPDATE players SET last_game_id = ? WHERE puuid = ?",
      [null, "puuid-abc"]
    );

    const player = db.query<PlayerRow, [string]>(
      "SELECT * FROM players WHERE puuid = ?"
    ).get("puuid-abc");

    expect(player?.last_game_id).toBeNull();
  });

  it("deve deletar jogador por discord_id", () => {
    const result = db.run(
      "DELETE FROM players WHERE discord_id = ?",
      ["123456"]
    );

    expect(result.changes).toBe(1);
  });

  it("deve rejeitar puuid duplicado", () => {
    db.run(
      "INSERT INTO players (discord_id, puuid, game_name, tag_line) VALUES (?, ?, ?, ?)",
      ["111", "puuid-dup", "Player1", "BR1"]
    );

    expect(() => {
      db.run(
        "INSERT INTO players (discord_id, puuid, game_name, tag_line) VALUES (?, ?, ?, ?)",
        ["222", "puuid-dup", "Player2", "BR2"]
      );
    }).toThrow();
  });
});
