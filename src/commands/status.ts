import { SlashCommandBuilder, EmbedBuilder, type ChatInputCommandInteraction } from "discord.js";
import { db } from "../database/db.ts";
import type { PlayerRow } from "../database/db.ts";

export const statusCommand = {
  data: new SlashCommandBuilder()
    .setName("status")
    .setDescription("Mostra suas contas vinculadas e status de monitoramento"),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const players = db.query<PlayerRow, [string]>(
        "SELECT * FROM players WHERE discord_id = ?"
      ).all(interaction.user.id);

      if (players.length === 0) {
        return interaction.editReply(
          "⚠️ Você não possui nenhuma conta vinculada. Use `/register` para começar."
        );
      }

      const embed = new EmbedBuilder()
        .setTitle("🛡️ VoiceLeague - Suas Contas")
        .setColor(0x5865F2)
        .setTimestamp();

      for (const player of players) {
        const isInGame = player.last_game_id !== null;
        const statusIcon = isInGame ? "🟢 Em partida" : "⚪ Fora de partida";
        const activeIcon = player.is_active ? "✅ Monitorando" : "⏸️ Pausado";

        embed.addFields({
          name: `${player.game_name}#${player.tag_line}`,
          value: `${statusIcon} | ${activeIcon}`,
          inline: false,
        });
      }

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Erro no comando /status:", error);
      return interaction.editReply("❌ Ocorreu um erro ao buscar suas informações.");
    }
  }
};
