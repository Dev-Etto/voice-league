import { 
  getPlayersByDiscordId, 
  deletePlayersByDiscordId, 
  updateAutoJoinPreference, 
  type Player 
} from "../database/db.ts";
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

export class SetAutoJoinPreference {
  async execute(discordId: string, enabled: boolean): Promise<void> {
    const result = safeRun(() => updateAutoJoinPreference(discordId, enabled));
    if (!result.success) {
      throw result.error;
    }
  }
}
