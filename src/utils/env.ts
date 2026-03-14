import { z } from "zod";
import { safeRun } from "./safe-run.ts";
import { ConfigError } from "./errors.ts";

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

/**
 * Carrega e valida as variáveis de ambiente.
 * @throws {ConfigError} Se a validação falhar.
 */
export function loadEnv(): Env {
  if (cachedEnv) return cachedEnv;

  const result = safeRun(() => EnvSchema.parse(process.env));

  if (!result.success) {
    if (result.error instanceof z.ZodError) {
      const formatted = result.error.issues
        .map((issue) => `  → ${issue.path.join(".")}: ${issue.message}`)
        .join("\n");
      throw new ConfigError(`Variáveis de ambiente inválidas:\n${formatted}`);
    }

    throw new ConfigError(`Erro ao carregar ambiente: ${result.error.message}`);
  }

  cachedEnv = result.data;
  return result.data;
}


/**
 * Retorna as variáveis de ambiente carregadas.
 * Se não estiverem carregadas, tenta realizar o carregamento.
 */
export function getEnv(): Env {
  if (!cachedEnv) {
    return loadEnv();
  }
  return cachedEnv;
}

