// Error hierarchy mapped to the HTTP responses required by spec section 53.

export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields?: Record<string, string>;

  constructor(status: number, code: string, message: string, fields?: Record<string, string>) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, fields?: Record<string, string>) {
    super(400, "VALIDATION_ERROR", message, fields);
  }
}

export class NotAuthenticatedError extends AppError {
  constructor(message = "Authentication required.") {
    super(401, "NOT_AUTHENTICATED", message);
  }
}

export class NotAuthorizedError extends AppError {
  constructor(message = "You are not authorized to perform this action.") {
    super(403, "NOT_AUTHORIZED", message);
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string) {
    super(404, "NOT_FOUND", `${entity} not found.`);
  }
}

export class ConflictError extends AppError {
  constructor(
    message = "This item has been changed by another user. Refresh the page before saving your changes."
  ) {
    super(409, "CONFLICT", message);
  }
}
