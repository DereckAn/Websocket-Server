// =================================================================
// RESPONSE VIEW - Standardized API response formatting
// =================================================================

/**
 * ResponseView - Creates consistent API responses across all endpoints
 *
 * Why standardized responses?
 * - Predictable API contract for frontend
 * - Consistent error handling
 * - Easy to modify response format globally
 * - Better developer experience
 * - Automatic metadata inclusion
 */
export class ResponseView {
  // =================================================================
  // SUCCESS RESPONSES
  // =================================================================

  /**
   * Creates a standard success response
   */
  static success<T>(
    data: T,
    message?: string,
    metadata?: Record<string, any>
  ): Response {
    const response = {
      success: true,
      data,
      ...(message && { message }),
      ...(metadata && { metadata }),
      timestamp: new Date().toISOString(),
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: this.getStandardHeaders(),
    });
  }

  /**
   * Creates a success response with custom status
   */
  static successWithStatus<T>(
    data: T,
    status: number,
    message?: string
  ): Response {
    const response = {
      success: true,
      data,
      ...(message && { message }),
      timestamp: new Date().toISOString(),
    };

    return new Response(JSON.stringify(response), {
      status,
      headers: this.getStandardHeaders(),
    });
  }

  /**
   * Creates a 201 Created response
   */
  static created<T>(
    data: T,
    message: string = "Resource created successfully"
  ): Response {
    return this.successWithStatus(data, 201, message);
  }

  /**
   * Creates a 202 Accepted response (for async operations)
   */
  static accepted<T>(
    data: T,
    message: string = "Request accepted for processing"
  ): Response {
    return this.successWithStatus(data, 202, message);
  }

  /**
   * Creates a 204 No Content response
   */
  static noContent(): Response {
    return new Response(null, {
      status: 204,
      headers: this.getStandardHeaders(),
    });
  }

  // =================================================================
  // ERROR RESPONSES
  // =================================================================

  /**
   * Creates a standard error response
   */
  static error(
    error: string,
    status: number = 500,
    code?: string,
    details?: any
  ): Response {
    const response = {
      success: false,
      error,
      code: code || this.getDefaultErrorCode(status),
      ...(details && { details }),
      timestamp: new Date().toISOString(),
    };

    return new Response(JSON.stringify(response), {
      status,
      headers: this.getStandardHeaders(),
    });
  }

  /**
   * Creates a 400 Bad Request response
   */
  static badRequest(error: string, details?: any): Response {
    return this.error(error, 400, "BAD_REQUEST", details);
  }

  /**
   * Creates a 401 Unauthorized response
   */
  static unauthorized(error: string = "Unauthorized"): Response {
    return this.error(error, 401, "UNAUTHORIZED");
  }

  /**
   * Creates a 403 Forbidden response
   */
  static forbidden(error: string = "Forbidden"): Response {
    return this.error(error, 403, "FORBIDDEN");
  }

  /**
   * Creates a 404 Not Found response
   */
  static notFound(resource: string = "Resource"): Response {
    return this.error(`${resource} not found`, 404, "NOT_FOUND");
  }

  /**
   * Creates a 409 Conflict response
   */
  static conflict(error: string): Response {
    return this.error(error, 409, "CONFLICT");
  }

  /**
   * Creates a 422 Unprocessable Entity response
   */
  static unprocessableEntity(error: string, details?: any): Response {
    return this.error(error, 422, "UNPROCESSABLE_ENTITY", details);
  }

  /**
   * Creates a 429 Too Many Requests response
   */
  static tooManyRequests(
    error: string = "Too many requests",
    retryAfter?: number
  ): Response {
    const headers = this.getStandardHeaders();
    if (retryAfter) {
      headers["Retry-After"] = retryAfter.toString();
    }

    const response = {
      success: false,
      error,
      code: "RATE_LIMIT_EXCEEDED",
      ...(retryAfter && { retryAfter }),
      timestamp: new Date().toISOString(),
    };

    return new Response(JSON.stringify(response), {
      status: 429,
      headers,
    });
  }

  /**
   * Creates a 500 Internal Server Error response
   */
  static internalServerError(
    error: string = "Internal server error",
    requestId?: string
  ): Response {
    return this.error(error, 500, "INTERNAL_SERVER_ERROR", {
      ...(requestId && { requestId }),
    });
  }

  /**
   * Creates a 503 Service Unavailable response
   */
  static serviceUnavailable(
    error: string = "Service temporarily unavailable"
  ): Response {
    return this.error(error, 503, "SERVICE_UNAVAILABLE");
  }

  // =================================================================
  // VALIDATION ERROR RESPONSES
  // =================================================================

  /**
   * Creates a validation error response
   */
  static validationError(errors: string[]): Response {
    return this.badRequest("Validation failed", {
      validationErrors: errors,
    });
  }

  /**
   * Creates a single field validation error
   */
  static fieldValidationError(field: string, message: string): Response {
    return this.validationError([`${field}: ${message}`]);
  }

  // =================================================================
  // GAME-SPECIFIC RESPONSES
  // =================================================================

  /**
   * Creates a game error response
   */
  static gameError(error: string, gameId?: string): Response {
    return this.unprocessableEntity(error, {
      ...(gameId && { gameId }),
      type: "GAME_ERROR",
    });
  }

  /**
   * Creates an AI error response
   */
  static aiError(error: string, gameId?: string): Response {
    return this.internalServerError(`AI calculation failed: ${error}`, gameId);
  }

  /**
   * Creates a WebSocket error response
   */
  static websocketError(error: string, connectionId?: string): Response {
    return this.badRequest(`WebSocket error: ${error}`, {
      ...(connectionId && { connectionId }),
      type: "WEBSOCKET_ERROR",
    });
  }

  // =================================================================
  // HEALTH CHECK RESPONSES
  // =================================================================

  /**
   * Creates a healthy response
   */
  static healthy(data: any): Response {
    return this.success(data, "Service is healthy");
  }

  /**
   * Creates a degraded service response
   */
  static degraded(data: any, issues: string[]): Response {
    const response = {
      success: true,
      data,
      message: "Service is degraded",
      warnings: issues,
      timestamp: new Date().toISOString(),
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: this.getStandardHeaders(),
    });
  }

  /**
   * Creates an unhealthy response
   */
  static unhealthy(issues: string[]): Response {
    const response = {
      success: false,
      error: "Service is unhealthy",
      code: "SERVICE_UNAVAILABLE",
      issues,
      timestamp: new Date().toISOString(),
    };

    return new Response(JSON.stringify(response), {
      status: 503,
      headers: this.getStandardHeaders(),
    });
  }

  // =================================================================
  // PAGINATION RESPONSES
  // =================================================================

  /**
   * Creates a paginated response
   */
  static paginated<T>(
    data: T[],
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    }
  ): Response {
    return this.success(data, undefined, {
      pagination: {
        ...pagination,
        hasNext: pagination.page < pagination.totalPages,
        hasPrev: pagination.page > 1,
      },
    });
  }

  // =================================================================
  // RESPONSE HELPERS
  // =================================================================

  /**
   * Gets standard headers for all responses
   */
  private static getStandardHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      // CORS headers removed - handled by middleware in routes/index.ts
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "X-XSS-Protection": "1; mode=block",
    };
  }

  /**
   * Gets default error code based on HTTP status
   */
  private static getDefaultErrorCode(status: number): string {
    const codes: Record<number, string> = {
      400: "BAD_REQUEST",
      401: "UNAUTHORIZED",
      403: "FORBIDDEN",
      404: "NOT_FOUND",
      409: "CONFLICT",
      422: "UNPROCESSABLE_ENTITY",
      429: "RATE_LIMIT_EXCEEDED",
      500: "INTERNAL_SERVER_ERROR",
      502: "BAD_GATEWAY",
      503: "SERVICE_UNAVAILABLE",
      504: "GATEWAY_TIMEOUT",
    };

    return codes[status] || "UNKNOWN_ERROR";
  }

  /**
   * Adds request ID to response headers (for tracing)
   */
  static withRequestId(response: Response, requestId: string): Response {
    const headers = new Headers(response.headers);
    headers.set("X-Request-ID", requestId);

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  /**
   * Adds cache headers to response
   */
  static withCacheHeaders(
    response: Response,
    maxAge: number,
    isPublic: boolean = true
  ): Response {
    const headers = new Headers(response.headers);
    headers.set(
      "Cache-Control",
      `${isPublic ? "public" : "private"}, max-age=${maxAge}`
    );

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  /**
   * Adds no-cache headers to response
   */
  static withNoCacheHeaders(response: Response): Response {
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
    headers.set("Pragma", "no-cache");
    headers.set("Expires", "0");

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
}

export default ResponseView;
