import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { UnregisterPlayer } from "../use-cases/player-status.ts";

export const unregisterCommand = {
  data: new SlashCommandBuilder()
    .setName("unregister")
    .setDescription("Desvincula sua conta do LoL do Discord"),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const unregisterUseCase = new UnregisterPlayer();
      await unregisterUseCase.execute(interaction.user.id);
      
      return interaction.editReply("✅ Todas as suas contas vinculadas foram removidas.");
    } catch (error) {
      console.error("Erro no comando /unregister:", error);
      return interaction.editReply("❌ Ocorreu um erro ao desvincular sua conta.");
    }
  }
};

