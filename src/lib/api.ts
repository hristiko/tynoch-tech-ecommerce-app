import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError, RateLimitError } from "./errors";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

/** Wrap a route handler so every error becomes a consistent JSON response. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof ZodError) {
        return NextResponse.json(
          { error: { code: "VALIDATION_ERROR", message: err.issues[0]?.message ?? "Invalid input", details: err.issues } },
          { status: 400 }
        );
      }
      if (err instanceof AppError) {
        return NextResponse.json(
          { error: { code: err.code, message: err.message, details: err.details } },
          { status: err.status, ...(err instanceof RateLimitError ? { headers: { "Retry-After": String(err.retryAfterSeconds) } } : {}) }
        );
      }
      console.error("[api] unexpected error", err);
      return NextResponse.json(
        { error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } },
        { status: 500 }
      );
    }
  };
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new AppError("Request body must be valid JSON", 400, "INVALID_JSON");
  }
}
