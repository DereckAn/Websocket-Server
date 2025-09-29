// =================================================================
// GOMOKU SERVER - Main server with complete MVC architecture
// =================================================================

import Routes from './routes/index';
import GameService from './services/GameService';
import AIService from './services/AIService';
import WebSocketService from './services/WebSocketService';
import GomokuController from './controllers/GomokuController';
import SquareController from './controllers/SquareController';

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
 */

// =================================================================
// SERVER CONFIGURATION
// =================================================================

const SERVER_CONFIG = {
  port: parseInt(process.env.WEBHOOK_PORT || '3000'),
  host: process.env.HOST || '0.0.0.0',
  environment: process.env.NODE_ENV || 'development',
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    allowCredentials: process.env.NODE_ENV === 'production'
  },
  cleanup: {
    interval: 5 * 60 * 1000, // 5 minutes
    enabled: true
  }
};

// =================================================================
// SERVER STARTUP
// =================================================================

console.log('🚀 Starting Gomoku Game Server...');
console.log(`📍 Environment: ${SERVER_CONFIG.environment}`);
console.log(`🔗 Port: ${SERVER_CONFIG.port}`);
console.log(`🌐 CORS Origin: ${SERVER_CONFIG.cors.origin}`);

// Validate environment
if (!validateEnvironment()) {
  console.error('❌ Environment validation failed');
  process.exit(1);
}

// Services are imported through controllers and will initialize manually when needed

// Start periodic cleanup
if (SERVER_CONFIG.cleanup.enabled) {
  startPeriodicCleanup();
}

// Debug: Log before creating server
console.log('🔧 DEBUG: About to create Bun.serve on port:', SERVER_CONFIG.port);
console.log('🔧 DEBUG: Current process PID:', process.pid);

// Check if port is already in use before creating server
console.log('🔧 DEBUG: Checking port availability...');

// Declare server variable outside try block
let server: any;

try {
  // Create and start the server
  console.log('🔧 DEBUG: Calling Bun.serve...');
  server = Bun.serve({
  port: SERVER_CONFIG.port,
  hostname: SERVER_CONFIG.host,

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
      console.error('❌ Unhandled server error:', error);

      return new Response(JSON.stringify({
        success: false,
        error: 'Internal server error',
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
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
        console.error('❌ WebSocket open error:', error);
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
        console.error('❌ WebSocket message error:', error);
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
        console.error('❌ WebSocket close error:', error);
      }
    },

    // WebSocket configuration
    idleTimeout: 120,                // 2 minutes
    perMessageDeflate: true
  }
});

console.log('🔧 DEBUG: Bun.serve created successfully!');

// =================================================================
// SERVER STARTUP CONFIRMATION
// =================================================================

console.log('✅ Gomoku Game Server started successfully!');
console.log(`🎮 Server running at http://${SERVER_CONFIG.host}:${SERVER_CONFIG.port}`);
console.log(`🔌 WebSocket endpoint: ws://${SERVER_CONFIG.host}:${SERVER_CONFIG.port}/ws/gomoku/:roomId`);
console.log('');
console.log('📊 Available endpoints:');
console.log('  🎯 Game API:      /api/gomoku/*');
console.log('  ⚙️  Admin API:     /api/admin/*');
console.log('  🏥 Health check:  /health');
console.log('  📋 API status:    /api/status');
console.log('');

// Log server statistics
logServerInfo();

  console.log('🔧 DEBUG: Server setup completed successfully!');

} catch (error) {
  console.error('❌ ERROR: Failed to start server!');
  console.error('🔧 DEBUG: Error details:', error);
  console.error('🔧 DEBUG: Error code:', (error as any)?.code);
  console.error('🔧 DEBUG: Port attempted:', SERVER_CONFIG.port);

  // Check what's using the port
  console.log('🔧 DEBUG: Attempting to check port usage...');
  process.exit(1);
}

// =================================================================
// UTILITY FUNCTIONS
// =================================================================

/**
 * Validates environment configuration
 */
function validateEnvironment(): boolean {
  const required = [];
  const warnings = [];

  // Check optional but recommended variables
  if (!process.env.CORS_ORIGIN) {
    warnings.push('CORS_ORIGIN not set - using wildcard (*)');
  }

  if (!process.env.NODE_ENV) {
    warnings.push('NODE_ENV not set - defaulting to development');
  }

  // Log warnings
  warnings.forEach(warning => {
    console.warn(`⚠️ ${warning}`);
  });

  // All validations passed
  return true;
}

/**
 * Starts periodic cleanup of inactive resources
 */
function startPeriodicCleanup(): void {
  console.log(`🧹 Starting periodic cleanup every ${SERVER_CONFIG.cleanup.interval / 1000 / 60} minutes`);

  setInterval(() => {
    try {
      const gameCleanup = GameService.cleanupInactiveGames();
      const wsCleanup = WebSocketService.cleanupStaleConnections();

      if (gameCleanup > 0 || wsCleanup > 0) {
        console.log(`🧹 Cleanup completed: ${gameCleanup} games, ${wsCleanup} connections`);
      }

      // Optional: Clear AI cache if it gets too large
      const aiStats = AIService.getStats();
      if (aiStats.cacheSize > 50000) {
        AIService.clearCache();
        console.log('🧠 AI cache cleared due to size limit');
      }

    } catch (error) {
      console.error('❌ Cleanup error:', error);
    }
  }, SERVER_CONFIG.cleanup.interval);
}

/**
 * Logs server information and statistics
 */
function logServerInfo(): void {
  const stats = GameService.getServerStats();
  const aiStats = AIService.getStats();
  const wsStats = WebSocketService.getServerStats();

  console.log('📈 Initial server state:');
  console.log(`  🎮 Active games: ${stats.activeRooms}`);
  console.log(`  👥 Active players: ${stats.activePlayers}`);
  console.log(`  🧠 AI cache size: ${aiStats.cacheSize}`);
  console.log(`  🔌 WebSocket connections: ${wsStats.activeConnections}`);
  console.log(`  💾 Memory usage: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)} MB`);
  console.log('');
}

// =================================================================
// GRACEFUL SHUTDOWN
// =================================================================

process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  gracefulShutdown();
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  gracefulShutdown();
});

function gracefulShutdown(): void {
  console.log('🧹 Performing final cleanup...');

  try {
    // Cleanup resources
    const gameCleanup = GameService.cleanupInactiveGames();
    const wsCleanup = WebSocketService.cleanupStaleConnections();

    console.log(`✅ Final cleanup: ${gameCleanup} games, ${wsCleanup} connections`);

    // Log final statistics
    const finalStats = GameService.getServerStats();
    console.log(`📊 Final stats: ${finalStats.activeRooms} games, ${finalStats.activePlayers} players`);

  } catch (error) {
    console.error('❌ Error during shutdown cleanup:', error);
  }

  console.log('👋 Gomoku Game Server shut down complete');
  process.exit(0);
}

// =================================================================
// ERROR HANDLING
// =================================================================

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);

  // Log server state for debugging
  try {
    const stats = GameService.getServerStats();
    console.error('Server state at error:', stats);
  } catch (e) {
    console.error('Could not get server stats:', e);
  }

  // Don't exit immediately - let the process finish current operations
  setTimeout(() => {
    console.error('💀 Exiting due to uncaught exception');
    process.exit(1);
  }, 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);

  // Log but don't exit - unhandled rejections are often recoverable
});

// Export server for testing (commented out to avoid Bun auto-serve)
// export default server;
export { SERVER_CONFIG };