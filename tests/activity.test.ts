import { describe, expect, it, spyOn } from "bun:test";
import { DataDragonService } from "../src/services/data-dragon.ts";

describe("DataDragonService", () => {
  it("deve ser um singleton", () => {
    const instance1 = DataDragonService.getInstance();
    const instance2 = DataDragonService.getInstance();
    expect(instance1).toBe(instance2);
  });

  it("deve retornar nome do campeão (mockado)", async () => {
    const service = DataDragonService.getInstance();
    
    const mockData = {
      data: {
        "Aatrox": { key: "266", name: "Aatrox" },
        "Ahri": { key: "103", name: "Ahri" }
      }
    };

    const fetchSpy = spyOn(global, "fetch").mockImplementation((async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("versions.json")) {
        return Response.json(["14.5.1"]);
      }
      return Response.json(mockData);
    }) as unknown as typeof fetch);

    const name = await service.getChampionName(266);
    expect(name).toBe("Aatrox");

    const unknown = await service.getChampionName(999);
    expect(unknown).toBe("Campeão Desconhecido");

    fetchSpy.mockRestore();
  });
});
