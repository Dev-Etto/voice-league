import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { deletePlayersByDiscordId } from "../database/db.ts";

export const unregisterCommand = {
  data: new SlashCommandBuilder()
    .setName("unregister")
    .setDescription("Desvincula sua conta do LoL do Discord"),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      deletePlayersByDiscordId(interaction.user.id);

      return interaction.editReply("✅ Todas as suas contas vinculadas foram removidas.");
    } catch (error) {
      console.error("Erro no comando /unregister:", error);
      return interaction.editReply("❌ Ocorreu um erro ao desvincular sua conta.");
    }
  }
};
