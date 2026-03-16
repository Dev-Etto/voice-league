import { getPlayersByDiscordId, deletePlayersByDiscordId, type Player } from "../database/db.ts";
import { safeRun } from "../utils/safe-run.ts";

export class GetPlayerStatus {
  async execute(discordId: string): Promise<Player[]> {
    const result = safeRun(() => getPlayersByDiscordId(discordId));
    if (!result.success) {
      throw result.error;
    }
    return result.data;
  }
}

export class UnregisterPlayer {
  async execute(discordId: string): Promise<void> {
    const result = safeRun(() => deletePlayersByDiscordId(discordId));
    if (!result.success) {
      throw result.error;
    }
  }
}
