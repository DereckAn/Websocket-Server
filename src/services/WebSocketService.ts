// =================================================================
// WEBSOCKET SERVICE - Real-time communication for Gomoku games
// =================================================================

import {
  type WSMessage,
  type WSMessageType,
  type GameState,
  type AIMove,
  GAME_CONFIG
} from '../types/gomoku';

/**
 * WebSocketService - Manages real-time communication for games
 *
 * Why WebSocket for Gomoku?
 * - Instant move updates (no polling needed)
 * - AI thinking notifications (better UX)
 * - Connection status tracking
 * - Scalable for multiple concurrent games
 * - Perfect for "live" gaming experience
 */
export class WebSocketService {

  // Active WebSocket connections
  private static connections: Map<string, {
    ws: any;
    playerId: string;
    roomId: string;
    gameId: string;
    connectedAt: Date;
    lastPing: Date;
  }> = new Map();

  // Room subscribers (for broadcasting to room)
  private static roomSubscribers: Map<string, Set<string>> = new Map();

  // =================================================================
  // CONNECTION MANAGEMENT
  // =================================================================

  /**
   * Handles new WebSocket connection
   */
  static handleConnection(
    ws: any,
    playerId: string,
    roomId: string,
    gameId: string
  ): string {
    const connectionId = this.generateConnectionId();

    // Store connection
    this.connections.set(connectionId, {
      ws,
      playerId,
      roomId,
      gameId,
      connectedAt: new Date(),
      lastPing: new Date()
    });

    // Add to room subscribers
    if (!this.roomSubscribers.has(roomId)) {
      this.roomSubscribers.set(roomId, new Set());
    }
    this.roomSubscribers.get(roomId)!.add(connectionId);

    // Setup WebSocket event handlers
    this.setupWebSocketHandlers(ws, connectionId);

    // Send welcome message
    this.sendToConnection(connectionId, {
      type: 'game_created',
      gameId,
      roomId,
      data: {
        message: 'Connected to game successfully',
        playerId,
        connectionId
      },
      timestamp: new Date()
    });

    console.log(`🔌 WebSocket connected: Player ${playerId} in room ${roomId} (${connectionId})`);

    return connectionId;
  }

  /**
   * Sets up WebSocket event handlers
   */
  private static setupWebSocketHandlers(ws: any, connectionId: string): void {
    // Handle incoming messages
    ws.on('message', (data: any) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleIncomingMessage(connectionId, message);
      } catch (error) {
        console.error('❌ Invalid WebSocket message:', error);
        this.sendError(connectionId, 'Invalid message format');
      }
    });

    // Handle connection close
    ws.on('close', () => {
      this.handleDisconnection(connectionId);
    });

    // Handle connection errors
    ws.on('error', (error: any) => {
      console.error(`❌ WebSocket error for ${connectionId}:`, error);
      this.handleDisconnection(connectionId);
    });

    // Setup ping/pong for connection health
    this.setupHeartbeat(ws, connectionId);
  }

  /**
   * Handles WebSocket disconnection
   */
  static handleDisconnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Remove from room subscribers
    const roomSubscribers = this.roomSubscribers.get(connection.roomId);
    if (roomSubscribers) {
      roomSubscribers.delete(connectionId);
      if (roomSubscribers.size === 0) {
        this.roomSubscribers.delete(connection.roomId);
      }
    }

    // Remove connection
    this.connections.delete(connectionId);

    // Notify GameService about disconnection
    const { GameService } = require('./GameService');
    GameService.handlePlayerDisconnect(connection.playerId);

    // Notify other players in room
    this.broadcastToRoom(connection.roomId, {
      type: 'player_left',
      gameId: connection.gameId,
      roomId: connection.roomId,
      data: {
        playerId: connection.playerId,
        message: 'Player disconnected'
      },
      timestamp: new Date()
    }, connectionId); // Exclude the disconnected player

    console.log(`🔌 WebSocket disconnected: Player ${connection.playerId} from room ${connection.roomId}`);
  }

  // =================================================================
  // MESSAGE HANDLING
  // =================================================================

  /**
   * Handles incoming WebSocket messages
   */
  private static handleIncomingMessage(connectionId: string, message: any): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Update last activity
    connection.lastPing = new Date();

    switch (message.type) {
      case 'ping':
        this.handlePing(connectionId);
        break;

      case 'move_request':
        this.handleMoveRequest(connectionId, message);
        break;

      case 'game_state_request':
        this.handleGameStateRequest(connectionId);
        break;

      default:
        console.warn(`❓ Unknown message type: ${message.type}`);
        this.sendError(connectionId, 'Unknown message type');
    }
  }

  /**
   * Handles ping messages (keep-alive)
   */
  private static handlePing(connectionId: string): void {
    this.sendToConnection(connectionId, {
      type: 'pong',
      timestamp: new Date()
    });
  }

  /**
   * Handles move requests from players
   */
  private static async handleMoveRequest(connectionId: string, message: any): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    try {
      // Import GameService dynamically to avoid circular dependency
      const { GameService } = await import('./GameService');

      // Send "processing move" notification
      this.sendToConnection(connectionId, {
        type: 'move_processing',
        gameId: connection.gameId,
        data: { message: 'Processing your move...' },
        timestamp: new Date()
      });

      // Process the move
      const result = await GameService.makeMove({
        row: message.row,
        col: message.col,
        playerId: connection.playerId
      });

      if (result.success) {
        // Broadcast move to all players in room
        this.broadcastToRoom(connection.roomId, {
          type: 'move_made',
          gameId: connection.gameId,
          roomId: connection.roomId,
          data: {
            move: result.move,
            gameState: result.gameState,
            playerId: connection.playerId
          },
          timestamp: new Date()
        });

        // If there's an AI move, send it after a brief delay (for better UX)
        if (result.aiMove) {
          // Send "AI thinking" notification
          this.broadcastToRoom(connection.roomId, {
            type: 'ai_thinking',
            gameId: connection.gameId,
            data: {
              message: 'AI is thinking...',
              estimatedTime: 2000
            },
            timestamp: new Date()
          });

          // Send AI move
          setTimeout(() => {
            this.broadcastToRoom(connection.roomId, {
              type: 'ai_move',
              gameId: connection.gameId,
              data: {
                move: result.aiMove,
                gameState: result.gameState,
                aiStats: {
                  timeElapsed: result.aiMove!.timeElapsed,
                  nodesSearched: result.aiMove!.nodesSearched,
                  confidence: result.aiMove!.confidence
                }
              },
              timestamp: new Date()
            });
          }, 100); // Small delay for better UX
        }

        // Check if game ended
        if (result.gameState?.status === 'won' || result.gameState?.status === 'draw') {
          setTimeout(() => {
            this.broadcastToRoom(connection.roomId, {
              type: 'game_over',
              gameId: connection.gameId,
              data: {
                gameState: result.gameState,
                winner: result.gameState?.winner,
                finalMessage: result.gameState?.status === 'won'
                  ? `${result.gameState.winner} wins!`
                  : 'Game ended in a draw!'
              },
              timestamp: new Date()
            });
          }, result.aiMove ? 150 : 50);
        }

      } else {
        // Send error to the specific player
        this.sendError(connectionId, result.error || 'Invalid move');
      }

    } catch (error) {
      console.error('❌ Error processing move:', error);
      this.sendError(connectionId, 'Failed to process move');
    }
  }

  /**
   * Handles game state requests
   */
  private static async handleGameStateRequest(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    try {
      const { GameService } = await import('./GameService');

      const gameState = GameService.getGameState({
        gameId: connection.gameId,
        playerId: connection.playerId
      });

      if (gameState) {
        this.sendToConnection(connectionId, {
          type: 'game_state_update',
          gameId: connection.gameId,
          data: { gameState },
          timestamp: new Date()
        });
      } else {
        this.sendError(connectionId, 'Game not found');
      }

    } catch (error) {
      console.error('❌ Error getting game state:', error);
      this.sendError(connectionId, 'Failed to get game state');
    }
  }

  // =================================================================
  // BROADCASTING AND MESSAGING
  // =================================================================

  /**
   * Sends message to specific connection
   */
  static sendToConnection(connectionId: string, message: WSMessage): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) return false;

    try {
      connection.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error(`❌ Failed to send message to ${connectionId}:`, error);
      this.handleDisconnection(connectionId);
      return false;
    }
  }

  /**
   * Broadcasts message to all players in a room
   */
  static broadcastToRoom(
    roomId: string,
    message: WSMessage,
    excludeConnectionId?: string
  ): number {
    const subscribers = this.roomSubscribers.get(roomId);
    if (!subscribers) return 0;

    let sentCount = 0;

    for (const connectionId of subscribers) {
      if (connectionId !== excludeConnectionId) {
        if (this.sendToConnection(connectionId, message)) {
          sentCount++;
        }
      }
    }

    return sentCount;
  }

  /**
   * Sends error message to connection
   */
  private static sendError(connectionId: string, error: string): void {
    this.sendToConnection(connectionId, {
      type: 'error',
      data: { error, code: 'GAME_ERROR' },
      timestamp: new Date()
    });
  }

  // =================================================================
  // CONNECTION HEALTH AND CLEANUP
  // =================================================================

  /**
   * Sets up heartbeat for connection health monitoring
   */
  private static setupHeartbeat(ws: any, connectionId: string): void {
    const interval = setInterval(() => {
      const connection = this.connections.get(connectionId);
      if (!connection) {
        clearInterval(interval);
        return;
      }

      // Check if connection is still alive
      const timeSinceLastPing = Date.now() - connection.lastPing.getTime();
      if (timeSinceLastPing > GAME_CONFIG.WEBSOCKET_PING_INTERVAL * 2) {
        console.log(`💔 Connection ${connectionId} timed out`);
        this.handleDisconnection(connectionId);
        clearInterval(interval);
        return;
      }

      // Send ping
      try {
        ws.ping();
      } catch (error) {
        console.error(`❌ Ping failed for ${connectionId}:`, error);
        this.handleDisconnection(connectionId);
        clearInterval(interval);
      }
    }, GAME_CONFIG.WEBSOCKET_PING_INTERVAL);
  }

  /**
   * Cleans up stale connections
   * Should be called periodically
   */
  static cleanupStaleConnections(): number {
    let cleanedCount = 0;
    const now = Date.now();

    for (const [connectionId, connection] of this.connections.entries()) {
      const timeSinceLastPing = now - connection.lastPing.getTime();

      if (timeSinceLastPing > GAME_CONFIG.WEBSOCKET_PING_INTERVAL * 3) {
        console.log(`🧹 Cleaning up stale connection: ${connectionId}`);
        this.handleDisconnection(connectionId);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  // =================================================================
  // ADMIN AND MONITORING
  // =================================================================

  /**
   * Gets WebSocket server statistics
   */
  static getServerStats(): {
    activeConnections: number;
    activeRooms: number;
    connectionsByRoom: Record<string, number>;
    averageConnectionAge: number;
  } {
    const now = Date.now();
    let totalAge = 0;
    const connectionsByRoom: Record<string, number> = {};

    for (const connection of this.connections.values()) {
      totalAge += now - connection.connectedAt.getTime();

      if (connection.roomId) {
        if (!connectionsByRoom[connection.roomId]) {
          connectionsByRoom[connection.roomId] = 0;
        }
        const count = connectionsByRoom[connection.roomId];
        if (count !== undefined) {
          connectionsByRoom[connection.roomId] = count + 1;
        }
      }
    }

    return {
      activeConnections: this.connections.size,
      activeRooms: this.roomSubscribers.size,
      connectionsByRoom,
      averageConnectionAge: this.connections.size > 0 ? totalAge / this.connections.size : 0
    };
  }

  /**
   * Lists all active connections (for debugging)
   */
  static listActiveConnections(): Array<{
    connectionId: string;
    playerId: string;
    roomId: string;
    connectedAt: string;
    lastPing: string;
  }> {
    const connections = [];

    for (const [connectionId, connection] of this.connections.entries()) {
      connections.push({
        connectionId,
        playerId: connection.playerId,
        roomId: connection.roomId,
        connectedAt: connection.connectedAt.toISOString(),
        lastPing: connection.lastPing.toISOString()
      });
    }

    return connections;
  }

  /**
   * Force disconnects a connection (admin function)
   */
  static forceDisconnect(connectionId: string): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) return false;

    try {
      connection.ws.close();
      this.handleDisconnection(connectionId);
      console.log(`🔒 Force disconnected: ${connectionId}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to force disconnect ${connectionId}:`, error);
      return false;
    }
  }

  /**
   * Broadcasts admin message to all connections
   */
  static broadcastAdminMessage(message: string): number {
    let sentCount = 0;

    for (const connectionId of this.connections.keys()) {
      if (this.sendToConnection(connectionId, {
        type: 'admin_message',
        data: { message },
        timestamp: new Date()
      })) {
        sentCount++;
      }
    }

    return sentCount;
  }

  // =================================================================
  // UTILITY METHODS
  // =================================================================

  /**
   * Generates unique connection ID
   */
  private static generateConnectionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `ws_${timestamp}_${random}`;
  }

  /**
   * Validates WebSocket message format
   */
  private static isValidMessage(message: any): boolean {
    return message &&
           typeof message.type === 'string' &&
           message.type.length > 0;
  }

  /**
   * Gets connection info
   */
  static getConnectionInfo(connectionId: string): {
    playerId: string;
    roomId: string;
    gameId: string;
    connectedAt: Date;
    isActive: boolean;
  } | null {
    const connection = this.connections.get(connectionId);
    if (!connection) return null;

    return {
      playerId: connection.playerId,
      roomId: connection.roomId,
      gameId: connection.gameId,
      connectedAt: connection.connectedAt,
      isActive: true
    };
  }
}

export default WebSocketService;