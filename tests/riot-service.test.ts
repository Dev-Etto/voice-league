import { describe, expect, it, beforeEach, spyOn } from "bun:test";
import { getAccountByRiotId, getActiveGameByPuuid, clearRiotCache } from "../src/services/riot.ts";
import { RateLimitError, RiotApiError } from "../src/utils/errors.ts";
import * as httpClient from "../src/utils/http-client.ts";

describe("RiotService (Integration Coverage)", () => {
  const httpSpy = spyOn(httpClient, "httpClient");

  beforeEach(() => {
    httpSpy.mockReset();
    clearRiotCache();
  });

  it("deve lidar com 404 (jogador não encontrado)", async () => {
    httpSpy.mockResolvedValue({
      success: false,
      response: { status: 404 } as any,
      data: null,
      error: new Error("Not Found")
    });

    const result = await getAccountByRiotId("Unknown", "No");
    expect(result).toBeNull();
  });

  it("deve lidar com 429 (Rate Limit)", async () => {
    httpSpy.mockResolvedValue({
      success: false,
      response: { 
        status: 429,
        headers: new Map([["Retry-After", "30"]])
      } as any,
      data: null,
      error: new Error("Rate Limit")
    });

    expect(getAccountByRiotId("Faker", "KR1")).rejects.toThrow(RateLimitError);
  });

  it("deve lidar com 401 (API Key inválida)", async () => {
    httpSpy.mockResolvedValue({
      success: false,
      response: { status: 401 } as any,
      data: null,
      error: new Error("Unauthorized")
    });

    expect(getAccountByRiotId("Faker", "KR1")).rejects.toThrow(RiotApiError);
  });

  it("deve lidar com falha de schema (safeRun falhou)", async () => {
    httpSpy.mockResolvedValue({
      success: true,
      response: { status: 200 } as any,
      data: { invalid: "data" }
    });

    expect(getAccountByRiotId("Faker", "KR1")).rejects.toThrow(/Schema inválido/);
  });

  it("deve retornar dados de jogo ativo com sucesso", async () => {
    httpSpy.mockResolvedValue({
      success: true,
      response: { status: 200 } as any,
      data: {
        gameId: 123,
        gameStartTime: Date.now(),
        platformId: "BR1",
        gameMode: "CLASSIC",
        gameType: "MATCHED_GAME",
        participants: [{ puuid: "p1", teamId: 100, championId: 1 }]
      }
    });

    const result = await getActiveGameByPuuid("p1");
    expect(result?.gameId).toBe(123);
  });

  it("deve retornar dados do cache na segunda chamada", async () => {
    httpSpy.mockResolvedValue({
      success: true,
      data: {
        gameId: 999,
        gameStartTime: Date.now(),
        platformId: "BR1",
        gameMode: "CLASSIC",
        gameType: "MATCHED_GAME",
        participants: [],
      },
      response: { status: 200, headers: new Map() } as any,
    });

    // Primeira chamada - deve ir para o network
    const first = await getActiveGameByPuuid("p-cache");
    // Segunda chamada - deve vir do cache
    const second = await getActiveGameByPuuid("p-cache");

    expect(first?.gameId).toBe(999);
    expect(second?.gameId).toBe(999);
    expect(httpSpy).toHaveBeenCalledTimes(1); // Somente 1 chamada de rede
  });
});
