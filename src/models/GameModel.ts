// =================================================================
// GAME MODEL - Core game logic and data management
// =================================================================

import {
  DIRECTIONS,
  GAME_CONFIG,
  type Board,
  type GameState,
  type GameStatus,
  type GameSymbol,
  type Move,
  type Position
} from '../types/gomoku';

/**
 * GameModel - Handles all game logic and state management
 *
 * Why this design?
 * - Centralized game rules and validation
 * - Immutable operations (pure functions where possible)
 * - Easy to test and debug
 * - Separates game logic from network/UI concerns
 */
export class GameModel {
  // =================================================================
  // BOARD CREATION AND VALIDATION
  // =================================================================

  /**
   * Creates an empty Gomoku board
   * Why 15x15? Standard Gomoku board size for optimal strategy
   */
  static createEmptyBoard(): Board {
    return Array(GAME_CONFIG.BOARD_SIZE)
      .fill(null)
      .map(() => Array(GAME_CONFIG.BOARD_SIZE).fill(null));
  }

  /**
   * Creates initial game state for Human vs AI
   *
   * Why these defaults?
   * - Human gets 'X' (first player advantage)
   * - AI gets 'O' (traditional second player)
   * - Status starts as 'playing' (ready to accept moves)
   */
  static createInitialGameState(
    gameId: string,
    humanSymbol: GameSymbol = "X",
    aiSymbol: GameSymbol = "O"
  ): GameState {
    return {
      id: gameId,
      board: this.createEmptyBoard(),
      currentPlayer: "X", // X always goes first in Gomoku
      status: "playing",
      winner: null,
      moves: [],
      players: [], // Will be populated when players join
      createdAt: new Date(),
      lastActivity: new Date(),
      winningPositions: undefined,
    };
  }

  // =================================================================
  // MOVE VALIDATION AND EXECUTION
  // =================================================================

  /**
   * Validates if a move is legal
   *
   * Why these checks?
   * 1. Position bounds - prevent array out of bounds
   * 2. Empty cell - can't place on occupied space
   * 3. Game active - can't move in finished games
   * 4. Turn order - enforce alternating turns
   */
  static isValidMove(
    gameState: GameState,
    row: number,
    col: number,
    player: GameSymbol
  ): { valid: boolean; reason?: string } {
    // Check if game is still active
    if (gameState.status !== "playing") {
      return { valid: false, reason: "Game is not active" };
    }

    // Check turn order
    if (gameState.currentPlayer !== player) {
      return { valid: false, reason: "Not your turn" };
    }

    // Check bounds
    if (
      row < 0 ||
      row >= GAME_CONFIG.BOARD_SIZE ||
      col < 0 ||
      col >= GAME_CONFIG.BOARD_SIZE
    ) {
      return { valid: false, reason: "Move out of bounds" };
    }

    // Check if cell is empty
    if (gameState.board[row]?.[col] !== null) {
      return { valid: false, reason: "Cell already occupied" };
    }

    return { valid: true };
  }

  /**
   * Executes a move and returns new game state
   *
   * Why immutable?
   * - Easier to track changes
   * - Can implement undo/redo
   * - Prevents accidental state mutations
   * - Better for debugging
   */
  static makeMove(
    gameState: GameState,
    row: number,
    col: number,
    player: GameSymbol
  ): {
    newGameState: GameState;
    move: Move;
    isValid: boolean;
    error: string | undefined;
  } {
    // Validate move first
    const validation = this.isValidMove(gameState, row, col, player);
    if (!validation.valid) {
      return {
        newGameState: gameState,
        move: null as any,
        isValid: false,
        error: validation.reason || undefined,
      };
    }

    // Create the move
    const move: Move = {
      row,
      col,
      player,
      timestamp: new Date(),
      moveNumber: gameState.moves.length + 1,
    };

    // Create new board state (immutable)
    const newBoard = gameState.board.map((row) => [...row]);
    if (newBoard[row]) {
      newBoard[row][col] = player;
    }

    // Check for win condition
    const winResult = this.checkWinCondition(newBoard, row, col, player);

    // Determine next player (X -> O -> X...)
    const nextPlayer: GameSymbol = player === "X" ? "O" : "X";

    // Check for draw (board full)
    const isBoardFull = this.isBoardFull(newBoard);

    // Determine game status
    let status: GameStatus = "playing";
    let winner: GameSymbol | null = null;

    if (winResult.isWin) {
      status = "won";
      winner = player;
    } else if (isBoardFull) {
      status = "draw";
    }

    // Create new game state
    const newGameState: GameState = {
      ...gameState,
      board: newBoard,
      currentPlayer:
        status === "playing" ? nextPlayer : gameState.currentPlayer,
      status,
      winner,
      moves: [...gameState.moves, move],
      lastActivity: new Date(),
      winningPositions: winResult.winningPositions,
    };

    return {
      newGameState,
      move,
      isValid: true,
      error: undefined
    };
  }

  // =================================================================
  // WIN CONDITION DETECTION
  // =================================================================

  /**
   * Checks if the last move resulted in a win
   *
   * Why check all 4 directions?
   * - Horizontal: ← →
   * - Vertical: ↑ ↓
   * - Diagonal 1: ↖ ↘
   * - Diagonal 2: ↗ ↙
   *
   * Need exactly 5 in a row for Gomoku win
   */
  static checkWinCondition(
    board: Board,
    lastRow: number,
    lastCol: number,
    player: GameSymbol
  ): {
    isWin: boolean;
    winningPositions: Position[] | undefined;
  } {
    // Check each direction
    for (const [deltaRow, deltaCol] of DIRECTIONS) {
      const line = this.getLinePositions(
        board,
        lastRow,
        lastCol,
        deltaRow,
        deltaCol,
        player
      );

      if (line.length >= GAME_CONFIG.WIN_LENGTH) {
        return {
          isWin: true,
          winningPositions: line.slice(0, GAME_CONFIG.WIN_LENGTH),
        };
      }
    }

    return { isWin: false, winningPositions: undefined };
  }

  /**
   * Gets consecutive positions in a direction for the same player
   */
  private static getLinePositions(
    board: Board,
    row: number,
    col: number,
    deltaRow: number,
    deltaCol: number,
    player: GameSymbol
  ): Position[] {
    const positions: Position[] = [{ row, col }];

    // Check forward direction
    let currentRow = row + deltaRow;
    let currentCol = col + deltaCol;

    while (
      currentRow >= 0 &&
      currentRow < GAME_CONFIG.BOARD_SIZE &&
      currentCol >= 0 &&
      currentCol < GAME_CONFIG.BOARD_SIZE &&
      board[currentRow]?.[currentCol] === player
    ) {
      positions.push({ row: currentRow, col: currentCol });
      currentRow += deltaRow;
      currentCol += deltaCol;
    }

    // Check backward direction
    currentRow = row - deltaRow;
    currentCol = col - deltaCol;

    while (
      currentRow >= 0 &&
      currentRow < GAME_CONFIG.BOARD_SIZE &&
      currentCol >= 0 &&
      currentCol < GAME_CONFIG.BOARD_SIZE &&
      board[currentRow]?.[currentCol] === player
    ) {
      positions.unshift({ row: currentRow, col: currentCol });
      currentRow -= deltaRow;
      currentCol -= deltaCol;
    }

    return positions;
  }

  // =================================================================
  // UTILITY METHODS
  // =================================================================

  /**
   * Checks if the board is completely full (draw condition)
   */
  static isBoardFull(board: Board): boolean {
    return board.every((row) => row.every((cell) => cell !== null));
  }

  /**
   * Gets all empty positions on the board
   * Useful for AI move generation
   */
  static getEmptyPositions(board: Board): Position[] {
    const positions: Position[] = [];

    for (let row = 0; row < GAME_CONFIG.BOARD_SIZE; row++) {
      for (let col = 0; col < GAME_CONFIG.BOARD_SIZE; col++) {
        if (board[row]?.[col] === null) {
          positions.push({ row, col });
        }
      }
    }

    return positions;
  }

  /**
   * Creates a deep copy of the board
   * Essential for AI search algorithms that need to simulate moves
   */
  static copyBoard(board: Board): Board {
    return board.map((row) => [...row]);
  }

  /**
   * Gets move history as a readable format
   * Useful for debugging and game replay
   */
  static getMoveHistory(gameState: GameState): string[] {
    return gameState.moves.map(
      (move, index) =>
        `${index + 1}. ${move.player} at (${move.row}, ${move.col})`
    );
  }

  /**
   * Checks if a game should be auto-cleaned up
   * Games older than 30 minutes with no activity get removed
   */
  static shouldCleanup(gameState: GameState): boolean {
    const now = new Date();
    const timeSinceActivity = now.getTime() - gameState.lastActivity.getTime();
    return timeSinceActivity > GAME_CONFIG.AUTO_CLEANUP_TIME;
  }
}

export default GameModel;
