import { z } from "zod";
import { getEnv } from "../utils/env.ts";
import { RateLimitError, RiotApiError } from "../utils/errors.ts";
import { httpClient } from "../utils/http-client.ts";
import { safeRun } from "../utils/safe-run.ts";

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
      puuid: z.string().nullable(),
      teamId: z.number(),
      summonerId: z.string().optional(),
      championId: z.number(),
    })
  ),
});

export type RiotAccount = z.infer<typeof AccountSchema>;
export type ActiveGame = z.infer<typeof SpectatorSchema>;

const BASE_URL_ACCOUNT = "https://americas.api.riotgames.com";
const BASE_URL_SPECTATOR = "https://br1.api.riotgames.com";

/**
 * Realiza uma requisição segura à API da Riot, tratando erros específicos e validando o schema.
 */
async function request<T>(url: string, schema: z.ZodSchema<T>): Promise<T | null> {
  const apiKey = getEnv().RIOT_API_KEY;

  const httpResult = await httpClient<unknown>(url, {
    headers: { "X-Riot-Token": apiKey },
  });

  if (!httpResult.success) {
    const { response } = httpResult;

    if (response?.status === 404) return null;

    if (response?.status === 429) {
      const retryAfter = Number(response.headers.get("Retry-After") ?? 10);
      throw new RateLimitError(retryAfter);
    }

    if (response?.status === 401) {
      throw new RiotApiError(
        "A Chave da API da Riot (RIOT_API_KEY) expirou ou é inválida. Gere uma nova em developer.riotgames.com",
        401
      );
    }

    throw new RiotApiError(
      `Riot API respondeu com erro: ${httpResult.error?.message}`,
      response?.status ?? 500
    );
  }

  const parseResult = safeRun(() => schema.parse(httpResult.data));

  if (!parseResult.success) {
    throw new RiotApiError(
      `Schema inválido da Riot: ${parseResult.error.message}`,
      httpResult.response.status
    );
  }

  return parseResult.data;
}

const gameCache = new Map<string, { data: ActiveGame | null; timestamp: number }>();
const CACHE_TTL_MS = 25000; // 25 segundos (um pouco menos que o poll padrão)

export async function getAccountByRiotId(gameName: string, tagLine: string): Promise<RiotAccount | null> {
  const url = `${BASE_URL_ACCOUNT}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
  return request(url, AccountSchema);
}

export async function getActiveGameByPuuid(puuid: string): Promise<ActiveGame | null> {
  const now = Date.now();
  const cached = gameCache.get(puuid);

  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const url = `${BASE_URL_SPECTATOR}/lol/spectator/v5/active-games/by-summoner/${puuid}`;
  const data = await request(url, SpectatorSchema);

  gameCache.set(puuid, { data, timestamp: now });
  return data;
}

/**
 * Limpa o cache de partidas (útil para testes).
 */
export function clearRiotCache(): void {
  gameCache.clear();
}


