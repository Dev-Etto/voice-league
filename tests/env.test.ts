import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { z } from "zod";

describe("Env Validation", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.DISCORD_TOKEN = "test-discord-token";
    process.env.CLIENT_ID = "test-client-id";
    process.env.GUILD_ID = "test-guild-id";
    process.env.RIOT_API_KEY = "test-riot-key";
    process.env.POLLING_INTERVAL_MS = "15000";
    process.env.WEBHOOK_API_KEY = "test-web-key";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  const EnvSchema = z.object({
    DISCORD_TOKEN: z.string().min(1),
    CLIENT_ID: z.string().min(1),
    GUILD_ID: z.string().min(1),
    RIOT_API_KEY: z.string().min(1),
    POLLING_INTERVAL_MS: z.coerce.number().int().positive().default(15000),
    INACTIVITY_DAYS: z.coerce.number().int().positive().default(7),
    WEBHOOK_API_KEY: z.string().min(1),
  });

  it("deve validar env completo com sucesso", () => {
    const result = EnvSchema.safeParse(process.env);
    expect(result.success).toBe(true);
  });

  it("deve falhar quando DISCORD_TOKEN está vazio", () => {
    process.env.DISCORD_TOKEN = "";
    const result = EnvSchema.safeParse(process.env);
    expect(result.success).toBe(false);
  });

  it("deve falhar quando RIOT_API_KEY está ausente", () => {
    delete process.env.RIOT_API_KEY;
    const result = EnvSchema.safeParse(process.env);
    expect(result.success).toBe(false);
  });

  it("deve usar valor default para POLLING_INTERVAL_MS", () => {
    delete process.env.POLLING_INTERVAL_MS;
    const result = EnvSchema.safeParse(process.env);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.POLLING_INTERVAL_MS).toBe(15000);
    }
  });

  it("deve converter POLLING_INTERVAL_MS de string para number", () => {
    process.env.POLLING_INTERVAL_MS = "60000";
    const result = EnvSchema.safeParse(process.env);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.POLLING_INTERVAL_MS).toBe(60000);
    }
  });
});
