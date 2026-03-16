import { z } from "zod";
import { CACHE_TTL_24H } from "../utils/constantes.ts";
import { safeRun } from "../utils/safe-run.ts";
import { httpClient } from "../utils/http-client.ts";

const VersionsSchema = z.array(z.string());
const ChampionsSchema = z.object({
  data: z.record(
    z.object({
      key: z.string(),
      name: z.string(),
    })
  ),
});

export class DataDragonService {
  private static instance: DataDragonService;
  private championMap = new Map<number, string>();
  private lastUpdate = 0;
  private readonly CACHE_TTL = CACHE_TTL_24H;

  private constructor() {}

  public static getInstance(): DataDragonService {
    if (!DataDragonService.instance) {
      DataDragonService.instance = new DataDragonService();
    }
    return DataDragonService.instance;
  }

  public static _resetInstance(): void {
    (DataDragonService as any).instance = undefined;
  }

  /**
   * Retorna o nome do campeão pelo ID.
   */
  async getChampionName(championId: number): Promise<string> {
    if (this.championMap.size === 0 || Date.now() - this.lastUpdate > this.CACHE_TTL) {
      await this.refreshChampionData();
    }
    return this.championMap.get(championId) || "Campeão Desconhecido";
  }

  private async refreshChampionData(): Promise<void> {
    console.log("🐲 Atualizando dados do Data Dragon...");

    const versionsResult = await httpClient<unknown>("https://ddragon.leagueoflegends.com/api/versions.json");
    if (!versionsResult.success) {
      console.error("❌ Erro ao buscar versões do Data Dragon:", versionsResult.error?.message);
      return;
    }

    const versionsParse = safeRun(() => VersionsSchema.parse(versionsResult.data));
    if (!versionsParse.success) {
      console.error("❌ Erro ao validar versões do Data Dragon:", versionsParse.error.message);
      return;
    }

    const latestVersion = versionsParse.data[0];

    const championResult = await httpClient<unknown>(
      `https://ddragon.leagueoflegends.com/cdn/${latestVersion}/data/pt_BR/champion.json`
    );
    if (!championResult.success) {
      console.error("❌ Erro ao buscar campeões do Data Dragon:", championResult.error?.message);
      return;
    }

    const championsParse = safeRun(() => ChampionsSchema.parse(championResult.data));
    if (!championsParse.success) {
      console.error("❌ Erro ao validar campeões do Data Dragon:", championsParse.error.message);
      return;
    }

    const newMap = new Map<number, string>();
    for (const championKey in championsParse.data.data) {
      const champ = championsParse.data.data[championKey];
      newMap.set(Number(champ.key), champ.name);
    }

    this.championMap = newMap;
    this.lastUpdate = Date.now();
    console.log(`✅ ${newMap.size} campeões carregados (v${latestVersion}).`);
  }
}


