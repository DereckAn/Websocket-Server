// =================================================================
import { logger } from '../utils/logger';
// SQUARE SERVICE - Business logic for Square webhook processing
// =================================================================

import crypto from 'crypto';
import { SquareClient } from 'square';
import { OrderModel } from '../models/OrderModel';
import type {
  SquareOrder,
  SquareWebhookEvent,
  FormattedOrder,
  WebhookVerification,
  WebhookRequest,
  WebhookResponse,
  OrderProcessingResult,
  SquareServiceStats
} from '../types/square';

/**
 * SquareService - Application logic for Square integration
 *
 * Responsibilities:
 * - Webhook signature verification
 * - Order processing and formatting
 * - Square API interactions
 * - Business rule enforcement
 * - Statistics tracking
 */
export class SquareService {
  private static squareClient: SquareClient;
  private static stats: SquareServiceStats = {
    webhooksProcessed: 0,
    ordersProcessed: 0,
    adminConnections: 0,
    uptime: process.uptime(),
    errors: {
      webhookVerificationErrors: 0,
      processingErrors: 0
    }
  };

  /**
   * Initializes the Square client
   */
  static initialize(): void {
    const token = process.env.SQUARE_ACCESS_TOKEN;

    if (!token) {
      logger.warn('⚠️ SQUARE_ACCESS_TOKEN not configured - Square integration disabled');
      return;
    }

    this.squareClient = new SquareClient({
      token: token,
      environment: process.env.SQUARE_ENVIRONMENT === 'production' ? 'Production' : 'Sandbox'
    });

    logger.info('✅ Square client initialized:', {
      environment: process.env.SQUARE_ENVIRONMENT || 'sandbox',
      tokenPresent: !!token,
      tokenLength: token.length
    });
  }

  /**
   * Verifies Square webhook signature
   */
  static verifyWebhookSignature(request: WebhookRequest): WebhookVerification {
    const signatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;

    if (!signatureKey) {
      this.stats.errors.webhookVerificationErrors++;
      return {
        isValid: false,
        signature: undefined,
        expectedSignature: undefined,
        error: 'SQUARE_WEBHOOK_SIGNATURE_KEY not configured'
      };
    }

    try {
      const stringToSign = request.webhookUrl + request.body;
      const hmac = crypto.createHmac('sha256', signatureKey);
      hmac.update(stringToSign);
      const expectedSignature = hmac.digest('base64');

      const isValid = expectedSignature === request.signature;

      if (!isValid) {
        this.stats.errors.webhookVerificationErrors++;
      }

      return {
        isValid,
        signature: request.signature,
        expectedSignature,
        error: isValid ? undefined : 'Signature verification failed'
      };

    } catch (error) {
      this.stats.errors.webhookVerificationErrors++;
      return {
        isValid: false,
        signature: undefined,
        expectedSignature: undefined,
        error: `Signature verification error: ${error}`
      };
    }
  }

  /**
   * Processes Square webhook events
   */
  static async processWebhookEvents(events: SquareWebhookEvent[]): Promise<WebhookResponse> {
    const results: OrderProcessingResult[] = [];
    let processedOrders = 0;

    try {
      this.stats.webhooksProcessed++;

      for (const event of events) {
        const result = await this.processWebhookEvent(event);
        results.push(result);

        if (result.success) {
          processedOrders++;
        }
      }

      this.stats.lastWebhookAt = new Date().toISOString();

      return {
        success: true,
        processedOrders,
        events: results
      };

    } catch (error) {
      this.stats.errors.processingErrors++;
      this.stats.errors.lastError = String(error);

      return {
        success: false,
        processedOrders,
        events: results,
        error: `Webhook processing failed: ${error}`
      };
    }
  }

  /**
   * Processes a single webhook event
   */
  static async processWebhookEvent(event: SquareWebhookEvent): Promise<OrderProcessingResult> {
    try {
      logger.info(`📥 Processing webhook event: ${event.type} for ${event.data?.id}`);

      // Handle test events
      if (event.type === 'test') {
        return {
          success: true,
          eventType: 'test',
          order: undefined,
          error: undefined
        };
      }

      // Extract order from event
      const order = event.data?.object;
      if (!order) {
        return {
          success: false,
          error: 'No order data in webhook event',
          eventType: event.type,
          order: undefined
        };
      }

      // Validate order
      const validation = OrderModel.validateOrder(order);
      if (!validation.isValid) {
        return {
          success: false,
          error: `Order validation failed: ${validation.errors.join(', ')}`,
          eventType: event.type,
          order: undefined
        };
      }

      // Format order for display
      const formattedOrder = OrderModel.formatOrderForDisplay(order);

      // Update statistics
      this.stats.ordersProcessed++;
      this.stats.lastOrderAt = new Date().toISOString();

      logger.info(`✅ Order processed: ${formattedOrder.id} (${formattedOrder.state})`);

      return {
        success: true,
        order: formattedOrder,
        eventType: event.type,
        error: undefined
      };

    } catch (error) {
      this.stats.errors.processingErrors++;
      logger.error(`❌ Error processing webhook event:`, error);

      return {
        success: false,
        error: `Event processing failed: ${error}`,
        eventType: event.type,
        order: undefined
      };
    }
  }

  /**
   * Retrieves order by ID from Square API
   */
  static async getOrderById(orderId: string): Promise<SquareOrder | null> {
    if (!this.squareClient) {
      throw new Error('Square client not initialized');
    }

    if (!OrderModel.isValidOrderId(orderId)) {
      throw new Error('Invalid order ID format');
    }

    try {
      logger.info(`🔍 Fetching order from Square API: ${orderId}`);

      const { result } = await this.squareClient.ordersApi.retrieveOrder(orderId);

      if (!result.order) {
        logger.warn(`Order not found in Square API: ${orderId}`);
        return null;
      }

      logger.info(`✅ Order retrieved from Square API: ${orderId}`);
      return result.order as SquareOrder;

    } catch (error) {
      logger.error(`❌ Error retrieving order ${orderId}:`, error);
      throw new Error(`Failed to retrieve order: ${error}`);
    }
  }

  /**
   * Gets formatted order by ID
   */
  static async getFormattedOrderById(orderId: string): Promise<FormattedOrder | null> {
    const order = await this.getOrderById(orderId);

    if (!order) {
      return null;
    }

    return OrderModel.formatOrderForDisplay(order);
  }

  /**
   * Gets service statistics
   */
  static getStats(): SquareServiceStats {
    return {
      ...this.stats,
      uptime: process.uptime()
    };
  }

  /**
   * Updates admin connection count
   */
  static updateAdminConnectionCount(count: number): void {
    this.stats.adminConnections = count;
  }

  /**
   * Resets statistics (for testing/debugging)
   */
  static resetStats(): void {
    this.stats = {
      webhooksProcessed: 0,
      ordersProcessed: 0,
      adminConnections: this.stats.adminConnections, // Keep current connections
      uptime: process.uptime(),
      errors: {
        webhookVerificationErrors: 0,
        processingErrors: 0
      }
    };

    logger.info('📊 Square service statistics reset');
  }

  /**
   * Checks if Square integration is properly configured
   */
  static isConfigured(): {
    isConfigured: boolean;
    missingConfig: string[];
  } {
    const requiredEnvVars = [
      'SQUARE_ACCESS_TOKEN',
      'SQUARE_WEBHOOK_SIGNATURE_KEY'
    ];

    const missingConfig = requiredEnvVars.filter(envVar => !process.env[envVar]);

    return {
      isConfigured: missingConfig.length === 0,
      missingConfig
    };
  }

  /**
   * Gets Square client instance (for advanced operations)
   */
  static getSquareClient(): SquareClient {
    if (!this.squareClient) {
      throw new Error('Square client not initialized. Call SquareService.initialize() first.');
    }
    return this.squareClient;
  }

  /**
   * Processes test webhook event
   */
  static processTestEvent(data: any): {
    success: boolean;
    message: string;
    data: any;
  } {
    logger.info('🧪 Processing test event from admin panel');

    return {
      success: true,
      message: 'Test event processed successfully',
      data: {
        ...data,
        processedAt: new Date().toISOString(),
        serverInfo: {
          uptime: process.uptime(),
          environment: process.env.NODE_ENV || 'development'
        }
      }
    };
  }

  /**
   * Health check for Square service
   */
  static getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      configured: boolean;
      clientInitialized: boolean;
      recentErrors: boolean;
      uptime: number;
    };
  } {
    const config = this.isConfigured();
    const recentErrors = this.stats.errors.webhookVerificationErrors > 0 ||
                        this.stats.errors.processingErrors > 0;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (!config.isConfigured || !this.squareClient) {
      status = 'unhealthy';
    } else if (recentErrors) {
      status = 'degraded';
    }

    return {
      status,
      details: {
        configured: config.isConfigured,
        clientInitialized: !!this.squareClient,
        recentErrors,
        uptime: process.uptime()
      }
    };
  }
}

// Initialize Square service when module loads
// SquareService.initialize(); // Moved to server.ts to avoid auto-execution