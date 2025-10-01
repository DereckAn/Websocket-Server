// =================================================================
// GOMOKU ROUTES - Route definitions for Gomoku game endpoints
// =================================================================

import GomokuController from '../controllers/GomokuController';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { handleCorsPrelight } from '../middleware/cors';
import { validateWebSocketOrigin } from '../middleware/cors';
import ResponseView from '../views/ResponseView';

/**
 * Gomoku Routes Handler
 *
 * Why centralized routing?
 * - Clear endpoint organization
 * - Middleware application in correct order
 * - Easy to modify routes without touching main server
 * - Consistent error handling across all routes
 * - Easy to add new endpoints
 */
export class GomokuRoutes {

  /**
   * Handles all HTTP requests for Gomoku endpoints
   */
  static async handleRequest(request: Request, url: URL): Promise<Response | null> {
    const path = url.pathname;
    const method = request.method;

    // CORS preflight handling
    if (method === 'OPTIONS') {
      return handleCorsPrelight(request);
    }

    // Rate limiting check
    const rateLimitResult = rateLimitMiddleware(request);
    if (rateLimitResult) {
      return rateLimitResult; // Rate limit exceeded
    }

    try {
      // Route matching
      switch (true) {
        // POST /api/gomoku/quick-start
        case method === 'POST' && path === '/api/gomoku/quick-start':
          return await this.handleQuickStart(request);

        // POST /api/gomoku/game/:gameId/move
        case method === 'POST' && this.matchesPattern(path, '/api/gomoku/game/*/move'):
          const gameId = this.extractGameId(path);
          return await this.handleMakeMove(request, gameId);

        // GET /api/gomoku/game/:gameId/state
        case method === 'GET' && this.matchesPattern(path, '/api/gomoku/game/*/state'):
          const stateGameId = this.extractGameId(path);
          return await this.handleGetGameState(request, stateGameId);

        // DELETE /api/gomoku/game/:gameId
        case method === 'DELETE' && this.matchesPattern(path, '/api/gomoku/game/*'):
          const endGameId = this.extractGameId(path);
          return await this.handleEndGame(request, endGameId);

        // POST /api/gomoku/game/:gameId/reset
        case method === 'POST' && this.matchesPattern(path, '/api/gomoku/game/*/reset'):
          const resetGameId = this.extractGameId(path);
          return await this.handleResetGame(request, resetGameId);

        // No match
        default:
          return null; // Let other route handlers try
      }

    } catch (error) {
      console.error('❌ Error in Gomoku routes:', error);
      return ResponseView.internalServerError('Route handling failed');
    }
  }

  /**
   * Handles WebSocket upgrade for Gomoku
   */
  static handleWebSocketUpgrade(
    request: Request,
    server: any,
    url: URL
  ): Response | undefined {
    const path = url.pathname;

    // Check if this is a Gomoku WebSocket route
    // WS /ws/gomoku/:roomId
    if (this.matchesPattern(path, '/ws/gomoku/*')) {
      // Validate origin for WebSocket
      if (!validateWebSocketOrigin(request)) {
        return new Response('Forbidden', { status: 403 });
      }

      // Check WebSocket rate limit
      // Note: This is imported but commented out to avoid circular dependency
      // const wsRateLimit = checkWebSocketRateLimit(request);
      // if (!wsRateLimit) {
      //   return new Response('Too many WebSocket connections', { status: 429 });
      // }

      const roomId = this.extractRoomId(path);
      return GomokuController.handleWebSocketUpgrade(request, server, roomId);
    }

    return undefined; // Not a Gomoku WebSocket route
  }

  // =================================================================
  // ROUTE HANDLERS
  // =================================================================

  /**
   * Handles POST /api/gomoku/quick-start
   */
  private static async handleQuickStart(request: Request): Promise<Response> {
    try {
      console.log('🚀 Handling quick start request');
      return await GomokuController.quickStart(request);
    } catch (error) {
      console.error('❌ Quick start error:', error);
      return ResponseView.internalServerError('Failed to create game');
    }
  }

  /**
   * Handles POST /api/gomoku/game/:gameId/move
   */
  private static async handleMakeMove(request: Request, gameId: string): Promise<Response> {
    try {
      console.log(`🎯 Handling move request for game ${gameId}`);

      // Validate gameId
      if (!this.isValidGameId(gameId)) {
        return ResponseView.badRequest('Invalid game ID format');
      }

      return await GomokuController.makeMove(request, gameId);
    } catch (error) {
      console.error(`❌ Make move error for game ${gameId}:`, error);
      return ResponseView.internalServerError('Failed to process move');
    }
  }

  /**
   * Handles GET /api/gomoku/game/:gameId/state
   */
  private static async handleGetGameState(request: Request, gameId: string): Promise<Response> {
    try {
      console.log(`📊 Handling game state request for ${gameId}`);

      // Validate gameId
      if (!this.isValidGameId(gameId)) {
        return ResponseView.badRequest('Invalid game ID format');
      }

      return await GomokuController.getGameState(request, gameId);
    } catch (error) {
      console.error(`❌ Get game state error for ${gameId}:`, error);
      return ResponseView.internalServerError('Failed to get game state');
    }
  }

  /**
   * Handles DELETE /api/gomoku/game/:gameId
   */
  private static async handleEndGame(request: Request, gameId: string): Promise<Response> {
    try {
      console.log(`🔚 Handling end game request for ${gameId}`);

      // Validate gameId
      if (!this.isValidGameId(gameId)) {
        return ResponseView.badRequest('Invalid game ID format');
      }

      return await GomokuController.endGame(request, gameId);
    } catch (error) {
      console.error(`❌ End game error for ${gameId}:`, error);
      return ResponseView.internalServerError('Failed to end game');
    }
  }

  /**
   * Handles POST /api/gomoku/game/:gameId/reset
   * Resets the game in the same room, keeping win stats
   */
  private static async handleResetGame(request: Request, gameId: string): Promise<Response> {
    try {
      console.log(`🔄 Handling reset game request for ${gameId}`);

      // Validate gameId
      if (!this.isValidGameId(gameId)) {
        return ResponseView.badRequest('Invalid game ID format');
      }

      return await GomokuController.resetGame(request, gameId);
    } catch (error) {
      console.error(`❌ Reset game error for ${gameId}:`, error);
      return ResponseView.internalServerError('Failed to reset game');
    }
  }

  // =================================================================
  // UTILITY METHODS
  // =================================================================

  /**
   * Checks if a path matches a pattern with wildcards
   */
  private static matchesPattern(path: string, pattern: string): boolean {
    // Convert pattern to regex
    const regexPattern = pattern
      .replace(/\*/g, '[^/]+') // * matches any non-slash characters
      .replace(/\//g, '\\/');  // Escape slashes

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path);
  }

  /**
   * Extracts game ID from path like /api/gomoku/game/abc123/move
   */
  private static extractGameId(path: string): string {
    const parts = path.split('/');
    const gameIndex = parts.indexOf('game');

    if (gameIndex !== -1 && gameIndex + 1 < parts.length) {
      return parts[gameIndex + 1] || '';
    }

    return '';
  }

  /**
   * Extracts room ID from WebSocket path like /ws/gomoku/ABC123
   */
  private static extractRoomId(path: string): string {
    const parts = path.split('/');
    const gomokuIndex = parts.indexOf('gomoku');

    if (gomokuIndex !== -1 && gomokuIndex + 1 < parts.length) {
      return parts[gomokuIndex + 1] || '';
    }

    return '';
  }

  /**
   * Validates game ID format
   */
  private static isValidGameId(gameId: string): boolean {
    // Game IDs should be alphanumeric with underscores and dashes
    return /^game_[a-zA-Z0-9_-]+$/.test(gameId);
  }

  /**
   * Validates room ID format
   */
  private static isValidRoomId(roomId: string): boolean {
    // Room IDs should be 6 characters (ABC123 format)
    return /^[A-Z]{3}[0-9]{3}$/.test(roomId);
  }

  /**
   * Extracts path parameters for debugging
   */
  static extractPathParams(path: string): Record<string, string> {
    const params: Record<string, string> = {};

    // Extract gameId if present
    const gameIdMatch = path.match(/\/game\/([^\/]+)/);
    if (gameIdMatch && gameIdMatch[1]) {
      params.gameId = gameIdMatch[1];
    }

    // Extract roomId if present
    const roomIdMatch = path.match(/\/gomoku\/([^\/]+)/);
    if (roomIdMatch && roomIdMatch[1]) {
      params.roomId = roomIdMatch[1];
    }

    return params;
  }

  /**
   * Gets route info for debugging/logging
   */
  static getRouteInfo(request: Request): {
    method: string;
    path: string;
    params: Record<string, string>;
    isGomokuRoute: boolean;
    isWebSocketRoute: boolean;
  } {
    const url = new URL(request.url);
    const path = url.pathname;

    return {
      method: request.method,
      path,
      params: this.extractPathParams(path),
      isGomokuRoute: path.startsWith('/api/gomoku/'),
      isWebSocketRoute: path.startsWith('/ws/gomoku/')
    };
  }
}

export default GomokuRoutes;