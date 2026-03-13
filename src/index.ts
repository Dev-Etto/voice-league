import { Client, GatewayIntentBits } from "discord.js";
import { config } from "dotenv";
import { initDb } from "./database/db.ts";

// Carregar variáveis de ambiente
config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once("ready", () => {
  console.log(`🛡️ VoiceLeague online como ${client.user?.tag}`);
  initDb();
});

// Login do Bot
const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error("ERRO: DISCORD_TOKEN não encontrado no .env");
  process.exit(1);
}

client.login(token).catch((error) => {
  console.error("Falha ao iniciar o bot:", error);
});
