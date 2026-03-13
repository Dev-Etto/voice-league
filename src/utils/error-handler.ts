import { AppError } from "./errors.ts";

export function setupGlobalErrorHandlers(): void {
  process.on("uncaughtException", (error: Error) => {
    console.error("💀 [UNCAUGHT EXCEPTION]:", error.message);

    if (error instanceof AppError && error.isOperational) {
      console.warn("Erro operacional capturado globalmente. O bot continua rodando.");
      return;
    }

    console.error("Erro fatal não-operacional. Encerrando processo...");
    process.exit(1);
  });

  process.on("unhandledRejection", (reason: unknown) => {
    const message = reason instanceof Error ? reason.message : String(reason);
    console.error("💀 [UNHANDLED REJECTION]:", message);

    if (reason instanceof AppError && reason.isOperational) {
      console.warn("Promise rejeitada (operacional). O bot continua rodando.");
      return;
    }

    console.error("Promise rejeitada (fatal). Encerrando processo...");
    process.exit(1);
  });
}
