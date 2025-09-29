// =================================================================
// GAME VIEW - Response formatting for game-related endpoints
// =================================================================

import {
  type GameState,
  type Move,
  type AIMove,
  type Player,
  type Room,
  type QuickStartResponse,
  type MakeMoveResponse,
  type WSMessage
} from '../types/gomoku';

/**
 * GameView - Formats game data for API responses
 *
 * Why Views in MVC?
 * - Consistent response format across all endpoints
 * - Separation between data structure and API contract
 * - Easy to modify response format without changing business logic
 * - Centralized formatting rules
 * - Better API versioning support
 */
export class GameView {

  // =================================================================
  // GAME RESPONSE FORMATTING
  // =================================================================

  /**
   * Formats quick start game response
   */
  static formatQuickStartResponse(gameData: any): QuickStartResponse {
    return {
      success: true,
      gameId: gameData.gameId,
      roomId: gameData.roomId,
      playerId: gameData.playerId,
      playerSymbol: gameData.playerSymbol,
      aiSymbol: gameData.aiSymbol,
      wsEndpoint: gameData.wsEndpoint,
      gameState: this.formatGameState(gameData.gameState)
    };
  }

  /**
   * Formats game state for API responses
   */
  static formatGameState(gameState: GameState): GameState {
    return {
      id: gameState.id,
      board: gameState.board,
      currentPlayer: gameState.currentPlayer,
      status: gameState.status,
      winner: gameState.winner,
      moves: gameState.moves.map(move => this.formatMove(move)),
      players: gameState.players.map(player => this.formatPlayer(player)),
      createdAt: gameState.createdAt,
      lastActivity: gameState.lastActivity,
      winningPositions: gameState.winningPositions
    };
  }

  /**
   * Formats a single move
   */
  static formatMove(move: Move): Move {
    return {
      row: move.row,
      col: move.col,
      player: move.player,
      timestamp: move.timestamp,
      moveNumber: move.moveNumber
    };
  }

  /**
   * Formats player information
   */
  static formatPlayer(player: Player): Player {
    // Don't expose connection ID in public API
    return {
      id: player.id,
      symbol: player.symbol,
      type: player.type,
      joinedAt: player.joinedAt,
      isConnected: player.isConnected,
      lastActivity: player.lastActivity,
      connectionId: undefined // Hide connection ID for security
    };
  }

  /**
   * Formats AI move response
   */
  static formatAIMove(aiMove: AIMove): AIMove {
    return {
      row: aiMove.row,
      col: aiMove.col,
      score: aiMove.score,
      timeElapsed: aiMove.timeElapsed,
      nodesSearched: aiMove.nodesSearched,
      depth: aiMove.depth,
      confidence: aiMove.confidence
    };
  }

  /**
   * Formats make move response
   */
  static formatMakeMoveResponse(moveResult: any): MakeMoveResponse {
    const response: MakeMoveResponse = {
      success: moveResult.success
    };

    if (moveResult.success) {
      response.move = this.formatMove(moveResult.move);
      response.gameState = this.formatGameState(moveResult.gameState);

      if (moveResult.aiMove) {
        response.aiMove = this.formatAIMove(moveResult.aiMove);
      }
    } else {
      response.error = moveResult.error;
    }

    return response;
  }

  // =================================================================
  // WEBSOCKET MESSAGE FORMATTING
  // =================================================================

  /**
   * Formats WebSocket message for game updates
   */
  static formatGameUpdateMessage(
    type: 'move_made' | 'ai_move' | 'game_over',
    data: any
  ): WSMessage {
    const baseMessage: WSMessage = {
      type,
      timestamp: new Date()
    };

    switch (type) {
      case 'move_made':
        return {
          ...baseMessage,
          gameId: data.gameId,
          roomId: data.roomId,
          data: {
            move: this.formatMove(data.move),
            gameState: this.formatGameState(data.gameState),
            playerId: data.playerId
          }
        };

      case 'ai_move':
        return {
          ...baseMessage,
          gameId: data.gameId,
          data: {
            move: this.formatMove(data.move),
            gameState: this.formatGameState(data.gameState),
            aiStats: {
              timeElapsed: data.aiStats.timeElapsed,
              nodesSearched: data.aiStats.nodesSearched,
              confidence: data.aiStats.confidence
            }
          }
        };

      case 'game_over':
        return {
          ...baseMessage,
          gameId: data.gameId,
          data: {
            gameState: this.formatGameState(data.gameState),
            winner: data.winner,
            finalMessage: data.finalMessage,
            gameStats: this.formatGameStats(data.gameState)
          }
        };

      default:
        return baseMessage;
    }
  }

  /**
   * Formats AI thinking notification
   */
  static formatAIThinkingMessage(gameId: string, estimatedTime: number): WSMessage {
    return {
      type: 'ai_thinking',
      gameId,
      data: {
        message: 'AI is calculating the best move...',
        estimatedTime,
        progress: 0 // Could be updated with actual progress
      },
      timestamp: new Date()
    };
  }

  /**
   * Formats player connection update
   */
  static formatPlayerConnectionMessage(
    type: 'player_joined' | 'player_left',
    data: any
  ): WSMessage {
    return {
      type,
      gameId: data.gameId,
      roomId: data.roomId,
      data: {
        playerId: data.playerId,
        playerSymbol: data.playerSymbol,
        message: data.message,
        remainingPlayers: data.remainingPlayers
      },
      timestamp: new Date()
    };
  }

  // =================================================================
  // ADMIN/MONITORING VIEWS
  // =================================================================

  /**
   * Formats room information for admin views
   */
  static formatRoomInfo(room: Room): {
    id: string;
    gameType: string;
    playerCount: number;
    gameStatus: string;
    createdAt: string;
    lastActivity: string;
    players: Array<{
      id: string;
      symbol: string;
      type: string;
      isConnected: boolean;
    }>;
  } {
    return {
      id: room.id,
      gameType: room.gameType,
      playerCount: room.game.players.length,
      gameStatus: room.game.status,
      createdAt: room.createdAt.toISOString(),
      lastActivity: room.lastActivity.toISOString(),
      players: room.game.players.map(player => ({
        id: player.id,
        symbol: player.symbol,
        type: player.type,
        isConnected: player.isConnected
      }))
    };
  }

  /**
   * Formats server statistics
   */
  static formatServerStats(stats: any): {
    summary: {
      activeGames: number;
      activePlayers: number;
      uptime: string;
      memoryUsage: string;
    };
    games: any;
    ai: any;
    websockets: any;
    timestamp: string;
  } {
    return {
      summary: {
        activeGames: stats.games.activeRooms,
        activePlayers: stats.games.activePlayers,
        uptime: this.formatUptime(stats.server.uptime),
        memoryUsage: this.formatMemoryUsage(stats.server.memory.heapUsed)
      },
      games: stats.games,
      ai: stats.ai,
      websockets: stats.websockets,
      timestamp: new Date().toISOString()
    };
  }

  // =================================================================
  // ERROR FORMATTING
  // =================================================================

  /**
   * Formats error responses consistently
   */
  static formatError(
    error: string,
    code: string = 'UNKNOWN_ERROR',
    details?: any
  ): {
    success: false;
    error: string;
    code: string;
    details?: any;
    timestamp: string;
  } {
    return {
      success: false,
      error,
      code,
      ...(details && { details }),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Formats validation errors
   */
  static formatValidationError(errors: string[]): {
    success: false;
    error: string;
    code: string;
    details: string[];
    timestamp: string;
  } {
    return {
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: errors,
      timestamp: new Date().toISOString()
    };
  }

  // =================================================================
  // UTILITY FORMATTING HELPERS
  // =================================================================

  /**
   * Formats game statistics for final game summary
   */
  private static formatGameStats(gameState: GameState): {
    totalMoves: number;
    gameDuration: string;
    movesByPlayer: Record<string, number>;
  } {
    const totalMoves = gameState.moves.length;
    const gameDuration = this.formatDuration(
      gameState.lastActivity.getTime() - gameState.createdAt.getTime()
    );

    const movesByPlayer: Record<string, number> = {};
    for (const move of gameState.moves) {
      movesByPlayer[move.player] = (movesByPlayer[move.player] || 0) + 1;
    }

    return {
      totalMoves,
      gameDuration,
      movesByPlayer
    };
  }

  /**
   * Formats duration in human-readable format
   */
  private static formatDuration(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Formats uptime in human-readable format
   */
  private static formatUptime(seconds: number): string {
    return this.formatDuration(seconds * 1000);
  }

  /**
   * Formats memory usage in human-readable format
   */
  private static formatMemoryUsage(bytes: number): string {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  }

  /**
   * Formats board for compact representation (if needed)
   */
  static formatCompactBoard(board: any[][]): string {
    // Compact string representation for logging/debugging
    return board.map(row =>
      row.map(cell => cell || '.').join('')
    ).join('\n');
  }

  /**
   * Formats move sequence for replay/analysis
   */
  static formatMoveSequence(moves: Move[]): string {
    return moves.map(move =>
      `${move.moveNumber}. ${move.player}(${move.row},${move.col})`
    ).join(' ');
  }
}

export default GameView;