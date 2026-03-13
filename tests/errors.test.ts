import { describe, expect, it } from "bun:test";
import {
  AppError,
  DatabaseError,
  RateLimitError,
  RiotApiError,
  ValidationError,
} from "../src/utils/errors.ts";

describe("Error Hierarchy", () => {
  it("AppError deve ser instância de Error", () => {
    const error = new AppError("test");
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
    expect(error.isOperational).toBe(true);
    expect(error.statusCode).toBe(500);
  });

  it("RiotApiError deve estender AppError", () => {
    const error = new RiotApiError("riot error", 403);
    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(RiotApiError);
    expect(error.riotStatusCode).toBe(403);
  });

  it("RateLimitError deve conter retryAfterSeconds", () => {
    const error = new RateLimitError(120);
    expect(error).toBeInstanceOf(RiotApiError);
    expect(error.retryAfterSeconds).toBe(120);
    expect(error.statusCode).toBe(429);
  });

  it("DatabaseError deve ser não-operacional", () => {
    const error = new DatabaseError("connection failed");
    expect(error.isOperational).toBe(false);
    expect(error.message).toContain("connection failed");
  });

  it("ValidationError deve ter statusCode 400", () => {
    const error = new ValidationError("formato inválido");
    expect(error.statusCode).toBe(400);
    expect(error.isOperational).toBe(true);
  });
});
