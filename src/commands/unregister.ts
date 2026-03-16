import { SlashCommandBuilder, MessageFlags, type ChatInputCommandInteraction } from "discord.js";
import { UnregisterPlayer } from "../use-cases/player-status.ts";
import { safeAsync } from "../utils/safe-async.ts";
import type { DiscordCommand } from "../types/command.ts";
import type { WatchdogEngine } from "../engine/watchdog.ts";

export const unregisterCommand: DiscordCommand = {
  data: new SlashCommandBuilder()
    .setName("unregister")
    .setDescription("Desvincula sua conta do LoL do Discord"),

  async execute(interaction: ChatInputCommandInteraction, _watchdog: WatchdogEngine) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const unregisterUseCase = new UnregisterPlayer();
    const result = await safeAsync(unregisterUseCase.execute(interaction.user.id));
    
    if (!result.success) {
      console.error("Erro no comando /unregister:", result.error);
      return interaction.editReply("❌ Ocorreu um erro ao desvincular sua conta.");
    }

    return interaction.editReply("✅ Todas as suas contas vinculadas foram removidas.");
  }
};
