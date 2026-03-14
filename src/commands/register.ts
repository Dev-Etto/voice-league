import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { upsertPlayer } from "../database/db.ts";
import { getAccountByRiotId } from "../services/riot.ts";
import { RateLimitError } from "../utils/errors.ts";
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

    const [name, tag] = riotIdParam.split("#");
    const result = await safeAsync(getAccountByRiotId(name, tag));

    if (!result.success) {
      const { error } = result;
      
      if (error instanceof RateLimitError) {
        return interaction.editReply("⏳ A API da Riot está sobrecarregada. Tente novamente em alguns segundos.");
      }

      console.error("Erro no comando /register:", error);
      return interaction.editReply("❌ Ocorreu um erro interno ao tentar registrar sua conta.");
    }

    const account = result.data;

    if (!account) {
      return interaction.editReply("❌ Conta não encontrada na Riot Games. Verifique o nome e a tag.");
    }

    upsertPlayer(interaction.user.id, account.puuid, account.gameName, account.tagLine);

    return interaction.editReply(`✅ Conta **${account.gameName}#${account.tagLine}** vinculada com sucesso!`);
  }
};

