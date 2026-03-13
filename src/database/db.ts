import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { eq } from "drizzle-orm";
import { players, type Player } from "./schema.ts";
import { DatabaseError } from "../utils/errors.ts";

const sqlite = new Database("VoiceLeague.sqlite");
export const db = drizzle(sqlite);

export const initDb = () => {
  try {
    sqlite.run(`
      CREATE TABLE IF NOT EXISTS players (
        discord_id TEXT NOT NULL,
        puuid TEXT PRIMARY KEY,
        game_name TEXT NOT NULL,
        tag_line TEXT NOT NULL,
        last_game_id TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(discord_id, puuid)
      )
    `);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new DatabaseError(message);
  }
};

export const getActivePlayers = (): Player[] => {
  try {
    return db.select().from(players).where(eq(players.isActive, true)).all();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new DatabaseError(message);
  }
};

export const getPlayersByDiscordId = (discordId: string): Player[] => {
  try {
    return db.select().from(players).where(eq(players.discordId, discordId)).all();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new DatabaseError(message);
  }
};

export const upsertPlayer = (discordId: string, puuid: string, gameName: string, tagLine: string): void => {
  try {
    db.insert(players)
      .values({ discordId, puuid, gameName, tagLine })
      .onConflictDoUpdate({
        target: players.puuid,
        set: { discordId, gameName, tagLine },
      })
      .run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new DatabaseError(message);
  }
};

export const updateLastGameId = (puuid: string, gameId: string | null): void => {
  try {
    db.update(players)
      .set({ lastGameId: gameId })
      .where(eq(players.puuid, puuid))
      .run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new DatabaseError(message);
  }
};

export const deletePlayersByDiscordId = (discordId: string): number => {
  try {
    const result = db.delete(players)
      .where(eq(players.discordId, discordId))
      .run();
    return result.changes;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new DatabaseError(message);
  }
};
