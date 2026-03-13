import { Database } from "bun:sqlite";

const db = new Database("VoiceLeague.sqlite");

// Inicialização das tabelas
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
    console.error("Erro ao inicializar banco de dados:", error);
    throw error;
  }
};

export { db, initDb };
