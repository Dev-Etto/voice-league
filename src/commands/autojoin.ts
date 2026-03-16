import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { SetAutoJoinPreference } from "../use-cases/player-status.ts";

export const autoJoinCommand = {
  data: new SlashCommandBuilder()
    .setName("autojoin")
    .setDescription("Habilita ou desabilita a entrada automática na sala da partida")
    .addBooleanOption(option =>
      option.setName("enabled")
        .setDescription("Ligar ou desligar o auto-join")
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const enabled = interaction.options.getBoolean("enabled", true);
    await interaction.deferReply({ ephemeral: true });

    try {
      const setAutoJoinUseCase = new SetAutoJoinPreference();
      await setAutoJoinUseCase.execute(interaction.user.id, enabled);
      
      const status = enabled ? "ativado" : "desativado";
      return interaction.editReply(`✅ Auto-join **${status}** com sucesso.`);
    } catch (error) {
      console.error("Erro no comando /autojoin:", error);
      return interaction.editReply("❌ Ocorreu um erro ao atualizar sua preferência.");
    }
  }
};
