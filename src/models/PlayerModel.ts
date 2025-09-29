// =================================================================
// PLAYER MODEL - Player management without authentication
// =================================================================

import {
  type Player,
  type GameSymbol,
  GAME_CONFIG
} from '../types/gomoku';

/**
 * PlayerModel - Manages player creation and lifecycle
 *
 * Why this design?
 * - NO authentication required (quick play experience)
 * - Visual identification only (symbols)
 * - Auto-generated IDs for uniqueness
 * - Simple connection tracking
 * - Auto-cleanup for abandoned connections
 */
export class PlayerModel {

  // =================================================================
  // PLAYER CREATION
  // =================================================================

  /**
   * Creates a new human player
   *
   * Why UUID?
   * - Unique across all games
   * - No collision risk
   * - No personal data needed
   *
   * Why auto-assignment of symbols?
   * - Simplifies UI (no need to choose)
   * - Prevents conflicts
   * - Quick game start
   */
  static createHumanPlayer(
    preferredSymbol?: GameSymbol,
    connectionId?: string
  ): Player {
    return {
      id: this.generatePlayerId(),
      symbol: preferredSymbol || 'X', // Default to X if not specified
      type: 'human',
      connectionId: connectionId || undefined, // Explicit undefined
      joinedAt: new Date(),
      isConnected: true,
      lastActivity: new Date()
    };
  }

  /**
   * Creates an AI player
   *
   * Why separate method?
   * - AI players have different lifecycle
   * - No connection ID needed
   * - Always "connected" (server-side)
   * - Predictable symbol assignment
   */
  static createAIPlayer(symbol: GameSymbol): Player {
    return {
      id: `ai_${this.generatePlayerId()}`,
      symbol,
      type: 'ai',
      connectionId: undefined, // AI doesn't need WebSocket
      joinedAt: new Date(),
      isConnected: true, // AI is always "connected"
      lastActivity: new Date()
    };
  }

  // =================================================================
  // SYMBOL MANAGEMENT
  // =================================================================

  /**
   * Gets available symbols for a game type
   *
   * Why this order?
   * - X, O: Traditional Gomoku symbols
   * - ▲, ■: For multiplayer (visual distinction)
   */
  static getAvailableSymbols(gameType: 'human-vs-ai' | 'multiplayer'): GameSymbol[] {
    if (gameType === 'human-vs-ai') {
      return [...GAME_CONFIG.VS_AI_SYMBOLS];
    }
    return [...GAME_CONFIG.MULTIPLAYER_SYMBOLS];
  }

  /**
   * Assigns optimal symbols for human vs AI
   *
   * Why X for human?
   * - X traditionally goes first
   * - Gives human slight advantage (first move)
   * - Standard in most Gomoku implementations
   */
  static assignSymbolsForVsAI(humanPreference?: GameSymbol): {
    humanSymbol: GameSymbol;
    aiSymbol: GameSymbol;
  } {
    // If human wants O, give them O
    if (humanPreference === 'O') {
      return { humanSymbol: 'O', aiSymbol: 'X' };
    }

    // Default: human gets X (first move advantage)
    return { humanSymbol: 'X', aiSymbol: 'O' };
  }

  /**
   * Gets next available symbol for multiplayer
   */
  static getNextAvailableSymbol(
    existingPlayers: Player[],
    gameType: 'human-vs-ai' | 'multiplayer'
  ): GameSymbol | null {
    const availableSymbols = this.getAvailableSymbols(gameType);
    const usedSymbols = existingPlayers.map(p => p.symbol);

    const nextSymbol = availableSymbols.find(symbol =>
      !usedSymbols.includes(symbol)
    );

    return nextSymbol || null;
  }

  // =================================================================
  // PLAYER LIFECYCLE MANAGEMENT
  // =================================================================

  /**
   * Updates player's last activity
   * Essential for connection management and auto-cleanup
   */
  static updateActivity(player: Player): Player {
    return {
      ...player,
      lastActivity: new Date()
    };
  }

  /**
   * Marks player as connected/disconnected
   *
   * Why track connection status?
   * - Pause games when player disconnects
   * - Resume when they reconnect
   * - Auto-cleanup abandoned games
   */
  static setConnectionStatus(
    player: Player,
    isConnected: boolean,
    connectionId?: string
  ): Player {
    return {
      ...player,
      isConnected,
      connectionId: isConnected ? connectionId : undefined,
      lastActivity: new Date()
    };
  }

  /**
   * Checks if player should be cleaned up
   *
   * Why 30 minutes?
   * - Restaurant dining time: 5-15 minutes waiting
   * - Buffer time for slow connections
   * - Prevents memory leaks from abandoned games
   */
  static shouldCleanup(player: Player): boolean {
    if (player.type === 'ai') {
      return false; // AI players are never cleaned up individually
    }

    const now = new Date();
    const timeSinceActivity = now.getTime() - player.lastActivity.getTime();
    const isInactive = timeSinceActivity > GAME_CONFIG.AUTO_CLEANUP_TIME;
    const isDisconnected = !player.isConnected;

    // Clean up if disconnected for more than 5 minutes
    const disconnectionThreshold = 5 * 60 * 1000; // 5 minutes
    const shouldCleanupDisconnected = isDisconnected && timeSinceActivity > disconnectionThreshold;

    return isInactive || shouldCleanupDisconnected;
  }

  /**
   * Checks if two players can be in the same game
   *
   * Why these validations?
   * - Prevent duplicate symbols
   * - Ensure game type compatibility
   * - Maintain game balance
   */
  static canPlayTogether(player1: Player, player2: Player): {
    canPlay: boolean;
    reason?: string;
  } {
    // Same symbol conflict
    if (player1.symbol === player2.symbol) {
      return { canPlay: false, reason: 'Players cannot have the same symbol' };
    }

    // Both AI (shouldn't happen in current design)
    if (player1.type === 'ai' && player2.type === 'ai') {
      return { canPlay: false, reason: 'Cannot have two AI players' };
    }

    return { canPlay: true };
  }

  // =================================================================
  // PLAYER VALIDATION
  // =================================================================

  /**
   * Validates player data
   */
  static validatePlayer(player: Partial<Player>): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!player.id) {
      errors.push('Player ID is required');
    }

    if (!player.symbol) {
      errors.push('Player symbol is required');
    }

    if (player.symbol && !['X', 'O', '▲', '■'].includes(player.symbol)) {
      errors.push('Invalid player symbol');
    }

    if (!player.type) {
      errors.push('Player type is required');
    }

    if (player.type && !['human', 'ai'].includes(player.type)) {
      errors.push('Invalid player type');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // =================================================================
  // UTILITY METHODS
  // =================================================================

  /**
   * Generates unique player ID
   *
   * Why this format?
   * - Short enough for logs
   * - Unique enough for concurrent players
   * - No personal information
   */
  private static generatePlayerId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${timestamp}_${random}`;
  }

  /**
   * Gets player display info (for UI)
   */
  static getDisplayInfo(player: Player): {
    id: string;
    symbol: GameSymbol;
    type: string;
    status: string;
  } {
    return {
      id: player.id,
      symbol: player.symbol,
      type: player.type === 'ai' ? 'AI (Extreme)' : 'Human',
      status: player.isConnected ? 'Connected' : 'Disconnected'
    };
  }

  /**
   * Creates player summary for logging
   */
  static createSummary(player: Player): string {
    const status = player.isConnected ? '🟢' : '🔴';
    const type = player.type === 'ai' ? '🤖' : '👤';
    return `${type} ${player.symbol} (${player.id.substring(0, 8)}) ${status}`;
  }

  /**
   * Gets all human players from a list
   */
  static getHumanPlayers(players: Player[]): Player[] {
    return players.filter(p => p.type === 'human');
  }

  /**
   * Gets all AI players from a list
   */
  static getAIPlayers(players: Player[]): Player[] {
    return players.filter(p => p.type === 'ai');
  }
}

export default PlayerModel;