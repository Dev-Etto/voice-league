import type { GuildMember } from "discord.js";
import { saveOriginalNickname, clearOriginalNickname, getPlayerByPuuid, type Player } from "../database/db.ts";
import { DataDragonService } from "./data-dragon.ts";
import { safeAsync } from "../utils/safe-async.ts";

export class NicknameService {
  private static instance: NicknameService;

  private constructor() {}

  public static getInstance(): NicknameService {
    if (!NicknameService.instance) {
      NicknameService.instance = new NicknameService();
    }
    return NicknameService.instance;
  }

  async updateWithChampion(member: GuildMember, player: Player, championId: number): Promise<void> {
    const championName = await DataDragonService.getInstance().getChampionName(championId);
    const originalNick = member.nickname || member.user.username;
    const newNickname = `${originalNick} (${championName})`.substring(0, 32);

    saveOriginalNickname(player.puuid, member.nickname || "@@USERNAME@@");

    const result = await safeAsync(member.setNickname(newNickname, "Identificação de campeão na partida"));
    
    if (result.success) {
      console.log(`🏷️ Nickname atualizado: ${originalNick} -> ${newNickname}`);
    } else {
      console.warn(`⚠️ Não foi possível alterar o nickname de ${player.gameName} (Hierarquia ou Permissão).`);
    }
  }

  async restore(member: GuildMember, puuid: string): Promise<void> {
    const player = getPlayerByPuuid(puuid);
    if (!player || player.originalNickname === null) return;

    const nickToRestore = player.originalNickname === "@@USERNAME@@" ? null : player.originalNickname;
    
    const result = await safeAsync(member.setNickname(nickToRestore, "Restauração pós-partida"));
    
    if (result.success) {
      console.log(`✅ Nickname restaurado para ${player.gameName}`);
      clearOriginalNickname(puuid);
    } else {
      console.warn(`⚠️ Falha ao restaurar nickname de ${player.gameName}`);
    }
  }
}
