// =================================================================
// GOMOKU GAME TYPES - Centralized type definitions
// =================================================================

// Basic game symbols - Visual identifiers only (no authentication)
export type GameSymbol = 'X' | 'O' | '▲' | '■';

// Player types - Simple identification
export type PlayerType = GameSymbol | null;

// Game status states
export type GameStatus = 'waiting' | 'playing' | 'won' | 'draw' | 'abandoned';

// AI difficulty - Fixed to extreme only
export type AIDifficulty = 'extreme';

// =================================================================
// CORE GAME INTERFACES
// =================================================================

/**
 * Player interface - NO authentication, just visual identification
 * Perfect for quick "arrive, play, leave" experience
 */
export interface Player {
  id: string;                    // Auto-generated UUID
  symbol: GameSymbol;            // Visual identifier (X, O, ▲, ■)
  type: 'human' | 'ai';         // Player type
  connectionId: string | undefined; // WebSocket connection ID (explicit undefined)
  joinedAt: Date;               // When they joined
  isConnected: boolean;         // Connection status
  lastActivity: Date;           // For auto-cleanup
}

/**
 * Game board - 15x15 grid for Gomoku
 */
export type Board = PlayerType[][];

/**
 * Move interface - Represents a single game move
 */
export interface Move {
  row: number;                  // 0-14
  col: number;                  // 0-14
  player: GameSymbol;          // Who made the move
  timestamp: Date;             // When the move was made
  moveNumber: number;          // Sequential move counter
}

/**
 * Game state - Complete state of a Gomoku game
 */
export interface GameState {
  id: string;                   // Unique game ID
  board: Board;                 // Current board state
  currentPlayer: GameSymbol;    // Whose turn it is
  status: GameStatus;           // Current game status
  winner: GameSymbol | null;    // Winner if game is won
  moves: Move[];               // Complete move history
  players: Player[];           // Players in this game (max 2 for vs-AI)
  createdAt: Date;            // Game creation time
  lastActivity: Date;         // Last move time
  winningPositions: { row: number; col: number }[] | undefined; // Winning line positions
}

/**
 * AI Move result - Response from AI calculation
 */
export interface AIMove {
  row: number;                 // Best move row
  col: number;                 // Best move column
  score: number;               // Position evaluation score
  timeElapsed: number;         // Time taken to calculate (ms)
  nodesSearched: number;       // Nodes evaluated in search tree
  depth: number;               // Search depth reached
  confidence: number;          // AI confidence (0-1)
}

/**
 * Room interface - Container for games
 */
export interface Room {
  id: string;                  // Short, memorable room ID (e.g., "ABC123")
  gameType: 'human-vs-ai' | 'multiplayer'; // Game type
  game: GameState;             // Current game state
  maxPlayers: number;          // Maximum players allowed
  isPrivate: boolean;          // Whether room is private
  createdAt: Date;            // Room creation time
  lastActivity: Date;         // Last activity (for cleanup)
  autoCleanupAt: Date;        // When to auto-delete this room

  // Win tracking for the room session
  winStats?: {
    humanWins: number;         // Human player wins in this room
    aiWins: number;            // AI wins in this room
    draws: number;             // Draw count
    consecutiveHumanWins: number; // Consecutive human wins (for rewards)
  };
}

// =================================================================
// WEBSOCKET MESSAGE TYPES
// =================================================================

/**
 * WebSocket message types for real-time communication
 */
export type WSMessageType =
  | 'game_created'         // Game was created
  | 'player_joined'        // Player joined the game
  | 'player_left'          // Player left the game
  | 'move_made'            // Move was made
  | 'move_processing'      // Move is being processed
  | 'ai_thinking'          // AI is calculating move
  | 'ai_move'              // AI made its move
  | 'game_state_update'    // Game state was updated
  | 'game_over'            // Game ended
  | 'game_reset'           // Game was reset
  | 'room_closed'          // Room was closed
  | 'error'                // Error occurred
  | 'admin_message'        // Admin message
  | 'ping'                 // Keep-alive ping
  | 'pong';                // Keep-alive response

/**
 * WebSocket message structure
 */
export interface WSMessage {
  type: WSMessageType;
  gameId?: string;             // Associated game ID
  roomId?: string;             // Associated room ID
  data?: any;                  // Message payload
  timestamp: Date;             // Message timestamp
  playerId?: string;           // Sender player ID
}

// =================================================================
// API REQUEST/RESPONSE TYPES
// =================================================================

/**
 * Quick start game request - Minimal data needed
 */
export interface QuickStartRequest {
  playerSymbol?: GameSymbol;   // Preferred symbol (optional)
}

/**
 * Quick start game response
 */
export interface QuickStartResponse {
  success: boolean;
  gameId: string;
  roomId: string;
  playerId: string;
  playerSymbol: GameSymbol;
  aiSymbol: GameSymbol;
  wsEndpoint: string;          // WebSocket connection URL
  gameState: GameState;
}

/**
 * Make move request
 */
export interface MakeMoveRequest {
  row: number;
  col: number;
  playerId: string;
}

/**
 * Make move response
 */
export interface MakeMoveResponse {
  success: boolean;
  move?: Move;
  gameState?: GameState;
  aiMove?: AIMove;             // If AI responded immediately
  error?: string;
}

/**
 * Game state request
 */
export interface GameStateRequest {
  gameId: string;
  playerId: string;
}

/**
 * Error response structure
 */
export interface ErrorResponse {
  success: false;
  error: string;
  code: string;
  timestamp: Date;
}

// =================================================================
// CONFIGURATION CONSTANTS
// =================================================================

export const GAME_CONFIG = {
  BOARD_SIZE: 15,              // 15x15 board
  WIN_LENGTH: 5,               // 5 in a row to win
  MAX_PLAYERS_VS_AI: 2,        // Human + AI
  MAX_PLAYERS_MULTIPLAYER: 4,  // Up to 4 players
  AI_DIFFICULTY: 'extreme' as const, // Always extreme

  // Timing configurations
  AI_MAX_THINK_TIME: 1000,     // 1 second max for AI (faster response)
  AUTO_CLEANUP_TIME: 30 * 60 * 1000, // 30 minutes
  WEBSOCKET_PING_INTERVAL: 60000, // 60 seconds (more stable)

  // Performance limits
  MAX_CONCURRENT_GAMES: 15,    // Support for 15 simultaneous games
  MAX_CONNECTIONS_PER_IP: 3,   // Prevent abuse

  // Available symbols for different game modes
  VS_AI_SYMBOLS: ['X', 'O'] as const,
  MULTIPLAYER_SYMBOLS: ['X', 'O', '▲', '■'] as const
} as const;

// =================================================================
// UTILITY TYPES
// =================================================================

/**
 * Direction vectors for win detection
 */
export type Direction = [number, number];

export const DIRECTIONS: Direction[] = [
  [0, 1],   // horizontal →
  [1, 0],   // vertical ↓
  [1, 1],   // diagonal ↘
  [1, -1],  // diagonal ↗
] as const;

/**
 * Position on the board
 */
export interface Position {
  row: number;
  col: number;
}

/**
 * AI evaluation patterns
 */
export interface Pattern {
  length: number;              // Length of the pattern
  openEnds: number;           // Number of open ends (0, 1, or 2)
  isBlocked: boolean;         // Whether pattern is blocked
  value: number;              // Strategic value of pattern
}

