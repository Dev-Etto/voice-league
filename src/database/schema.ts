import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const players = sqliteTable("players", {
  discordId: text("discord_id").notNull(),
  puuid: text("puuid").primaryKey(),
  gameName: text("game_name").notNull(),
  tagLine: text("tag_line").notNull(),
  lastGameId: text("last_game_id"),
  isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
  lastSeenAt: text("last_seen_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  originalNickname: text("original_nickname"),
  autoJoin: integer("auto_join", { mode: "boolean" }).default(false).notNull(),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type Player = typeof players.$inferSelect;
export type NewPlayer = typeof players.$inferInsert;
