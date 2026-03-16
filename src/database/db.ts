import { Database } from "bun:sqlite";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { DatabaseError } from "../utils/errors.ts";
import { safeRun } from "../utils/safe-run.ts";
import { players, type Player } from "./schema.ts";
export type { Player };

import path from "node:path";

const getDatabasePath = () => process.env.DATABASE_PATH || path.join(process.cwd(), "VoiceLeague.sqlite");

let sqlite = new Database(getDatabasePath());
export let db = drizzle(sqlite);

/**
 * Reinicializa a conexão com o banco (útil para testes).
 */
export const resetDatabase = (newPath?: string): void => {
  const path = newPath || getDatabasePath();
  sqlite.close();
  sqlite = new Database(path);
  db = drizzle(sqlite);
};

/**
 * Executa as migrações do banco de dados.
 */
export const runMigrations = async (): Promise<void> => {
  console.log("⏳ Rodando migrations...");
  const result = safeRun(() => migrate(db, { migrationsFolder: "./drizzle" }));



  if (!result.success) {
    console.error(`❌ Erro nas migrations: ${result.error.message}`);
    throw new DatabaseError(`Falha ao sincronizar banco: ${result.error.message}`);
  }

  console.log("✅ Migrations concluídas!");
};

/**
 * Busca todos os jogadores ativos.
 */
export const getActivePlayers = (): Player[] => {
  const result = safeRun(() => db.select().from(players).where(eq(players.isActive, true)).all());

  if (!result.success) {
    throw new DatabaseError(result.error.message);
  }

  return result.data;
};

/**
 * Busca jogadores por ID do Discord.
 */
export const getPlayersByDiscordId = (discordId: string): Player[] => {
  const result = safeRun(() => db.select().from(players).where(eq(players.discordId, discordId)).all());

  if (!result.success) {
    throw new DatabaseError(result.error.message);
  }

  return result.data;
};

/**
 * Busca um jogador pelo PUUID.
 */
export const getPlayerByPuuid = (puuid: string): Player | null => {
  const result = safeRun(() => db.select().from(players).where(eq(players.puuid, puuid)).get());

  if (!result.success) {
    throw new DatabaseError(result.error.message);
  }

  return result.data || null;
};

/**
 * Insere ou atualiza um jogador.
 */

export const upsertPlayer = (discordId: string, puuid: string, gameName: string, tagLine: string): void => {
  const result = safeRun(() => 
    db.insert(players)
      .values({ discordId, puuid, gameName, tagLine, isActive: true, lastSeenAt: sql`CURRENT_TIMESTAMP` })
      .onConflictDoUpdate({
        target: players.puuid,
        set: { discordId, gameName, tagLine, isActive: true, lastSeenAt: sql`CURRENT_TIMESTAMP` },
      })
      .run()
  );

  if (!result.success) {
    throw new DatabaseError(result.error.message);
  }
};

/**
 * Atualiza o timestamp de última atividade do jogador.
 */
export const updatePlayerActivity = (puuid: string): void => {
  const result = safeRun(() =>
    db.update(players)
      .set({ lastSeenAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(players.puuid, puuid))
      .run()
  );

  if (!result.success) {
    throw new DatabaseError(result.error.message);
  }
};

/**
 * Atualiza o ID da última partida rastreada.
 */
export const updateLastGameId = (puuid: string, gameId: string | null): void => {
  const result = safeRun(() =>
    db.update(players)
      .set({ lastGameId: gameId })
      .where(eq(players.puuid, puuid))
      .run()
  );

  if (!result.success) {
    throw new DatabaseError(result.error.message);
  }
};

/**
 * Remove registros de um jogador pelo ID do Discord.
 */
export const deletePlayersByDiscordId = (discordId: string): void => {
  const result = safeRun(() =>
    db.delete(players)
      .where(eq(players.discordId, discordId))
      .run()
  );

  if (!result.success) {
    throw new DatabaseError(result.error.message);
  }
};

/**
 * Atualiza a preferência de auto-join do jogador para todas as suas contas registradas.
 */
export const updateAutoJoinPreference = (discordId: string, enabled: boolean): void => {
  const result = safeRun(() =>
    db.update(players)
      .set({ autoJoin: enabled })
      .where(eq(players.discordId, discordId))
      .run()
  );

  if (!result.success) {
    throw new DatabaseError(result.error.message);
  }
};

/**
 * Inativa jogadores sem atividade recente.
 */
export const deactivateInactivePlayers = (days: number): Player[] => {
  const result = safeRun(() => {
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
  });

  if (!result.success) {
    throw new DatabaseError(result.error.message);
  }

  return result.data;
};

/**
 * Salva o nickname original do membro para restauração posterior.
 */
export const saveOriginalNickname = (puuid: string, nickname: string | null): void => {
  const result = safeRun(() =>
    db.update(players)
      .set({ originalNickname: nickname })
      .where(sql`${players.puuid} = ${puuid} AND ${players.originalNickname} IS NULL`)
      .run()
  );


  if (!result.success) {
    throw new DatabaseError(result.error.message);
  }
};

/**
 * Limpa o registro do nickname original.
 */
export const clearOriginalNickname = (puuid: string): void => {
  const result = safeRun(() =>
    db.update(players)
      .set({ originalNickname: null })
      .where(eq(players.puuid, puuid))
      .run()
  );

  if (!result.success) {
    throw new DatabaseError(result.error.message);
  }
};

