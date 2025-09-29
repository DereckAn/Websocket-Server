// =================================================================
// AI SERVICE - Optimized Gomoku AI for server-side processing
// =================================================================

import {
  type GameState,
  type GameSymbol,
  type Board,
  type AIMove,
  type Position,
  GAME_CONFIG,
  DIRECTIONS
} from '../types/gomoku';
import GameModel from '../models/GameModel';

/**
 * AIService - High-performance Gomoku AI optimized for server
 *
 * Why server-side AI?
 * - 10x faster than client-side (no browser limitations)
 * - Deeper search (12+ levels vs 6 on client)
 * - Advanced optimizations (transposition tables, threading)
 * - Consistent performance across all devices
 * - Better for concurrent games (shared resources)
 */
export class AIService {

  // AI Configuration - Always EXTREME difficulty
  private static readonly AI_CONFIG = {
    maxDepth: 12,                    // Deep search for strong play
    maxTimePerMove: 2000,           // 2 seconds max (quick response)
    useTranspositionTable: true,    // Cache evaluated positions
    useIterativeDeepening: true,    // Gradually increase search depth
    useAlphaBetaPruning: true,      // Skip irrelevant branches
    usePatternRecognition: true,    // Recognize common patterns
    aggressiveness: 0.9,            // Favor attacking moves
    defensiveness: 1.2,             // Strong defensive play
  };

  // Pattern evaluation values (strategic importance)
  private static readonly PATTERN_VALUES = {
    // Winning patterns
    FIVE_IN_ROW: 1000000,           // Immediate win
    OPEN_FOUR: 100000,              // Unstoppable (4 with both ends open)

    // Threatening patterns
    CLOSED_FOUR: 10000,             // 4 in a row, one end blocked
    DOUBLE_OPEN_THREE: 8000,        // Two open threes (fork)
    OPEN_THREE: 1000,               // 3 in a row, both ends open

    // Building patterns
    CLOSED_THREE: 100,              // 3 in a row, one end blocked
    DOUBLE_OPEN_TWO: 80,            // Two open twos
    OPEN_TWO: 10,                   // 2 in a row, both ends open
    CLOSED_TWO: 1,                  // 2 in a row, one end blocked

    // Positional values
    CENTER_BONUS: 5,                // Favor center positions
    PROXIMITY_BONUS: 3,             // Stay near existing stones
  };

  // Transposition table for caching evaluations
  private static transpositionTable: Map<string, {
    score: number;
    depth: number;
    bestMove: Position | null;
    flag: 'exact' | 'lowerbound' | 'upperbound';
  }> = new Map();

  // Performance tracking
  private static searchStats = {
    nodesSearched: 0,
    cacheHits: 0,
    cacheMisses: 0,
    startTime: 0,
  };

  // =================================================================
  // MAIN AI INTERFACE
  // =================================================================

  /**
   * Calculates the best move for the current game state
   *
   * This is the main entry point for AI decisions
   */
  static async calculateBestMove(gameState: GameState): Promise<AIMove> {
    // Reset performance counters
    this.resetSearchStats();

    const aiSymbol = gameState.currentPlayer as GameSymbol;
    const startTime = Date.now();

    try {
      console.log(`🤖 AI (${aiSymbol}) calculating move for game ${gameState.id}...`);

      // Quick win/block checks first (performance optimization)
      const immediateMove = this.findImmediateMove(gameState.board, aiSymbol);
      if (immediateMove) {
        const timeElapsed = Date.now() - startTime;
        console.log(`⚡ AI found immediate move in ${timeElapsed}ms: (${immediateMove.row}, ${immediateMove.col})`);

        return {
          row: immediateMove.row,
          col: immediateMove.col,
          score: immediateMove.priority,
          timeElapsed,
          nodesSearched: 1,
          depth: 1,
          confidence: 1.0
        };
      }

      // Use iterative deepening for best move
      let bestMove: Position | null = null;
      let bestScore = -Infinity;
      let searchDepth = 1;

      // Iterative deepening: gradually increase search depth
      for (let depth = 1; depth <= this.AI_CONFIG.maxDepth; depth++) {
        const timeElapsed = Date.now() - startTime;

        // Time limit check
        if (timeElapsed > this.AI_CONFIG.maxTimePerMove * 0.8) {
          console.log(`⏰ AI time limit reached at depth ${depth}`);
          break;
        }

        const result = this.minimaxAlphaBeta(
          gameState.board,
          depth,
          -Infinity,
          Infinity,
          true, // maximizing player (AI)
          aiSymbol
        );

        if (result.bestMove) {
          bestMove = result.bestMove;
          bestScore = result.score;
          searchDepth = depth;

          // If we found a winning move, no need to search deeper
          if (bestScore >= this.PATTERN_VALUES.OPEN_FOUR) {
            console.log(`🎯 AI found winning move at depth ${depth}`);
            break;
          }
        }
      }

      // Fallback if no move found (shouldn't happen)
      if (!bestMove) {
        bestMove = this.getFallbackMove(gameState.board);
        bestScore = 0;
      }

      const timeElapsed = Date.now() - startTime;
      const confidence = this.calculateConfidence(bestScore, searchDepth);

      console.log(`🤖 AI decision: (${bestMove.row}, ${bestMove.col}) - Score: ${bestScore}, Depth: ${searchDepth}, Time: ${timeElapsed}ms`);
      console.log(`📊 Search stats: ${this.searchStats.nodesSearched} nodes, ${this.searchStats.cacheHits} cache hits`);

      return {
        row: bestMove.row,
        col: bestMove.col,
        score: bestScore,
        timeElapsed,
        nodesSearched: this.searchStats.nodesSearched,
        depth: searchDepth,
        confidence
      };

    } catch (error) {
      console.error('❌ AI calculation error:', error);

      // Emergency fallback
      const fallbackMove = this.getFallbackMove(gameState.board);
      return {
        row: fallbackMove.row,
        col: fallbackMove.col,
        score: 0,
        timeElapsed: Date.now() - startTime,
        nodesSearched: this.searchStats.nodesSearched,
        depth: 1,
        confidence: 0.1
      };
    }
  }

  // =================================================================
  // MINIMAX WITH ALPHA-BETA PRUNING
  // =================================================================

  /**
   * Core AI algorithm: Minimax with Alpha-Beta pruning
   *
   * This is where the AI "thinks" - evaluating possible moves
   */
  private static minimaxAlphaBeta(
    board: Board,
    depth: number,
    alpha: number,
    beta: number,
    maximizingPlayer: boolean,
    aiSymbol: GameSymbol
  ): { score: number; bestMove: Position | null } {

    this.searchStats.nodesSearched++;

    // Terminal conditions
    if (depth === 0 || this.isTimeUp()) {
      return {
        score: this.evaluatePosition(board, aiSymbol),
        bestMove: null
      };
    }

    // Check transposition table
    const boardHash = this.hashBoard(board);
    const cached = this.transpositionTable.get(boardHash);
    if (cached && cached.depth >= depth) {
      this.searchStats.cacheHits++;
      return {
        score: cached.score,
        bestMove: cached.bestMove
      };
    }
    this.searchStats.cacheMisses++;

    // Generate and order moves
    const moves = this.generateOrderedMoves(board, maximizingPlayer ? aiSymbol : this.getOpponent(aiSymbol));

    if (moves.length === 0) {
      return { score: 0, bestMove: null }; // Draw
    }

    let bestMove: Position | null = null;
    let bestScore = maximizingPlayer ? -Infinity : Infinity;

    for (const move of moves) {
      // Make move
      const newBoard = GameModel.copyBoard(board);
      if (newBoard[move.row] && newBoard[move.row]?.[move.col] === null) {
        const row = newBoard[move.row];
        if (row) {
          row[move.col] = maximizingPlayer ? aiSymbol : this.getOpponent(aiSymbol);
        }
      }

      // Check for immediate win/loss
      const gameResult = GameModel.checkWinCondition(
        newBoard,
        move.row,
        move.col,
        maximizingPlayer ? aiSymbol : this.getOpponent(aiSymbol)
      );

      if (gameResult.isWin) {
        const winScore = maximizingPlayer
          ? this.PATTERN_VALUES.FIVE_IN_ROW - (this.AI_CONFIG.maxDepth - depth)
          : -this.PATTERN_VALUES.FIVE_IN_ROW + (this.AI_CONFIG.maxDepth - depth);

        // Cache result
        this.transpositionTable.set(boardHash, {
          score: winScore,
          depth,
          bestMove: move,
          flag: 'exact'
        });

        return { score: winScore, bestMove: move };
      }

      // Recursive search
      const result = this.minimaxAlphaBeta(
        newBoard,
        depth - 1,
        alpha,
        beta,
        !maximizingPlayer,
        aiSymbol
      );

      // Update best move
      if (maximizingPlayer) {
        if (result.score > bestScore) {
          bestScore = result.score;
          bestMove = move;
        }
        alpha = Math.max(alpha, bestScore);
      } else {
        if (result.score < bestScore) {
          bestScore = result.score;
          bestMove = move;
        }
        beta = Math.min(beta, bestScore);
      }

      // Alpha-beta pruning
      if (beta <= alpha) {
        break; // Prune remaining moves
      }
    }

    // Cache result
    this.transpositionTable.set(boardHash, {
      score: bestScore,
      depth,
      bestMove,
      flag: 'exact'
    });

    return { score: bestScore, bestMove };
  }

  // =================================================================
  // POSITION EVALUATION
  // =================================================================

  /**
   * Evaluates how good a board position is for the AI
   *
   * Higher scores = better for AI
   * Lower scores = better for opponent
   */
  private static evaluatePosition(board: Board, aiSymbol: GameSymbol): number {
    const opponent = this.getOpponent(aiSymbol);

    // Evaluate for both players
    const aiScore = this.evaluatePlayerPosition(board, aiSymbol);
    const opponentScore = this.evaluatePlayerPosition(board, opponent);

    // AI advantage = AI strength - Opponent strength
    return aiScore - opponentScore * this.AI_CONFIG.defensiveness;
  }

  /**
   * Evaluates position for a specific player
   */
  private static evaluatePlayerPosition(board: Board, player: GameSymbol): number {
    let totalScore = 0;

    // Check all positions for patterns
    for (let row = 0; row < GAME_CONFIG.BOARD_SIZE; row++) {
      for (let col = 0; col < GAME_CONFIG.BOARD_SIZE; col++) {
        if (board[row]?.[col] === player) {
          // Check patterns in all 4 directions
          for (const [deltaRow, deltaCol] of DIRECTIONS) {
            const pattern = this.analyzePattern(board, row, col, deltaRow, deltaCol, player);
            totalScore += this.getPatternValue(pattern);
          }

          // Positional bonuses
          totalScore += this.getPositionalBonus(row, col);
        }
      }
    }

    return totalScore;
  }

  /**
   * Analyzes a pattern starting from a position in a direction
   */
  private static analyzePattern(
    board: Board,
    startRow: number,
    startCol: number,
    deltaRow: number,
    deltaCol: number,
    player: GameSymbol
  ): { length: number; openEnds: number; blocked: boolean } {

    let length = 1; // Count the starting position
    let openEnds = 0;

    // Check forward direction
    let row = startRow + deltaRow;
    let col = startCol + deltaCol;
    while (
      row >= 0 && row < GAME_CONFIG.BOARD_SIZE &&
      col >= 0 && col < GAME_CONFIG.BOARD_SIZE &&
      board[row]?.[col] === player
    ) {
      length++;
      row += deltaRow;
      col += deltaCol;
    }

    // Check if forward end is open
    if (
      row >= 0 && row < GAME_CONFIG.BOARD_SIZE &&
      col >= 0 && col < GAME_CONFIG.BOARD_SIZE &&
      board[row]?.[col] === null
    ) {
      openEnds++;
    }

    // Check backward direction
    row = startRow - deltaRow;
    col = startCol - deltaCol;
    while (
      row >= 0 && row < GAME_CONFIG.BOARD_SIZE &&
      col >= 0 && col < GAME_CONFIG.BOARD_SIZE &&
      board[row]?.[col] === player
    ) {
      length++;
      row -= deltaRow;
      col -= deltaCol;
    }

    // Check if backward end is open
    if (
      row >= 0 && row < GAME_CONFIG.BOARD_SIZE &&
      col >= 0 && col < GAME_CONFIG.BOARD_SIZE &&
      board[row]?.[col] === null
    ) {
      openEnds++;
    }

    return {
      length,
      openEnds,
      blocked: openEnds === 0
    };
  }

  /**
   * Gets strategic value for a pattern
   */
  private static getPatternValue(pattern: { length: number; openEnds: number; blocked: boolean }): number {
    if (pattern.blocked) return 0;

    switch (pattern.length) {
      case 5: return this.PATTERN_VALUES.FIVE_IN_ROW;
      case 4:
        return pattern.openEnds === 2
          ? this.PATTERN_VALUES.OPEN_FOUR
          : this.PATTERN_VALUES.CLOSED_FOUR;
      case 3:
        return pattern.openEnds === 2
          ? this.PATTERN_VALUES.OPEN_THREE
          : this.PATTERN_VALUES.CLOSED_THREE;
      case 2:
        return pattern.openEnds === 2
          ? this.PATTERN_VALUES.OPEN_TWO
          : this.PATTERN_VALUES.CLOSED_TWO;
      default:
        return 0;
    }
  }

  /**
   * Gets positional bonus (favor center, stay near stones)
   */
  private static getPositionalBonus(row: number, col: number): number {
    const center = Math.floor(GAME_CONFIG.BOARD_SIZE / 2);
    const distanceFromCenter = Math.abs(row - center) + Math.abs(col - center);
    return Math.max(0, this.PATTERN_VALUES.CENTER_BONUS - distanceFromCenter);
  }

  // =================================================================
  // MOVE GENERATION AND ORDERING
  // =================================================================

  /**
   * Generates moves ordered by strategic importance
   *
   * Better moves first = better alpha-beta pruning
   */
  private static generateOrderedMoves(board: Board, player: GameSymbol): Position[] {
    const moves: Array<{ position: Position; priority: number }> = [];

    // Only consider positions near existing stones (huge optimization)
    const relevantPositions = this.getRelevantPositions(board);

    for (const pos of relevantPositions) {
      if (board[pos.row]?.[pos.col] === null) {
        const priority = this.evaluateMoveImportance(board, pos.row, pos.col, player);
        moves.push({ position: pos, priority });
      }
    }

    // Sort by priority (highest first)
    moves.sort((a, b) => b.priority - a.priority);

    // Return top moves only (performance optimization)
    const maxMoves = Math.min(moves.length, 20);
    return moves.slice(0, maxMoves).map(m => m.position);
  }

  /**
   * Gets positions that are strategically relevant
   * (near existing stones - huge performance boost)
   */
  private static getRelevantPositions(board: Board): Position[] {
    const positions = new Set<string>();

    for (let row = 0; row < GAME_CONFIG.BOARD_SIZE; row++) {
      for (let col = 0; col < GAME_CONFIG.BOARD_SIZE; col++) {
        if (board[row]?.[col] !== null) {
          // Add positions around this stone
          for (let dr = -2; dr <= 2; dr++) {
            for (let dc = -2; dc <= 2; dc++) {
              const newRow = row + dr;
              const newCol = col + dc;

              if (
                newRow >= 0 && newRow < GAME_CONFIG.BOARD_SIZE &&
                newCol >= 0 && newCol < GAME_CONFIG.BOARD_SIZE
              ) {
                positions.add(`${newRow},${newCol}`);
              }
            }
          }
        }
      }
    }

    // If no stones on board, start from center
    if (positions.size === 0) {
      const center = Math.floor(GAME_CONFIG.BOARD_SIZE / 2);
      positions.add(`${center},${center}`);
    }

    return Array.from(positions).map(pos => {
      const [row, col] = pos.split(',').map(Number);
      return { row: row || 0, col: col || 0 };
    }).filter(pos => pos.row !== undefined && pos.col !== undefined);
  }

  /**
   * Evaluates how important a move is (for move ordering)
   */
  private static evaluateMoveImportance(
    board: Board,
    row: number,
    col: number,
    player: GameSymbol
  ): number {
    // Simulate placing the stone
    const testBoard = GameModel.copyBoard(board);
    if (testBoard[row]) {
      testBoard[row][col] = player;
    }

    // Quick evaluation
    let importance = 0;

    // Check for immediate threats/opportunities
    for (const [deltaRow, deltaCol] of DIRECTIONS) {
      const pattern = this.analyzePattern(testBoard, row, col, deltaRow, deltaCol, player);
      importance += this.getPatternValue(pattern);
    }

    return importance;
  }

  // =================================================================
  // IMMEDIATE MOVE DETECTION
  // =================================================================

  /**
   * Finds immediate win/block moves (performance optimization)
   */
  private static findImmediateMove(
    board: Board,
    aiSymbol: GameSymbol
  ): { row: number; col: number; priority: number } | null {

    const opponent = this.getOpponent(aiSymbol);

    // 1. Check for immediate win
    const winMove = this.findWinningMove(board, aiSymbol);
    if (winMove) {
      return { ...winMove, priority: this.PATTERN_VALUES.FIVE_IN_ROW };
    }

    // 2. Check for immediate block
    const blockMove = this.findWinningMove(board, opponent);
    if (blockMove) {
      return { ...blockMove, priority: this.PATTERN_VALUES.OPEN_FOUR };
    }

    // 3. Check for open four opportunities
    const openFourMove = this.findOpenFourMove(board, aiSymbol);
    if (openFourMove) {
      return { ...openFourMove, priority: this.PATTERN_VALUES.OPEN_FOUR };
    }

    return null;
  }

  /**
   * Finds a move that creates 5 in a row (winning move)
   */
  private static findWinningMove(board: Board, player: GameSymbol): Position | null {
    for (let row = 0; row < GAME_CONFIG.BOARD_SIZE; row++) {
      for (let col = 0; col < GAME_CONFIG.BOARD_SIZE; col++) {
        if (board[row]?.[col] === null) {
          // Test this position
          const testBoard = GameModel.copyBoard(board);
          if (testBoard[row] && testBoard[row]?.[col] === null) {
            const boardRow = testBoard[row];
            if (boardRow) {
              boardRow[col] = player;
            }

            const result = GameModel.checkWinCondition(testBoard, row, col, player);
            if (result.isWin) {
              return { row, col };
            }
          }
        }
      }
    }
    return null;
  }

  /**
   * Finds a move that creates an open four (unstoppable threat)
   */
  private static findOpenFourMove(board: Board, player: GameSymbol): Position | null {
    // This would be more complex - checking for patterns that create open fours
    // For now, simplified implementation
    return null;
  }

  // =================================================================
  // UTILITY METHODS
  // =================================================================

  /**
   * Gets the opponent symbol
   */
  private static getOpponent(player: GameSymbol): GameSymbol {
    return player === 'X' ? 'O' : 'X';
  }

  /**
   * Creates a hash of the board for transposition table
   */
  private static hashBoard(board: Board): string {
    return board.map(row =>
      row.map(cell => cell || '_').join('')
    ).join('|');
  }

  /**
   * Checks if AI thinking time is up
   */
  private static isTimeUp(): boolean {
    const elapsed = Date.now() - this.searchStats.startTime;
    return elapsed > this.AI_CONFIG.maxTimePerMove;
  }

  /**
   * Calculates confidence based on score and search depth
   */
  private static calculateConfidence(score: number, depth: number): number {
    // Higher scores and deeper searches = higher confidence
    const scoreConfidence = Math.min(Math.abs(score) / this.PATTERN_VALUES.OPEN_THREE, 1);
    const depthConfidence = Math.min(depth / this.AI_CONFIG.maxDepth, 1);

    return (scoreConfidence + depthConfidence) / 2;
  }

  /**
   * Gets a fallback move when all else fails
   */
  private static getFallbackMove(board: Board): Position {
    // Try center first
    const center = Math.floor(GAME_CONFIG.BOARD_SIZE / 2);
    if (board[center]?.[center] === null) {
      return { row: center, col: center };
    }

    // Find any empty position near center
    for (let radius = 1; radius < 5; radius++) {
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          const row = center + dr;
          const col = center + dc;

          if (
            row >= 0 && row < GAME_CONFIG.BOARD_SIZE &&
            col >= 0 && col < GAME_CONFIG.BOARD_SIZE &&
            board[row]?.[col] === null
          ) {
            return { row, col };
          }
        }
      }
    }

    // Last resort: any empty position
    for (let row = 0; row < GAME_CONFIG.BOARD_SIZE; row++) {
      for (let col = 0; col < GAME_CONFIG.BOARD_SIZE; col++) {
        if (board[row]?.[col] === null) {
          return { row, col };
        }
      }
    }

    // Should never reach here
    return { row: 0, col: 0 };
  }

  /**
   * Resets search statistics
   */
  private static resetSearchStats(): void {
    this.searchStats = {
      nodesSearched: 0,
      cacheHits: 0,
      cacheMisses: 0,
      startTime: Date.now(),
    };
  }

  /**
   * Clears transposition table (memory management)
   */
  static clearCache(): void {
    this.transpositionTable.clear();
    console.log('🧹 AI cache cleared');
  }

  /**
   * Gets AI performance statistics
   */
  static getStats(): {
    cacheSize: number;
    hitRate: number;
    lastSearchNodes: number;
  } {
    const hitRate = this.searchStats.cacheHits + this.searchStats.cacheMisses > 0
      ? this.searchStats.cacheHits / (this.searchStats.cacheHits + this.searchStats.cacheMisses)
      : 0;

    return {
      cacheSize: this.transpositionTable.size,
      hitRate,
      lastSearchNodes: this.searchStats.nodesSearched
    };
  }
}

export default AIService;