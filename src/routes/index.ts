// =================================================================
import { logger } from '../utils/logger';
// ROUTES INDEX - Central route dispatcher
// =================================================================

import { addCorsHeaders } from "../middleware/cors";
import { addRateLimitHeaders } from "../middleware/rateLimit";
import ResponseView from "../views/ResponseView";
import AdminRoutes from "./adminRoutes";
import GomokuRoutes from "./gomokuRoutes";
import SquareRoutes from "./squareRoutes";

/**
 * Central Routes Handler
 *
 * Why centralized routing?
 * - Single entry point for all HTTP requests
 * - Consistent middleware application
 * - Easy to add new route modules
 * - Centralized 404 handling
 * - Request/response logging
 */
export class Routes {
  /**
   * Main HTTP request handler
   * This is called by the main server for every HTTP request
   */
  static async handleRequest(request: Request): Promise<Response> {
    const startTime = Date.now();
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Log incoming request
    logger.info(`📥 ${method} ${path} - ${this.getClientIP(request)}`);

    try {
      let response: Response | null = null;

      // Try Gomoku routes first
      if (path.startsWith("/api/gomoku/")) {
        response = await GomokuRoutes.handleRequest(request, url);
      }

      // Try Admin routes
      if (!response && path.startsWith("/api/admin/")) {
        response = await AdminRoutes.handleRequest(request, url);
      }

      // Try Square routes
      if (
        !response &&
        (path.startsWith("/webhooks/square") ||
          path.startsWith("/orders/") ||
          path.startsWith("/square/") ||
          path === "/test")
      ) {
        response = await SquareRoutes.handleRequest(request, url);
      }

      // Health check endpoint (simple, no auth needed)
      if (!response && method === "GET" && path === "/health") {
        response = await this.handleHealthCheck(request);
      }

      // API status endpoint
      if (!response && method === "GET" && path === "/api/status") {
        response = await this.handleAPIStatus(request);
      }

      // 404 - Route not found
      if (!response) {
        response = ResponseView.notFound("Endpoint");
      }

      // Apply middleware to response (skip for OPTIONS requests - they already have CORS headers)
      if (method !== "OPTIONS") {
        response = this.applyResponseMiddleware(response, request);
      }

      // Log response
      const duration = Date.now() - startTime;
      logger.info(`📤 ${method} ${path} - ${response.status} (${duration}ms)`);

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`❌ ${method} ${path} - Error (${duration}ms):`, error);

      const errorResponse = ResponseView.internalServerError(
        "An unexpected error occurred"
      );

      return this.applyResponseMiddleware(errorResponse, request);
    }
  }

  /**
   * WebSocket upgrade handler
   * This is called by the main server for WebSocket upgrade requests
   */
  static handleWebSocketUpgrade(
    request: Request,
    server: any
  ): Response | undefined {
    const url = new URL(request.url);
    const path = url.pathname;

    logger.info(`🔌 WebSocket upgrade request: ${path}`);

    try {
      // Try Gomoku WebSocket routes
      if (path.startsWith("/ws/gomoku/")) {
        return GomokuRoutes.handleWebSocketUpgrade(request, server, url);
      }

      // Try Square admin WebSocket routes
      if (path === "/admin" || path === "/admin/ws") {
        logger.info(`✅ Routing to Square admin WebSocket: ${path}`);
        return SquareRoutes.handleWebSocketUpgrade(request, server, url);
      }

      // WebSocket route not found
      logger.warn(`⚠️ Unknown WebSocket route: ${path}`, {
        availableRoutes: ['/ws/gomoku/:roomId', '/admin', '/admin/ws']
      });
      return new Response("WebSocket route not found", { status: 404 });
    } catch (error) {
      logger.error("❌ WebSocket upgrade error:", error);
      return new Response("WebSocket upgrade failed", { status: 500 });
    }
  }

  // =================================================================
  // BUILT-IN ENDPOINTS
  // =================================================================

  /**
   * Basic health check endpoint
   * GET /health
   */
  private static async handleHealthCheck(request: Request): Promise<Response> {
    const health = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: "1.0.0",
    };

    return ResponseView.success(health, "Service is healthy");
  }

  /**
   * API status endpoint with basic info
   * GET /api/status
   */
  private static async handleAPIStatus(request: Request): Promise<Response> {
    const status = {
      api: {
        version: "1.0.0",
        name: "Gomoku Game & Square Webhook Server",
        description:
          "High-performance Gomoku AI server with real-time multiplayer and Square POS integration",
      },
      server: {
        uptime: this.formatUptime(process.uptime()),
        memory: this.formatMemoryUsage(process.memoryUsage().heapUsed),
        platform: process.platform,
        nodeVersion: process.version,
      },
      endpoints: {
        game: "/api/gomoku/*",
        admin: "/api/admin/*",
        square: "/webhooks/square, /orders/*, /square/*",
        websocket: "/ws/gomoku/*, /admin",
        health: "/health",
      },
      timestamp: new Date().toISOString(),
    };

    return ResponseView.success(status, "API is operational");
  }

  // =================================================================
  // MIDDLEWARE APPLICATION
  // =================================================================

  /**
   * Applies response middleware in correct order
   */
  private static applyResponseMiddleware(
    response: Response,
    request: Request
  ): Response {
    // 1. Add CORS headers
    response = addCorsHeaders(response, request);

    // 2. Add rate limit headers (if available)
    response = addRateLimitHeaders(response, request);

    // 3. Add security headers (already in ResponseView)

    // 4. Add request ID for tracing (if needed)
    const requestId = this.generateRequestId();
    response = ResponseView.withRequestId(response, requestId);

    return response;
  }

  // =================================================================
  // UTILITY METHODS
  // =================================================================

  /**
   * Gets client IP address
   */
  private static getClientIP(request: Request): string {
    // Try to get real IP from headers (for proxies/load balancers)
    const forwarded = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");

    if (forwarded) {
      return forwarded.split(",")[0]?.trim() || "unknown";
    }

    if (realIp) {
      return realIp;
    }

    return "unknown";
  }

  /**
   * Generates unique request ID for tracing
   */
  private static generateRequestId(): string {
    return require("../utils").createRequestId();
  }

  /**
   * Formats uptime in human-readable format
   */
  private static formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m ${secs}s`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  /**
   * Formats memory usage in human-readable format
   */
  private static formatMemoryUsage(bytes: number): string {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  }

  // =================================================================
  // ROUTE INFORMATION
  // =================================================================

  /**
   * Gets route information for debugging/monitoring
   */
  static getRouteInfo(request: Request): {
    method: string;
    path: string;
    isGameRoute: boolean;
    isAdminRoute: boolean;
    isWebSocketRoute: boolean;
    clientIP: string;
  } {
    const url = new URL(request.url);
    const path = url.pathname;

    return {
      method: request.method,
      path,
      isGameRoute: path.startsWith("/api/gomoku/"),
      isAdminRoute: path.startsWith("/api/admin/"),
      isWebSocketRoute: path.startsWith("/ws/"),
      clientIP: this.getClientIP(request),
    };
  }

  /**
   * Lists all available routes (for documentation)
   */
  static getAvailableRoutes(): {
    game: string[];
    admin: string[];
    websocket: string[];
    system: string[];
  } {
    return {
      game: [
        "POST /api/gomoku/quick-start",
        "POST /api/gomoku/game/:gameId/move",
        "GET /api/gomoku/game/:gameId/state",
        "DELETE /api/gomoku/game/:gameId",
      ],
      admin: [
        "GET /api/admin/stats",
        "GET /api/admin/rooms",
        "GET /api/admin/connections",
        "POST /api/admin/cleanup",
        "DELETE /api/admin/room/:roomId",
        "DELETE /api/admin/connection/:connectionId",
        "DELETE /api/admin/ai/cache",
        "GET /api/admin/ai/performance",
        "GET /api/admin/health",
      ],
      websocket: ["WS /ws/gomoku/:roomId"],
      system: ["GET /health", "GET /api/status"],
    };
  }
}

export default Routes;
