import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { deletePlayersByDiscordId } from "../database/db.ts";
import { safeRun } from "../utils/safe-run.ts";


export const unregisterCommand = {
  data: new SlashCommandBuilder()
    .setName("unregister")
    .setDescription("Desvincula sua conta do LoL do Discord"),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const result = safeRun(() => deletePlayersByDiscordId(interaction.user.id));

    if (result.success) {
      return interaction.editReply("✅ Todas as suas contas vinculadas foram removidas.");
    }

    console.error("Erro no comando /unregister:", result.error.message);
    return interaction.editReply("❌ Ocorreu um erro ao desvincular sua conta.");
  }
};

