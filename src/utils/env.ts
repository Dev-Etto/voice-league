import { z } from "zod";

const EnvSchema = z.object({
  DISCORD_TOKEN: z.string().min(1, "DISCORD_TOKEN é obrigatório"),
  CLIENT_ID: z.string().min(1, "CLIENT_ID é obrigatório"),
  GUILD_ID: z.string().min(1, "GUILD_ID é obrigatório"),
  RIOT_API_KEY: z.string().min(1, "RIOT_API_KEY é obrigatório"),
  POLLING_INTERVAL_MS: z.coerce.number().int().positive().default(30000),
  INACTIVITY_DAYS: z.coerce.number().int().positive().default(7),
});

type Env = z.infer<typeof EnvSchema>;

let cachedEnv: Env | null = null;

export function loadEnv(): Env {
  if (cachedEnv) return cachedEnv;

  const result = EnvSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  → ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    console.error(`\n❌ Variáveis de ambiente inválidas:\n${formatted}\n`);
    process.exit(1);
  }

  cachedEnv = result.data;
  return cachedEnv;
}

export function getEnv(): Env {
  if (!cachedEnv) {
    throw new Error("Env não carregada. Chame loadEnv() antes.");
  }
  return cachedEnv;
}
