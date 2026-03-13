import { Client, GatewayIntentBits, REST, Routes, type ChatInputCommandInteraction } from "discord.js";
import { config } from "dotenv";
import { registerCommand } from "./commands/register.ts";
import { statusCommand } from "./commands/status.ts";
import { unregisterCommand } from "./commands/unregister.ts";
import { initDb } from "./database/db.ts";
import { WatchdogEngine } from "./engine/watchdog.ts";
import { loadEnv } from "./utils/env.ts";
import { setupGlobalErrorHandlers } from "./utils/error-handler.ts";

config();

setupGlobalErrorHandlers();

const env = loadEnv();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const commandHandlers: Record<string, { execute: (i: ChatInputCommandInteraction) => Promise<unknown> }> = {
  register: registerCommand,
  unregister: unregisterCommand,
  status: statusCommand,
};

const commands = [
  registerCommand.data.toJSON(),
  unregisterCommand.data.toJSON(),
  statusCommand.data.toJSON(),
];

const rest = new REST({ version: "10" }).setToken(env.DISCORD_TOKEN);

async function deployCommands() {
  try {
    console.log("Iniciando atualização dos comandos (/)");
    await rest.put(
      Routes.applicationCommands(env.CLIENT_ID),
      { body: commands }
    );
    console.log("Comandos registrados com sucesso!");
  } catch (error) {
    console.error("Erro ao registrar comandos:", error);
  }
}

client.once("ready", () => {
  console.log(`🛡️ VoiceLeague online como ${client.user?.tag}`);
  initDb();
  deployCommands();

  const watchdog = new WatchdogEngine(client);
  watchdog.start();
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    const handler = commandHandlers[interaction.commandName];
    if (handler) {
      await handler.execute(interaction);
    }
  } catch (error) {
    console.error(`Erro no comando /${interaction.commandName}:`, error);

    const reply = interaction.deferred || interaction.replied
      ? interaction.editReply("❌ Ocorreu um erro inesperado.")
      : interaction.reply({ content: "❌ Ocorreu um erro inesperado.", ephemeral: true });

    await reply.catch(console.error);
  }
});

client.login(env.DISCORD_TOKEN).catch((error) => {
  console.error("Falha ao iniciar o bot:", error);
  process.exit(1);
});
