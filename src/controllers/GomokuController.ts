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
      console.log('🎮 Quick start request received');

      // Parse request body
      let requestData: QuickStartRequest = {};

      try {
        const body = await request.text();
        if (body.trim()) {
          requestData = JSON.parse(body);
        }
      } catch (parseError) {
        console.error('❌ Invalid JSON in quick start request:', parseError);
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

      console.log(`✅ Quick start game created: ${gameResult.gameId}`);

      // Return success response
      return this.successResponse(gameResult);

    } catch (error) {
      console.error('❌ Error in quick start:', error);
      return this.errorResponse('Failed to create game', 500);
    }
  }

  /**
   * POST /api/gomoku/game/:gameId/move
   * Makes a move in an existing game
   */
  static async makeMove(request: Request, gameId: string): Promise<Response> {
    try {
      console.log(`🎯 Move request for game ${gameId}`);

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
        console.log(`✅ Move processed for game ${gameId}`);

        // Broadcast move update via WebSocket
        console.log(`🔌 🚀 About to broadcast move update...`);
        this.broadcastMoveUpdate(moveResult);

        return this.successResponse(moveResult);
      } else {
        console.log(`❌ Invalid move for game ${gameId}: ${moveResult.error}`);
        return this.errorResponse(moveResult.error!, 422);
      }

    } catch (error) {
      console.error(`❌ Error processing move for game ${gameId}:`, error);
      return this.errorResponse('Failed to process move', 500);
    }
  }

  /**
   * GET /api/gomoku/game/:gameId/state
   * Gets current game state
   */
  static async getGameState(request: Request, gameId: string): Promise<Response> {
    try {
      console.log(`📊 Game state request for ${gameId}`);

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
        console.log(`✅ Game state retrieved for ${gameId}`);
        return this.successResponse({ gameState });
      } else {
        console.log(`❌ Game not found: ${gameId}`);
        return this.errorResponse('Game not found', 404);
      }

    } catch (error) {
      console.error(`❌ Error getting game state for ${gameId}:`, error);
      return this.errorResponse('Failed to get game state', 500);
    }
  }

  /**
   * DELETE /api/gomoku/game/:gameId
   * Ends a game (player leaves)
   */
  static async endGame(request: Request, gameId: string): Promise<Response> {
    try {
      console.log(`🔚 End game request for ${gameId}`);

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

      console.log(`✅ Game ended for player ${requestData.playerId}`);
      return this.successResponse({ message: 'Game ended successfully' });

    } catch (error) {
      console.error(`❌ Error ending game ${gameId}:`, error);
      return this.errorResponse('Failed to end game', 500);
    }
  }

  /**
   * POST /api/gomoku/game/:gameId/reset
   * Resets game in same room, keeping win stats
   */
  static async resetGame(request: Request, gameId: string): Promise<Response> {
    try {
      console.log(`🔄 Reset game request for ${gameId}`);

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

      console.log(`✅ Game reset in room ${roomId}. Win stats: H:${room.winStats?.humanWins} AI:${room.winStats?.aiWins}`);

      return this.successResponse({
        message: 'Game reset successfully',
        gameState: room.game,
        winStats: room.winStats
      });

    } catch (error) {
      console.error(`❌ Error resetting game ${gameId}:`, error);
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
      console.log(`🔌 WebSocket upgrade request for room ${roomId}`);

      // Extract connection parameters
      const url = new URL(request.url);
      const playerId = url.searchParams.get('playerId');
      const gameId = url.searchParams.get('gameId');

      if (!playerId || !gameId) {
        console.error('❌ Missing playerId or gameId in WebSocket request');
        return new Response('Missing required parameters', { status: 400 });
      }

      // Validate that the room exists
      const room = GameService.getRoom(roomId);
      if (!room) {
        console.error(`❌ Room not found: ${roomId}`);
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
        console.log(`✅ WebSocket upgraded for player ${playerId} in room ${roomId}`);
        return undefined; // Successful upgrade
      } else {
        console.error(`❌ WebSocket upgrade failed for room ${roomId}`);
        return new Response('WebSocket upgrade failed', { status: 400 });
      }

    } catch (error) {
      console.error('❌ Error in WebSocket upgrade:', error);
      return new Response('Internal server error', { status: 500 });
    }
  }

  /**
   * Handles WebSocket connection open
   */
  static handleWebSocketOpen(ws: any): void {
    try {
      const { roomId, playerId, gameId } = ws.data;

      console.log(`🔌 WebSocket connected: Player ${playerId} in room ${roomId}`);

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
      console.error('❌ Error in WebSocket open:', error);
      ws.close();
    }
  }

  /**
   * Handles WebSocket connection close
   */
  static handleWebSocketClose(ws: any): void {
    try {
      const { playerId, connectionId } = ws.data;

      console.log(`🔌 WebSocket disconnected: Player ${playerId}`);

      // Handle disconnection
      if (connectionId) {
        WebSocketService.handleDisconnection(connectionId);
      }

    } catch (error) {
      console.error('❌ Error in WebSocket close:', error);
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
        console.error('❌ Invalid WebSocket message format:', parseError);
        ws.send(JSON.stringify({
          type: 'error',
          data: { error: 'Invalid message format' },
          timestamp: new Date()
        }));
        return;
      }

      console.log(`📨 WebSocket message from ${playerId}:`, parsedMessage.type);

      // Forward to WebSocketService for processing
      // The service will handle the actual message processing
      // This keeps the controller focused on just handling the WebSocket protocol

    } catch (error) {
      console.error('❌ Error processing WebSocket message:', error);
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
        console.log('🔌 ⚠️ Cannot broadcast: missing gameState or move');
        return;
      }

      // Extract room ID from gameId (game_ABC123 -> ABC123)
      const roomId = moveResult.gameState.id.replace('game_', '');
      console.log(`🔌 📡 Broadcasting move update for room ${roomId}`);

      const room = await GameService.getRoom(roomId);
      if (!room) {
        console.log(`🔌 ⚠️ Cannot broadcast: room ${roomId} not found`);
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
            let statsResult = { specialMessage: undefined as string | undefined, achievedMilestone: false };

            if (room.gameType === 'human-vs-ai') {
              console.log('📊 Game ended, updating win stats...');
              // Find human and AI players
              const aiPlayer = room.game.players.find(p => p.type === 'ai');
              const humanPlayer = room.game.players.find(p => p.type === 'human');

              if (humanPlayer && aiPlayer) {
                console.log('👥 Found players - Human:', humanPlayer.symbol, 'AI:', aiPlayer.symbol);
                console.log('🏆 Winner:', moveResult.gameState.winner);
                console.log('📊 Win stats BEFORE update:', JSON.stringify(room.winStats));

                statsResult = RoomModel.updateWinStats(
                  room,
                  moveResult.gameState.winner,
                  humanPlayer.symbol
                );

                console.log('📊 Win stats AFTER update:', JSON.stringify(room.winStats));
                console.log('✨ Special message:', statsResult.specialMessage);
              } else {
                console.log('❌ Could not find human or AI player');
              }
            }

            setTimeout(() => {
              console.log('📤 Broadcasting game_over with winStats:', JSON.stringify(room.winStats));
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
        console.log('📤 Broadcasting game_over (human move ended game)');

        // Update win stats for AI games BEFORE sending the message
        let statsResult = { specialMessage: undefined as string | undefined, achievedMilestone: false };
        if (room.gameType === 'human-vs-ai') {
          console.log('📊 Updating win stats for human win...');
          const aiPlayer = room.game.players.find(p => p.type === 'ai');
          const humanPlayer = room.game.players.find(p => p.type === 'human');

          if (humanPlayer && aiPlayer) {
            console.log('👥 Found players - Human:', humanPlayer.symbol, 'AI:', aiPlayer.symbol);
            console.log('🏆 Winner:', moveResult.gameState.winner);
            console.log('📊 Win stats BEFORE update:', JSON.stringify(room.winStats));

            statsResult = RoomModel.updateWinStats(
              room,
              moveResult.gameState.winner,
              humanPlayer.symbol
            );

            console.log('📊 Win stats AFTER update:', JSON.stringify(room.winStats));
            console.log('✨ Special message:', statsResult.specialMessage);
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
            console.log('📊 Including winStats in game_over:', JSON.stringify(room.winStats));
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
      console.error('❌ Error broadcasting move update:', error);
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