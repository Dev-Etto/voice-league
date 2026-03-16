import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { UnregisterPlayer } from "../use-cases/player-status.ts";
import { safeAsync } from "../utils/safe-async.ts";

export const unregisterCommand = {
  data: new SlashCommandBuilder()
    .setName("unregister")
    .setDescription("Desvincula sua conta do LoL do Discord"),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const unregisterUseCase = new UnregisterPlayer();
    const result = await safeAsync(unregisterUseCase.execute(interaction.user.id));
    
    if (!result.success) {
      console.error("Erro no comando /unregister:", result.error);
      return interaction.editReply("❌ Ocorreu um erro ao desvincular sua conta.");
    }

    return interaction.editReply("✅ Todas as suas contas vinculadas foram removidas.");
  }
};
