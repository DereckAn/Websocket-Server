// =================================================================
// GOMOKU SERVER - Main server with complete MVC architecture
// =================================================================

import Routes from './routes/index';
import GameService from './services/GameService';
import AIService from './services/AIService';
import WebSocketService from './services/WebSocketService';
import { SquareService } from './services/SquareService';
import { AdminWebSocketService } from './services/AdminWebSocketService';
import GomokuController from './controllers/GomokuController';
import SquareController from './controllers/SquareController';
import CleanupService from './services/CleanupService';
import { env, isProduction } from './config/env';
import { logger } from './utils/logger';
import { shutdownHandler } from './utils/shutdown';

/**
 * Gomoku Game Server with MVC Architecture
 *
 * This is the new main server file that integrates:
 * - Models: GameModel, PlayerModel, RoomModel
 * - Views: GameView, ResponseView
 * - Controllers: GomokuController, AdminController
 * - Services: GameService, AIService, WebSocketService
 * - Routes: Centralized routing with middleware
 * - Middleware: CORS, Rate Limiting, Validation
 * - Config: Environment validation and configuration
 * - Utils: Structured logging and graceful shutdown
 */

// =================================================================
// SERVER STARTUP
// =================================================================

logger.info('Starting Gomoku Game Server...', {
  environment: env.NODE_ENV,
  port: env.PORT,
  allowedOrigins: env.ALLOWED_ORIGINS,
  logLevel: env.LOG_LEVEL,
});

// Initialize Square services
SquareService.initialize();
AdminWebSocketService.initialize();

// Start cleanup service
CleanupService.start();

// Register cleanup for graceful shutdown
shutdownHandler.register(async () => {
  logger.info('Stopping cleanup service...');
  CleanupService.stop();
});

shutdownHandler.register(async () => {
  logger.info('Closing WebSocket connections...');
  WebSocketService.cleanupStaleConnections();
});

shutdownHandler.register(async () => {
  logger.info('Closing admin WebSocket connections...');
  AdminWebSocketService.stop();
});

shutdownHandler.register(async () => {
  logger.info('Cleaning up games...');
  GameService.cleanupInactiveGames();
});

// Setup shutdown handlers
shutdownHandler.setup();

// Declare server variable outside try block
let server: any;

try {
  // Create and start the server
  logger.debug('Creating Bun server...');
  server = Bun.serve({
  port: env.PORT,
  hostname: '0.0.0.0',

  // =================================================================
  // HTTP REQUEST HANDLER
  // =================================================================
  async fetch(request, server) {
    try {
      // Check if this is a WebSocket upgrade request
      const upgradeHeader = request.headers.get('upgrade');
      if (upgradeHeader === 'websocket') {
        // Handle WebSocket upgrade through Routes
        const upgradeResult = Routes.handleWebSocketUpgrade(request, server);
        if (upgradeResult) {
          return upgradeResult; // Error response
        }
        return undefined; // Successful upgrade
      }

      // Handle regular HTTP requests through Routes
      return await Routes.handleRequest(request);

    } catch (error) {
      logger.error('Unhandled server error', error);

      return new Response(JSON.stringify({
        success: false,
        error: isProduction() ? 'Internal server error' : (error as Error).message,
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
  },

  // =================================================================
  // WEBSOCKET HANDLERS
  // =================================================================
  websocket: {
    open(ws) {
      try {
        // Determine WebSocket type by the upgrade path stored in ws
        const wsType = (ws as any).upgradeData?.wsType || 'gomoku';

        if (wsType === 'admin') {
          SquareController.handleAdminWebSocketOpen(ws);
        } else {
          GomokuController.handleWebSocketOpen(ws);
        }
      } catch (error) {
        logger.error('WebSocket open error', error);
        ws.close();
      }
    },

    message(ws, message) {
      try {
        const messageStr = typeof message === 'string' ? message : message.toString();
        const wsType = (ws as any).upgradeData?.wsType || 'gomoku';

        if (wsType === 'admin') {
          SquareController.handleAdminWebSocketMessage(ws, messageStr);
        } else {
          GomokuController.handleWebSocketMessage(ws, messageStr);
        }
      } catch (error) {
        logger.error('WebSocket message error', error);
        ws.send(JSON.stringify({
          type: 'error',
          data: { error: 'Failed to process message' },
          timestamp: new Date()
        }));
      }
    },

    close(ws) {
      try {
        const wsType = (ws as any).upgradeData?.wsType || 'gomoku';

        if (wsType === 'admin') {
          SquareController.handleAdminWebSocketClose(ws);
        } else {
          GomokuController.handleWebSocketClose(ws);
        }
      } catch (error) {
        logger.error('WebSocket close error', error);
      }
    },

    // WebSocket configuration
    idleTimeout: 120,                // 2 minutes
    perMessageDeflate: true
  }
});

logger.info('Gomoku Game Server started successfully!', {
  port: env.PORT,
  endpoints: {
    game: '/api/gomoku/*',
    admin: '/api/admin/*',
    health: '/health',
    status: '/api/status',
  },
});

// Log server statistics
logServerInfo();

} catch (error) {
  logger.error('Failed to start server', error);
  logger.error('Port attempted', { port: env.PORT });
  process.exit(1);
}

// =================================================================
// UTILITY FUNCTIONS
// =================================================================

/**
 * Logs server information and statistics
 */
function logServerInfo(): void {
  const stats = GameService.getServerStats();
  const aiStats = AIService.getStats();
  const wsStats = WebSocketService.getServerStats();

  logger.info('Initial server state', {
    games: {
      active: stats.activeRooms,
      humanVsAI: stats.humanVsAIGames,
      multiplayer: stats.multiplayerGames,
    },
    players: stats.activePlayers,
    ai: {
      cacheSize: aiStats.cacheSize,
    },
    websocket: {
      connections: wsStats.activeConnections,
    },
    memory: {
      used: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)} MB`,
      total: `${(process.memoryUsage().heapTotal / 1024 / 1024).toFixed(1)} MB`,
    },
  });
}

// Export for testing
export { server };