// =================================================================
// OPENING BOOK - Professional Gomoku Opening Patterns
// =================================================================

import { type Position, GAME_CONFIG } from '../types/gomoku';

/**
 * Opening Book for Gomoku
 *
 * Contains professional opening patterns and responses
 * Improves early game play significantly
 */
export class OpeningBook {

  // Center position
  private static readonly CENTER = Math.floor(GAME_CONFIG.BOARD_SIZE / 2);

  /**
   * Gets the best opening move based on board state
   * Returns null if position is not in opening book
   */
  static getOpeningMove(
    board: (string | null)[][],
    moveNumber: number
  ): Position | null {

    // First move: always center (strongest opening)
    if (moveNumber === 1) {
      return { row: this.CENTER, col: this.CENTER };
    }

    // Second move: respond to first move
    if (moveNumber === 2) {
      return this.getSecondMoveResponse(board);
    }

    // Third move: maintain balance
    if (moveNumber === 3) {
      return this.getThirdMoveResponse(board);
    }

    // For moves 4-8, use pattern-based suggestions
    if (moveNumber <= 8) {
      return this.getEarlyGameMove(board);
    }

    return null; // Use regular AI after opening
  }

  /**
   * Second move response (White's first move)
   */
  private static getSecondMoveResponse(board: (string | null)[][]): Position | null {
    // Find black's first move
    for (let row = 0; row < GAME_CONFIG.BOARD_SIZE; row++) {
      for (let col = 0; col < GAME_CONFIG.BOARD_SIZE; col++) {
        if (board[row]?.[col] !== null) {
          // If black played center, play diagonal
          if (row === this.CENTER && col === this.CENTER) {
            // Diagonal approach - creates imbalance (professional opening)
            const diagonals = [
              { row: this.CENTER - 1, col: this.CENTER - 1 },
              { row: this.CENTER + 1, col: this.CENTER + 1 },
              { row: this.CENTER - 1, col: this.CENTER + 1 },
              { row: this.CENTER + 1, col: this.CENTER - 1 },
            ];
            return diagonals[Math.floor(Math.random() * diagonals.length)] || null;
          } else {
            // If black didn't play center, take it
            return { row: this.CENTER, col: this.CENTER };
          }
        }
      }
    }
    return null;
  }

  /**
   * Third move response (Black's second move)
   */
  private static getThirdMoveResponse(board: (string | null)[][]): Position | null {
    // Count stones
    let blackStones: Position[] = [];
    let whiteStones: Position[] = [];

    for (let row = 0; row < GAME_CONFIG.BOARD_SIZE; row++) {
      for (let col = 0; col < GAME_CONFIG.BOARD_SIZE; col++) {
        if (board[row]?.[col] === 'X') blackStones.push({ row, col });
        if (board[row]?.[col] === 'O') whiteStones.push({ row, col });
      }
    }

    if (blackStones.length !== 1 || whiteStones.length !== 1) return null;

    const black1 = blackStones[0];
    const white1 = whiteStones[0];

    if (!black1 || !white1) return null;

    // If center opening with diagonal response
    if (black1?.row === this.CENTER && black1.col === this.CENTER) {
      // Play opposite diagonal for balanced development
      if (white1.row < this.CENTER && white1.col < this.CENTER) {
        return { row: this.CENTER + 1, col: this.CENTER + 1 };
      }
      if (white1.row > this.CENTER && white1.col > this.CENTER) {
        return { row: this.CENTER - 1, col: this.CENTER - 1 };
      }
      if (white1.row < this.CENTER && white1.col > this.CENTER) {
        return { row: this.CENTER + 1, col: this.CENTER - 1 };
      }
      if (white1.row > this.CENTER && white1.col < this.CENTER) {
        return { row: this.CENTER - 1, col: this.CENTER + 1 };
      }
    }

    return null;
  }

  /**
   * Early game move (moves 4-8)
   * Focus on central control and avoiding edges
   */
  private static getEarlyGameMove(board: (string | null)[][]): Position | null {
    // Get all empty positions within center area
    const centerMoves: Array<{ pos: Position; score: number }> = [];
    const radius = 4; // Stay within 4 squares of center

    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        const row = this.CENTER + dr;
        const col = this.CENTER + dc;

        if (
          row >= 0 && row < GAME_CONFIG.BOARD_SIZE &&
          col >= 0 && col < GAME_CONFIG.BOARD_SIZE &&
          board[row]?.[col] === null
        ) {
          // Score based on distance from center (closer = better)
          const distance = Math.abs(dr) + Math.abs(dc);

          // Check if near existing stones (more valuable)
          let nearStones = 0;
          for (let r = -2; r <= 2; r++) {
            for (let c = -2; c <= 2; c++) {
              const checkRow = row + r;
              const checkCol = col + c;
              if (
                checkRow >= 0 && checkRow < GAME_CONFIG.BOARD_SIZE &&
                checkCol >= 0 && checkCol < GAME_CONFIG.BOARD_SIZE &&
                board[checkRow]?.[checkCol] !== null
              ) {
                nearStones++;
              }
            }
          }

          const score = (10 - distance) + (nearStones * 2);
          centerMoves.push({ pos: { row, col }, score });
        }
      }
    }

    // Return best scored move
    if (centerMoves.length > 0) {
      centerMoves.sort((a, b) => b.score - a.score);
      return centerMoves[0]?.pos || null;
    }

    return null;
  }

  /**
   * Evaluates if a position follows good opening principles
   */
  static isGoodOpeningMove(row: number, col: number, moveNumber: number): boolean {
    // Avoid edges and corners in early game
    if (moveNumber <= 8) {
      // Check if too close to edge
      const distanceFromEdge = Math.min(
        row,
        col,
        GAME_CONFIG.BOARD_SIZE - 1 - row,
        GAME_CONFIG.BOARD_SIZE - 1 - col
      );

      // Should be at least 2 squares from edge
      if (distanceFromEdge < 2) return false;

      // Prefer central positions
      const distanceFromCenter =
        Math.abs(row - this.CENTER) + Math.abs(col - this.CENTER);

      // Should be within 5 squares of center
      return distanceFromCenter <= 5;
    }

    return true; // No restrictions after opening
  }

  /**
   * Gets anti-pattern positions to avoid
   */
  static isAntiPattern(row: number, col: number, moveNumber: number): boolean {
    // Avoid corners in first 10 moves
    if (moveNumber <= 10) {
      const corners = [
        [0, 0], [0, GAME_CONFIG.BOARD_SIZE - 1],
        [GAME_CONFIG.BOARD_SIZE - 1, 0], [GAME_CONFIG.BOARD_SIZE - 1, GAME_CONFIG.BOARD_SIZE - 1]
      ];

      for (const [cornerRow, cornerCol] of corners) {
        if (row === cornerRow && col === cornerCol) return true;
      }

      // Avoid edges in first 6 moves
      if (moveNumber <= 6) {
        if (row === 0 || row === GAME_CONFIG.BOARD_SIZE - 1) return true;
        if (col === 0 || col === GAME_CONFIG.BOARD_SIZE - 1) return true;
      }
    }

    return false;
  }

  /**
   * Gets suggested opening for demonstration/teaching
   */
  static getOpeningPattern(patternName: string): Position[] {
    const patterns: Record<string, Position[]> = {
      'center-diagonal': [
        { row: this.CENTER, col: this.CENTER },
        { row: this.CENTER - 1, col: this.CENTER - 1 },
        { row: this.CENTER + 1, col: this.CENTER + 1 },
        { row: this.CENTER - 1, col: this.CENTER + 1 },
        { row: this.CENTER + 1, col: this.CENTER - 1 },
      ],
      'flower': [
        { row: this.CENTER, col: this.CENTER },
        { row: this.CENTER - 1, col: this.CENTER },
        { row: this.CENTER + 1, col: this.CENTER },
        { row: this.CENTER, col: this.CENTER - 1 },
        { row: this.CENTER, col: this.CENTER + 1 },
      ],
      'star': [
        { row: this.CENTER, col: this.CENTER },
        { row: this.CENTER - 2, col: this.CENTER - 2 },
        { row: this.CENTER + 2, col: this.CENTER + 2 },
        { row: this.CENTER - 2, col: this.CENTER + 2 },
        { row: this.CENTER + 2, col: this.CENTER - 2 },
      ],
    };

    return patterns[patternName] || [];
  }
}

export default OpeningBook;
