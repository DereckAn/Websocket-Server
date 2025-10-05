// =================================================================
// ONLINE ORDER ROUTES - Route handlers for online order endpoints
// =================================================================

import OnlineOrderController from "../controllers/OnlineOrderController";
import { handleCorsPrelight } from "../middleware/cors";
import { rateLimitMiddleware } from "../middleware/rateLimit";
import { logger } from "../utils/logger";
import ResponseView from "../views/ResponseView";

/**
 * OnlineOrderRoutes - Handles online order HTTP routes
 *
 * Routes handled:
 * - POST /api/orders/create - Create new online order
 */
export class OnlineOrderRoutes {
  /**
   * Handles all HTTP requests for online order endpoints
   */
  static async handleRequest(
    request: Request,
    url: URL
  ): Promise<Response | null> {
    const path = url.pathname;
    const method = request.method;

    // CORS preflight handling
    if (method === "OPTIONS") {
      return handleCorsPrelight(request);
    }

    try {
      // Route matching
      switch (true) {
        // POST /api/orders/create
        case method === "POST" && path === "/api/orders/create":
          return await this.handleCreateOrder(request);

        // No match
        default:
          return null; // Let other route handlers try
      }
    } catch (error) {
      logger.error("❌ Error in OnlineOrder routes:", error);
      return ResponseView.internalServerError(
        "Online order route handling failed"
      );
    }
  }

  /**
   * Handles POST /api/orders/create
   */
  private static async handleCreateOrder(request: Request): Promise<Response> {
    try {
      logger.info("📥 POST /api/orders/create");

      // Apply rate limiting
      const rateLimitResult = rateLimitMiddleware(request);
      if (rateLimitResult) {
        return rateLimitResult;
      }

      return await OnlineOrderController.handleCreateOrder(request);
    } catch (error) {
      logger.error("❌ Create order route error:", error);
      return ResponseView.internalServerError(
        "Failed to process create order request"
      );
    }
  }

  /**
   * Gets route info for debugging/logging
   */
  static getRouteInfo(request: Request): {
    method: string;
    path: string;
    isOnlineOrderRoute: boolean;
  } {
    const url = new URL(request.url);
    const path = url.pathname;

    return {
      method: request.method,
      path,
      isOnlineOrderRoute: path.startsWith("/api/orders/"),
    };
  }

  /**
   * Lists all available online order routes
   */
  static getAvailableRoutes(): {
    api: string[];
  } {
    return {
      api: ["POST /api/orders/create"],
    };
  }
}

export default OnlineOrderRoutes;
