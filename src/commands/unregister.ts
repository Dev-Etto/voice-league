import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { deletePlayersByDiscordId } from "../database/db.ts";

export const unregisterCommand = {
  data: new SlashCommandBuilder()
    .setName("unregister")
    .setDescription("Desvincula sua conta do LoL do Discord"),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const deletedCount = deletePlayersByDiscordId(interaction.user.id);

      if (deletedCount === 0) {
        return interaction.editReply("⚠️ Você não possui nenhuma conta vinculada.");
      }

      return interaction.editReply(
        `✅ ${deletedCount} conta(s) desvinculada(s) com sucesso.`
      );
    } catch (error) {
      console.error("Erro no comando /unregister:", error);
      return interaction.editReply("❌ Ocorreu um erro ao desvincular sua conta.");
    }
  }
};
