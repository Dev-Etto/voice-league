import { SlashCommandBuilder, EmbedBuilder, MessageFlags, type ChatInputCommandInteraction } from "discord.js";
import { GetPlayerStatus } from "../use-cases/player-status.ts";
import { safeAsync } from "../utils/safe-async.ts";
import type { DiscordCommand } from "../types/command.ts";
import type { WatchdogEngine } from "../engine/watchdog.ts";

export const statusCommand: DiscordCommand = {
  data: new SlashCommandBuilder()
    .setName("status")
    .setDescription("Mostra suas contas vinculadas e status de monitoramento"),

  async execute(interaction: ChatInputCommandInteraction, _watchdog: WatchdogEngine) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const getStatusUseCase = new GetPlayerStatus();
    const result = await safeAsync(getStatusUseCase.execute(interaction.user.id));

    if (!result.success) {
      console.error("Erro no comando /status:", result.error);
      return interaction.editReply("❌ Ocorreu um erro ao buscar suas informações.");
    }

    const playersList = result.data;

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
  }
};
