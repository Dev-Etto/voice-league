import { SlashCommandBuilder, MessageFlags, type ChatInputCommandInteraction } from "discord.js";
import { SetAutoJoinPreference } from "../use-cases/player-status.ts";
import { safeAsync } from "../utils/safe-async.ts";
import type { DiscordCommand } from "../types/command.ts";
import type { WatchdogEngine } from "../engine/watchdog.ts";

export const autoJoinCommand: DiscordCommand = {
  data: new SlashCommandBuilder()
    .setName("autojoin")
    .setDescription("Habilita ou desabilita a entrada automática na sala da partida")
    .addBooleanOption(option =>
      option.setName("enabled")
        .setDescription("Ligar ou desligar o auto-join")
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction, _watchdog: WatchdogEngine) {
    const enabled = interaction.options.getBoolean("enabled", true);
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const setAutoJoinUseCase = new SetAutoJoinPreference();
    const result = await safeAsync(setAutoJoinUseCase.execute(interaction.user.id, enabled));
    
    if (!result.success) {
      console.error("Erro no comando /autojoin:", result.error);
      return interaction.editReply("❌ Ocorreu um erro ao atualizar sua preferência.");
    }

    const status = enabled ? "ativado" : "desativado";
    return interaction.editReply(`✅ Auto-join **${status}** com sucesso.`);
  }
};
