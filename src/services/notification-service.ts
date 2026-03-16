import type { Client } from "discord.js";
import type { Player } from "../database/db.ts";
import { safeAsync } from "../utils/safe-async.ts";

export class NotificationService {
  constructor(private client: Client) {}

  async sendGameInvite(player: Player, teamLabel: string, gameId: number, inviteUrl: string): Promise<void> {
    const userResult = await safeAsync(this.client.users.fetch(player.discordId));
    
    if (!userResult.success) {
      console.warn(`⚠️ Não foi possível encontrar usuário ${player.discordId} para enviar DM.`);
      return;
    }
    
    const user = userResult.data;
    const dmResult = await safeAsync(user.send(
      `🎮 **Sua partida começou!**\n\n` +
      `🛡️ Time **${teamLabel}** | Partida \`${gameId}\`\n\n` +
      `📋 Copie o link abaixo e envie no chat do time para chamar seus aliados:\n` +
      `${inviteUrl}`
    ));

    if (dmResult.success) {
      console.log(`📨 DM enviada para ${player.gameName} (${player.discordId})`);
    } else {
      console.warn(`⚠️ Não foi possível enviar DM para ${player.gameName}. DMs desabilitadas?`);
    }
  }
}
