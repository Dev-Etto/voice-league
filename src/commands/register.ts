import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { RegisterPlayer } from "../use-cases/register-player.ts";
import { RateLimitError, ValidationError } from "../utils/errors.ts";
import { safeAsync } from "../utils/safe-async.ts";

export const registerCommand = {
  data: new SlashCommandBuilder()
    .setName("register")
    .setDescription("Vincula sua conta do LoL ao Discord")
    .addStringOption(option =>
      option.setName("riotid")
        .setDescription("Seu Riot ID (Ex: Player#BR1)")
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const riotIdParam = interaction.options.getString("riotid", true);

    if (!riotIdParam.includes("#")) {
      return interaction.reply({
        content: "❌ Formato inválido. Use Nome#Tag (Ex: Faker#KR1).",
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const registerUseCase = new RegisterPlayer();
    const result = await safeAsync(registerUseCase.execute(interaction.user.id, riotIdParam));

    if (!result.success) {
      const error = result.error;
      
      if (error instanceof RateLimitError) {
        return interaction.editReply("⏳ A API da Riot está sobrecarregada. Tente novamente em alguns segundos.");
      }

      if (error instanceof ValidationError) {
        return interaction.editReply(`⚠️ ${error.message}`);
      }

      console.error("Erro no comando /register:", error);
      return interaction.editReply("❌ Ocorreu um erro interno ao tentar registrar sua conta.");
    }

    const player = result.data;
    return interaction.editReply(`✅ Conta **${player.gameName}#${player.tagLine}** vinculada com sucesso!`);
  }
};
