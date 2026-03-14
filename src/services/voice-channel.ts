import {
  ChannelType,
  PermissionFlagsBits,
  type Client,
  type Guild,
  type GuildMember,
  type VoiceChannel,
} from "discord.js";
import {
  clearOriginalNickname,
  getActivePlayers,
  getPlayerByPuuid,
  saveOriginalNickname,
  type Player,
} from "../database/db.ts";

import { getEnv } from "../utils/env.ts";
import { safeAsync } from "../utils/safe-async.ts";
import { DataDragonService } from "./data-dragon.ts";


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

/**
 * Gerencia os canais de voz do servidor.
 */
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

    const channelsResult = await safeAsync(guild.channels.fetch());
    
    if (!channelsResult.success) {
      console.error("Erro ao sincronizar canais:", channelsResult.error.message);
      return;
    }

    const voiceChannels = channelsResult.data.filter(
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
  }


  /**
   * Remove canais que não têm membros e que não estão mais sendo rastreados como ativos.
   */
  async pruneEmptyChannels(activeGameIds: Set<number>): Promise<void> {
    const guild = await this.getGuild();
    if (!guild) return;

    for (const [key, managed] of this.managedChannels.entries()) {
      if (activeGameIds.has(managed.gameId)) continue;

      const channelResult = await safeAsync(guild.channels.fetch(managed.channelId));
      const channel = channelResult.success ? (channelResult.data as VoiceChannel) : null;
      
      if (!channel) {
        this.managedChannels.delete(key);
        continue;
      }

      if (channel.members.size === 0) {
        const ageMs = Date.now() - managed.createdAt;
        if (ageMs < 30 * 1000) continue;

        const deleteResult = await safeAsync(channel.delete("Limpeza de canais órfãos"));
        if (deleteResult.success) {
          this.managedChannels.delete(key);
          console.log(`🧹 Canal vazio/órfão deletado: ${channel.name}`);
        } else {
          console.error(`Erro ao limpar canal ${managed.channelId}:`, deleteResult.error.message);
        }
      }
    }
  }


  /**
   * Cria um canal de voz para uma partida e configura as permissões para os jogadores.
   */
  async createGameChannel(
    gameId: number,
    teamId: number,
    triggerPlayer: Player,
    championId?: number
  ): Promise<ManagedChannel | null> {
    const channelKey = this.buildChannelKey(gameId, teamId);

    if (this.managedChannels.has(channelKey)) {
      return this.managedChannels.get(channelKey) ?? null;
    }

    const guild = await this.getGuild();
    if (!guild) return null;

    const teamLabel = TEAM_LABELS[teamId] ?? "Desconhecido";
    const channelName = `🔊 Time ${teamLabel} - ${gameId}`;

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

    const channelResult = await safeAsync(guild.channels.create({
      name: channelName,
      type: ChannelType.GuildVoice,
      permissionOverwrites: [
        {
          id: guild.id,
          deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect],
        },
      ],
    }));

    if (!channelResult.success) {
      console.error(`Erro ao criar canal para partida ${gameId}:`, channelResult.error.message);
      return null;
    }

    const voiceChannel = channelResult.data as VoiceChannel;
    const inviteResult = await safeAsync(voiceChannel.createInvite({
      maxAge: 3600,
      unique: true,
    }));

    if (!inviteResult.success) {
      console.error(`Erro ao criar convite para canal ${voiceChannel.name}:`, inviteResult.error.message);
      return null;
    }

    const managed: ManagedChannel = {
      gameId,
      teamId,
      channelId: voiceChannel.id,
      inviteUrl: inviteResult.data.url,
      createdAt: Date.now(),
    };

    this.managedChannels.set(channelKey, managed);
    console.log(`🔊 Canal criado: ${channelName} | Convite: ${inviteResult.data.url}`);
    console.log(`⏱️ Delay de fechamento ajustado para ${POST_GAME_DELAY_MS / 1000}s para restauração rápida de nicks.`);

    await this.addPlayerToGameChannel(triggerPlayer, managed, championId);

    return managed;
  }


  /**
   * Adiciona um jogador a um canal de partida, configurando permissões específicas.
   * Se for o canal do time do jogador, concede acesso total (voz/chat).
   * Se for o canal do time inimigo, concede apenas visibilidade (sem conexão).
   */
  async addPlayerToGameChannel(player: Player, managed: ManagedChannel, championId?: number): Promise<void> {
    const guild = await this.getGuild();
    if (!guild) return;

    const channelResult = await safeAsync(guild.channels.fetch(managed.channelId));
    const channel = channelResult.success ? (channelResult.data as VoiceChannel) : null;
    if (!channel) return;

    const memberResult = await safeAsync(guild.members.fetch(player.discordId));
    const member = memberResult.success ? memberResult.data : null;
    if (!member) return;
    
    const permResult = await safeAsync(channel.permissionOverwrites.create(member.id, {
      ViewChannel: true,
      Connect: true,
      Speak: true,
      SendMessages: true,
      Stream: true,
      UseEmbeddedActivities: true,
    }));

    if (!permResult.success) {
      console.error(`Erro ao configurar permissões para ${player.gameName}:`, permResult.error.message);
      return;
    }

    if (championId) {
      await this.handleNicknameUpdate(member, player, championId);
    }

    console.log(`🔐 Permissões de TIME concedidas para ${player.gameName} no canal ${channel.name}`);

    await this.sendInviteDM(player, managed);

    const enemyTeamId = managed.teamId === 100 ? 200 : 100;
    const enemyChannelKey = this.buildChannelKey(managed.gameId, enemyTeamId);
    const enemyManaged = this.managedChannels.get(enemyChannelKey);

    if (enemyManaged) {
      const enemyChannelRes = await safeAsync(guild.channels.fetch(enemyManaged.channelId));
      const enemyChannel = enemyChannelRes.success ? (enemyChannelRes.data as VoiceChannel) : null;
      if (enemyChannel) {
        await safeAsync(enemyChannel.permissionOverwrites.create(member.id, {
          ViewChannel: true,
          Connect: false,
        }));
        console.log(`👁️ Visibilidade de INIMIGO concedida para ${player.gameName} no canal ${enemyChannel.name}`);
      }
    }
  }


  /**
   * Atualiza o apelido do jogador para incluir o campeão.
   */
  private async handleNicknameUpdate(member: GuildMember, player: Player, championId: number): Promise<void> {
    const championName = await DataDragonService.getInstance().getChampionName(championId);
    const originalNick = member.nickname || member.user.username;
    const newNickname = `${originalNick} (${championName})`.substring(0, 32);

    // Salva o nickname atual. Se for null (usa username), salva um marcador especial
    saveOriginalNickname(player.puuid, member.nickname || "@@USERNAME@@");

    const nickResult = await safeAsync(member.setNickname(newNickname, "Identificação de campeão na partida"));
    
    if (nickResult.success) {
      console.log(`🏷️ Nickname atualizado: ${originalNick} -> ${newNickname}`);
    } else {
      console.warn(`⚠️ Não foi possível alterar o nickname de ${player.gameName} (Hierarquia ou Permissão).`);
    }
  }



  /**
   * Restaura os nicknames originais de todos os jogadores da partida finalizada.
   */
  /**
   * Restaura os nicknames originais de todos os jogadores da partida finalizada.
   */
  private async restorePlayersNicknames(playersSnapshots: Player[]): Promise<void> {
    const guild = await this.getGuild();
    if (!guild) return;

    for (const snapshot of playersSnapshots) {
      // Busca o estado mais recente do jogador para ter o originalNickname atualizado
      const player = getPlayerByPuuid(snapshot.puuid);
      if (!player) continue;

      if (player.originalNickname !== undefined && player.originalNickname !== null) {

        const memberRes = await safeAsync(guild.members.fetch(player.discordId));
        const member = memberRes.success ? memberRes.data : null;
        
        if (member) {
          // Se o marcador especial for encontrado, restaura para null (username)
          const nickToRestore = player.originalNickname === "@@USERNAME@@" ? null : player.originalNickname;
          
          const restoreResult = await safeAsync(member.setNickname(nickToRestore, "Restauração pós-partida"));
          if (restoreResult.success) {
            console.log(`✅ Nickname restaurado para ${player.gameName}`);
          } else {
            console.warn(`⚠️ Falha ao restaurar nickname de ${player.gameName}`);
          }
        }
        clearOriginalNickname(player.puuid);
      }
    }
  }


  /**
   * Notifica um jogador sobre a partida e adiciona ele ao canal de voz.
   */

  async notifyPlayer(player: Player, gameId: number, teamId: number, championId?: number): Promise<void> {
    const channelKey = this.buildChannelKey(gameId, teamId);
    const managed = this.managedChannels.get(channelKey);

    if (!managed) return;

    await this.addPlayerToGameChannel(player, managed, championId);
  }

  /**
   * Agenda a deleção dos canais de uma partida após um delay de 5 minutos.
   */
  /**
   * Agenda a deleção dos canais de uma partida após um delay.
   */
  async scheduleChannelDeletion(gameId: number, playersToRestore: Player[]): Promise<void> {
    const channelsToDelete = [...this.managedChannels.entries()]
      .filter(([, managed]) => managed.gameId === gameId);

    if (channelsToDelete.length === 0) return;

    console.log(`⏳ Partida ${gameId} finalizada. Deletando canais e restaurando nicks em ${POST_GAME_DELAY_MS / 1000}s...`);

    setTimeout(async () => {
      await this.restorePlayersNicknames(playersToRestore);
      
      for (const [key, managed] of channelsToDelete) {
        await this.deleteChannel(managed);
        this.managedChannels.delete(key);
      }
    }, POST_GAME_DELAY_MS);
  }



  /**
   * Verifica se existe um canal para a partida.
   */
  hasChannelForGame(gameId: number, teamId: number): boolean {
    return this.managedChannels.has(this.buildChannelKey(gameId, teamId));
  }

  /**
   * Deleta um canal de voz.
   */
  private async deleteChannel(managed: ManagedChannel): Promise<void> {
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

    const deleteResult = await safeAsync(channel.delete("Partida finalizada - VoiceLeague"));
    if (deleteResult.success) {
      console.log(`🗑️ Canal deletado: ${channel.name}`);
    } else {
      console.error(`Erro ao deletar canal ${managed.channelId}:`, deleteResult.error.message);
    }
  }


  /**
   * Envia um convite para o jogador.
   */
  private async sendInviteDM(player: Player, managed: ManagedChannel): Promise<void> {
    const userResult = await safeAsync(this.client.users.fetch(player.discordId));
    if (!userResult.success) {
      console.warn(`⚠️ Não foi possível encontrar usuário ${player.discordId} para enviar DM.`);
      return;
    }
    
    const user = userResult.data;
    const teamLabel = TEAM_LABELS[managed.teamId] ?? "Desconhecido";

    const dmResult = await safeAsync(user.send(
      `🎮 **Sua partida começou!**\n\n` +
      `🛡️ Time **${teamLabel}** | Partida \`${managed.gameId}\`\n\n` +
      `📋 Copie o link abaixo e envie no chat do time para chamar seus aliados:\n` +
      `${managed.inviteUrl}`
    ));

    if (dmResult.success) {
      console.log(`📨 DM enviada para ${player.gameName} (${player.discordId})`);
    } else {
      console.warn(`⚠️ Não foi possível enviar DM para ${player.gameName}. DMs desabilitadas?`);
    }
  }


  /**
   * Busca a guild no Discord.
   */
  private async getGuild(): Promise<Guild | null> {
    const result = await safeAsync(this.client.guilds.fetch(getEnv().GUILD_ID));
    
    if (result.success) {
      return result.data;
    }

    console.error("Erro ao buscar guild:", result.error.message);
    return null;
  }


  /**
   * Constrói a chave do canal.
   */
  private buildChannelKey(gameId: number, teamId: number): string {
    return `${gameId}-${teamId}`;
  }
}
