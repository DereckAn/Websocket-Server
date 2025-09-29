// =================================================================
// ADMIN CONTROLLER - Server monitoring and administration
// =================================================================

import GameService from '../services/GameService';
import AIService from '../services/AIService';
import WebSocketService from '../services/WebSocketService';

/**
 * AdminController - Handles administrative and monitoring endpoints
 *
 * Why separate admin controller?
 * - Security: Can be protected separately
 * - Monitoring: Centralized server stats
 * - Debugging: Tools for development
 * - Maintenance: Cleanup and management functions
 */
export class AdminController {

  // =================================================================
  // MONITORING ENDPOINTS
  // =================================================================

  /**
   * GET /api/admin/stats
   * Returns comprehensive server statistics
   */
  static async getServerStats(request: Request): Promise<Response> {
    try {
      console.log('📊 Admin stats request');

      const gameStats = GameService.getServerStats();
      const aiStats = AIService.getStats();
      const wsStats = WebSocketService.getServerStats();

      const stats = {
        server: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          timestamp: new Date().toISOString()
        },
        games: gameStats,
        ai: aiStats,
        websockets: wsStats,
        system: {
          nodeVersion: process.version,
          platform: process.platform,
          cpuUsage: process.cpuUsage()
        }
      };

      return this.successResponse(stats);

    } catch (error) {
      console.error('❌ Error getting server stats:', error);
      return this.errorResponse('Failed to get server statistics', 500);
    }
  }

  /**
   * GET /api/admin/rooms
   * Lists all active rooms with detailed info
   */
  static async getRooms(request: Request): Promise<Response> {
    try {
      console.log('🏠 Admin rooms request');

      const rooms = GameService.listActiveRooms();
      const roomDetails = [];

      // Get detailed info for each room
      for (const room of rooms) {
        const details = GameService.getRoomDetails(room.roomId);
        if (details) {
          roomDetails.push(details);
        }
      }

      return this.successResponse({
        totalRooms: rooms.length,
        rooms: roomDetails
      });

    } catch (error) {
      console.error('❌ Error getting rooms:', error);
      return this.errorResponse('Failed to get room information', 500);
    }
  }

  /**
   * GET /api/admin/connections
   * Lists all active WebSocket connections
   */
  static async getConnections(request: Request): Promise<Response> {
    try {
      console.log('🔌 Admin connections request');

      const connections = WebSocketService.listActiveConnections();
      const wsStats = WebSocketService.getServerStats();

      return this.successResponse({
        summary: wsStats,
        connections: connections
      });

    } catch (error) {
      console.error('❌ Error getting connections:', error);
      return this.errorResponse('Failed to get connection information', 500);
    }
  }

  // =================================================================
  // MAINTENANCE ENDPOINTS
  // =================================================================

  /**
   * POST /api/admin/cleanup
   * Triggers manual cleanup of inactive resources
   */
  static async triggerCleanup(request: Request): Promise<Response> {
    try {
      console.log('🧹 Admin cleanup request');

      const gameCleanupCount = GameService.cleanupInactiveGames();
      const wsCleanupCount = WebSocketService.cleanupStaleConnections();

      // Optionally clear AI cache if it's getting too large
      const aiStats = AIService.getStats();
      let aiCacheCleared = false;
      if (aiStats.cacheSize > 10000) {
        AIService.clearCache();
        aiCacheCleared = true;
      }

      const result = {
        gamesCleanedUp: gameCleanupCount,
        connectionsCleanedUp: wsCleanupCount,
        aiCacheCleared,
        timestamp: new Date().toISOString()
      };

      console.log('✅ Cleanup completed:', result);
      return this.successResponse(result);

    } catch (error) {
      console.error('❌ Error during cleanup:', error);
      return this.errorResponse('Failed to perform cleanup', 500);
    }
  }

  /**
   * DELETE /api/admin/room/:roomId
   * Force closes a specific room
   */
  static async forceCloseRoom(request: Request, roomId: string): Promise<Response> {
    try {
      console.log(`🔒 Admin force close room: ${roomId}`);

      const success = GameService.forceCloseGame(roomId);

      if (success) {
        return this.successResponse({
          message: `Room ${roomId} closed successfully`,
          roomId,
          timestamp: new Date().toISOString()
        });
      } else {
        return this.errorResponse(`Room ${roomId} not found`, 404);
      }

    } catch (error) {
      console.error(`❌ Error closing room ${roomId}:`, error);
      return this.errorResponse('Failed to close room', 500);
    }
  }

  /**
   * DELETE /api/admin/connection/:connectionId
   * Force disconnects a WebSocket connection
   */
  static async forceDisconnect(request: Request, connectionId: string): Promise<Response> {
    try {
      console.log(`🔌 Admin force disconnect: ${connectionId}`);

      const success = WebSocketService.forceDisconnect(connectionId);

      if (success) {
        return this.successResponse({
          message: `Connection ${connectionId} disconnected successfully`,
          connectionId,
          timestamp: new Date().toISOString()
        });
      } else {
        return this.errorResponse(`Connection ${connectionId} not found`, 404);
      }

    } catch (error) {
      console.error(`❌ Error disconnecting ${connectionId}:`, error);
      return this.errorResponse('Failed to disconnect connection', 500);
    }
  }

  // =================================================================
  // AI MANAGEMENT
  // =================================================================

  /**
   * DELETE /api/admin/ai/cache
   * Clears AI cache
   */
  static async clearAICache(request: Request): Promise<Response> {
    try {
      console.log('🧠 Admin clear AI cache request');

      const statsBefore = AIService.getStats();
      AIService.clearCache();
      const statsAfter = AIService.getStats();

      return this.successResponse({
        message: 'AI cache cleared successfully',
        before: statsBefore,
        after: statsAfter,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Error clearing AI cache:', error);
      return this.errorResponse('Failed to clear AI cache', 500);
    }
  }

  /**
   * GET /api/admin/ai/performance
   * Gets detailed AI performance metrics
   */
  static async getAIPerformance(request: Request): Promise<Response> {
    try {
      console.log('🧠 Admin AI performance request');

      const aiStats = AIService.getStats();

      // Additional performance metrics could be added here
      const performance = {
        ...aiStats,
        memoryUsage: process.memoryUsage(),
        recommendations: this.getAIPerformanceRecommendations(aiStats)
      };

      return this.successResponse(performance);

    } catch (error) {
      console.error('❌ Error getting AI performance:', error);
      return this.errorResponse('Failed to get AI performance metrics', 500);
    }
  }

  // =================================================================
  // SYSTEM HEALTH
  // =================================================================

  /**
   * GET /api/admin/health
   * Comprehensive health check
   */
  static async healthCheck(request: Request): Promise<Response> {
    try {
      const gameStats = GameService.getServerStats();
      const aiStats = AIService.getStats();
      const wsStats = WebSocketService.getServerStats();
      const memory = process.memoryUsage();

      // Determine overall health
      const health = {
        status: 'healthy',
        checks: {
          games: gameStats.activeRooms < 100 ? 'healthy' : 'warning',
          memory: memory.heapUsed < 1024 * 1024 * 1024 ? 'healthy' : 'warning', // 1GB
          websockets: wsStats.activeConnections < 1000 ? 'healthy' : 'warning',
          ai: aiStats.cacheSize < 50000 ? 'healthy' : 'warning'
        },
        metrics: {
          uptime: process.uptime(),
          memory,
          games: gameStats,
          websockets: wsStats,
          ai: aiStats
        },
        timestamp: new Date().toISOString()
      };

      // Overall status based on individual checks
      const hasWarnings = Object.values(health.checks).includes('warning');
      health.status = hasWarnings ? 'warning' : 'healthy';

      const statusCode = health.status === 'healthy' ? 200 : 503;
      return this.responseWithStatus(health, statusCode);

    } catch (error) {
      console.error('❌ Error in health check:', error);

      return this.responseWithStatus({
        status: 'unhealthy',
        error: 'Health check failed',
        timestamp: new Date().toISOString()
      }, 503);
    }
  }

  // =================================================================
  // UTILITY METHODS
  // =================================================================

  /**
   * Gets AI performance recommendations
   */
  private static getAIPerformanceRecommendations(stats: any): string[] {
    const recommendations: string[] = [];

    if (stats.cacheSize > 20000) {
      recommendations.push('Consider clearing AI cache - size is getting large');
    }

    if (stats.hitRate < 0.5) {
      recommendations.push('AI cache hit rate is low - check if patterns are repeating');
    }

    if (stats.lastSearchNodes > 100000) {
      recommendations.push('Last search evaluated many nodes - consider time limits');
    }

    if (recommendations.length === 0) {
      recommendations.push('AI performance is optimal');
    }

    return recommendations;
  }

  // =================================================================
  // RESPONSE HELPERS
  // =================================================================

  /**
   * Creates success response
   */
  private static successResponse(data: any): Response {
    const response = {
      success: true,
      data,
      timestamp: new Date().toISOString()
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: this.getHeaders()
    });
  }

  /**
   * Creates error response
   */
  private static errorResponse(error: string, status: number = 500): Response {
    const response = {
      success: false,
      error,
      timestamp: new Date().toISOString()
    };

    return new Response(JSON.stringify(response), {
      status,
      headers: this.getHeaders()
    });
  }

  /**
   * Creates response with custom status
   */
  private static responseWithStatus(data: any, status: number): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: this.getHeaders()
    });
  }

  /**
   * Gets standard headers
   */
  private static getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };
  }
}

export default AdminController;