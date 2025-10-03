// =================================================================
// GAME SERVICE - Game orchestration and business logic
// =================================================================

import {
  type GameState,
  type Player,
  type Room,
  type GameSymbol,
  type Move,
  type QuickStartRequest,
  type QuickStartResponse,
  type MakeMoveRequest,
  type MakeMoveResponse,
  type GameStateRequest,
  GAME_CONFIG
} from '../types/gomoku';
import GameModel from '../models/GameModel';
import PlayerModel from '../models/PlayerModel';
import RoomModel from '../models/RoomModel';
import { logger } from '../utils/logger';

/**
 * GameService - Central orchestrator for all game operations
 *
 * Why this design?
 * - Separates business logic from HTTP/WebSocket concerns
 * - Coordinates between multiple models
 * - Handles complex workflows (create game, join, move, etc.)
 * - Easy to test and maintain
 * - Single source of truth for game operations
 */
export class GameService {

  // In-memory storage for active games (in production, could use Redis)
  private static activeRooms: Map<string, Room> = new Map();
  private static playerRoomMap: Map<string, string> = new Map(); // playerId -> roomId

  // =================================================================
  // QUICK START - Human vs AI
  // =================================================================

  /**
   * Creates a new Human vs AI game instantly
   *
   * Why this approach?
   * - Zero friction: no registration, no waiting
   * - Instant play: AI is created immediately
   * - Perfect for restaurant scenario: "arrive, play, leave"
   */
  static async createQuickStartGame(
    request: QuickStartRequest,
    connectionId?: string
  ): Promise<QuickStartResponse> {

    try {
      // Determine symbols
      const symbolAssignment = PlayerModel.assignSymbolsForVsAI(request.playerSymbol);

      // Create human player
      const humanPlayer = PlayerModel.createHumanPlayer(
        symbolAssignment.humanSymbol,
        connectionId
      );

      // Create AI player
      const aiPlayer = PlayerModel.createAIPlayer(symbolAssignment.aiSymbol);

      // Create room with both players
      const room = RoomModel.createHumanVsAIRoom(humanPlayer, aiPlayer);

      // Store room
      this.activeRooms.set(room.id, room);
      this.playerRoomMap.set(humanPlayer.id, room.id);
      this.playerRoomMap.set(aiPlayer.id, room.id);

      // Build WebSocket endpoint
      const wsEndpoint = `ws://localhost:${process.env.WEBHOOK_PORT || 3000}/ws/gomoku/${room.id}`;

      logger.game('Quick start game created', room.id, {
        humanSymbol: humanPlayer.symbol,
        aiSymbol: aiPlayer.symbol
      });

      return {
        success: true,
        gameId: room.game.id,
        roomId: room.id,
        playerId: humanPlayer.id,
        playerSymbol: humanPlayer.symbol,
        aiSymbol: aiPlayer.symbol,
        wsEndpoint,
        gameState: room.game
      };

    } catch (error) {
      logger.error('Error creating quick start game', error);
      throw new Error('Failed to create game');
    }
  }

  // =================================================================
  // MOVE MANAGEMENT
  // =================================================================

  /**
   * Handles a player move and triggers AI response if needed
   *
   * Why async?
   * - AI calculation takes time (up to 2 seconds)
   * - Don't block other operations
   * - Can add WebSocket notifications during AI thinking
   */
  static async makeMove(request: MakeMoveRequest): Promise<MakeMoveResponse> {

    try {
      // Find player's room
      const roomId = this.playerRoomMap.get(request.playerId);
      if (!roomId) {
        return {
          success: false,
          error: 'Player not in any active game'
        };
      }

      const room = this.activeRooms.get(roomId);
      if (!room) {
        return {
          success: false,
          error: 'Game room not found'
        };
      }

      // Find the player
      const player = RoomModel.getPlayer(room, request.playerId);
      if (!player) {
        return {
          success: false,
          error: 'Player not found in game'
        };
      }

      // Make the move
      const moveResult = GameModel.makeMove(
        room.game,
        request.row,
        request.col,
        player.symbol
      );

      if (!moveResult.isValid) {
        return {
          success: false,
          error: moveResult.error || 'Invalid move'
        };
      }

      // Update room with new game state
      const updatedRoom = RoomModel.updateGameState(room, moveResult.newGameState);
      this.activeRooms.set(roomId, updatedRoom);

      logger.game('Move made', roomId, {
        playerSymbol: player.symbol,
        row: request.row,
        col: request.col
      });

      // Check if game ended
      if (moveResult.newGameState.status === 'won' || moveResult.newGameState.status === 'draw') {
        logger.game('Game ended', roomId, {
          status: moveResult.newGameState.status
        });

        return {
          success: true,
          move: moveResult.move,
          gameState: moveResult.newGameState
        };
      }

      // If it's a Human vs AI game and AI's turn, calculate AI move
      if (room.gameType === 'human-vs-ai' && moveResult.newGameState.currentPlayer !== player.symbol) {
        logger.ai('AI thinking in room', { roomId });

        // Import AIService dynamically to avoid circular dependency
        const { AIService } = await import('./AIService');
        const aiMove = await AIService.calculateBestMove(moveResult.newGameState);

        // Make AI move
        const aiMoveResult = GameModel.makeMove(
          moveResult.newGameState,
          aiMove.row,
          aiMove.col,
          moveResult.newGameState.currentPlayer
        );

        if (aiMoveResult.isValid) {
          // Update room with AI move
          const finalRoom = RoomModel.updateGameState(updatedRoom, aiMoveResult.newGameState);
          this.activeRooms.set(roomId, finalRoom);

          logger.ai('AI moved', {
            playerSymbol: aiMoveResult.move.player,
            row: aiMove.row,
            col: aiMove.col,
            roomId
          });

          return {
            success: true,
            move: moveResult.move,
            gameState: aiMoveResult.newGameState,
            aiMove: {
              row: aiMove.row,
              col: aiMove.col,
              score: aiMove.score,
              timeElapsed: aiMove.timeElapsed,
              nodesSearched: aiMove.nodesSearched,
              depth: aiMove.depth,
              confidence: aiMove.confidence
            }
          };
        }
      }

      return {
        success: true,
        move: moveResult.move,
        gameState: moveResult.newGameState
      };

    } catch (error) {
      logger.error('Error making move', error);
      return {
        success: false,
        error: 'Failed to process move'
      };
    }
  }

  // =================================================================
  // GAME STATE MANAGEMENT
  // =================================================================

  /**
   * Gets current game state for a player
   */
  static getGameState(request: GameStateRequest): GameState | null {
    const roomId = this.playerRoomMap.get(request.playerId);
    if (!roomId) return null;

    const room = this.activeRooms.get(roomId);
    if (!room) return null;

    // Update activity
    const updatedRoom = RoomModel.updateActivity(room);
    this.activeRooms.set(roomId, updatedRoom);

    return updatedRoom.game;
  }

  /**
   * Gets room information
   */
  static getRoom(roomId: string): Room | null {
    return this.activeRooms.get(roomId) || null;
  }

  /**
   * Gets room by player ID
   */
  static getRoomByPlayerId(playerId: string): Room | null {
    const roomId = this.playerRoomMap.get(playerId);
    if (!roomId) return null;
    return this.activeRooms.get(roomId) || null;
  }

  /**
   * Gets all active rooms (for cleanup and monitoring)
   */
  static getAllRooms(): Room[] {
    return Array.from(this.activeRooms.values());
  }

  // =================================================================
  // PLAYER CONNECTION MANAGEMENT
  // =================================================================

  /**
   * Updates player connection status
   */
  static updatePlayerConnection(
    playerId: string,
    isConnected: boolean,
    connectionId?: string
  ): boolean {
    const roomId = this.playerRoomMap.get(playerId);
    if (!roomId) return false;

    const room = this.activeRooms.get(roomId);
    if (!room) return false;

    const player = RoomModel.getPlayer(room, playerId);
    if (!player) return false;

    // Update player connection
    const updatedPlayer = PlayerModel.setConnectionStatus(player, isConnected, connectionId);
    const updatedRoom = RoomModel.updatePlayer(room, playerId, updatedPlayer);

    this.activeRooms.set(roomId, updatedRoom);

    logger.ws('Player connection status updated', undefined, {
      playerId,
      roomId,
      isConnected
    });

    return true;
  }

  /**
   * Handles player disconnect
   */
  static handlePlayerDisconnect(playerId: string): void {
    this.updatePlayerConnection(playerId, false);

    // For vs AI games, we could pause the game
    const room = this.getRoomByPlayerId(playerId);
    if (room && room.gameType === 'human-vs-ai') {
      logger.game('Pausing game due to player disconnect', room.id);
      // Game will resume when player reconnects
    }
  }

  // =================================================================
  // CLEANUP AND MAINTENANCE
  // =================================================================

  /**
   * Cleans up inactive games
   * Should be called periodically (every 5 minutes)
   */
  static cleanupInactiveGames(): number {
    let cleanedCount = 0;

    for (const [roomId, room] of this.activeRooms.entries()) {
      if (RoomModel.shouldCleanup(room)) {
        // Remove room and all player mappings
        this.activeRooms.delete(roomId);

        for (const player of room.game.players) {
          this.playerRoomMap.delete(player.id);
        }

        logger.debug('Cleaned up inactive room', { roomId });
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info('Cleanup completed', { roomsRemoved: cleanedCount });
    }

    return cleanedCount;
  }

  /**
   * Gets server statistics
   */
  static getServerStats(): {
    activeRooms: number;
    activePlayers: number;
    humanVsAIGames: number;
    multiplayerGames: number;
    gamesInProgress: number;
    gamesWaiting: number;
  } {
    let humanVsAIGames = 0;
    let multiplayerGames = 0;
    let gamesInProgress = 0;
    let gamesWaiting = 0;
    let activePlayers = 0;

    for (const room of this.activeRooms.values()) {
      if (room.gameType === 'human-vs-ai') humanVsAIGames++;
      else multiplayerGames++;

      if (room.game.status === 'playing') gamesInProgress++;
      else gamesWaiting++;

      activePlayers += room.game.players.filter(p => p.isConnected).length;
    }

    return {
      activeRooms: this.activeRooms.size,
      activePlayers,
      humanVsAIGames,
      multiplayerGames,
      gamesInProgress,
      gamesWaiting
    };
  }

  /**
   * Force closes a game (admin function)
   */
  static forceCloseGame(roomId: string): boolean {
    const room = this.activeRooms.get(roomId);
    if (!room) return false;

    // Remove room and player mappings
    this.activeRooms.delete(roomId);
    for (const player of room.game.players) {
      this.playerRoomMap.delete(player.id);
    }

    logger.warn('Force closed room', { roomId });
    return true;
  }

  // =================================================================
  // DEVELOPMENT AND DEBUGGING
  // =================================================================

  /**
   * Lists all active rooms (for debugging)
   */
  static listActiveRooms(): Array<{
    roomId: string;
    gameType: string;
    players: string[];
    status: string;
    lastActivity: string;
  }> {
    const rooms = [];

    for (const [roomId, room] of this.activeRooms.entries()) {
      rooms.push({
        roomId,
        gameType: room.gameType,
        players: room.game.players.map(p => `${p.symbol}(${p.type})`),
        status: room.game.status,
        lastActivity: room.lastActivity.toISOString()
      });
    }

    return rooms;
  }

  /**
   * Gets detailed room info (for debugging)
   */
  static getRoomDetails(roomId: string): any {
    const room = this.activeRooms.get(roomId);
    if (!room) return null;

    return {
      room: RoomModel.getStatus(room),
      players: room.game.players.map(p => PlayerModel.getDisplayInfo(p)),
      gameState: {
        moveCount: room.game.moves.length,
        currentPlayer: room.game.currentPlayer,
        status: room.game.status,
        winner: room.game.winner
      },
      moveHistory: GameModel.getMoveHistory(room.game)
    };
  }
}

export default GameService;