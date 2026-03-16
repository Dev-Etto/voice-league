import {
  ChannelType,
  PermissionFlagsBits,
  type Client,
  type Guild,
  type GuildMember,
  type VoiceChannel,
} from "discord.js";
import { type Player } from "../database/db.ts";
import { getEnv } from "../utils/env.ts";
import { safeAsync } from "../utils/safe-async.ts";
import { NicknameService } from "./nickname-service.ts";
import { NotificationService } from "./notification-service.ts";

const TEAM_LABELS: Record<number, string> = {
  100: "Azul",
  200: "Vermelho",
};

const POST_GAME_DELAY_MS = 30 * 1000;

interface ManagedChannel {
  gameId: number;
  teamId: number;
  channelId: string;
  inviteUrl: string;
  createdAt: number;
}

export class VoiceChannelManager {
  private readonly managedChannels = new Map<string, ManagedChannel>();

  constructor(
    public readonly client: Client,
    private readonly nicknameService: NicknameService = NicknameService.getInstance(),
    private readonly notificationService: NotificationService = new NotificationService(client)
  ) {}

  async initializeFromGuild(): Promise<void> {
    console.log("🔍 Sincronizando canais de voz existentes...");
    const guild = await this.getGuild();
    if (!guild) return;

    const channelsResult = await safeAsync(guild.channels.fetch());
    if (!channelsResult.success) return;

    const voiceChannels = channelsResult.data.filter(
      (c): c is VoiceChannel => 
        c !== null && 
        c.type === ChannelType.GuildVoice && 
        c.name.startsWith("🔊 Time")
    );

    for (const [, channel] of voiceChannels) {
      this.syncChannel(channel);
    }

    console.log(`✅ ${this.managedChannels.size} canais sincronizados.`);
  }

  private syncChannel(channel: VoiceChannel): void {
    const match = channel.name.match(/Time (Azul|Vermelho) - (\d+)/);
    if (!match) return;

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

  async pruneEmptyChannels(activeGameIds: Set<number>): Promise<void> {
    const guild = await this.getGuild();
    if (!guild) return;

    for (const [key, managed] of this.managedChannels.entries()) {
      if (activeGameIds.has(managed.gameId)) continue;

      const channelResult = await safeAsync(guild.channels.fetch(managed.channelId));
      const channel = channelResult.success ? (channelResult.data as VoiceChannel) : null;
      
      if (!channel || (channel.members.size === 0 && Date.now() - managed.createdAt > 30000)) {
        await this.deleteChannelIfPossible(channel, key);
      }
    }
  }

  private async deleteChannelIfPossible(channel: VoiceChannel | null, key: string): Promise<void> {
    if (channel) {
      await safeAsync(channel.delete("Limpeza de canais órfãos"));
    }
    this.managedChannels.delete(key);
  }

  async createGameChannel(gameId: number, teamId: number, triggerPlayer: Player, championId?: number): Promise<ManagedChannel | null> {
    const channelKey = this.buildChannelKey(gameId, teamId);
    if (this.managedChannels.has(channelKey)) return this.managedChannels.get(channelKey)!;

    const guild = await this.getGuild();
    if (!guild) return null;

    const teamLabel = TEAM_LABELS[teamId] ?? "Desconhecido";
    const channelName = `🔊 Time ${teamLabel} - ${gameId}`;

    const channelResult = await safeAsync(guild.channels.create({
      name: channelName,
      type: ChannelType.GuildVoice,
      permissionOverwrites: [{ id: guild.id, deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect] }],
    }));

    if (!channelResult.success) return null;

    const voiceChannel = channelResult.data as VoiceChannel;
    const invite = await voiceChannel.createInvite({ maxAge: 3600, unique: true });

    const managed: ManagedChannel = {
      gameId,
      teamId,
      channelId: voiceChannel.id,
      inviteUrl: invite.url,
      createdAt: Date.now(),
    };

    this.managedChannels.set(channelKey, managed);
    await this.addPlayerToGameChannel(triggerPlayer, managed, championId);

    return managed;
  }

  async addPlayerToGameChannel(player: Player, managed: ManagedChannel, championId?: number): Promise<void> {
    const guild = await this.getGuild();
    if (!guild) return;

    const channelRes = await safeAsync(guild.channels.fetch(managed.channelId));
    const channel = channelRes.success ? (channelRes.data as VoiceChannel) : null;
    if (!channel) return;

    const memberRes = await safeAsync(guild.members.fetch(player.discordId));
    const member = memberRes.success ? memberRes.data : null;
    if (!member) return;

    await safeAsync(channel.permissionOverwrites.create(member.id, {
      ViewChannel: true, Connect: true, Speak: true, SendMessages: true, Stream: true, UseEmbeddedActivities: true,
    }));

    if (championId) {
      await this.nicknameService.updateWithChampion(member, player, championId);
    }

    await this.notificationService.sendGameInvite(player, TEAM_LABELS[managed.teamId], managed.gameId, managed.inviteUrl);
    
    if (player.autoJoin && member.voice.channelId && member.voice.channelId !== channel.id) {
      await safeAsync(member.voice.setChannel(channel, "Auto-Join VoiceLeague"));
    }

    await this.setupEnemyVisibility(guild, member, managed);
  }

  private async setupEnemyVisibility(guild: Guild, member: GuildMember, managed: ManagedChannel): Promise<void> {
    const enemyTeamId = managed.teamId === 100 ? 200 : 100;
    const enemyManaged = this.managedChannels.get(this.buildChannelKey(managed.gameId, enemyTeamId));

    if (enemyManaged) {
      const enemyChannelRes = await safeAsync(guild.channels.fetch(enemyManaged.channelId));
      if (enemyChannelRes.success) {
        await safeAsync((enemyChannelRes.data as VoiceChannel).permissionOverwrites.create(member.id, {
          ViewChannel: true, Connect: false,
        }));
      }
    }
  }

  async notifyPlayer(player: Player, gameId: number, teamId: number, championId?: number): Promise<void> {
    const managed = this.managedChannels.get(this.buildChannelKey(gameId, teamId));
    if (managed) await this.addPlayerToGameChannel(player, managed, championId);
  }

  async scheduleChannelDeletion(gameId: number, playersToRestore: Player[]): Promise<void> {
    const channels = [...this.managedChannels.entries()].filter(([, m]) => m.gameId === gameId);
    if (channels.length === 0) return;

    setTimeout(async () => {
      const guild = await this.getGuild();
      if (!guild) return;

      for (const player of playersToRestore) {
        const memberRes = await safeAsync(guild.members.fetch(player.discordId));
        if (memberRes.success) await this.nicknameService.restore(memberRes.data, player.puuid);
      }

      for (const [key, managed] of channels) {
        await this.deleteChannel(managed);
        this.managedChannels.delete(key);
      }
    }, POST_GAME_DELAY_MS);
  }

  private async deleteChannel(managed: ManagedChannel): Promise<void> {
    const guild = await this.getGuild();
    if (!guild) return;

    const channel = guild.channels.cache.get(managed.channelId) as VoiceChannel | undefined;
    if (!channel) return;

    if (channel.members.size > 0) {
      setTimeout(() => this.deleteChannel(managed), 60000);
      return;
    }

    await safeAsync(channel.delete("Partida finalizada - VoiceLeague"));
  }

  hasChannelForGame(gameId: number, teamId: number): boolean {
    return this.managedChannels.has(this.buildChannelKey(gameId, teamId));
  }

  private async getGuild(): Promise<Guild | null> {
    const result = await safeAsync(this.client.guilds.fetch(getEnv().GUILD_ID));
    return result.success ? result.data : null;
  }

  private buildChannelKey(gameId: number, teamId: number): string {
    return `${gameId}-${teamId}`;
  }
}
