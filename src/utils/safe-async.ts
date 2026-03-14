export type SafeAsyncResult<T> = 
  | { success: true; data: T }
  | { success: false; error: Error };

/**
 * Utilitário para executar funções assíncronas sem blocos try/catch repetitivos.
 * Retorna um objeto padronizado { success, data?, error? }.
 */
export async function safeAsync<T>(
  promise: Promise<T>
): Promise<SafeAsyncResult<T>> {

  try {
    const data = await promise;
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}
