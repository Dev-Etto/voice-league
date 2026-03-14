import {
  ChannelType,
  PermissionFlagsBits,
  type Client,
  type Guild,
  type VoiceChannel,
} from "discord.js";
import type { Player } from "../database/db.ts";
import { getEnv } from "../utils/env.ts";

const TEAM_LABELS: Record<number, string> = {
  100: "Azul",
  200: "Vermelho",
};

const POST_GAME_DELAY_MS = 2 * 60 * 1000;

interface ManagedChannel {
  gameId: number;
  teamId: number;
  channelId: string;
  inviteUrl: string;
  createdAt: number;
}

export class VoiceChannelManager {
  public readonly client: Client;
  private readonly managedChannels = new Map<string, ManagedChannel>();

  constructor(client: Client) {
    this.client = client;
  }

  /**
   * Reconstrói o estado interno a partir dos canais existentes no Discord.
   * Útil para manter o controle após um reinício do bot.
   */
  async initializeFromGuild(): Promise<void> {
    console.log("🔍 Sincronizando canais de voz existentes...");
    const guild = await this.getGuild();
    if (!guild) return;

    try {
      const channels = await guild.channels.fetch();
      const voiceChannels = channels.filter(
        (c): c is VoiceChannel => 
          c !== null && 
          c.type === ChannelType.GuildVoice && 
          c.name.startsWith("🔊 Time")
      );

      for (const [, channel] of voiceChannels) {
        const match = channel.name.match(/Time (Azul|Vermelho) - (\d+)/);
        if (!match) continue;

        const [, teamLabel, gameIdStr] = match;
        const gameId = Number(gameIdStr);
        const teamId = teamLabel === "Azul" ? 100 : 200;
        const channelKey = this.buildChannelKey(gameId, teamId);

        if (!this.managedChannels.has(channelKey)) {
          this.managedChannels.set(channelKey, {
            gameId,
            teamId,
            channelId: channel.id,
            inviteUrl: "Recuperado - Link indisponível",
            createdAt: channel.createdTimestamp,
          });
        }
      }

      console.log(`✅ ${this.managedChannels.size} canais sincronizados.`);
    } catch (error) {
      console.error("Erro ao sincronizar canais:", error);
    }
  }

  /**
   * Remove canais que não têm membros e que não estão mais sendo rastreados como ativos.
   */
  async pruneEmptyChannels(activeGameIds: Set<number>): Promise<void> {
    const guild = await this.getGuild();
    if (!guild) return;

    for (const [key, managed] of this.managedChannels.entries()) {
      if (activeGameIds.has(managed.gameId)) continue;

      try {
        const channel = await guild.channels.fetch(managed.channelId).catch(() => null) as VoiceChannel | null;
        
        if (!channel) {
          this.managedChannels.delete(key);
          continue;
        }

        if (channel.members.size === 0) {
          const ageMs = Date.now() - managed.createdAt;
          if (ageMs < 5 * 60 * 1000) continue;

          await channel.delete("Limpeza de canais órfãos");
          this.managedChannels.delete(key);
          console.log(`🧹 Canal órfão deletado: ${channel.name}`);
        }
      } catch (error) {
        console.error(`Erro ao limpar canal ${managed.channelId}:`, error);
      }
    }
  }

  async createGameChannel(
    gameId: number,
    teamId: number,
    triggerPlayer: Player
  ): Promise<ManagedChannel | null> {
    const channelKey = this.buildChannelKey(gameId, teamId);

    if (this.managedChannels.has(channelKey)) {
      return this.managedChannels.get(channelKey) ?? null;
    }

    const guild = await this.getGuild();
    if (!guild) return null;

    try {
      const teamLabel = TEAM_LABELS[teamId] ?? "Desconhecido";
      const channelName = `🔊 Time ${teamLabel} - ${gameId}`;

      // Segurança: Verifica se já existe um canal com esse nome no Discord
      const existingChannel = guild.channels.cache.find(c => c.name === channelName) as VoiceChannel | undefined;
      if (existingChannel) {
        const managed: ManagedChannel = {
          gameId,
          teamId,
          channelId: existingChannel.id,
          inviteUrl: "Reutilizado - Link indisponível",
          createdAt: existingChannel.createdTimestamp,
        };
        this.managedChannels.set(channelKey, managed);
        return managed;
      }

      const voiceChannel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildVoice,
        permissionOverwrites: [
          {
            id: guild.id,
            allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak],
          },
        ],
      });

      const invite = await voiceChannel.createInvite({
        maxAge: 3600,
        unique: true,
      });

      const managed: ManagedChannel = {
        gameId,
        teamId,
        channelId: voiceChannel.id,
        inviteUrl: invite.url,
        createdAt: Date.now(),
      };

      this.managedChannels.set(channelKey, managed);
      console.log(`🔊 Canal criado: ${channelName} | Convite: ${invite.url}`);

      await this.sendInviteDM(triggerPlayer, managed);

      return managed;
    } catch (error) {
      console.error(`Erro ao criar canal para partida ${gameId}:`, error);
      return null;
    }
  }

  async notifyPlayer(player: Player, gameId: number, teamId: number): Promise<void> {
    const channelKey = this.buildChannelKey(gameId, teamId);
    const managed = this.managedChannels.get(channelKey);

    if (!managed) return;

    await this.sendInviteDM(player, managed);
  }

  async scheduleChannelDeletion(gameId: number): Promise<void> {
    const channelsToDelete = [...this.managedChannels.entries()]
      .filter(([, managed]) => managed.gameId === gameId);

    if (channelsToDelete.length === 0) return;

    console.log(`⏳ Partida ${gameId} finalizada. Deletando canais em ${POST_GAME_DELAY_MS / 1000}s...`);

    setTimeout(async () => {
      for (const [key, managed] of channelsToDelete) {
        await this.deleteChannel(managed);
        this.managedChannels.delete(key);
      }
    }, POST_GAME_DELAY_MS);
  }

  hasChannelForGame(gameId: number, teamId: number): boolean {
    return this.managedChannels.has(this.buildChannelKey(gameId, teamId));
  }

  private async deleteChannel(managed: ManagedChannel): Promise<void> {
    try {
      const guild = await this.getGuild();
      if (!guild) return;

      const channel = guild.channels.cache.get(managed.channelId) as VoiceChannel | undefined;

      if (!channel) {
        console.warn(`⚠️ Canal ${managed.channelId} já foi deletado ou não existe.`);
        return;
      }

      if (channel.members.size > 0) {
        console.log(`👥 Canal ${channel.name} ainda tem ${channel.members.size} membro(s). Aguardando mais 60s...`);
        setTimeout(() => this.deleteChannel(managed), 60_000);
        return;
      }

      await channel.delete("Partida finalizada - VoiceLeague");
      console.log(`🗑️ Canal deletado: ${channel.name}`);
    } catch (error) {
      console.error(`Erro ao deletar canal ${managed.channelId}:`, error);
    }
  }

  private async sendInviteDM(player: Player, managed: ManagedChannel): Promise<void> {
    try {
      const user = await this.client.users.fetch(player.discordId);
      const teamLabel = TEAM_LABELS[managed.teamId] ?? "Desconhecido";

      await user.send(
        `🎮 **Sua partida começou!**\n\n` +
        `🛡️ Time **${teamLabel}** | Partida \`${managed.gameId}\`\n\n` +
        `📋 Copie o link abaixo e envie no chat do time para chamar seus aliados:\n` +
        `${managed.inviteUrl}`
      );

      console.log(`📨 DM enviada para ${player.gameName} (${player.discordId})`);
    } catch {
      console.warn(`⚠️ Não foi possível enviar DM para ${player.gameName}. DMs desabilitadas?`);
    }
  }

  private async getGuild(): Promise<Guild | null> {
    try {
      return await this.client.guilds.fetch(getEnv().GUILD_ID);
    } catch (error) {
      console.error("Erro ao buscar guild:", error);
      return null;
    }
  }

  private buildChannelKey(gameId: number, teamId: number): string {
    return `${gameId}-${teamId}`;
  }
}
