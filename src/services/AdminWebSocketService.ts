// =================================================================
import { logger } from '../utils/logger';
// ADMIN WEBSOCKET SERVICE - Real-time communication for Square admin
// =================================================================

import type {
  AdminConnection,
  AdminWSMessage,
  AdminWSMessageType,
  SquareServiceStats
} from '../types/square';
import { generateId } from '../utils';
import { SquareService } from './SquareService';

/**
 * AdminWebSocketService - WebSocket management for Square admin dashboard
 *
 * Responsibilities:
 * - Admin WebSocket connection management
 * - Broadcasting order notifications
 * - Admin-specific messaging
 * - Connection health monitoring
 * - Statistics and monitoring
 */
export class AdminWebSocketService {
  private static connections = new Map<string, AdminConnection>();
  private static keepAliveInterval: Timer;
  private static readonly PING_INTERVAL = 30000; // 30 seconds
  private static readonly CONNECTION_TIMEOUT = 60000; // 60 seconds

  /**
   * Initializes the admin WebSocket service
   */
  static initialize(): void {
    this.startKeepAlive();
    logger.info('🔌 Admin WebSocket service initialized');
  }

  /**
   * Handles new admin WebSocket connection
   */
  static handleConnection(ws: any): string {
    const clientId = this.generateClientId();

    const connection: AdminConnection = {
      ws,
      clientId,
      connectedAt: new Date(),
      lastPing: new Date(),
      isAlive: true
    };

    this.connections.set(clientId, connection);

    // Send welcome message
    const welcomeMessage: AdminWSMessage = {
      type: 'connected',
      data: {
        clientId,
        message: 'Connected to Square admin dashboard',
        serverInfo: {
          uptime: process.uptime(),
          environment: process.env.NODE_ENV || 'development'
        }
      },
      timestamp: new Date().toISOString(),
      clientId
    };

    this.sendToConnection(clientId, welcomeMessage);

    // Update Square service with new connection count
    SquareService.updateAdminConnectionCount(this.connections.size);

    logger.info(`👤 Admin client connected: ${clientId} (total: ${this.connections.size})`);

    return clientId;
  }

  /**
   * Handles WebSocket message from admin client
   */
  static handleMessage(ws: any, message: string | Buffer): void {
    try {
      const data = JSON.parse(typeof message === 'string' ? message : new TextDecoder().decode(message));
      const connection = this.findConnectionByWs(ws);

      if (!connection) {
        logger.warn('⚠️ Received message from unknown WebSocket connection');
        return;
      }

      logger.info(`📨 Admin message from ${connection.clientId}: ${data.type}`);

      switch (data.type) {
        case 'admin-connect':
          this.handleAdminConnect(connection, data);
          break;

        case 'ping':
          this.handlePing(connection);
          break;

        case 'get-stats':
          this.handleGetStats(connection);
          break;

        case 'test-event':
          this.handleTestEvent(connection, data);
          break;

        default:
          logger.warn(`🤷 Unknown admin message type: ${data.type}`);
          this.sendError(connection.clientId, `Unknown message type: ${data.type}`);
      }

      // Update last activity
      connection.lastPing = new Date();

    } catch (error) {
      logger.error('❌ Error parsing admin WebSocket message:', error);
      const connection = this.findConnectionByWs(ws);
      if (connection) {
        this.sendError(connection.clientId, 'Invalid message format');
      }
    }
  }

  /**
   * Handles admin connection close
   */
  static handleClose(ws: any): void {
    const connection = this.findConnectionByWs(ws);

    if (connection) {
      const connectionDuration = Date.now() - connection.connectedAt.getTime();

      this.connections.delete(connection.clientId);

      // Update Square service with new connection count
      SquareService.updateAdminConnectionCount(this.connections.size);

      logger.info(`👋 Admin client disconnected: ${connection.clientId}`, {
        duration: `${Math.round(connectionDuration / 1000)}s`,
        remaining: this.connections.size
      });
    } else {
      logger.warn('⚠️ Unknown admin WebSocket connection closed');
    }
  }

  /**
   * Broadcasts message to all connected admin clients
   */
  static broadcastToAdmins(message: AdminWSMessage): void {
    const connectedClients = this.connections.size;

    if (connectedClients === 0) {
      logger.info('📭 No admin clients connected for broadcast');
      return;
    }

    logger.info(`📢 Broadcasting to ${connectedClients} admin clients: ${message.type}`);

    let successCount = 0;
    let failureCount = 0;

    for (const [clientId, connection] of this.connections) {
      try {
        if (connection.isAlive) {
          connection.ws.send(JSON.stringify(message));
          successCount++;
        } else {
          // Remove dead connection
          this.connections.delete(clientId);
          failureCount++;
        }
      } catch (error) {
        logger.warn(`⚠️ Failed to send message to admin client ${clientId}:`, error);
        this.connections.delete(clientId);
        failureCount++;
      }
    }

    // Update connection count if we removed any
    if (failureCount > 0) {
      SquareService.updateAdminConnectionCount(this.connections.size);
    }

    logger.info(`✅ Broadcast complete: ${successCount} successful, ${failureCount} failed`);
  }

  /**
   * Sends message to specific connection
   */
  static sendToConnection(clientId: string, message: AdminWSMessage): boolean {
    const connection = this.connections.get(clientId);

    if (!connection || !connection.isAlive) {
      logger.warn(`⚠️ Cannot send message to client ${clientId}: not connected`);
      return false;
    }

    try {
      connection.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      logger.error(`❌ Error sending message to client ${clientId}:`, error);
      this.connections.delete(clientId);
      SquareService.updateAdminConnectionCount(this.connections.size);
      return false;
    }
  }

  /**
   * Broadcasts new order notification
   */
  static broadcastNewOrder(order: any): void {
    logger.debug('📢 broadcastNewOrder called:', {
      orderId: order?.id,
      activeConnections: this.connections.size
    });

    const message: AdminWSMessage = {
      type: 'new-order',
      data: { order },
      timestamp: new Date().toISOString()
    };

    this.broadcastToAdmins(message);

    logger.debug('✅ Broadcast completed');
  }

  /**
   * Broadcasts order update notification
   */
  static broadcastOrderUpdate(order: any): void {
    const message: AdminWSMessage = {
      type: 'order-updated',
      data: order,
      timestamp: new Date().toISOString()
    };

    this.broadcastToAdmins(message);
  }

  /**
   * Gets connection statistics
   */
  static getConnectionStats(): {
    activeConnections: number;
    connections: Array<{
      clientId: string;
      connectedAt: string;
      uptime: number;
      lastPing: string;
      isAlive: boolean;
    }>;
  } {
    const connections = Array.from(this.connections.values()).map(conn => ({
      clientId: conn.clientId,
      connectedAt: conn.connectedAt.toISOString(),
      uptime: Date.now() - conn.connectedAt.getTime(),
      lastPing: conn.lastPing?.toISOString() || conn.connectedAt.toISOString(),
      isAlive: conn.isAlive
    }));

    return {
      activeConnections: this.connections.size,
      connections
    };
  }

  /**
   * Cleans up stale connections
   */
  static cleanupStaleConnections(): number {
    const now = Date.now();
    let removedCount = 0;

    for (const [clientId, connection] of this.connections) {
      const timeSinceLastPing = now - (connection.lastPing?.getTime() || connection.connectedAt.getTime());

      if (timeSinceLastPing > this.CONNECTION_TIMEOUT) {
        logger.info(`🧹 Removing stale admin connection: ${clientId}`);
        this.connections.delete(clientId);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      SquareService.updateAdminConnectionCount(this.connections.size);
    }

    return removedCount;
  }

  // =================================================================
  // PRIVATE METHODS
  // =================================================================

  /**
   * Starts keep-alive mechanism
   */
  private static startKeepAlive(): void {
    this.keepAliveInterval = setInterval(() => {
      this.sendPingToAll();
      this.cleanupStaleConnections();
    }, this.PING_INTERVAL);

    logger.info(`💓 Admin keep-alive started (${this.PING_INTERVAL}ms interval)`);
  }

  /**
   * Sends ping to all connections
   */
  private static sendPingToAll(): void {
    if (this.connections.size === 0) return;

    const pingMessage: AdminWSMessage = {
      type: 'ping',
      timestamp: new Date().toISOString()
    };

    this.broadcastToAdmins(pingMessage);
  }

  /**
   * Handles admin connect message
   */
  private static handleAdminConnect(connection: AdminConnection, data: any): void {
    const response: AdminWSMessage = {
      type: 'connected',
      data: {
        clientId: connection.clientId,
        message: 'Admin connection confirmed',
        stats: SquareService.getStats()
      },
      timestamp: new Date().toISOString(),
      clientId: connection.clientId
    };

    this.sendToConnection(connection.clientId, response);
  }

  /**
   * Handles ping message
   */
  private static handlePing(connection: AdminConnection): void {
    connection.lastPing = new Date();
    connection.isAlive = true;

    const pongMessage: AdminWSMessage = {
      type: 'pong',
      timestamp: new Date().toISOString(),
      clientId: connection.clientId
    };

    this.sendToConnection(connection.clientId, pongMessage);
  }

  /**
   * Handles get stats request
   */
  private static handleGetStats(connection: AdminConnection): void {
    const stats = SquareService.getStats();
    const connectionStats = this.getConnectionStats();

    const response: AdminWSMessage = {
      type: 'stats',
      data: {
        square: stats,
        connections: connectionStats
      },
      timestamp: new Date().toISOString(),
      clientId: connection.clientId
    };

    this.sendToConnection(connection.clientId, response);
  }

  /**
   * Handles test event
   */
  private static handleTestEvent(connection: AdminConnection, data: any): void {
    const result = SquareService.processTestEvent(data.data || {});

    // Send response to requesting client
    const response: AdminWSMessage = {
      type: 'test-event',
      data: result,
      timestamp: new Date().toISOString(),
      clientId: connection.clientId
    };

    this.sendToConnection(connection.clientId, response);

    // Broadcast to all other clients
    const broadcastMessage: AdminWSMessage = {
      type: 'test-event',
      data: {
        ...result,
        source: 'admin-panel',
        triggeredBy: connection.clientId
      },
      timestamp: new Date().toISOString()
    };

    this.broadcastToAdmins(broadcastMessage);
  }

  /**
   * Sends error message to client
   */
  private static sendError(clientId: string, errorMessage: string): void {
    const errorResponse: AdminWSMessage = {
      type: 'error',
      data: { error: errorMessage },
      timestamp: new Date().toISOString(),
      clientId
    };

    this.sendToConnection(clientId, errorResponse);
  }

  /**
   * Finds connection by WebSocket instance
   */
  private static findConnectionByWs(ws: any): AdminConnection | null {
    for (const connection of this.connections.values()) {
      if (connection.ws === ws) {
        return connection;
      }
    }
    return null;
  }

  /**
   * Generates unique client ID
   */
  private static generateClientId(): string {
    return `admin_${generateId()}`;
  }

  /**
   * Stops the service and cleans up resources
   */
  static stop(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
    }

    // Close all connections
    for (const connection of this.connections.values()) {
      try {
        connection.ws.close();
      } catch (error) {
        logger.warn('Error closing admin connection:', error);
      }
    }

    this.connections.clear();
    SquareService.updateAdminConnectionCount(0);

    logger.info('🛑 Admin WebSocket service stopped');
  }
}

// Initialize service when module loads
// AdminWebSocketService.initialize(); // Moved to server.ts to avoid auto-execution