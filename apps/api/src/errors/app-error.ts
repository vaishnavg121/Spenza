import { ApiErrorDetail } from "@spenza/contracts";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: ApiErrorDetail[];

  constructor(statusCode: number, code: string, message: string, details?: ApiErrorDetail[]) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found", code = "NOT_FOUND") {
    super(404, code, message);
  }
}

export class ValidationError extends AppError {
  constructor(message = "The request is invalid", details?: ApiErrorDetail[]) {
    super(400, "VALIDATION_FAILED", message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required", code = "UNAUTHORIZED") {
    super(401, code, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Access forbidden", code = "FORBIDDEN") {
    super(403, code, message);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource conflict", code = "CONFLICT") {
    super(409, code, message);
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(message = "The request violates a domain rule", code = "DOMAIN_VALIDATION_FAILED") {
    super(422, code, message);
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message = "Payload size limit exceeded") {
    super(413, "PAYLOAD_TOO_LARGE", message);
  }
}
