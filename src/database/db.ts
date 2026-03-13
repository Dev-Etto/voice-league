import { Database } from "bun:sqlite";
import { DatabaseError } from "../utils/errors.ts";

const db = new Database("VoiceLeague.sqlite");

interface PlayerRow {
  discord_id: string;
  puuid: string;
  game_name: string;
  tag_line: string;
  last_game_id: string | null;
  is_active: number;
}

const initDb = () => {
  try {
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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new DatabaseError(message);
  }
};

const getActivePlayers = (): PlayerRow[] => {
  try {
    return db.query<PlayerRow, []>(
      "SELECT * FROM players WHERE is_active = 1"
    ).all();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new DatabaseError(message);
  }
};

const updateLastGameId = (puuid: string, gameId: string | null): void => {
  try {
    db.run(
      "UPDATE players SET last_game_id = ? WHERE puuid = ?",
      [gameId, puuid]
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new DatabaseError(message);
  }
};

export { db, initDb, getActivePlayers, updateLastGameId };
export type { PlayerRow };
