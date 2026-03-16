import { describe, expect, it, spyOn, beforeEach } from "bun:test";
import { DataDragonService } from "../src/services/data-dragon.ts";
import * as httpClient from "../src/utils/http-client.ts";

describe("DataDragonService", () => {
  const httpSpy = spyOn(httpClient, "httpClient");

  beforeEach(() => {
    DataDragonService._resetInstance();
    httpSpy.mockReset();
  });

  it("deve ser um singleton", () => {
    const instance1 = DataDragonService.getInstance();
    const instance2 = DataDragonService.getInstance();
    expect(instance1).toBe(instance2);
  });

  it("deve retornar nome do campeão (mockado)", async () => {
    const service = DataDragonService.getInstance();
    
    const mockChampions = {
      data: {
        "Aatrox": { key: "266", name: "Aatrox" },
        "Ahri": { key: "103", name: "Ahri" }
      }
    };

    httpSpy.mockImplementation((async (url: string) => {
      if (url.includes("versions.json")) {
        return {
          success: true,
          data: ["14.5.1"],
          response: { status: 200 } as any
        };
      }
      return {
        success: true,
        data: mockChampions,
        response: { status: 200 } as any
      };
    }) as any);

    const name = await service.getChampionName(266);
    expect(name).toBe("Aatrox");

    const unknown = await service.getChampionName(999);
    expect(unknown).toBe("Campeão Desconhecido");
  });
});
