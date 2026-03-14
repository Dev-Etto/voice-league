import { SlashCommandBuilder, EmbedBuilder, type ChatInputCommandInteraction } from "discord.js";
import { getPlayersByDiscordId } from "../database/db.ts";
import { safeRun } from "../utils/safe-run.ts";

export const statusCommand = {
  data: new SlashCommandBuilder()
    .setName("status")
    .setDescription("Mostra suas contas vinculadas e status de monitoramento"),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const result = safeRun(() => getPlayersByDiscordId(interaction.user.id));

    if (!result.success) {
      console.error("Erro no comando /status:", result.error.message);
      return interaction.editReply("❌ Ocorreu um erro ao buscar suas informações.");
    }

    const playersList = result.data;

    if (playersList.length === 0) {
      return interaction.editReply(
        "⚠️ Você não possui nenhuma conta vinculada. Use `/register` para começar."
      );
    }

    const embed = new EmbedBuilder()
      .setTitle("🛡️ VoiceLeague - Suas Contas")
      .setColor(0x5865F2)
      .setTimestamp();

    for (const player of playersList) {
      const isInGame = player.lastGameId !== null;
      const statusIcon = isInGame ? "🟢 Em partida" : "⚪ Fora de partida";
      const activeIcon = player.isActive ? "✅ Monitorando" : "⏸️ Pausado";

      embed.addFields({
        name: `${player.gameName}#${player.tagLine}`,
        value: `${statusIcon} | ${activeIcon}`,
        inline: false,
      });
    }

    return interaction.editReply({ embeds: [embed] });
  }
};

