import { upsertPlayer } from "../database/db.ts";
import { getAccountByRiotId } from "../services/riot.ts";
import { ValidationError } from "../utils/errors.ts";
import { safeAsync } from "../utils/safe-async.ts";

export interface RegisterPlayerResult {
  gameName: string;
  tagLine: string;
}

export class RegisterPlayer {
  async execute(discordId: string, riotId: string): Promise<RegisterPlayerResult> {
    if (!riotId.includes("#")) {
      throw new ValidationError("Formato de Riot ID inválido. Use Nome#Tag.");
    }

    const [name, tag] = riotId.split("#");
    const accountResult = await safeAsync(getAccountByRiotId(name, tag));

    if (!accountResult.success) {
      throw accountResult.error;
    }

    const account = accountResult.data;
    if (!account) {
      throw new ValidationError("Conta não encontrada na Riot Games.");
    }

    await upsertPlayer(discordId, account.puuid, account.gameName, account.tagLine);

    return {
      gameName: account.gameName,
      tagLine: account.tagLine
    };
  }
}
