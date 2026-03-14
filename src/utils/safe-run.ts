export type SafeRunResult<T> = 
  | { success: true; data: T }
  | { success: false; error: Error };

/**
 * Utilitário para executar funções síncronas sem blocos try/catch repetitivos.
 */
export function safeRun<T>(fn: () => T): SafeRunResult<T> {
  try {
    const data = fn();
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}
