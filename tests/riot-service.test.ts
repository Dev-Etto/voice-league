import { describe, expect, it, spyOn, afterAll } from "bun:test";
import { getAccountByRiotId, getActiveGameByPuuid } from "../src/services/riot.ts";
import { RateLimitError, RiotApiError } from "../src/utils/errors.ts";
import * as httpClientModule from "../src/utils/http-client.ts";

describe("RiotService (Integration Coverage)", () => {
  const httpSpy = spyOn(httpClientModule, "httpClient");

  afterAll(() => {
    httpSpy.mockRestore();
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
      data: { invalid: "data" } // Faltam campos do AccountSchema
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
});
