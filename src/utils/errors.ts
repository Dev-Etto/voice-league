export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class RiotApiError extends AppError {
  public readonly riotStatusCode: number;

  constructor(message: string, riotStatusCode: number) {
    super(message, riotStatusCode);
    this.riotStatusCode = riotStatusCode;
  }
}

export class RateLimitError extends RiotApiError {
  public readonly retryAfterSeconds: number;

  constructor(retryAfter: number) {
    super(`Rate Limit atingido. Retry after: ${retryAfter}s`, 429);
    this.retryAfterSeconds = retryAfter;
  }
}

export class DatabaseError extends AppError {
  constructor(message: string) {
    super(`Erro no banco de dados: ${message}`, 500, false);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}
