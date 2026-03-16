import { mock, describe, expect, it, beforeEach, spyOn, afterAll } from "bun:test";
import { RegisterPlayer } from "../src/use-cases/register-player.ts";
import { GetPlayerStatus, UnregisterPlayer } from "../src/use-cases/player-status.ts";
import * as db from "../src/database/db.ts";
import * as riot from "../src/services/riot.ts";
import { ValidationError } from "../src/utils/errors.ts";

describe("Use Cases", () => {
  // Spies criados fora para serem restaurados ou limpos
  const upsertSpy = spyOn(db, "upsertPlayer");
  const getByDiscordSpy = spyOn(db, "getPlayersByDiscordId");
  const deleteSpy = spyOn(db, "deletePlayersByDiscordId");
  const getAccountSpy = spyOn(riot, "getAccountByRiotId");

  beforeEach(() => {
    upsertSpy.mockReset();
    getByDiscordSpy.mockReset();
    deleteSpy.mockReset();
    getAccountSpy.mockReset();

    upsertSpy.mockImplementation(() => {});
    getByDiscordSpy.mockReturnValue([]);
    deleteSpy.mockImplementation(() => {});
    getAccountSpy.mockResolvedValue(null);
  });

  afterAll(() => {
    upsertSpy.mockRestore();
    getByDiscordSpy.mockRestore();
    deleteSpy.mockRestore();
    getAccountSpy.mockRestore();
  });

  describe("RegisterPlayer", () => {
    it("deve lançar ValidationError se Riot ID não tiver #", async () => {
      const useCase = new RegisterPlayer();
      expect(useCase.execute("u1", "Faker")).rejects.toThrow(ValidationError);
    });

    it("deve registrar jogador se encontrado na Riot", async () => {
      const useCase = new RegisterPlayer();
      getAccountSpy.mockResolvedValue({
        puuid: "p1",
        gameName: "Faker",
        tagLine: "KR1"
      } as any);

      const result = await useCase.execute("u1", "Faker#KR1");

      expect(db.upsertPlayer).toHaveBeenCalledWith("u1", "p1", "Faker", "KR1");
      expect(result.gameName).toBe("Faker");
    });

    it("deve lançar ValidationError se conta não existir", async () => {
      const useCase = new RegisterPlayer();
      getAccountSpy.mockResolvedValue(null);
      expect(useCase.execute("u1", "Faker#KR1")).rejects.toThrow("Conta não encontrada");
    });
  });

  describe("PlayerStatus", () => {
    it("GetPlayerStatus deve retornar lista de jogadores do banco", async () => {
      const useCase = new GetPlayerStatus();
      const mockData = [{ gameName: "Faker" }] as any;
      getByDiscordSpy.mockReturnValue(mockData);

      const result = await useCase.execute("u1");
      expect(result).toEqual(mockData);
    });

    it("UnregisterPlayer deve chamar delete no banco", async () => {
      const useCase = new UnregisterPlayer();
      await useCase.execute("u1");
      expect(db.deletePlayersByDiscordId).toHaveBeenCalledWith("u1");
    });
  });
});
