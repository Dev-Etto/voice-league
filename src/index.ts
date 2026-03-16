import { Client, Events, GatewayIntentBits, REST, Routes, type ChatInputCommandInteraction } from "discord.js";
import { config } from "dotenv";
import { registerCommand } from "./commands/register.ts";
import { statusCommand } from "./commands/status.ts";
import { unregisterCommand } from "./commands/unregister.ts";
import { autoJoinCommand } from "./commands/autojoin.ts";
import { runMigrations } from "./database/db.ts";
import { WatchdogEngine } from "./engine/watchdog.ts";
import { loadEnv } from "./utils/env.ts";
import { setupGlobalErrorHandlers } from "./utils/error-handler.ts";
import { safeAsync } from "./utils/safe-async.ts";
import { auditCommand } from "./commands/audit.ts";

config();

setupGlobalErrorHandlers();

const startApp = async () => {
  await runMigrations();
  const env = loadEnv();

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildPresences,
    ],
  });

  const commandHandlers: Record<string, { execute: (i: ChatInputCommandInteraction) => Promise<unknown> }> = {
    register: registerCommand,
    unregister: unregisterCommand,
    status: statusCommand,
    autojoin: autoJoinCommand,
  };

  const commands = [
    registerCommand.data.toJSON(),
    unregisterCommand.data.toJSON(),
    statusCommand.data.toJSON(),
    autoJoinCommand.data.toJSON(),
    auditCommand.data.toJSON()
  ];

  const rest = new REST({ version: "10" }).setToken(env.DISCORD_TOKEN);

  const deployCommands = async () => {
    console.log("Iniciando atualização dos comandos (/)");
    const result = await safeAsync(rest.put(Routes.applicationCommands(env.CLIENT_ID), { body: commands }));
    
    if (result.success) {
      console.log("Comandos registrados com sucesso!");
    } else {
      console.error("Erro ao registrar comandos:", result.error.message);
    }
  };

  client.once(Events.ClientReady, async (readyClient) => {
    console.log(`🛡️ VoiceLeague online como ${readyClient.user.tag}`);
    await deployCommands();

    const watchdog = new WatchdogEngine(readyClient);
    await watchdog.start();

    client.on(Events.VoiceStateUpdate, (oldState, newState) => {
      if (newState.member && newState.channelId && newState.channelId !== oldState.channelId) {
        void watchdog.triggerImmediateCheck(newState.member.id);
      }
    });

    client.on(Events.PresenceUpdate, (oldPresence, newPresence) => {
      if (newPresence.member && newPresence.activities.some(a => a.name.toLowerCase().includes("league of legends"))) {
        void watchdog.triggerImmediateCheck(newPresence.member.id);
      }
    });

    const WEBHOOK_PORT = 3000;
    Bun.serve({
      port: WEBHOOK_PORT,
      async fetch(req) {
        const url = new URL(req.url);
        
        if (req.method === "POST" && url.pathname === "/webhook/activity") {
          const apiKey = req.headers.get("x-api-key");
          if (apiKey !== env.WEBHOOK_API_KEY) {
            return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
          }

          const body = await req.json().catch(() => ({}));
          const { discordId } = body as { discordId?: string };

          if (discordId) {
            console.log(`📡 Webhook recebido para usuário Discord: ${discordId}`);
            void watchdog.triggerImmediateCheck(discordId);
            return Response.json({ success: true, message: "Check triggered" });
          }
          
          return Response.json({ success: false, error: "Missing discordId" }, { status: 400 });
        }

        return new Response("VoiceLeague Bot Webhook Server", { status: 404 });
      },
    });

    console.log(`📡 Servidor de Webhooks ouvindo na porta ${WEBHOOK_PORT}`);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const handler = commandHandlers[interaction.commandName];
    if (!handler) return;

    const result = await safeAsync(handler.execute(interaction));
    
    if (!result.success) {
      console.error(`Erro no comando /${interaction.commandName}:`, result.error.message);

      const errorPayload = { 
        content: "❌ Ocorreu um erro inesperado.", 
        ephemeral: true 
      };
      
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errorPayload).catch(() => {});
      } else {
        await interaction.reply(errorPayload).catch(() => {});
      }
    }
  });

  const loginResult = await safeAsync(client.login(env.DISCORD_TOKEN));
  if (!loginResult.success) {
    console.error("Falha ao iniciar o bot:", loginResult.error.message);
    process.exit(1);
  }
};

startApp();

