import { describe, expect, it, mock, spyOn, afterEach } from "bun:test";
import { getEnv, loadEnv } from "../src/utils/env.ts";
import { safeRun, type SafeRunResult } from "../src/utils/safe-run.ts";

describe("Utils Coverage", () => {
  
  describe("env.ts", () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
      process.env = { ...originalEnv };
    });

    it("deve carregar variáveis corretamente", () => {
      process.env.DISCORD_TOKEN = "tok";
      process.env.CLIENT_ID = "cli";
      process.env.GUILD_ID = "gui";
      process.env.RIOT_API_KEY = "rio";
      
      const env = loadEnv();
      expect(env.DISCORD_TOKEN).toBe("tok");
    });

    it("getEnv deve retornar o cache ou carregar", () => {
      const env = getEnv();
      expect(env).toHaveProperty("DISCORD_TOKEN");
    });
  });

  describe("safe-run.ts", () => {
    it("deve cobrir o catch de erro não-Error", () => {
      const result = safeRun(() => {
        throw "string error";
      });
      expect(result.success).toBe(false);
      expect((result as any).error.message).toBe("string error");
    });

    it("deve retornar sucesso para função válida", () => {
      const result = safeRun(() => 42);
      expect(result.success).toBe(true);
      if (result.success) expect(result.data).toBe(42);
    });
  });
});
