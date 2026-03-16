import { SlashCommandBuilder, EmbedBuilder, type ChatInputCommandInteraction } from "discord.js";
import { GetPlayerStatus } from "../use-cases/player-status.ts";

export const statusCommand = {
  data: new SlashCommandBuilder()
    .setName("status")
    .setDescription("Mostra suas contas vinculadas e status de monitoramento"),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const getStatusUseCase = new GetPlayerStatus();
      const playersList = await getStatusUseCase.execute(interaction.user.id);

      if (playersList.length === 0) {
        return interaction.editReply(
          "⚠️ Você não possui nenhuma conta vinculada. Use `/register` para começar."
        );
      }

      const embed = new EmbedBuilder()
        .setTitle("🛡️ VoiceLeague - Suas Contas")
        .setColor(0x5865F2)
        .setTimestamp();

      for (const player of playersList) {
        const isInGame = player.lastGameId !== null;
        const statusIcon = isInGame ? "🟢 Em partida" : "⚪ Fora de partida";
        const activeIcon = player.isActive ? "✅ Monitorando" : "⏸️ Pausado";

        embed.addFields({
          name: `${player.gameName}#${player.tagLine}`,
          value: `${statusIcon} | ${activeIcon}`,
          inline: false,
        });
      }

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Erro no comando /status:", error);
      return interaction.editReply("❌ Ocorreu um erro ao buscar suas informações.");
    }
  }
};

