import { safeAsync } from "./safe-async.ts";

export interface HttpResponse<T> {
  success: boolean;
  data: T;
  error?: Error;
  response: Response;
}

/**
 * Utilitário para requisições HTTP que utiliza o padrao safe-async internamente.
 * Centraliza a lógica de tratamento de status OK e parse de JSON.
 */
export async function httpClient<T>(
  url: string,
  options?: RequestInit
): Promise<HttpResponse<T>> {
  const fetchResult = await safeAsync(fetch(url, options));

  if (!fetchResult.success) {
    return {
      success: false,
      error: fetchResult.error,
      data: null as T,
      response: null as unknown as Response,
    };
  }

  const response = fetchResult.data;

  if (!response.ok) {
    return {
      success: false,
      error: new Error(`HTTP Error: ${response.status} ${response.statusText}`),
      data: null as T,
      response,
    };
  }

  const jsonResult = await safeAsync(response.json() as Promise<T>);

  if (!jsonResult.success) {
    return {
      success: false,
      error: jsonResult.error,
      data: null as T,
      response,
    };
  }

  return {
    success: true,
    data: jsonResult.data,
    response,
  };
}
