import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { getActivePlayers } from "../database/db.ts";
import { WatchdogEngine } from "../engine/watchdog.ts";
import { getEnv } from "../utils/env.ts";

export const auditCommand = {
  data: new SlashCommandBuilder()
    .setName("audit")
    .setDescription(" [Admin Only] Mostra o estado interno do VoiceLeague")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction, watchdog: WatchdogEngine) {
    await interaction.deferReply({ ephemeral: true });

    const players = getActivePlayers();
    const activeGames = watchdog.getTrackedGameCount();
    const uptime = process.uptime();
    const memory = process.memoryUsage();

    const embed = new EmbedBuilder()
      .setTitle("🛡️ VoiceLeague System Audit")
      .setColor("#5865F2")
      .addFields(
        { 
          name: "🤖 Engine Status", 
          value: `**Status:** ${watchdog.isMonitoring() ? "🟢 Ativo" : "🔴 Parado"}\n**Polling:** ${getEnv().POLLING_INTERVAL_MS / 1000}s`, 
          inline: true 
        },
        { 
          name: "🎮 Atividade", 
          value: `**Partidas:** ${activeGames}\n**Jogadores Ativos:** ${players.length}`, 
          inline: true 
        },
        { 
          name: "⚙️ Sistema", 
          value: `**Uptime:** ${Math.floor(uptime / 60)}m\n**RAM:** ${Math.round(memory.heapUsed / 1024 / 1024)}mb / ${Math.round(memory.heapTotal / 1024 / 1024)}mb`, 
          inline: true 
        }
      )
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }
};
