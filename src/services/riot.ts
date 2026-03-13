import { z } from "zod";
import { getEnv } from "../utils/env.ts";
import { RateLimitError, RiotApiError } from "../utils/errors.ts";

const AccountSchema = z.object({
  puuid: z.string(),
  gameName: z.string(),
  tagLine: z.string(),
});

const SpectatorSchema = z.object({
  gameId: z.number(),
  gameStartTime: z.number(),
  platformId: z.string(),
  gameMode: z.string(),
  gameType: z.string(),
  participants: z.array(
    z.object({
      puuid: z.string(),
      teamId: z.number(),
      summonerId: z.string(),
    })
  ),
});

export type RiotAccount = z.infer<typeof AccountSchema>;
export type ActiveGame = z.infer<typeof SpectatorSchema>;

export class RiotService {
  private readonly apiKey: string;
  private readonly baseUrlAccount = "https://americas.api.riotgames.com";
  private readonly baseUrlSpectator = "https://br1.api.riotgames.com";

  constructor() {
    this.apiKey = getEnv().RIOT_API_KEY;
  }

  private async request<T>(url: string, schema: z.ZodSchema<T>): Promise<T | null> {
    const response = await fetch(url, {
      headers: { "X-Riot-Token": this.apiKey },
    });

    if (response.status === 404) return null;

    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("Retry-After") ?? 10);
      throw new RateLimitError(retryAfter);
    }

    if (!response.ok) {
      throw new RiotApiError(
        `Riot API respondeu com status ${response.status}`,
        response.status
      );
    }

    const data = await response.json();

    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      throw new RiotApiError(
        `Schema inválido da Riot: ${parsed.error.message}`,
        response.status
      );
    }

    return parsed.data;
  }

  async getAccountByRiotId(gameName: string, tagLine: string): Promise<RiotAccount | null> {
    const url = `${this.baseUrlAccount}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
    return this.request(url, AccountSchema);
  }

  async getActiveGameByPuuid(puuid: string): Promise<ActiveGame | null> {
    const url = `${this.baseUrlSpectator}/lol/spectator/v5/active-games/by-summoner/${puuid}`;
    return this.request(url, SpectatorSchema);
  }
}

export const riotService = new RiotService();
