// =================================================================
// GOMOKU CONTROLLER - HTTP and WebSocket request handling
// =================================================================

import {
  type QuickStartRequest,
  type QuickStartResponse,
  type MakeMoveRequest,
  type MakeMoveResponse,
  type GameStateRequest,
  type ErrorResponse,
  type WSMessage
} from '../types/gomoku';
import GameService from '../services/GameService';
import WebSocketService from '../services/WebSocketService';
import RoomModel from '../models/RoomModel';
import { logger } from '../utils/logger';

/**
 * GomokuController - Handles all Gomoku-related HTTP and WebSocket requests
 *
 * Why this design?
 * - Single responsibility: Only handles request/response
 * - Delegates business logic to Services
 * - Consistent error handling and response formatting
 * - Clear separation between HTTP and WebSocket concerns
 * - Easy to test and mock
 */
export class GomokuController {

  // =================================================================
  // HTTP ENDPOINTS
  // =================================================================

  /**
   * POST /api/gomoku/quick-start
   * Creates a new Human vs AI game instantly
   */
  static async quickStart(request: Request): Promise<Response> {
    try {
      logger.game('Quick start request received');

      // Parse request body
      let requestData: QuickStartRequest = {};

      try {
        const body = await request.text();
        if (body.trim()) {
          requestData = JSON.parse(body);
        }
      } catch (parseError) {
        logger.error('Invalid JSON in quick start request', parseError);
        return this.errorResponse('Invalid JSON format', 400);
      }

      // Validate request data
      const validation = this.validateQuickStartRequest(requestData);
      if (!validation.isValid) {
        return this.errorResponse(validation.error!, 400);
      }

      // Extract connection info for WebSocket
      const connectionId = this.extractConnectionId(request);

      // Create game via GameService
      const gameResult = await GameService.createQuickStartGame(
        requestData,
        connectionId
      );

      logger.game('Quick start game created', undefined, { gameId: gameResult.gameId });

      // Return success response
      return this.successResponse(gameResult);

    } catch (error) {
      logger.error('Error in quick start', error);
      return this.errorResponse('Failed to create game', 500);
    }
  }

  /**
   * POST /api/gomoku/game/:gameId/move
   * Makes a move in an existing game
   */
  static async makeMove(request: Request, gameId: string): Promise<Response> {
    try {
      logger.game('Move request', undefined, { gameId });

      // Parse request body
      let moveData: any;
      try {
        const body = await request.text();
        moveData = JSON.parse(body);
      } catch (parseError) {
        return this.errorResponse('Invalid JSON format', 400);
      }

      // Validate move data
      const validation = this.validateMoveRequest(moveData, gameId);
      if (!validation.isValid) {
        return this.errorResponse(validation.error!, 400);
      }

      // Process move via GameService
      const moveResult = await GameService.makeMove({
        row: moveData.row,
        col: moveData.col,
        playerId: moveData.playerId
      });

      if (moveResult.success) {
        logger.game('Move processed', undefined, { gameId });

        // Broadcast move update via WebSocket
        logger.debug('About to broadcast move update');
        this.broadcastMoveUpdate(moveResult);

        return this.successResponse(moveResult);
      } else {
        logger.warn('Invalid move', { gameId, error: moveResult.error });
        return this.errorResponse(moveResult.error!, 422);
      }

    } catch (error) {
      logger.error('Error processing move', error, { gameId });
      return this.errorResponse('Failed to process move', 500);
    }
  }

  /**
   * GET /api/gomoku/game/:gameId/state
   * Gets current game state
   */
  static async getGameState(request: Request, gameId: string): Promise<Response> {
    try {
      logger.game('Game state request', undefined, { gameId });

      // Extract player ID from query params
      const url = new URL(request.url);
      const playerId = url.searchParams.get('playerId');

      if (!playerId) {
        return this.errorResponse('Player ID is required', 400);
      }

      // Get game state via GameService
      const gameState = GameService.getGameState({
        gameId,
        playerId
      });

      if (gameState) {
        logger.game('Game state retrieved', undefined, { gameId });
        return this.successResponse({ gameState });
      } else {
        logger.warn('Game not found', { gameId });
        return this.errorResponse('Game not found', 404);
      }

    } catch (error) {
      logger.error('Error getting game state', error, { gameId });
      return this.errorResponse('Failed to get game state', 500);
    }
  }

  /**
   * DELETE /api/gomoku/game/:gameId
   * Ends a game (player leaves)
   */
  static async endGame(request: Request, gameId: string): Promise<Response> {
    try {
      logger.game('End game request', undefined, { gameId });

      // Parse request body for player ID
      let requestData: any;
      try {
        const body = await request.text();
        requestData = JSON.parse(body);
      } catch (parseError) {
        return this.errorResponse('Invalid JSON format', 400);
      }

      if (!requestData.playerId) {
        return this.errorResponse('Player ID is required', 400);
      }

      // Handle player disconnect
      GameService.handlePlayerDisconnect(requestData.playerId);

      logger.game('Game ended for player', undefined, { playerId: requestData.playerId });
      return this.successResponse({ message: 'Game ended successfully' });

    } catch (error) {
      logger.error('Error ending game', error, { gameId });
      return this.errorResponse('Failed to end game', 500);
    }
  }

  /**
   * POST /api/gomoku/game/:gameId/reset
   * Resets game in same room, keeping win stats
   */
  static async resetGame(request: Request, gameId: string): Promise<Response> {
    try {
      logger.game('Reset game request', undefined, { gameId });

      // Extract room ID from gameId (game_ABC123 -> ABC123)
      const roomId = gameId.replace('game_', '');

      // Get room
      const room = await GameService.getRoom(roomId);
      if (!room) {
        return this.errorResponse('Room not found', 404);
      }

      // Reset game in room (keeps win stats)
      RoomModel.resetGameInRoom(room);

      // Broadcast game reset to all players
      const { default: WebSocketService } = await import('../services/WebSocketService');
      WebSocketService.broadcastToRoom(room.id, {
        type: 'game_reset',
        gameId: room.game.id,
        data: {
          gameState: room.game,
          winStats: room.winStats,
          message: 'New game started! Win stats preserved.'
        },
        timestamp: new Date()
      });

      logger.game('Game reset in room', roomId, {
        winStats: {
          humanWins: room.winStats?.humanWins,
          aiWins: room.winStats?.aiWins
        }
      });

      return this.successResponse({
        message: 'Game reset successfully',
        gameState: room.game,
        winStats: room.winStats
      });

    } catch (error) {
      logger.error('Error resetting game', error, { gameId });
      return this.errorResponse('Failed to reset game', 500);
    }
  }

  // =================================================================
  // WEBSOCKET HANDLERS
  // =================================================================

  /**
   * Handles WebSocket connection upgrade
   * WS /ws/gomoku/:roomId
   */
  static handleWebSocketUpgrade(
    request: Request,
    server: any,
    roomId: string
  ): Response | undefined {
    try {
      logger.ws('WebSocket upgrade request', undefined, { roomId });

      // Extract connection parameters
      const url = new URL(request.url);
      const playerId = url.searchParams.get('playerId');
      const gameId = url.searchParams.get('gameId');

      if (!playerId || !gameId) {
        logger.error('Missing playerId or gameId in WebSocket request');
        return new Response('Missing required parameters', { status: 400 });
      }

      // Validate that the room exists
      const room = GameService.getRoom(roomId);
      if (!room) {
        logger.error('Room not found for WebSocket', { roomId });
        return new Response('Room not found', { status: 404 });
      }

      // Attempt WebSocket upgrade
      const upgraded = server.upgrade(request, {
        data: {
          roomId,
          playerId,
          gameId,
          connectedAt: new Date()
        }
      });

      if (upgraded) {
        logger.ws('WebSocket upgraded', undefined, { playerId, roomId });
        return undefined; // Successful upgrade
      } else {
        logger.error('WebSocket upgrade failed', { roomId });
        return new Response('WebSocket upgrade failed', { status: 400 });
      }

    } catch (error) {
      logger.error('Error in WebSocket upgrade', error);
      return new Response('Internal server error', { status: 500 });
    }
  }

  /**
   * Handles WebSocket connection open
   */
  static handleWebSocketOpen(ws: any): void {
    try {
      const { roomId, playerId, gameId } = ws.data;

      logger.ws('WebSocket connected', undefined, { playerId, roomId });

      // Register connection with WebSocketService
      const connectionId = WebSocketService.handleConnection(
        ws,
        playerId,
        roomId,
        gameId
      );

      // Update player connection status
      GameService.updatePlayerConnection(playerId, true, connectionId);

      // Store connection ID in WebSocket data
      ws.data.connectionId = connectionId;

    } catch (error) {
      logger.error('Error in WebSocket open', error);
      ws.close();
    }
  }

  /**
   * Handles WebSocket connection close
   */
  static handleWebSocketClose(ws: any): void {
    try {
      const { playerId, connectionId } = ws.data;

      logger.ws('WebSocket disconnected', undefined, { playerId });

      // Handle disconnection
      if (connectionId) {
        WebSocketService.handleDisconnection(connectionId);
      }

    } catch (error) {
      logger.error('Error in WebSocket close', error);
    }
  }

  /**
   * Handles WebSocket messages
   */
  static handleWebSocketMessage(ws: any, message: string): void {
    try {
      const { connectionId, playerId } = ws.data;

      // Parse message
      let parsedMessage: any;
      try {
        parsedMessage = JSON.parse(message);
      } catch (parseError) {
        logger.error('Invalid WebSocket message format', parseError);
        ws.send(JSON.stringify({
          type: 'error',
          data: { error: 'Invalid message format' },
          timestamp: new Date()
        }));
        return;
      }

      logger.ws('WebSocket message received', undefined, {
        playerId,
        messageType: parsedMessage.type
      });

      // Forward to WebSocketService for processing
      // The service will handle the actual message processing
      // This keeps the controller focused on just handling the WebSocket protocol

    } catch (error) {
      logger.error('Error processing WebSocket message', error);
      ws.send(JSON.stringify({
        type: 'error',
        data: { error: 'Failed to process message' },
        timestamp: new Date()
      }));
    }
  }

  // =================================================================
  // VALIDATION METHODS
  // =================================================================

  /**
   * Validates quick start request
   */
  private static validateQuickStartRequest(data: any): {
    isValid: boolean;
    error?: string;
  } {
    // Quick start is very permissive - most fields are optional
    if (data.playerSymbol && !['X', 'O'].includes(data.playerSymbol)) {
      return { isValid: false, error: 'Invalid player symbol' };
    }

    return { isValid: true };
  }

  /**
   * Validates move request
   */
  private static validateMoveRequest(data: any, gameId: string): {
    isValid: boolean;
    error?: string;
  } {
    if (!data.playerId) {
      return { isValid: false, error: 'Player ID is required' };
    }

    if (typeof data.row !== 'number' || data.row < 0 || data.row >= 15) {
      return { isValid: false, error: 'Invalid row value' };
    }

    if (typeof data.col !== 'number' || data.col < 0 || data.col >= 15) {
      return { isValid: false, error: 'Invalid column value' };
    }

    return { isValid: true };
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
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
  }

  /**
   * Creates error response
   */
  private static errorResponse(error: string, status: number = 500): Response {
    const response: ErrorResponse = {
      success: false,
      error,
      code: this.getErrorCode(status),
      timestamp: new Date()
    };

    return new Response(JSON.stringify(response), {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
  }

  /**
   * Gets error code from HTTP status
   */
  private static getErrorCode(status: number): string {
    switch (status) {
      case 400: return 'BAD_REQUEST';
      case 404: return 'NOT_FOUND';
      case 422: return 'UNPROCESSABLE_ENTITY';
      case 500: return 'INTERNAL_SERVER_ERROR';
      default: return 'UNKNOWN_ERROR';
    }
  }

  // =================================================================
  // WEBSOCKET BROADCASTING METHODS
  // =================================================================

  /**
   * Broadcasts move updates via WebSocket
   */
  private static async broadcastMoveUpdate(moveResult: any): Promise<void> {
    try {
      // Import WebSocketService to avoid circular dependency
      const { default: WebSocketService } = await import('../services/WebSocketService');

      if (!moveResult.gameState || !moveResult.move) {
        logger.warn('Cannot broadcast: missing gameState or move');
        return;
      }

      // Extract room ID from gameId (game_ABC123 -> ABC123)
      const roomId = moveResult.gameState.id.replace('game_', '');
      logger.ws('Broadcasting move update', undefined, { roomId });

      const room = await GameService.getRoom(roomId);
      if (!room) {
        logger.warn('Cannot broadcast: room not found', { roomId });
        return;
      }

      // Broadcast player move
      WebSocketService.broadcastToRoom(room.id, {
        type: 'move_made',
        gameId: moveResult.gameState.id,
        roomId: room.id,
        data: {
          move: moveResult.move,
          gameState: moveResult.gameState,
          playerId: moveResult.move.playerId || moveResult.playerId
        },
        timestamp: new Date()
      });

      // If there's an AI move, broadcast it too
      if (moveResult.aiMove) {
        // Send "AI thinking" notification first
        WebSocketService.broadcastToRoom(room.id, {
          type: 'ai_thinking',
          gameId: moveResult.gameState.id,
          data: {
            message: 'AI is thinking...',
            estimatedTime: 1000
          },
          timestamp: new Date()
        });

        // Send AI move after a brief delay
        setTimeout(() => {
          WebSocketService.broadcastToRoom(room.id, {
            type: 'ai_move',
            gameId: moveResult.gameState.id,
            data: {
              move: moveResult.aiMove,
              gameState: moveResult.gameState,
              aiStats: {
                timeElapsed: moveResult.aiMove.timeElapsed,
                nodesSearched: moveResult.aiMove.nodesSearched || 0,
                confidence: moveResult.aiMove.confidence || 0.5
              }
            },
            timestamp: new Date()
          });

          // Check if game ended
          if (moveResult.gameState.status === 'won' || moveResult.gameState.status === 'draw') {
            // Update win stats for AI games
            let statsResult: { specialMessage: string | undefined; achievedMilestone: boolean } = { specialMessage: undefined, achievedMilestone: false };

            if (room.gameType === 'human-vs-ai') {
              logger.game('Game ended, updating win stats', roomId);
              // Find human and AI players
              const aiPlayer = room.game.players.find(p => p.type === 'ai');
              const humanPlayer = room.game.players.find(p => p.type === 'human');

              if (humanPlayer && aiPlayer) {
                logger.debug('Found players', {
                  humanSymbol: humanPlayer.symbol,
                  aiSymbol: aiPlayer.symbol,
                  winner: moveResult.gameState.winner,
                  winStatsBefore: room.winStats
                });

                statsResult = RoomModel.updateWinStats(
                  room,
                  moveResult.gameState.winner,
                  humanPlayer.symbol
                );

                logger.debug('Win stats updated', {
                  winStatsAfter: room.winStats,
                  specialMessage: statsResult.specialMessage
                });
              } else {
                logger.warn('Could not find human or AI player');
              }
            }

            setTimeout(() => {
              logger.ws('Broadcasting game_over', undefined, { roomId, winStats: room.winStats });
              WebSocketService.broadcastToRoom(room.id, {
                type: 'game_over',
                gameId: moveResult.gameState.id,
                data: {
                  gameState: moveResult.gameState,
                  winner: moveResult.gameState.winner,
                  finalMessage: moveResult.gameState.status === 'won'
                    ? `${moveResult.gameState.winner} wins!`
                    : 'Game ended in a draw!',
                  winStats: room.winStats, // Include win stats
                  specialMessage: statsResult.specialMessage, // Milestone message
                  achievedMilestone: statsResult.achievedMilestone
                },
                timestamp: new Date()
              });
            }, 100);
          }
        }, 100);
      }

      // Check if game ended (for non-AI games or when human wins in AI game)
      if (!moveResult.aiMove && (moveResult.gameState.status === 'won' || moveResult.gameState.status === 'draw')) {
        logger.ws('Broadcasting game_over (human move ended game)', undefined, { roomId });

        // Update win stats for AI games BEFORE sending the message
        let statsResult: { specialMessage: string | undefined; achievedMilestone: boolean } = { specialMessage: undefined, achievedMilestone: false };
        if (room.gameType === 'human-vs-ai') {
          logger.game('Updating win stats for human win', roomId);
          const aiPlayer = room.game.players.find(p => p.type === 'ai');
          const humanPlayer = room.game.players.find(p => p.type === 'human');

          if (humanPlayer && aiPlayer) {
            logger.debug('Found players', {
              humanSymbol: humanPlayer.symbol,
              aiSymbol: aiPlayer.symbol,
              winner: moveResult.gameState.winner,
              winStatsBefore: room.winStats
            });

            statsResult = RoomModel.updateWinStats(
              room,
              moveResult.gameState.winner,
              humanPlayer.symbol
            );

            logger.debug('Win stats updated', {
              winStatsAfter: room.winStats,
              specialMessage: statsResult.specialMessage
            });
          }
        }

        setTimeout(() => {
          // Include winStats if it's an AI game
          const messageData: any = {
            gameState: moveResult.gameState,
            winner: moveResult.gameState.winner,
            finalMessage: moveResult.gameState.status === 'won'
              ? `${moveResult.gameState.winner} wins!`
              : 'Game ended in a draw!'
          };

          // Add winStats for AI games
          if (room.gameType === 'human-vs-ai' && room.winStats) {
            messageData.winStats = room.winStats;
            messageData.specialMessage = statsResult.specialMessage;
            messageData.achievedMilestone = statsResult.achievedMilestone;
            logger.debug('Including winStats in game_over', { winStats: room.winStats });
          }

          WebSocketService.broadcastToRoom(room.id, {
            type: 'game_over',
            gameId: moveResult.gameState.id,
            data: messageData,
            timestamp: new Date()
          });
        }, 50);
      }

    } catch (error) {
      logger.error('Error broadcasting move update', error);
    }
  }

  /**
   * Extracts connection ID from request headers
   */
  private static extractConnectionId(request: Request): string | undefined {
    // In a real implementation, this might extract from headers
    // For now, we'll let the WebSocket connection handle this
    return undefined;
  }
}

export default GomokuController;