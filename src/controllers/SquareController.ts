// =================================================================
// SQUARE CONTROLLER - HTTP request handlers for Square webhooks
// =================================================================

import { SquareService } from '../services/SquareService';
import { AdminWebSocketService } from '../services/AdminWebSocketService';
import { OrderModel } from '../models/OrderModel';
import { logger } from '../utils/logger';
import ResponseView from '../views/ResponseView';
import type {
  SquareWebhookEvent,
  WebhookRequest
} from '../types/square';

/**
 * SquareController - Handles HTTP requests for Square webhook integration
 *
 * Responsibilities:
 * - Square webhook endpoint handling
 * - Order lookup API endpoints
 * - Test event processing
 * - Admin dashboard endpoints
 * - Request validation and response formatting
 */
export class SquareController {

  /**
   * Handles Square webhook POST requests
   * POST /webhooks/square
   */
  static async handleWebhook(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const signature = request.headers.get('x-square-hmacsha256-signature');
      const body = await request.text();

      logger.info('📥 Square webhook received');

      // Parse webhook body
      let parsedBody;
      try {
        parsedBody = JSON.parse(body);
      } catch (parseError) {
        logger.error('❌ Invalid JSON in webhook body:', parseError);
        return ResponseView.badRequest('Invalid JSON in request body');
      }

      // Handle test events (skip signature verification)
      if (parsedBody.type === 'test') {
        logger.info('🧪 Processing test webhook event');

        const testResult = SquareService.processTestEvent(parsedBody.data || {});

        // Broadcast test event to admin clients
        AdminWebSocketService.broadcastToAdmins({
          type: 'test-event',
          data: {
            ...testResult,
            source: 'square-webhook'
          },
          timestamp: new Date().toISOString()
        });

        return ResponseView.success({
          processed: true,
          eventType: 'test',
          message: testResult.message
        });
      }

      // Verify signature for real webhooks
      if (!signature) {
        logger.error('❌ Missing signature in webhook request');
        return ResponseView.badRequest('Missing x-square-hmacsha256-signature header');
      }

      const webhookUrl = process.env.WEBHOOK_URL || `${url.protocol}//${url.host}/webhooks/square`;
      const webhookRequest: WebhookRequest = {
        signature,
        body,
        webhookUrl
      };

      const verification = SquareService.verifyWebhookSignature(webhookRequest);

      if (!verification.isValid) {
        logger.error('❌ Webhook signature verification failed:', verification.error);
        return ResponseView.forbidden('Invalid webhook signature');
      }

      // Process webhook events
      const events = parsedBody.events || [parsedBody];
      const result = await SquareService.processWebhookEvents(events);

      if (!result.success) {
        logger.error('❌ Webhook processing failed:', result.error);
        return ResponseView.internalServerError('Failed to process webhook events');
      }

      // Broadcast successful orders to admin clients
      for (const eventResult of result.events) {
        if (eventResult.success && eventResult.order) {
          AdminWebSocketService.broadcastNewOrder(eventResult.order);
        }
      }

      logger.info('Webhook processed successfully', {
        processedOrders: result.processedOrders
      });

      return ResponseView.success({
        processed: true,
        ordersProcessed: result.processedOrders,
        eventsProcessed: result.events.length
      });

    } catch (error) {
      logger.error('❌ Square webhook error:', error);
      return ResponseView.internalServerError('Webhook processing failed');
    }
  }

  /**
   * Handles order lookup by ID
   * GET /orders/{orderId}
   */
  static async handleOrderLookup(request: Request, orderId: string): Promise<Response> {
    try {
      logger.info('Order lookup request', { orderId });

      // Validate order ID format
      if (!OrderModel.isValidOrderId(orderId)) {
        return ResponseView.badRequest('Invalid order ID format');
      }

      // Get order from Square API
      const order = await SquareService.getFormattedOrderById(orderId);

      if (!order) {
        return ResponseView.notFound('Order');
      }

      logger.info('Order found', { orderId, state: order.state });

      return ResponseView.success(order);

    } catch (error) {
      logger.error(`❌ Order lookup error for ${orderId}:`, error);
      return ResponseView.internalServerError('Failed to retrieve order');
    }
  }

  /**
   * Handles test event from admin panel
   * POST /test
   */
  static async handleTestEvent(request: Request): Promise<Response> {
    try {
      const body = await request.json();

      logger.info('🧪 Test event from admin panel');

      const result = SquareService.processTestEvent(body);

      // Broadcast to admin clients
      AdminWebSocketService.broadcastToAdmins({
        type: 'test-event',
        data: {
          ...result,
          source: 'admin-panel'
        },
        timestamp: new Date().toISOString()
      });

      return ResponseView.success({
        processed: true,
        message: result.message,
        data: result.data
      });

    } catch (error) {
      logger.error('❌ Test event error:', error);
      return ResponseView.badRequest('Invalid test event request');
    }
  }

  /**
   * Handles Square-specific health check
   * GET /square/health
   */
  static handleSquareHealth(request: Request): Response {
    try {
      const healthStatus = SquareService.getHealthStatus();
      const stats = SquareService.getStats();
      const connectionStats = AdminWebSocketService.getConnectionStats();

      const healthData = {
        square: healthStatus,
        statistics: stats,
        connections: connectionStats,
        timestamp: new Date().toISOString()
      };

      if (healthStatus.status === 'healthy') {
        return ResponseView.success(healthData, 'Square integration is healthy');
      } else if (healthStatus.status === 'degraded') {
        return ResponseView.successWithStatus(healthData, 200, 'Square integration is degraded');
      } else {
        return ResponseView.serviceUnavailable('Square integration is unhealthy');
      }

    } catch (error) {
      logger.error('❌ Square health check error:', error);
      return ResponseView.internalServerError('Health check failed');
    }
  }

  /**
   * Handles Square statistics endpoint
   * GET /square/stats
   */
  static handleSquareStats(request: Request): Response {
    try {
      const stats = SquareService.getStats();
      const connectionStats = AdminWebSocketService.getConnectionStats();

      return ResponseView.success({
        square: stats,
        connections: connectionStats,
        server: {
          uptime: process.uptime(),
          memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
          },
          environment: process.env.NODE_ENV || 'development'
        }
      });

    } catch (error) {
      logger.error('❌ Square stats error:', error);
      return ResponseView.internalServerError('Failed to get statistics');
    }
  }

  /**
   * Handles admin connections endpoint
   * GET /square/connections
   */
  static handleSquareConnections(request: Request): Response {
    try {
      const connectionStats = AdminWebSocketService.getConnectionStats();

      return ResponseView.success(connectionStats);

    } catch (error) {
      logger.error('❌ Square connections error:', error);
      return ResponseView.internalServerError('Failed to get connection statistics');
    }
  }

  /**
   * Handles admin cleanup endpoint
   * POST /square/cleanup
   */
  static handleSquareCleanup(request: Request): Response {
    try {
      const removedConnections = AdminWebSocketService.cleanupStaleConnections();

      logger.info('Square admin cleanup', {
        removedConnections
      });

      return ResponseView.success({
        cleaned: true,
        removedConnections,
        activeConnections: AdminWebSocketService.getConnectionStats().activeConnections
      });

    } catch (error) {
      logger.error('❌ Square cleanup error:', error);
      return ResponseView.internalServerError('Cleanup failed');
    }
  }

  /**
   * Handles WebSocket upgrade for admin connections
   */
  static handleAdminWebSocketUpgrade(
    request: Request,
    server: any
  ): Response | undefined {
    try {
      logger.info('🔌 Admin WebSocket upgrade request');

      // Upgrade the connection
      if (server.upgrade(request)) {
        // WebSocket upgrade successful, will be handled by websocket handlers
        return undefined;
      } else {
        logger.error('❌ Failed to upgrade admin WebSocket connection');
        return ResponseView.badRequest('WebSocket upgrade failed');
      }

    } catch (error) {
      logger.error('❌ Admin WebSocket upgrade error:', error);
      return ResponseView.internalServerError('WebSocket upgrade failed');
    }
  }

  /**
   * Handles WebSocket open for admin connections
   */
  static handleAdminWebSocketOpen(ws: any): void {
    try {
      AdminWebSocketService.handleConnection(ws);
    } catch (error) {
      logger.error('❌ Admin WebSocket open error:', error);
      ws.close();
    }
  }

  /**
   * Handles WebSocket message for admin connections
   */
  static handleAdminWebSocketMessage(ws: any, message: string | Buffer): void {
    try {
      AdminWebSocketService.handleMessage(ws, message);
    } catch (error) {
      logger.error('❌ Admin WebSocket message error:', error);
      // Don't close connection on message errors, just log
    }
  }

  /**
   * Handles WebSocket close for admin connections
   */
  static handleAdminWebSocketClose(ws: any): void {
    try {
      AdminWebSocketService.handleClose(ws);
    } catch (error) {
      logger.error('❌ Admin WebSocket close error:', error);
    }
  }

  // =================================================================
  // UTILITY METHODS
  // =================================================================

  /**
   * Extracts order ID from URL path
   */
  static extractOrderId(path: string): string {
    const match = path.match(/\/orders\/([^\/]+)/);
    return match ? (match[1] || '') : '';
  }

  /**
   * Gets request information for logging
   */
  static getRequestInfo(request: Request): {
    method: string;
    path: string;
    hasSignature: boolean;
    contentLength: number;
    userAgent: string | undefined;
  } {
    const url = new URL(request.url);

    return {
      method: request.method,
      path: url.pathname,
      hasSignature: !!request.headers.get('x-square-hmacsha256-signature'),
      contentLength: parseInt(request.headers.get('content-length') || '0'),
      userAgent: request.headers.get('user-agent') ?? undefined
    };
  }
}

export default SquareController;