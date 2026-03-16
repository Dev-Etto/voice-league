import { mock, describe, expect, it, beforeEach, spyOn, afterAll } from "bun:test";
import * as db from "../src/database/db.ts";
import { NicknameService } from "../src/services/nickname-service.ts";
import { DataDragonService } from "../src/services/data-dragon.ts";

describe("NicknameService", () => {
  let service: NicknameService;
  const getChampionSpy = spyOn(DataDragonService.prototype, "getChampionName");
  
  // DB Spies
  const saveNickSpy = spyOn(db, "saveOriginalNickname");
  const getPlayerSpy = spyOn(db, "getPlayerByPuuid");
  const clearNickSpy = spyOn(db, "clearOriginalNickname");

  beforeEach(() => {
    service = NicknameService.getInstance();
    getChampionSpy.mockResolvedValue("Aatrox");
    
    saveNickSpy.mockClear();
    getPlayerSpy.mockClear();
    clearNickSpy.mockClear();

    saveNickSpy.mockImplementation(() => {});
    clearNickSpy.mockImplementation(() => {});
  });

  afterAll(() => {
    getChampionSpy.mockRestore();
    saveNickSpy.mockRestore();
    getPlayerSpy.mockRestore();
    clearNickSpy.mockRestore();
  });

  it("updateWithChampion deve salvar nick antigo e setar novo", async () => {
    const mockMember = {
      nickname: "Player1",
      user: { username: "User1" },
      setNickname: mock(() => Promise.resolve()),
    } as any;

    const player = { puuid: "p1", gameName: "P1" } as any;

    await service.updateWithChampion(mockMember, player, 1);

    expect(db.saveOriginalNickname).toHaveBeenCalledWith("p1", "Player1");
    expect(mockMember.setNickname).toHaveBeenCalledWith(
      expect.stringContaining("(Aatrox)"),
      expect.any(String)
    );
  });

  it("restore deve restaurar nick original", async () => {
    const mockMember = {
      setNickname: mock(() => Promise.resolve()),
    } as any;

    getPlayerSpy.mockReturnValue({ originalNickname: "OldNick" } as any);

    await service.restore(mockMember, "p1");

    expect(mockMember.setNickname).toHaveBeenCalledWith("OldNick", expect.any(String));
    expect(db.clearOriginalNickname).toHaveBeenCalledWith("p1");
  });
});
