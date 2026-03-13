import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { db } from "../database/db.ts";

export const unregisterCommand = {
  data: new SlashCommandBuilder()
    .setName("unregister")
    .setDescription("Desvincula sua conta do LoL do Discord"),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const result = db.run(
        "DELETE FROM players WHERE discord_id = ?",
        [interaction.user.id]
      );

      if (result.changes === 0) {
        return interaction.editReply("⚠️ Você não possui nenhuma conta vinculada.");
      }

      return interaction.editReply(
        `✅ ${result.changes} conta(s) desvinculada(s) com sucesso.`
      );
    } catch (error) {
      console.error("Erro no comando /unregister:", error);
      return interaction.editReply("❌ Ocorreu um erro ao desvincular sua conta.");
    }
  }
};
