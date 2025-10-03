// =================================================================
import { logger } from '../utils/logger';
// SQUARE ROUTES - Route handlers for Square webhook integration
// =================================================================

import SquareController from '../controllers/SquareController';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { handleCorsPrelight } from '../middleware/cors';
import ResponseView from '../views/ResponseView';

/**
 * SquareRoutes - Handles Square webhook and admin routes
 *
 * Routes handled:
 * - POST /webhooks/square - Square webhook endpoint
 * - GET /orders/{orderId} - Order lookup
 * - POST /test - Test event from admin
 * - GET /square/health - Square health check
 * - GET /square/stats - Square statistics
 * - GET /square/connections - Admin connections
 * - POST /square/cleanup - Admin cleanup
 * - WS /admin - Admin WebSocket
 */
export class SquareRoutes {

  /**
   * Handles all HTTP requests for Square endpoints
   */
  static async handleRequest(request: Request, url: URL): Promise<Response | null> {
    const path = url.pathname;
    const method = request.method;

    // CORS preflight handling
    if (method === 'OPTIONS') {
      return handleCorsPrelight(request);
    }

    try {
      // Route matching
      switch (true) {
        // POST /webhooks/square
        case method === 'POST' && path === '/webhooks/square':
          return await this.handleSquareWebhook(request);

        // GET /orders/{orderId}
        case method === 'GET' && this.matchesPattern(path, '/orders/*'):
          const orderId = this.extractOrderId(path);
          return await this.handleOrderLookup(request, orderId);

        // POST /test
        case method === 'POST' && path === '/test':
          return await this.handleTestEvent(request);

        // GET /square/health
        case method === 'GET' && path === '/square/health':
          return this.handleSquareHealth(request);

        // GET /square/stats
        case method === 'GET' && path === '/square/stats':
          return this.handleSquareStats(request);

        // GET /square/connections
        case method === 'GET' && path === '/square/connections':
          return this.handleSquareConnections(request);

        // POST /square/cleanup
        case method === 'POST' && path === '/square/cleanup':
          return this.handleSquareCleanup(request);

        // No match
        default:
          return null; // Let other route handlers try
      }

    } catch (error) {
      logger.error('❌ Error in Square routes:', error);
      return ResponseView.internalServerError('Square route handling failed');
    }
  }

  /**
   * Handles WebSocket upgrade for admin connections
   */
  static handleWebSocketUpgrade(
    request: Request,
    server: any,
    url: URL
  ): Response | undefined {
    const path = url.pathname;

    // Check if this is an admin WebSocket route
    // WS /admin
    if (path === '/admin') {
      // Mark this as admin WebSocket for the main handler
      if (server.upgrade(request, { data: { wsType: 'admin' } })) {
        return undefined; // Successful upgrade
      } else {
        return ResponseView.badRequest('Admin WebSocket upgrade failed');
      }
    }

    return undefined; // Not a Square WebSocket route
  }

  // =================================================================
  // ROUTE HANDLERS
  // =================================================================

  /**
   * Handles POST /webhooks/square
   */
  private static async handleSquareWebhook(request: Request): Promise<Response> {
    try {
      logger.info('📥 Handling Square webhook request');

      // Apply rate limiting for webhooks
      const rateLimitResult = rateLimitMiddleware(request);
      if (rateLimitResult) {
        return rateLimitResult;
      }

      return await SquareController.handleWebhook(request);

    } catch (error) {
      logger.error('❌ Square webhook route error:', error);
      return ResponseView.internalServerError('Failed to process Square webhook');
    }
  }

  /**
   * Handles GET /orders/{orderId}
   */
  private static async handleOrderLookup(request: Request, orderId: string): Promise<Response> {
    try {
      logger.info(`🔍 Handling order lookup: ${orderId}`);

      // Validate order ID
      if (!orderId || orderId.length === 0) {
        return ResponseView.badRequest('Order ID is required');
      }

      // Apply rate limiting
      const rateLimitResult = rateLimitMiddleware(request);
      if (rateLimitResult) {
        return rateLimitResult;
      }

      return await SquareController.handleOrderLookup(request, orderId);

    } catch (error) {
      logger.error(`❌ Order lookup route error for ${orderId}:`, error);
      return ResponseView.internalServerError('Failed to lookup order');
    }
  }

  /**
   * Handles POST /test
   */
  private static async handleTestEvent(request: Request): Promise<Response> {
    try {
      logger.info('🧪 Handling test event request');

      // Apply rate limiting
      const rateLimitResult = rateLimitMiddleware(request);
      if (rateLimitResult) {
        return rateLimitResult;
      }

      return await SquareController.handleTestEvent(request);

    } catch (error) {
      logger.error('❌ Test event route error:', error);
      return ResponseView.internalServerError('Failed to process test event');
    }
  }

  /**
   * Handles GET /square/health
   */
  private static handleSquareHealth(request: Request): Response {
    try {
      logger.info('🏥 Square health check requested');
      return SquareController.handleSquareHealth(request);

    } catch (error) {
      logger.error('❌ Square health route error:', error);
      return ResponseView.internalServerError('Square health check failed');
    }
  }

  /**
   * Handles GET /square/stats
   */
  private static handleSquareStats(request: Request): Response {
    try {
      logger.info('📊 Square stats requested');

      // Apply rate limiting for stats endpoint
      const rateLimitResult = rateLimitMiddleware(request);
      if (rateLimitResult) {
        return rateLimitResult;
      }

      return SquareController.handleSquareStats(request);

    } catch (error) {
      logger.error('❌ Square stats route error:', error);
      return ResponseView.internalServerError('Failed to get Square statistics');
    }
  }

  /**
   * Handles GET /square/connections
   */
  private static handleSquareConnections(request: Request): Response {
    try {
      logger.info('🔌 Square connections requested');

      // Apply rate limiting
      const rateLimitResult = rateLimitMiddleware(request);
      if (rateLimitResult) {
        return rateLimitResult;
      }

      return SquareController.handleSquareConnections(request);

    } catch (error) {
      logger.error('❌ Square connections route error:', error);
      return ResponseView.internalServerError('Failed to get connection statistics');
    }
  }

  /**
   * Handles POST /square/cleanup
   */
  private static handleSquareCleanup(request: Request): Response {
    try {
      logger.info('🧹 Square cleanup requested');

      // Apply stricter rate limiting for cleanup
      const rateLimitResult = rateLimitMiddleware(request);
      if (rateLimitResult) {
        return rateLimitResult;
      }

      return SquareController.handleSquareCleanup(request);

    } catch (error) {
      logger.error('❌ Square cleanup route error:', error);
      return ResponseView.internalServerError('Failed to perform cleanup');
    }
  }

  // =================================================================
  // UTILITY METHODS
  // =================================================================

  /**
   * Checks if a path matches a pattern with wildcards
   */
  private static matchesPattern(path: string, pattern: string): boolean {
    const regexPattern = pattern
      .replace(/\*/g, '[^/]+') // * matches any non-slash characters
      .replace(/\//g, '\\/');   // Escape slashes

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path);
  }

  /**
   * Extracts order ID from path like /orders/abc123
   */
  private static extractOrderId(path: string): string {
    const parts = path.split('/');
    const orderIndex = parts.indexOf('orders');

    if (orderIndex !== -1 && orderIndex + 1 < parts.length) {
      return parts[orderIndex + 1] || '';
    }

    return '';
  }

  /**
   * Gets route info for debugging/logging
   */
  static getRouteInfo(request: Request): {
    method: string;
    path: string;
    isSquareRoute: boolean;
    isWebhookRoute: boolean;
    isAdminRoute: boolean;
    hasSignature: boolean;
  } {
    const url = new URL(request.url);
    const path = url.pathname;

    return {
      method: request.method,
      path,
      isSquareRoute: path.includes('/square/') || path.includes('/webhooks/square') || path.includes('/orders/'),
      isWebhookRoute: path === '/webhooks/square',
      isAdminRoute: path.startsWith('/square/') || path === '/admin',
      hasSignature: !!request.headers.get('x-square-hmacsha256-signature')
    };
  }

  /**
   * Lists all available Square routes
   */
  static getAvailableRoutes(): {
    webhook: string[];
    api: string[];
    admin: string[];
    websocket: string[];
  } {
    return {
      webhook: [
        'POST /webhooks/square'
      ],
      api: [
        'GET /orders/{orderId}',
        'POST /test'
      ],
      admin: [
        'GET /square/health',
        'GET /square/stats',
        'GET /square/connections',
        'POST /square/cleanup'
      ],
      websocket: [
        'WS /admin'
      ]
    };
  }
}

export default SquareRoutes;