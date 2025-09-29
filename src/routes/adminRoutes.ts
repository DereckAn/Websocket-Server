// =================================================================
// ADMIN ROUTES - Administrative and monitoring endpoints
// =================================================================

import AdminController from '../controllers/AdminController';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { handleCorsPrelight } from '../middleware/cors';
import ResponseView from '../views/ResponseView';

/**
 * Admin Routes Handler
 *
 * Why separate admin routes?
 * - Can be protected with different security
 * - Different rate limiting rules
 * - Easy to disable in production if needed
 * - Clear separation from game functionality
 */
export class AdminRoutes {

  /**
   * Handles all HTTP requests for admin endpoints
   */
  static async handleRequest(request: Request, url: URL): Promise<Response | null> {
    const path = url.pathname;
    const method = request.method;

    // Only handle admin routes
    if (!path.startsWith('/api/admin/')) {
      return null;
    }

    // CORS preflight handling
    if (method === 'OPTIONS') {
      return handleCorsPrelight(request);
    }

    // Admin endpoints have stricter rate limiting
    const rateLimitResult = rateLimitMiddleware(request);
    if (rateLimitResult) {
      return rateLimitResult;
    }

    // Optional: Add admin authentication here
    // const authResult = await this.checkAdminAuth(request);
    // if (!authResult.isAuthorized) {
    //   return ResponseView.unauthorized('Admin access required');
    // }

    try {
      // Route matching
      switch (true) {
        // GET /api/admin/stats
        case method === 'GET' && path === '/api/admin/stats':
          return await this.handleGetStats(request);

        // GET /api/admin/rooms
        case method === 'GET' && path === '/api/admin/rooms':
          return await this.handleGetRooms(request);

        // GET /api/admin/connections
        case method === 'GET' && path === '/api/admin/connections':
          return await this.handleGetConnections(request);

        // POST /api/admin/cleanup
        case method === 'POST' && path === '/api/admin/cleanup':
          return await this.handleTriggerCleanup(request);

        // DELETE /api/admin/room/:roomId
        case method === 'DELETE' && this.matchesPattern(path, '/api/admin/room/*'):
          const roomId = this.extractRoomId(path);
          return await this.handleForceCloseRoom(request, roomId);

        // DELETE /api/admin/connection/:connectionId
        case method === 'DELETE' && this.matchesPattern(path, '/api/admin/connection/*'):
          const connectionId = this.extractConnectionId(path);
          return await this.handleForceDisconnect(request, connectionId);

        // DELETE /api/admin/ai/cache
        case method === 'DELETE' && path === '/api/admin/ai/cache':
          return await this.handleClearAICache(request);

        // GET /api/admin/ai/performance
        case method === 'GET' && path === '/api/admin/ai/performance':
          return await this.handleGetAIPerformance(request);

        // GET /api/admin/health
        case method === 'GET' && path === '/api/admin/health':
          return await this.handleHealthCheck(request);

        // No match
        default:
          return ResponseView.notFound('Admin endpoint');
      }

    } catch (error) {
      console.error('❌ Error in Admin routes:', error);
      return ResponseView.internalServerError('Admin route handling failed');
    }
  }

  // =================================================================
  // ROUTE HANDLERS
  // =================================================================

  /**
   * Handles GET /api/admin/stats
   */
  private static async handleGetStats(request: Request): Promise<Response> {
    try {
      console.log('📊 Admin: Getting server stats');
      return await AdminController.getServerStats(request);
    } catch (error) {
      console.error('❌ Admin stats error:', error);
      return ResponseView.internalServerError('Failed to get server statistics');
    }
  }

  /**
   * Handles GET /api/admin/rooms
   */
  private static async handleGetRooms(request: Request): Promise<Response> {
    try {
      console.log('🏠 Admin: Getting rooms');
      return await AdminController.getRooms(request);
    } catch (error) {
      console.error('❌ Admin rooms error:', error);
      return ResponseView.internalServerError('Failed to get room information');
    }
  }

  /**
   * Handles GET /api/admin/connections
   */
  private static async handleGetConnections(request: Request): Promise<Response> {
    try {
      console.log('🔌 Admin: Getting connections');
      return await AdminController.getConnections(request);
    } catch (error) {
      console.error('❌ Admin connections error:', error);
      return ResponseView.internalServerError('Failed to get connection information');
    }
  }

  /**
   * Handles POST /api/admin/cleanup
   */
  private static async handleTriggerCleanup(request: Request): Promise<Response> {
    try {
      console.log('🧹 Admin: Triggering cleanup');
      return await AdminController.triggerCleanup(request);
    } catch (error) {
      console.error('❌ Admin cleanup error:', error);
      return ResponseView.internalServerError('Failed to perform cleanup');
    }
  }

  /**
   * Handles DELETE /api/admin/room/:roomId
   */
  private static async handleForceCloseRoom(request: Request, roomId: string): Promise<Response> {
    try {
      console.log(`🔒 Admin: Force closing room ${roomId}`);

      if (!this.isValidRoomId(roomId)) {
        return ResponseView.badRequest('Invalid room ID format');
      }

      return await AdminController.forceCloseRoom(request, roomId);
    } catch (error) {
      console.error(`❌ Admin force close room error for ${roomId}:`, error);
      return ResponseView.internalServerError('Failed to close room');
    }
  }

  /**
   * Handles DELETE /api/admin/connection/:connectionId
   */
  private static async handleForceDisconnect(request: Request, connectionId: string): Promise<Response> {
    try {
      console.log(`🔌 Admin: Force disconnecting ${connectionId}`);

      if (!this.isValidConnectionId(connectionId)) {
        return ResponseView.badRequest('Invalid connection ID format');
      }

      return await AdminController.forceDisconnect(request, connectionId);
    } catch (error) {
      console.error(`❌ Admin force disconnect error for ${connectionId}:`, error);
      return ResponseView.internalServerError('Failed to disconnect connection');
    }
  }

  /**
   * Handles DELETE /api/admin/ai/cache
   */
  private static async handleClearAICache(request: Request): Promise<Response> {
    try {
      console.log('🧠 Admin: Clearing AI cache');
      return await AdminController.clearAICache(request);
    } catch (error) {
      console.error('❌ Admin clear AI cache error:', error);
      return ResponseView.internalServerError('Failed to clear AI cache');
    }
  }

  /**
   * Handles GET /api/admin/ai/performance
   */
  private static async handleGetAIPerformance(request: Request): Promise<Response> {
    try {
      console.log('🧠 Admin: Getting AI performance');
      return await AdminController.getAIPerformance(request);
    } catch (error) {
      console.error('❌ Admin AI performance error:', error);
      return ResponseView.internalServerError('Failed to get AI performance metrics');
    }
  }

  /**
   * Handles GET /api/admin/health
   */
  private static async handleHealthCheck(request: Request): Promise<Response> {
    try {
      console.log('🏥 Admin: Health check');
      return await AdminController.healthCheck(request);
    } catch (error) {
      console.error('❌ Admin health check error:', error);
      return ResponseView.internalServerError('Health check failed');
    }
  }

  // =================================================================
  // AUTHENTICATION (Optional)
  // =================================================================

  /**
   * Checks admin authentication (disabled for now)
   */
  private static async checkAdminAuth(request: Request): Promise<{
    isAuthorized: boolean;
    reason?: string;
  }> {
    // For development, allow all admin requests
    if (process.env.NODE_ENV !== 'production') {
      return { isAuthorized: true };
    }

    // In production, could check:
    // - API key in headers
    // - JWT token
    // - IP whitelist
    // - etc.

    const authHeader = request.headers.get('authorization');
    const adminKey = process.env.ADMIN_API_KEY;

    if (!adminKey) {
      // No admin key configured = admin endpoints disabled
      return { isAuthorized: false, reason: 'Admin endpoints disabled' };
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { isAuthorized: false, reason: 'Authorization header required' };
    }

    const token = authHeader.substring(7); // Remove 'Bearer '
    if (token !== adminKey) {
      return { isAuthorized: false, reason: 'Invalid admin key' };
    }

    return { isAuthorized: true };
  }

  // =================================================================
  // UTILITY METHODS
  // =================================================================

  /**
   * Checks if a path matches a pattern with wildcards
   */
  private static matchesPattern(path: string, pattern: string): boolean {
    const regexPattern = pattern
      .replace(/\*/g, '[^/]+')
      .replace(/\//g, '\\/');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path);
  }

  /**
   * Extracts room ID from path like /api/admin/room/ABC123
   */
  private static extractRoomId(path: string): string {
    const parts = path.split('/');
    const roomIndex = parts.indexOf('room');

    if (roomIndex !== -1 && roomIndex + 1 < parts.length) {
      return parts[roomIndex + 1] || '';
    }

    return '';
  }

  /**
   * Extracts connection ID from path like /api/admin/connection/ws_123_abc
   */
  private static extractConnectionId(path: string): string {
    const parts = path.split('/');
    const connIndex = parts.indexOf('connection');

    if (connIndex !== -1 && connIndex + 1 < parts.length) {
      return parts[connIndex + 1] || '';
    }

    return '';
  }

  /**
   * Validates room ID format
   */
  private static isValidRoomId(roomId: string): boolean {
    return /^[A-Z]{3}[0-9]{3}$/.test(roomId);
  }

  /**
   * Validates connection ID format
   */
  private static isValidConnectionId(connectionId: string): boolean {
    return /^ws_[a-zA-Z0-9_]+$/.test(connectionId);
  }

  /**
   * Gets admin route info for logging
   */
  static getAdminRouteInfo(request: Request): {
    isAdminRoute: boolean;
    endpoint: string;
    requiresAuth: boolean;
  } {
    const url = new URL(request.url);
    const path = url.pathname;

    const isAdminRoute = path.startsWith('/api/admin/');

    return {
      isAdminRoute,
      endpoint: path,
      requiresAuth: isAdminRoute && process.env.NODE_ENV === 'production'
    };
  }
}

export default AdminRoutes;