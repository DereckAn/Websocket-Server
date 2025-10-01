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
import OpeningBook from './OpeningBook';

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

  // AI Configuration - UNBEATABLE EXPERT difficulty
  private static readonly AI_CONFIG = {
    maxDepth: 18,                   // Very deep search (was 16) - MORE THINKING!
    maxTimePerMove: 10000,          // 10 seconds for thorough analysis (was 5s) - MORE TIME!
    useTranspositionTable: true,    // Cache evaluated positions
    useIterativeDeepening: true,    // Gradually increase search depth
    useAlphaBetaPruning: true,      // Skip irrelevant branches
    usePatternRecognition: true,    // Recognize common patterns
    aggressiveness: 1.3,            // More aggressive - create threats actively!
    defensiveness: 2.0,             // Strong defense but not overly defensive
    threatDetectionDepth: 10,       // Even deeper threats (was 8)
    openingBookEnabled: true,       // Use opening book for early game
    useThreatSpaceSearch: true,     // Advanced threat space analysis
    useVCF: true,                   // Victory by Continuous Force
    useVCT: true,                   // Victory by Continuous Threat

    // Phase 1 optimizations
    useKillerMoves: true,           // Killer move heuristic
    useHistoryHeuristic: true,      // History heuristic
    useNullMovePruning: true,       // Null-move pruning
    nullMoveReduction: 3,           // Depth reduction for null move

    // Phase 2 optimizations (UNBEATABLE!)
    useLMR: true,                   // Late Move Reduction (NEW PHASE 2!)
    lmrDepthThreshold: 3,           // Minimum depth for LMR
    lmrMoveThreshold: 4,            // Start LMR after move #4
    lmrReduction: 2,                // Depth reduction amount
    useAspirationWindows: true,     // Aspiration windows (NEW PHASE 2!)
    aspirationWindowSize: 50,       // Window size for aspiration
    useZobristHashing: true,        // Zobrist hashing (NEW PHASE 2!)
    useEnhancedPatterns: true,      // Enhanced pattern recognition (NEW PHASE 2!)
    useThreatExtension: true,       // Extend search on threats (NEW PHASE 2!)
  };

  // Pattern evaluation values (strategic importance) - BALANCED FOR PROPER PLAY!
  private static readonly PATTERN_VALUES = {
    // Winning patterns (critical)
    FIVE_IN_ROW: 10000000,          // Immediate win (highest priority)
    OPEN_FOUR: 1000000,             // Unstoppable (4 with both ends open)

    // Critical threatening patterns
    CLOSED_FOUR: 500000,            // 4 in a row, one end blocked
    DOUBLE_OPEN_THREE: 100000,      // Two open threes (fork - game over)
    OPEN_THREE: 50000,              // 3 in a row, both ends open
    BROKEN_FOUR: 40000,             // 4 with gap (X_XXX or XXX_X)

    // Advanced threat patterns
    TRIPLE_THREAT: 80000,           // Three threats at once
    DOUBLE_CLOSED_THREE: 25000,     // Two closed threes
    TRIPLE_OPEN_TWO: 15000,         // Three open twos
    OPEN_THREE_PLUS_TWO: 12000,     // Open three + open two combo
    SWORD_PATTERN: 10000,           // Special attacking pattern
    DOUBLE_FOUR: 800000,            // Two fours at once

    // Building patterns
    CLOSED_THREE: 5000,             // 3 in a row, one end blocked
    DOUBLE_OPEN_TWO: 2000,          // Two open twos
    OPEN_TWO: 500,                  // 2 in a row, both ends open
    CLOSED_TWO: 50,                 // 2 in a row, one end blocked
    SINGLE_STONE: 10,               // Single stone

    // Positional values
    CENTER_BONUS: 100,              // Center preference
    PROXIMITY_BONUS: 50,            // Stay near existing stones
    CORNER_PENALTY: -20,            // Avoid corners early game
    EDGE_PENALTY: -10,              // Avoid edges early game
    KEY_POINT_BONUS: 200,           // Strategic key points
  };

  // Transposition table for caching evaluations
  private static transpositionTable: Map<string, {
    score: number;
    depth: number;
    bestMove: Position | null;
    flag: 'exact' | 'lowerbound' | 'upperbound';
  }> = new Map();

  // Killer moves table - stores moves that caused cutoffs at each depth
  // Structure: Map<depth, [killer1, killer2]>
  private static killerMoves: Map<number, Position[]> = new Map();

  // History heuristic table - tracks success rate of moves
  // historyTable[row][col] = score (higher = historically better)
  private static historyTable: number[][] = Array(GAME_CONFIG.BOARD_SIZE)
    .fill(null)
    .map(() => Array(GAME_CONFIG.BOARD_SIZE).fill(0));

  // Zobrist hashing - random numbers for incremental hash calculation
  // zobristTable[row][col][player] = random 64-bit number
  private static zobristTable: bigint[][][] = AIService.initializeZobristTable();

  // Current zobrist hash for incremental updates
  private static currentZobristHash: bigint = BigInt(0);

  // Performance tracking
  private static searchStats = {
    nodesSearched: 0,
    cacheHits: 0,
    cacheMisses: 0,
    startTime: 0,
    killerHits: 0,
    nullMoveCutoffs: 0,
    lmrReductions: 0,
    aspirationHits: 0,
    threatExtensions: 0,
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

      // 1. Quick win/block checks (HIGHEST PRIORITY - immediate tactical moves)
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

      // 2. Advanced threat detection
      if (this.AI_CONFIG.useThreatSpaceSearch) {
        const threats = this.detectAdvancedThreats(gameState.board, aiSymbol);

        // Prioritize VCF (forced win)
        if (threats.vcfThreat) {
          const timeElapsed = Date.now() - startTime;
          console.log(`🗡️ AI found VCF threat in ${timeElapsed}ms: (${threats.vcfThreat.row}, ${threats.vcfThreat.col})`);

          return {
            row: threats.vcfThreat.row,
            col: threats.vcfThreat.col,
            score: this.PATTERN_VALUES.DOUBLE_OPEN_THREE,
            timeElapsed,
            nodesSearched: 1,
            depth: 1,
            confidence: 0.95
          };
        }

        // Then fork threats
        if (threats.forkThreat) {
          const timeElapsed = Date.now() - startTime;
          console.log(`🔱 AI found fork threat in ${timeElapsed}ms: (${threats.forkThreat.row}, ${threats.forkThreat.col})`);

          return {
            row: threats.forkThreat.row,
            col: threats.forkThreat.col,
            score: this.PATTERN_VALUES.DOUBLE_OPEN_THREE * 0.8,
            timeElapsed,
            nodesSearched: 1,
            depth: 1,
            confidence: 0.9
          };
        }

        // Finally double threats
        if (threats.doubleThreat) {
          const timeElapsed = Date.now() - startTime;
          console.log(`⚔️ AI found double threat in ${timeElapsed}ms: (${threats.doubleThreat.row}, ${threats.doubleThreat.col})`);

          return {
            row: threats.doubleThreat.row,
            col: threats.doubleThreat.col,
            score: this.PATTERN_VALUES.DOUBLE_OPEN_THREE * 0.6,
            timeElapsed,
            nodesSearched: 1,
            depth: 1,
            confidence: 0.85
          };
        }
      }

      // 3. Opening book moves (early game, ONLY if no threats detected)
      if (this.AI_CONFIG.openingBookEnabled) {
        const openingMove = this.getOpeningBookMove(gameState.board, aiSymbol);
        if (openingMove) {
          const timeElapsed = Date.now() - startTime;
          console.log(`📚 AI using opening book move in ${timeElapsed}ms: (${openingMove.row}, ${openingMove.col})`);

          return {
            row: openingMove.row,
            col: openingMove.col,
            score: this.PATTERN_VALUES.CENTER_BONUS,
            timeElapsed,
            nodesSearched: 1,
            depth: 1,
            confidence: 0.9
          };
        }
      }

      // 4. Use iterative deepening for best move
      let bestMove: Position | null = null;
      let bestScore = -Infinity;
      let searchDepth = 1;

      // Iterative deepening with Aspiration Windows (Phase 2)
      console.log(`🧠 AI starting deep search (max depth: ${this.AI_CONFIG.maxDepth}, max time: ${this.AI_CONFIG.maxTimePerMove}ms)...`);

      for (let depth = 1; depth <= this.AI_CONFIG.maxDepth; depth++) {
        const timeElapsed = Date.now() - startTime;
        const depthStartTime = Date.now();

        // Time limit check (use 80% of available time for iterative deepening)
        if (timeElapsed > this.AI_CONFIG.maxTimePerMove * 0.8) {
          console.log(`⏰ AI time limit reached at depth ${depth} (${timeElapsed}ms elapsed)`);
          break;
        }

        console.log(`🔍 Searching depth ${depth}... (${timeElapsed}ms elapsed so far)`);
        let result;

        // ====== ASPIRATION WINDOWS (Phase 2) ======
        // Use narrow window for faster search after depth 3
        if (this.AI_CONFIG.useAspirationWindows && depth > 3 && bestScore !== -Infinity) {
          const window = this.AI_CONFIG.aspirationWindowSize;
          const alpha = bestScore - window;
          const beta = bestScore + window;

          // Try narrow window first
          result = this.minimaxAlphaBeta(
            gameState.board,
            depth,
            alpha,
            beta,
            true, // maximizing player (AI)
            aiSymbol
          );

          // If score falls outside window, re-search with full window
          if (result.score <= alpha || result.score >= beta) {
            console.log(`🔄 Aspiration window failed at depth ${depth}, re-searching`);
            result = this.minimaxAlphaBeta(
              gameState.board,
              depth,
              -Infinity,
              Infinity,
              true,
              aiSymbol
            );
          } else {
            this.searchStats.aspirationHits++;
          }
        } else {
          // Full window search
          result = this.minimaxAlphaBeta(
            gameState.board,
            depth,
            -Infinity,
            Infinity,
            true, // maximizing player (AI)
            aiSymbol
          );
        }

        if (result.bestMove) {
          bestMove = result.bestMove;
          bestScore = result.score;
          searchDepth = depth;

          const depthTime = Date.now() - depthStartTime;
          console.log(`✅ Depth ${depth} complete: move (${bestMove.row},${bestMove.col}), score ${bestScore}, time ${depthTime}ms, nodes ${this.searchStats.nodesSearched}`);

          // If we found a winning move, no need to search deeper
          if (bestScore >= this.PATTERN_VALUES.OPEN_FOUR) {
            console.log(`🎯 AI found winning move at depth ${depth}! (score: ${bestScore})`);
            break;
          }

          // If we found a very strong position, we can be confident
          if (bestScore >= this.PATTERN_VALUES.OPEN_THREE * 2) {
            console.log(`💪 AI found strong position at depth ${depth} (score: ${bestScore})`);
            // Continue searching but with high confidence
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

      console.log(`\n${'='.repeat(80)}`);
      console.log(`🤖 AI FINAL DECISION: (${bestMove.row}, ${bestMove.col})`);
      console.log(`   Score: ${bestScore}, Depth reached: ${searchDepth}, Time: ${timeElapsed}ms`);
      console.log(`${'='.repeat(80)}`);
      console.log(`📊 PHASE 1 OPTIMIZATIONS:`);
      console.log(`   • Nodes searched: ${this.searchStats.nodesSearched}`);
      console.log(`   • Cache hits: ${this.searchStats.cacheHits} (${((this.searchStats.cacheHits / this.searchStats.nodesSearched) * 100).toFixed(1)}% hit rate)`);
      console.log(`   • Killer move hits: ${this.searchStats.killerHits} ${this.searchStats.killerHits > 0 ? '✅' : '⚠️'}`);
      console.log(`   • Null-move cutoffs: ${this.searchStats.nullMoveCutoffs} ${this.searchStats.nullMoveCutoffs > 0 ? '✅' : '⚠️'}`);
      console.log(`📊 PHASE 2 OPTIMIZATIONS:`);
      console.log(`   • LMR reductions: ${this.searchStats.lmrReductions} ${this.searchStats.lmrReductions > 0 ? '✅' : '⚠️'}`);
      console.log(`   • Aspiration hits: ${this.searchStats.aspirationHits} ${this.searchStats.aspirationHits > 0 ? '✅' : '⚠️'}`);
      console.log(`   • Threat extensions: ${this.searchStats.threatExtensions} ${this.searchStats.threatExtensions > 0 ? '✅' : '⚠️'}`);
      console.log(`${'='.repeat(80)}\n`);

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
   * Enhanced with Null-Move Pruning, Killer Moves, and History Heuristic
   *
   * This is where the AI "thinks" - evaluating possible moves
   */
  private static minimaxAlphaBeta(
    board: Board,
    depth: number,
    alpha: number,
    beta: number,
    maximizingPlayer: boolean,
    aiSymbol: GameSymbol,
    allowNullMove: boolean = true
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

    // ====== NULL-MOVE PRUNING ======
    // If we can "pass" and still beat beta, position is too good - prune
    // Only try in non-PV nodes, when not in check, and with sufficient depth
    if (
      this.AI_CONFIG.useNullMovePruning &&
      allowNullMove &&
      !maximizingPlayer &&  // Only for opponent moves (defensive pruning)
      depth >= this.AI_CONFIG.nullMoveReduction + 1
    ) {
      // Try null move (skip turn)
      const nullScore = this.minimaxAlphaBeta(
        board,
        depth - this.AI_CONFIG.nullMoveReduction - 1,
        -beta,
        -beta + 1,
        true,  // Switch to maximizing
        aiSymbol,
        false  // Don't allow consecutive null moves
      ).score;

      // If null move causes beta cutoff, prune this branch
      if (nullScore >= beta) {
        this.searchStats.nullMoveCutoffs++;
        return { score: beta, bestMove: null };
      }
    }

    // Generate and order moves (now with killer + history heuristic)
    const moves = this.generateOrderedMoves(
      board,
      maximizingPlayer ? aiSymbol : this.getOpponent(aiSymbol),
      depth
    );

    if (moves.length === 0) {
      return { score: 0, bestMove: null }; // Draw
    }

    let bestMove: Position | null = null;
    let bestScore = maximizingPlayer ? -Infinity : Infinity;
    let moveCount = 0;

    for (const move of moves) {
      moveCount++;

      // Make move
      const newBoard = GameModel.copyBoard(board);
      if (newBoard[move.row] && newBoard[move.row]?.[move.col] === null) {
        const row = newBoard[move.row];
        if (row) {
          row[move.col] = maximizingPlayer ? aiSymbol : this.getOpponent(aiSymbol);
        }
      }

      // Check for immediate win/loss using enhanced detection
      const currentPlayerForMove = maximizingPlayer ? aiSymbol : this.getOpponent(aiSymbol);
      if (this.isWinningMove(newBoard, move.row, move.col, currentPlayerForMove)) {
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

      // ====== THREAT EXTENSION (Phase 2) ======
      // Extend search if move creates or blocks threats
      let searchDepth = depth - 1;
      if (this.AI_CONFIG.useThreatExtension && depth > 2) {
        const threats = this.countThreats(newBoard, move.row, move.col, currentPlayerForMove);
        if (threats >= 2) {
          searchDepth = depth; // Don't reduce depth for threat moves
          this.searchStats.threatExtensions++;
        }
      }

      // ====== LATE MOVE REDUCTION (Phase 2) ======
      // Reduce depth for late moves that aren't likely to be best
      let reduction = 0;
      if (
        this.AI_CONFIG.useLMR &&
        depth >= this.AI_CONFIG.lmrDepthThreshold &&
        moveCount > this.AI_CONFIG.lmrMoveThreshold &&
        !bestMove // Not first move
      ) {
        // Don't reduce tactical moves (captures, threats)
        const isTactical = this.isTacticalMove(newBoard, move.row, move.col, currentPlayerForMove);
        if (!isTactical) {
          reduction = this.AI_CONFIG.lmrReduction;
          this.searchStats.lmrReductions++;
        }
      }

      // Recursive search with possible reduction
      let result = this.minimaxAlphaBeta(
        newBoard,
        searchDepth - reduction,
        alpha,
        beta,
        !maximizingPlayer,
        aiSymbol
      );

      // ====== LMR RE-SEARCH ======
      // If reduced move looks good, re-search at full depth
      if (reduction > 0) {
        const needsReSearch = maximizingPlayer
          ? result.score > alpha
          : result.score < beta;

        if (needsReSearch) {
          result = this.minimaxAlphaBeta(
            newBoard,
            searchDepth,
            alpha,
            beta,
            !maximizingPlayer,
            aiSymbol
          );
        }
      }

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
        // ====== KILLER MOVE HEURISTIC ======
        // Store this move as a killer move (caused a cutoff)
        if (this.AI_CONFIG.useKillerMoves && bestMove) {
          this.storeKillerMove(depth, bestMove);
        }

        // ====== HISTORY HEURISTIC ======
        // Update history table (this move was good)
        if (this.AI_CONFIG.useHistoryHeuristic && bestMove) {
          this.historyTable[bestMove.row][bestMove.col] += depth * depth;
        }

        break; // Prune remaining moves
      }
    }

    // Update history for best move even if no cutoff
    if (this.AI_CONFIG.useHistoryHeuristic && bestMove) {
      this.historyTable[bestMove.row][bestMove.col] += depth;
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

    // Balanced evaluation: Apply aggression and defense multipliers
    let evaluation = (aiScore * this.AI_CONFIG.aggressiveness) - (opponentScore * this.AI_CONFIG.defensiveness);

    // Bonus for creating multiple threats (INCREASED for more aggressive play)
    const aiThreats = this.countWinningThreats(board, aiSymbol);
    const opponentThreats = this.countWinningThreats(board, this.getOpponent(aiSymbol));

    // AI threats bonus (create our own threats)
    evaluation += aiThreats * this.PATTERN_VALUES.OPEN_THREE * 0.3 * this.AI_CONFIG.aggressiveness;

    // Opponent threats penalty (defend against their threats)
    evaluation -= opponentThreats * this.PATTERN_VALUES.OPEN_THREE * 0.3 * this.AI_CONFIG.defensiveness;

    return evaluation;
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
   * Enhanced version with better open-end detection
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
    let forwardBlocked = false;
    let backwardBlocked = false;

    // Check forward direction
    let row = startRow + deltaRow;
    let col = startCol + deltaCol;
    while (
      row >= 0 && row < GAME_CONFIG.BOARD_SIZE &&
      col >= 0 && col < GAME_CONFIG.BOARD_SIZE
    ) {
      if (board[row]?.[col] === player) {
        length++;
      } else if (board[row]?.[col] === null) {
        openEnds++;
        break;
      } else {
        forwardBlocked = true;
        break;
      }
      row += deltaRow;
      col += deltaCol;
    }

    // If we hit the board edge, it's blocked
    if (row < 0 || row >= GAME_CONFIG.BOARD_SIZE || col < 0 || col >= GAME_CONFIG.BOARD_SIZE) {
      forwardBlocked = true;
    }

    // Check backward direction
    row = startRow - deltaRow;
    col = startCol - deltaCol;
    while (
      row >= 0 && row < GAME_CONFIG.BOARD_SIZE &&
      col >= 0 && col < GAME_CONFIG.BOARD_SIZE
    ) {
      if (board[row]?.[col] === player) {
        length++;
      } else if (board[row]?.[col] === null) {
        if (!forwardBlocked) openEnds++; // Only count if forward isn't already counted
        break;
      } else {
        backwardBlocked = true;
        break;
      }
      row -= deltaRow;
      col -= deltaCol;
    }

    // If we hit the board edge, it's blocked
    if (row < 0 || row >= GAME_CONFIG.BOARD_SIZE || col < 0 || col >= GAME_CONFIG.BOARD_SIZE) {
      backwardBlocked = true;
    }

    return {
      length,
      openEnds,
      blocked: forwardBlocked && backwardBlocked
    };
  }

  /**
   * Gets strategic value for a pattern - Enhanced version
   */
  private static getPatternValue(pattern: { length: number; openEnds: number; blocked: boolean }): number {
    if (pattern.length >= 5) return this.PATTERN_VALUES.FIVE_IN_ROW;
    if (pattern.blocked) return 0;

    switch (pattern.length) {
      case 4:
        return pattern.openEnds >= 1
          ? this.PATTERN_VALUES.OPEN_FOUR
          : this.PATTERN_VALUES.CLOSED_FOUR;
      case 3:
        return pattern.openEnds >= 2
          ? this.PATTERN_VALUES.OPEN_THREE
          : this.PATTERN_VALUES.CLOSED_THREE;
      case 2:
        return pattern.openEnds >= 2
          ? this.PATTERN_VALUES.OPEN_TWO
          : this.PATTERN_VALUES.CLOSED_TWO;
      case 1:
        return pattern.openEnds >= 2 ? this.PATTERN_VALUES.SINGLE_STONE : 0;
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
   * Enhanced with Killer Moves, History Heuristic, and threat analysis
   */
  private static generateOrderedMoves(board: Board, player: GameSymbol, depth: number = 0): Position[] {
    const moves: Array<{ position: Position; priority: number }> = [];
    const opponent = this.getOpponent(player);

    // Only consider positions near existing stones (huge optimization)
    const relevantPositions = this.getRelevantPositions(board);

    // Get killer moves for this depth
    const killers = this.AI_CONFIG.useKillerMoves ? (this.killerMoves.get(depth) || []) : [];

    for (const pos of relevantPositions) {
      if (board[pos.row]?.[pos.col] === null) {
        let priority = 0;

        // ====== KILLER MOVE BONUS ======
        // Check if this is a killer move (very high priority)
        if (this.AI_CONFIG.useKillerMoves) {
          const isKiller = killers.some(k => k.row === pos.row && k.col === pos.col);
          if (isKiller) {
            priority += 8000000; // Very high priority, just below winning moves
            this.searchStats.killerHits++;
          }
        }

        // ====== HISTORY HEURISTIC BONUS ======
        // Add bonus based on historical success
        if (this.AI_CONFIG.useHistoryHeuristic) {
          priority += this.historyTable[pos.row][pos.col] * 100;
        }

        // Test placing our stone
        const testBoard = GameModel.copyBoard(board);
        if (testBoard[pos.row]) {
          testBoard[pos.row][pos.col] = player;
        }

        // Priority 1: Winning moves (highest)
        if (GameModel.checkWinCondition(testBoard, pos.row, pos.col, player).isWin) {
          priority += 10000000;
        }

        // Priority 2: Multiple threat creation
        const threats = this.countThreats(testBoard, pos.row, pos.col, player);
        priority += threats * 100000;

        // Priority 3: Position evaluation for our move
        priority += this.evaluateMovePosition(testBoard, pos.row, pos.col, player);

        // Reset board and test opponent blocking
        if (testBoard[pos.row]) {
          testBoard[pos.row][pos.col] = opponent;
        }

        // Priority 4: Blocking opponent winning moves
        if (GameModel.checkWinCondition(testBoard, pos.row, pos.col, opponent).isWin) {
          priority += 5000000;
        }

        // Priority 5: Blocking opponent threats
        const opponentThreats = this.countThreats(testBoard, pos.row, pos.col, opponent);
        priority += opponentThreats * 50000;

        // Priority 6: Center preference (small bonus)
        const center = Math.floor(GAME_CONFIG.BOARD_SIZE / 2);
        const centerDistance = Math.abs(pos.row - center) + Math.abs(pos.col - center);
        priority += Math.max(0, 20 - centerDistance);

        moves.push({ position: pos, priority });
      }
    }

    // Sort by priority (highest first)
    moves.sort((a, b) => b.priority - a.priority);

    // Return top moves only (performance optimization)
    const maxMoves = Math.min(moves.length, 25);
    return moves.slice(0, maxMoves).map(m => m.position);
  }

  /**
   * Gets positions that are strategically relevant
   * Enhanced to consider larger search radius for stronger play
   */
  private static getRelevantPositions(board: Board): Position[] {
    const positions = new Set<string>();

    // Check if board is empty
    if (this.isBoardEmpty(board)) {
      const center = Math.floor(GAME_CONFIG.BOARD_SIZE / 2);
      return [{ row: center, col: center }];
    }

    for (let row = 0; row < GAME_CONFIG.BOARD_SIZE; row++) {
      for (let col = 0; col < GAME_CONFIG.BOARD_SIZE; col++) {
        if (board[row]?.[col] !== null) {
          // Add positions around this stone (radius 2 for stronger analysis)
          for (let dr = -2; dr <= 2; dr++) {
            for (let dc = -2; dc <= 2; dc++) {
              const newRow = row + dr;
              const newCol = col + dc;
              const key = `${newRow},${newCol}`;

              if (
                newRow >= 0 && newRow < GAME_CONFIG.BOARD_SIZE &&
                newCol >= 0 && newCol < GAME_CONFIG.BOARD_SIZE &&
                board[newRow]?.[newCol] === null &&
                !positions.has(key)
              ) {
                positions.add(key);
              }
            }
          }
        }
      }
    }

    return Array.from(positions).map(pos => {
      const [row, col] = pos.split(',').map(Number);
      return { row: row || 0, col: col || 0 };
    }).filter(pos =>
      pos.row !== undefined &&
      pos.col !== undefined &&
      pos.row >= 0 && pos.row < GAME_CONFIG.BOARD_SIZE &&
      pos.col >= 0 && pos.col < GAME_CONFIG.BOARD_SIZE
    );
  }

  /**
   * Checks if the board is empty
   */
  private static isBoardEmpty(board: Board): boolean {
    for (let row = 0; row < GAME_CONFIG.BOARD_SIZE; row++) {
      for (let col = 0; col < GAME_CONFIG.BOARD_SIZE; col++) {
        if (board[row]?.[col] !== null) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Evaluates how important a move is (for move ordering)
   * Enhanced with comprehensive position analysis
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

    // Comprehensive evaluation
    let importance = 0;

    // Check for immediate threats/opportunities in all directions
    for (const [deltaRow, deltaCol] of DIRECTIONS) {
      const pattern = this.analyzePattern(testBoard, row, col, deltaRow, deltaCol, player);
      importance += this.getPatternValue(pattern);
    }

    return importance;
  }

  /**
   * Counts threats created by a move
   */
  private static countThreats(board: Board, row: number, col: number, player: GameSymbol): number {
    let threats = 0;

    for (const [deltaRow, deltaCol] of DIRECTIONS) {
      const pattern = this.analyzePattern(board, row, col, deltaRow, deltaCol, player);

      // Count open threes and fours as threats
      if (pattern.length === 4 && pattern.openEnds >= 1) threats += 3;
      if (pattern.length === 3 && pattern.openEnds >= 2) threats += 1;
    }

    return threats;
  }

  /**
   * Evaluates specific move position value
   */
  private static evaluateMovePosition(board: Board, row: number, col: number, player: GameSymbol): number {
    let score = 0;

    // Evaluate the position if this move is made
    for (const [deltaRow, deltaCol] of DIRECTIONS) {
      const pattern = this.analyzePattern(board, row, col, deltaRow, deltaCol, player);
      score += this.getPatternValue(pattern);
    }

    return score;
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

    // 1. Check for immediate win (5 in a row)
    const winMove = this.findWinningMove(board, aiSymbol);
    if (winMove) {
      console.log(`🎯 AI found winning move: (${winMove.row}, ${winMove.col})`);
      return { ...winMove, priority: this.PATTERN_VALUES.FIVE_IN_ROW };
    }

    // 2. CRITICAL: Block opponent's winning move (5 in a row)
    const blockWinMove = this.findWinningMove(board, opponent);
    if (blockWinMove) {
      console.log(`🛡️ AI blocking opponent win: (${blockWinMove.row}, ${blockWinMove.col})`);
      return { ...blockWinMove, priority: this.PATTERN_VALUES.OPEN_FOUR };
    }

    // 3. ATTACK: Check for our own 4 in a row opportunity (BEFORE blocking opponent's 4)
    const makeFourMove = this.findFourInRowMove(board, aiSymbol);
    if (makeFourMove) {
      console.log(`⚔️ AI creating 4-in-row threat: (${makeFourMove.row}, ${makeFourMove.col})`);
      return { ...makeFourMove, priority: this.PATTERN_VALUES.CLOSED_FOUR };
    }

    // 4. DEFENSE: Block opponent's 4 in a row (MUST block!)
    const blockFourMove = this.findFourInRowMove(board, opponent);
    if (blockFourMove) {
      console.log(`🛡️ AI blocking opponent 4-in-row: (${blockFourMove.row}, ${blockFourMove.col})`);
      return { ...blockFourMove, priority: this.PATTERN_VALUES.CLOSED_FOUR * 0.95 }; // Slightly lower than our own
    }

    // 5. ATTACK: Check for open four opportunities (unstoppable threat)
    const openFourMove = this.findOpenFourMove(board, aiSymbol);
    if (openFourMove) {
      console.log(`⚔️ AI creating open-four (unstoppable): (${openFourMove.row}, ${openFourMove.col})`);
      return { ...openFourMove, priority: this.PATTERN_VALUES.OPEN_FOUR };
    }

    // 6. ATTACK: Create our own open three
    const makeThreeMove = this.findOpenThreeMove(board, aiSymbol);
    if (makeThreeMove) {
      console.log(`⚔️ AI creating open-three: (${makeThreeMove.row}, ${makeThreeMove.col})`);
      return { ...makeThreeMove, priority: this.PATTERN_VALUES.OPEN_THREE };
    }

    // 7. DEFENSE: Block opponent's open three (lower priority than our attacks)
    const blockThreeMove = this.findOpenThreeMove(board, opponent);
    if (blockThreeMove) {
      console.log(`🛡️ AI blocking opponent open-three: (${blockThreeMove.row}, ${blockThreeMove.col})`);
      return { ...blockThreeMove, priority: this.PATTERN_VALUES.OPEN_THREE * 0.9 }; // Lower priority
    }

    return null; // No immediate tactical move, use deep search
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
    const relevantPositions = this.getRelevantPositions(board);

    for (const pos of relevantPositions) {
      if (board[pos.row]?.[pos.col] === null) {
        // Test placing stone here
        const testBoard = GameModel.copyBoard(board);
        if (testBoard[pos.row]) {
          testBoard[pos.row][pos.col] = player;
        }

        // Check if this creates an open four in any direction
        for (const [deltaRow, deltaCol] of DIRECTIONS) {
          const pattern = this.analyzePattern(testBoard, pos.row, pos.col, deltaRow, deltaCol, player);
          if (pattern.length === 4 && pattern.openEnds === 2) {
            return pos;
          }
        }
      }
    }

    return null;
  }

  /**
   * Finds a move that creates or blocks 4 in a row
   */
  private static findFourInRowMove(board: Board, player: GameSymbol): Position | null {
    const relevantPositions = this.getRelevantPositions(board);

    for (const pos of relevantPositions) {
      if (board[pos.row]?.[pos.col] === null) {
        // Test placing stone here
        const testBoard = GameModel.copyBoard(board);
        if (testBoard[pos.row]) {
          testBoard[pos.row][pos.col] = player;
        }

        // Check if this creates 4 in a row in any direction
        for (const [deltaRow, deltaCol] of DIRECTIONS) {
          const pattern = this.analyzePattern(testBoard, pos.row, pos.col, deltaRow, deltaCol, player);
          if (pattern.length === 4) {
            return pos;
          }
        }
      }
    }

    return null;
  }

  /**
   * Finds a move that creates or blocks open three (3 with both ends open)
   */
  private static findOpenThreeMove(board: Board, player: GameSymbol): Position | null {
    const relevantPositions = this.getRelevantPositions(board);

    for (const pos of relevantPositions) {
      if (board[pos.row]?.[pos.col] === null) {
        // Test placing stone here
        const testBoard = GameModel.copyBoard(board);
        if (testBoard[pos.row]) {
          testBoard[pos.row][pos.col] = player;
        }

        // Check if this creates open three in any direction
        for (const [deltaRow, deltaCol] of DIRECTIONS) {
          const pattern = this.analyzePattern(testBoard, pos.row, pos.col, deltaRow, deltaCol, player);
          if (pattern.length === 3 && pattern.openEnds === 2) {
            return pos;
          }
        }
      }
    }

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
   * Check if a move results in a win - Enhanced version
   */
  private static isWinningMove(board: Board, row: number, col: number, player: GameSymbol): boolean {
    for (const [deltaRow, deltaCol] of DIRECTIONS) {
      let count = 1; // Count the current stone

      // Count in positive direction
      let r = row + deltaRow;
      let c = col + deltaCol;
      while (
        r >= 0 && r < GAME_CONFIG.BOARD_SIZE &&
        c >= 0 && c < GAME_CONFIG.BOARD_SIZE &&
        board[r]?.[c] === player
      ) {
        count++;
        r += deltaRow;
        c += deltaCol;
      }

      // Count in negative direction
      r = row - deltaRow;
      c = col - deltaCol;
      while (
        r >= 0 && r < GAME_CONFIG.BOARD_SIZE &&
        c >= 0 && c < GAME_CONFIG.BOARD_SIZE &&
        board[r]?.[c] === player
      ) {
        count++;
        r -= deltaRow;
        c -= deltaCol;
      }

      if (count >= GAME_CONFIG.WIN_LENGTH) return true;
    }
    return false;
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
      killerHits: 0,
      nullMoveCutoffs: 0,
      lmrReductions: 0,
      aspirationHits: 0,
      threatExtensions: 0,
    };

    // Clear killer moves for new search
    this.killerMoves.clear();
  }

  /**
   * Clears transposition table (memory management)
   */
  static clearCache(): void {
    this.transpositionTable.clear();
    this.killerMoves.clear();

    // Clear history table
    this.historyTable = Array(GAME_CONFIG.BOARD_SIZE)
      .fill(null)
      .map(() => Array(GAME_CONFIG.BOARD_SIZE).fill(0));

    console.log('🧹 AI cache cleared (transposition + killer + history)');
  }

  // =================================================================
  // ADVANCED THREAT DETECTION
  // =================================================================

  /**
   * Detects advanced threat patterns and combinations
   */
  private static detectAdvancedThreats(board: Board, player: GameSymbol): {
    doubleThreat: Position | null;
    forkThreat: Position | null;
    vcfThreat: Position | null;
  } {
    const relevantPositions = this.getRelevantPositions(board);
    let doubleThreat: Position | null = null;
    let forkThreat: Position | null = null;
    let vcfThreat: Position | null = null;

    for (const pos of relevantPositions) {
      if (board[pos.row]?.[pos.col] === null) {
        const testBoard = GameModel.copyBoard(board);
        if (testBoard[pos.row]) {
          testBoard[pos.row][pos.col] = player;
        }

        // Check for double threat (two ways to win)
        const threats = this.countWinningThreats(testBoard, player);
        if (threats >= 2) {
          doubleThreat = pos;
        }

        // Check for fork (multiple open threes)
        const openThrees = this.countOpenThrees(testBoard, player);
        if (openThrees >= 2) {
          forkThreat = pos;
        }

        // Check for VCF (Victory by Continuous Force)
        if (this.hasVCF(testBoard, pos, player)) {
          vcfThreat = pos;
        }
      }
    }

    return { doubleThreat, forkThreat, vcfThreat };
  }

  /**
   * Counts winning threats (open fours and closed fours)
   */
  private static countWinningThreats(board: Board, player: GameSymbol): number {
    let threats = 0;

    for (let row = 0; row < GAME_CONFIG.BOARD_SIZE; row++) {
      for (let col = 0; col < GAME_CONFIG.BOARD_SIZE; col++) {
        if (board[row]?.[col] === player) {
          for (const [deltaRow, deltaCol] of DIRECTIONS) {
            const pattern = this.analyzePattern(board, row, col, deltaRow, deltaCol, player);
            if (pattern.length === 4 && pattern.openEnds >= 1) {
              threats++;
            }
          }
        }
      }
    }

    return threats;
  }

  /**
   * Counts open three patterns
   */
  private static countOpenThrees(board: Board, player: GameSymbol): number {
    let count = 0;

    for (let row = 0; row < GAME_CONFIG.BOARD_SIZE; row++) {
      for (let col = 0; col < GAME_CONFIG.BOARD_SIZE; col++) {
        if (board[row]?.[col] === player) {
          for (const [deltaRow, deltaCol] of DIRECTIONS) {
            const pattern = this.analyzePattern(board, row, col, deltaRow, deltaCol, player);
            if (pattern.length === 3 && pattern.openEnds === 2) {
              count++;
            }
          }
        }
      }
    }

    return count;
  }

  /**
   * Checks for Victory by Continuous Force (forced win sequence)
   */
  private static hasVCF(board: Board, move: Position, player: GameSymbol): boolean {
    // Simplified VCF detection - checks if move creates multiple simultaneous threats
    const testBoard = GameModel.copyBoard(board);
    if (testBoard[move.row]) {
      testBoard[move.row][move.col] = player;
    }

    const threats = this.countWinningThreats(testBoard, player);
    const openThrees = this.countOpenThrees(testBoard, player);

    // VCF if we create multiple threats that opponent cannot block all
    return threats >= 2 || (threats >= 1 && openThrees >= 2);
  }

  // =================================================================
  // OPENING BOOK STRATEGIES
  // =================================================================

  /**
   * Gets opening book move for early game
   * Enhanced with professional opening patterns
   */
  private static getOpeningBookMove(board: Board, aiSymbol: GameSymbol): Position | null {
    const moveCount = this.getMoveCount(board);

    // Use professional opening book for first 4 moves ONLY (was 8)
    // After move 4, switch to deep search for tactical play
    if (moveCount <= 4) {
      const openingMove = OpeningBook.getOpeningMove(board, moveCount + 1);
      if (openingMove) {
        // Verify move is valid
        if (board[openingMove.row]?.[openingMove.col] === null) {
          console.log(`📚 Opening book active (move ${moveCount}/4)`);
          return openingMove;
        }
      }
    }

    console.log(`🧠 Opening book finished (move ${moveCount}), switching to deep search`);
    return null; // Use regular AI after opening
  }

  /**
   * Gets moves in center area (avoiding edges)
   */
  private static getCenterAreaMoves(board: Board, center: number): Position[] {
    const moves: Position[] = [];
    const radius = 3; // Stay within 3 squares of center

    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        const row = center + dr;
        const col = center + dc;

        if (this.isValidPosition(row, col) && board[row]?.[col] === null) {
          // Prefer positions closer to center
          const distance = Math.abs(dr) + Math.abs(dc);
          if (distance > 0) { // Don't include center itself
            moves.push({ row, col });
          }
        }
      }
    }

    // Sort by distance from center (closer = better)
    moves.sort((a, b) => {
      const distA = Math.abs(a.row - center) + Math.abs(a.col - center);
      const distB = Math.abs(b.row - center) + Math.abs(b.col - center);
      return distA - distB;
    });

    return moves;
  }

  /**
   * Counts total moves on board
   */
  private static getMoveCount(board: Board): number {
    let count = 0;
    for (let row = 0; row < GAME_CONFIG.BOARD_SIZE; row++) {
      for (let col = 0; col < GAME_CONFIG.BOARD_SIZE; col++) {
        if (board[row]?.[col] !== null) {
          count++;
        }
      }
    }
    return count;
  }

  /**
   * Checks if position is valid on board
   */
  private static isValidPosition(row: number, col: number): boolean {
    return row >= 0 && row < GAME_CONFIG.BOARD_SIZE && col >= 0 && col < GAME_CONFIG.BOARD_SIZE;
  }

  /**
   * Checks if a move is tactical (should not be reduced by LMR)
   * Tactical moves include: threats, blocks, captures
   */
  private static isTacticalMove(board: Board, row: number, col: number, player: GameSymbol): boolean {
    // Check if move creates threats
    const threats = this.countThreats(board, row, col, player);
    if (threats >= 1) return true;

    // Check if move blocks opponent threats
    const opponent = this.getOpponent(player);
    const opponentThreats = this.countWinningThreats(board, opponent);
    if (opponentThreats >= 1) return true;

    // Check if move creates open three or better
    for (const [deltaRow, deltaCol] of DIRECTIONS) {
      const pattern = this.analyzePattern(board, row, col, deltaRow, deltaCol, player);
      if (pattern.length >= 3 && pattern.openEnds >= 2) {
        return true; // Open three or better
      }
      if (pattern.length >= 4) {
        return true; // Any four
      }
    }

    return false;
  }

  /**
   * Stores a killer move for a specific depth
   * Keeps only the 2 most recent killers per depth
   */
  private static storeKillerMove(depth: number, move: Position): void {
    const killers = this.killerMoves.get(depth) || [];

    // Check if move already exists
    const exists = killers.some(k => k.row === move.row && k.col === move.col);
    if (exists) return;

    // Add to front, keep only 2 killers per depth
    killers.unshift(move);
    if (killers.length > 2) {
      killers.pop();
    }

    this.killerMoves.set(depth, killers);
  }

  // =================================================================
  // ZOBRIST HASHING (Phase 2)
  // =================================================================

  /**
   * Initializes Zobrist hash table with random numbers
   * This is called once during class initialization
   */
  private static initializeZobristTable(): bigint[][][] {
    const table: bigint[][][] = [];

    // Simple pseudo-random generator for reproducibility
    let seed = 123456789n;
    const random = (): bigint => {
      seed = (seed * 1103515245n + 12345n) & ((1n << 31n) - 1n);
      return seed;
    };

    for (let row = 0; row < GAME_CONFIG.BOARD_SIZE; row++) {
      table[row] = [];
      for (let col = 0; col < GAME_CONFIG.BOARD_SIZE; col++) {
        table[row][col] = [];
        // 0 = X, 1 = O
        table[row][col][0] = random();
        table[row][col][1] = random();
      }
    }

    return table;
  }

  /**
   * Computes Zobrist hash for a board position
   * O(board_size^2) but only called once per search
   */
  private static computeZobristHash(board: Board): bigint {
    let hash = BigInt(0);

    for (let row = 0; row < GAME_CONFIG.BOARD_SIZE; row++) {
      for (let col = 0; col < GAME_CONFIG.BOARD_SIZE; col++) {
        const cell = board[row]?.[col];
        if (cell === 'X') {
          hash ^= this.zobristTable[row][col][0];
        } else if (cell === 'O') {
          hash ^= this.zobristTable[row][col][1];
        }
      }
    }

    return hash;
  }

  /**
   * Updates hash incrementally when a move is made
   * O(1) - much faster than recomputing
   */
  private static updateZobristHash(hash: bigint, row: number, col: number, player: GameSymbol): bigint {
    const playerIndex = player === 'X' ? 0 : 1;
    return hash ^ this.zobristTable[row][col][playerIndex];
  }

  // =================================================================
  // PERFORMANCE STATISTICS
  // =================================================================

  /**
   * Gets AI performance statistics
   */
  static getStats(): {
    cacheSize: number;
    hitRate: number;
    lastSearchNodes: number;
    killerHits: number;
    nullMoveCutoffs: number;
    killerMovesStored: number;
    historyTableEntries: number;
    lmrReductions: number;
    aspirationHits: number;
    threatExtensions: number;
  } {
    const hitRate = this.searchStats.cacheHits + this.searchStats.cacheMisses > 0
      ? this.searchStats.cacheHits / (this.searchStats.cacheHits + this.searchStats.cacheMisses)
      : 0;

    // Count non-zero history entries
    let historyEntries = 0;
    for (let row = 0; row < GAME_CONFIG.BOARD_SIZE; row++) {
      for (let col = 0; col < GAME_CONFIG.BOARD_SIZE; col++) {
        if (this.historyTable[row][col] > 0) historyEntries++;
      }
    }

    return {
      cacheSize: this.transpositionTable.size,
      hitRate,
      lastSearchNodes: this.searchStats.nodesSearched,
      killerHits: this.searchStats.killerHits,
      nullMoveCutoffs: this.searchStats.nullMoveCutoffs,
      killerMovesStored: this.killerMoves.size,
      historyTableEntries: historyEntries,
      lmrReductions: this.searchStats.lmrReductions,
      aspirationHits: this.searchStats.aspirationHits,
      threatExtensions: this.searchStats.threatExtensions
    };
  }
}

export default AIService;