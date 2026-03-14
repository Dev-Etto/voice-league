import { Database } from "bun:sqlite";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { DatabaseError } from "../utils/errors.ts";
import { players, type Player } from "./schema.ts";
export type { Player };

import path from "node:path";

const databasePath = process.env.DATABASE_PATH || path.join(process.cwd(), "VoiceLeague.sqlite");
console.log(`📂 Utilizando banco de dados em: ${databasePath}`);

const sqlite = new Database(databasePath);
export const db = drizzle(sqlite);

export const runMigrations = async (): Promise<void> => {
  try {
    console.log("⏳ Rodando migrations...");
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("✅ Migrations concluídas!");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ Erro nas migrations: ${message}`);
    throw new DatabaseError(`Falha ao sincronizar banco: ${message}`);
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
      .values({ discordId, puuid, gameName, tagLine, isActive: true, lastSeenAt: sql`CURRENT_TIMESTAMP` })
      .onConflictDoUpdate({
        target: players.puuid,
        set: { discordId, gameName, tagLine, isActive: true, lastSeenAt: sql`CURRENT_TIMESTAMP` },
      })
      .run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new DatabaseError(message);
  }
};

export const updatePlayerActivity = (puuid: string): void => {
  try {
    db.update(players)
      .set({ lastSeenAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(players.puuid, puuid))
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

export const deletePlayersByDiscordId = (discordId: string): void => {
  try {
    db.delete(players)
      .where(eq(players.discordId, discordId))
      .run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new DatabaseError(message);
  }
};

export const deactivateInactivePlayers = (days: number): Player[] => {
  try {
    // Busca jogadores que não são vistos há mais de X dias
    const inactivePlayers = db.select()
      .from(players)
      .where(sql`last_seen_at < datetime('now', '-' || ${days} || ' days') AND is_active = 1`)
      .all();

    if (inactivePlayers.length > 0) {
      db.update(players)
        .set({ isActive: false })
        .where(sql`last_seen_at < datetime('now', '-' || ${days} || ' days') AND is_active = 1`)
        .run();
    }

    return inactivePlayers;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new DatabaseError(message);
  }
};
