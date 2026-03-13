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

const BASE_URL_ACCOUNT = "https://americas.api.riotgames.com";
const BASE_URL_SPECTATOR = "https://br1.api.riotgames.com";

async function request<T>(url: string, schema: z.ZodSchema<T>): Promise<T | null> {
  const apiKey = getEnv().RIOT_API_KEY;

  const response = await fetch(url, {
    headers: { "X-Riot-Token": apiKey },
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

export async function getAccountByRiotId(gameName: string, tagLine: string): Promise<RiotAccount | null> {
  const url = `${BASE_URL_ACCOUNT}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
  return request(url, AccountSchema);
}

export async function getActiveGameByPuuid(puuid: string): Promise<ActiveGame | null> {
  const url = `${BASE_URL_SPECTATOR}/lol/spectator/v5/active-games/by-summoner/${puuid}`;
  return request(url, SpectatorSchema);
}
