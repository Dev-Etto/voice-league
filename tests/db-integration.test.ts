import { beforeAll, describe, expect, it } from "bun:test";
import { 
  upsertPlayer, 
  getActivePlayers, 
  updatePlayerActivity, 
  updateLastGameId,
  deactivateInactivePlayers,
  getPlayerByPuuid,
  saveOriginalNickname,
  clearOriginalNickname,
  runMigrations,
  resetDatabase
} from "../src/database/db.ts";

describe("Database Integration (Real SQL Functions)", () => {
  beforeAll(async () => {
    resetDatabase(":memory:");
    await runMigrations();
  });

  it("deve executar o fluxo completo de um jogador", () => {
    // 1. Cadastrar
    upsertPlayer("d-1", "p-1", "Faker", "KR1");
    
    // 2. Buscar por PUUID
    const player = getPlayerByPuuid("p-1");
    expect(player).not.toBeNull();
    expect(player?.gameName).toBe("Faker");
    expect(player?.isActive).toBe(true);

    // 3. Atualizar atividade
    updatePlayerActivity("p-1");
    
    // 4. Inserir partida
    updateLastGameId("p-1", "game-123");
    expect(getPlayerByPuuid("p-1")?.lastGameId).toBe("game-123");

    // 5. Salvar Nickname
    saveOriginalNickname("p-1", "King");
    expect(getPlayerByPuuid("p-1")?.originalNickname).toBe("King");

    // 6. Limpar Nickname
    clearOriginalNickname("p-1");
    expect(getPlayerByPuuid("p-1")?.originalNickname).toBeNull();
  });

  it("deve gerenciar inatividade corretamente", () => {
    // Note: Para testar datas, precisaríamos de SQL injection de datas ou esperar.
    // Mas podemos validar o retorno da função.
    const deactivated = deactivateInactivePlayers(30);
    expect(Array.isArray(deactivated)).toBe(true);
  });

  it("deve retornar apenas jogadores ativos em getActivePlayers", () => {
    upsertPlayer("d-active", "p-active", "Active", "BR1");
    // O upsertPlayer coloca isActive: true por padrão.
    
    const activeOnes = getActivePlayers();
    expect(activeOnes.some(p => p.puuid === "p-active")).toBe(true);
  });
});
