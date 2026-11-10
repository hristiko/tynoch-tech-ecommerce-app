export class AppError extends Error {
  constructor(
    message: string,
    public readonly status: number = 500,
    public readonly code: string = "INTERNAL_ERROR",
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404, "NOT_FOUND");
  }
}

export class ValidationError extends AppError {
  constructor(message = "Invalid input", details?: unknown) {
    super(message, 400, "VALIDATION_ERROR", details);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict") {
    super(message, 409, "CONFLICT");
  }
}

/** Requests over the authentication quota. */
export class RateLimitError extends AppError {
  constructor(public readonly retryAfterSeconds: number) {
    super("Too many attempts. Please try again later.", 429, "RATE_LIMITED", { retryAfterSeconds });
  }
}
