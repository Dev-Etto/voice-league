import { beforeEach, describe, expect, it, mock } from "bun:test";
import { RateLimitError, ValidationError } from "../src/utils/errors.ts";
import { createMockInteraction } from "../.mocks/discord.mock.ts";
import { registerCommand } from "../src/commands/register.ts";
import { statusCommand } from "../src/commands/status.ts";
import { unregisterCommand } from "../src/commands/unregister.ts";



const mockUseCases = {
  register: {
    execute: mock(() => Promise.resolve({ gameName: "Faker", tagLine: "KR1" } as any)),
  },
  status: {
    execute: mock(() => Promise.resolve([] as any[])),
  },
  unregister: {
    execute: mock(() => Promise.resolve()),
  }
};

mock.module("../src/use-cases/register-player.ts", () => ({
  RegisterPlayer: class {
    execute = mockUseCases.register.execute;
  }
}));

mock.module("../src/use-cases/player-status.ts", () => ({
  GetPlayerStatus: class {
    execute = mockUseCases.status.execute;
  },
  UnregisterPlayer: class {
    execute = mockUseCases.unregister.execute;
  }
}));



describe("Slash Commands", () => {
  beforeEach(() => {
    mockUseCases.register.execute.mockClear();
    mockUseCases.status.execute.mockClear();
    mockUseCases.unregister.execute.mockClear();
    
    mockUseCases.register.execute.mockResolvedValue({ gameName: "Faker", tagLine: "KR1" });
    mockUseCases.status.execute.mockResolvedValue([]);
  });

  describe("/register", () => {
    it("deve cadastrar jogador com sucesso", async () => {
      const interaction = createMockInteraction({ riotid: "Faker#KR1" });
      await registerCommand.execute(interaction);
      expect(interaction.editReply).toHaveBeenCalledWith(expect.stringContaining("vinculada com sucesso"));
    });

    it("deve falhar se o formato do Riot ID for inválido", async () => {
      const interaction = createMockInteraction({ riotid: "FakerKR1" });
      await registerCommand.execute(interaction);
      expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({
        content: expect.stringContaining("Formato inválido")
      }));
    });

    it("deve lidar com ValidationError do use case", async () => {
      const interaction = createMockInteraction({ riotid: "Inexistente#000" });
      mockUseCases.register.execute.mockRejectedValue(new ValidationError("Conta não encontrada"));
      
      await registerCommand.execute(interaction);
      expect(interaction.editReply).toHaveBeenCalledWith(expect.stringContaining("Conta não encontrada"));
    });

    it("deve lidar com RateLimitError", async () => {
      const interaction = createMockInteraction({ riotid: "Faker#KR1" });
      mockUseCases.register.execute.mockRejectedValue(new RateLimitError(10));
      
      await registerCommand.execute(interaction);
      expect(interaction.editReply).toHaveBeenCalledWith(expect.stringContaining("API da Riot está sobrecarregada"));
    });
  });

  describe("/status", () => {
    it("deve mostrar mensagem de aviso se não houver contas", async () => {
      const interaction = createMockInteraction();
      await statusCommand.execute(interaction);
      expect(interaction.editReply).toHaveBeenCalledWith(expect.stringContaining("não possui nenhuma conta vinculada"));
    });

    it("deve listar contas vinculadas em um embed", async () => {
      const interaction = createMockInteraction();
      mockUseCases.status.execute.mockResolvedValue([
        { gameName: "Faker", tagLine: "KR1", lastGameId: "777", isActive: true },
        { gameName: "Showmaker", tagLine: "KR2", lastGameId: null, isActive: false }
      ]);

      await statusCommand.execute(interaction);
      
      expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({
        embeds: expect.any(Array)
      }));
    });
  });

  describe("/unregister", () => {
    it("deve remover contas do usuário", async () => {
      const interaction = createMockInteraction();
      await unregisterCommand.execute(interaction);
      expect(interaction.editReply).toHaveBeenCalledWith(expect.stringContaining("removidas"));
    });
  });
});
