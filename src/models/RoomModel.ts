// =================================================================
// ROOM MODEL - Game room management and lifecycle
// =================================================================

import {
  type Room,
  type GameState,
  type Player,
  GAME_CONFIG
} from '../types/gomoku';
import GameModel from './GameModel';
import PlayerModel from './PlayerModel';

/**
 * RoomModel - Manages game rooms and their lifecycle
 *
 * Why rooms?
 * - Isolate games from each other
 * - Easy cleanup and resource management
 * - Support for different game types
 * - Simple scaling (one room = one game instance)
 */
export class RoomModel {

  // =================================================================
  // ROOM CREATION
  // =================================================================

  /**
   * Creates a new room for Human vs AI
   *
   * Why short room IDs?
   * - Easy to remember and share
   * - Quick typing on mobile
   * - No personal information leaked
   */
  static createHumanVsAIRoom(
    humanPlayer: Player,
    aiPlayer: Player
  ): Room {
    const roomId = this.generateRoomId();
    const gameId = `game_${roomId}`;

    // Create initial game state
    const gameState = GameModel.createInitialGameState(
      gameId,
      humanPlayer.symbol,
      aiPlayer.symbol
    );

    // Add players to game state
    gameState.players = [humanPlayer, aiPlayer];

    const room: Room = {
      id: roomId,
      gameType: 'human-vs-ai',
      game: gameState,
      maxPlayers: GAME_CONFIG.MAX_PLAYERS_VS_AI,
      isPrivate: false, // vs AI rooms can be public
      createdAt: new Date(),
      lastActivity: new Date(),
      autoCleanupAt: new Date(Date.now() + GAME_CONFIG.AUTO_CLEANUP_TIME),
      // Initialize win stats
      winStats: {
        humanWins: 0,
        aiWins: 0,
        draws: 0,
        consecutiveHumanWins: 0
      }
    };

    return room;
  }

  /**
   * Creates a new room for multiplayer
   * (Future expansion - for now focusing on vs AI)
   */
  static createMultiplayerRoom(
    maxPlayers: number = GAME_CONFIG.MAX_PLAYERS_MULTIPLAYER,
    isPrivate: boolean = false
  ): Room {
    const roomId = this.generateRoomId();
    const gameId = `game_${roomId}`;

    const gameState = GameModel.createInitialGameState(gameId);

    const room: Room = {
      id: roomId,
      gameType: 'multiplayer',
      game: gameState,
      maxPlayers,
      isPrivate,
      createdAt: new Date(),
      lastActivity: new Date(),
      autoCleanupAt: new Date(Date.now() + GAME_CONFIG.AUTO_CLEANUP_TIME)
    };

    return room;
  }

  // =================================================================
  // ROOM MANAGEMENT
  // =================================================================

  /**
   * Updates room's last activity timestamp
   *
   * Why track activity?
   * - Auto-cleanup inactive rooms
   * - Resource management
   * - Prevent memory leaks
   */
  static updateActivity(room: Room): Room {
    const now = new Date();
    return {
      ...room,
      lastActivity: now,
      autoCleanupAt: new Date(now.getTime() + GAME_CONFIG.AUTO_CLEANUP_TIME),
      game: {
        ...room.game,
        lastActivity: now
      }
    };
  }

  /**
   * Updates game state within the room
   */
  static updateGameState(room: Room, newGameState: GameState): Room {
    return {
      ...room,
      game: newGameState,
      lastActivity: new Date()
    };
  }

  /**
   * Checks if room is full
   */
  static isFull(room: Room): boolean {
    return room.game.players.length >= room.maxPlayers;
  }

  /**
   * Checks if room is ready to start playing
   *
   * For vs AI: Need 1 human + 1 AI (auto-created)
   * For multiplayer: Need at least 2 players
   */
  static isReadyToPlay(room: Room): boolean {
    const playerCount = room.game.players.length;

    if (room.gameType === 'human-vs-ai') {
      // Need exactly 2 players: 1 human + 1 AI
      return playerCount === 2 &&
             room.game.players.some(p => p.type === 'human') &&
             room.game.players.some(p => p.type === 'ai');
    }

    // Multiplayer needs at least 2 players
    return playerCount >= 2;
  }

  // =================================================================
  // PLAYER MANAGEMENT WITHIN ROOMS
  // =================================================================

  /**
   * Adds a player to the room
   *
   * Why these validations?
   * - Prevent room overflow
   * - Ensure unique symbols
   * - Maintain game balance
   */
  static addPlayer(room: Room, player: Player): {
    success: boolean;
    updatedRoom?: Room;
    error?: string;
  } {
    // Check if room is full
    if (this.isFull(room)) {
      return { success: false, error: 'Room is full' };
    }

    // Check for symbol conflicts
    const existingSymbols = room.game.players.map(p => p.symbol);
    if (existingSymbols.includes(player.symbol)) {
      return { success: false, error: 'Symbol already taken' };
    }

    // For vs AI rooms, validate player types
    if (room.gameType === 'human-vs-ai') {
      const hasHuman = room.game.players.some(p => p.type === 'human');
      const hasAI = room.game.players.some(p => p.type === 'ai');

      if (player.type === 'human' && hasHuman) {
        return { success: false, error: 'Room already has a human player' };
      }

      if (player.type === 'ai' && hasAI) {
        return { success: false, error: 'Room already has an AI player' };
      }
    }

    // Add player to room
    const updatedGameState: GameState = {
      ...room.game,
      players: [...room.game.players, player],
      lastActivity: new Date()
    };

    const updatedRoom: Room = {
      ...room,
      game: updatedGameState,
      lastActivity: new Date()
    };

    return { success: true, updatedRoom };
  }

  /**
   * Removes a player from the room
   */
  static removePlayer(room: Room, playerId: string): {
    success: boolean;
    updatedRoom?: Room;
    shouldCleanup?: boolean;
  } {
    const existingPlayer = room.game.players.find(p => p.id === playerId);
    if (!existingPlayer) {
      return { success: false };
    }

    const remainingPlayers = room.game.players.filter(p => p.id !== playerId);

    // If removing a human player from vs AI, cleanup the room
    if (room.gameType === 'human-vs-ai' && existingPlayer.type === 'human') {
      return { success: true, shouldCleanup: true };
    }

    // If no players left, cleanup
    if (remainingPlayers.length === 0) {
      return { success: true, shouldCleanup: true };
    }

    const updatedGameState: GameState = {
      ...room.game,
      players: remainingPlayers,
      status: remainingPlayers.length < 2 ? 'waiting' : room.game.status,
      lastActivity: new Date()
    };

    const updatedRoom: Room = {
      ...room,
      game: updatedGameState,
      lastActivity: new Date()
    };

    return { success: true, updatedRoom };
  }

  /**
   * Gets a player from the room
   */
  static getPlayer(room: Room, playerId: string): Player | null {
    return room.game.players.find(p => p.id === playerId) || null;
  }

  /**
   * Updates a specific player in the room
   */
  static updatePlayer(room: Room, playerId: string, updatedPlayer: Player): Room {
    const updatedPlayers = room.game.players.map(p =>
      p.id === playerId ? updatedPlayer : p
    );

    return {
      ...room,
      game: {
        ...room.game,
        players: updatedPlayers,
        lastActivity: new Date()
      },
      lastActivity: new Date()
    };
  }

  // =================================================================
  // ROOM CLEANUP AND LIFECYCLE
  // =================================================================

  /**
   * Checks if room should be cleaned up
   *
   * Cleanup conditions:
   * 1. Past auto-cleanup time
   * 2. No active players
   * 3. Game finished and inactive for > 5 minutes
   */
  static shouldCleanup(room: Room): boolean {
    const now = new Date();

    // Check auto-cleanup time
    if (now > room.autoCleanupAt) {
      return true;
    }

    // Check for active players
    const activePlayers = room.game.players.filter(p =>
      p.isConnected && !PlayerModel.shouldCleanup(p)
    );

    if (activePlayers.length === 0) {
      return true;
    }

    // Check if game is finished and inactive
    if (room.game.status === 'won' || room.game.status === 'draw') {
      const timeSinceLastActivity = now.getTime() - room.lastActivity.getTime();
      const fiveMinutes = 5 * 60 * 1000;
      if (timeSinceLastActivity > fiveMinutes) {
        return true;
      }
    }

    return false;
  }

  /**
   * Prepares room for cleanup
   * Disconnects players and clears resources
   */
  static prepareForCleanup(room: Room): Room {
    const disconnectedPlayers = room.game.players.map(player =>
      PlayerModel.setConnectionStatus(player, false)
    );

    return {
      ...room,
      game: {
        ...room.game,
        players: disconnectedPlayers,
        status: 'abandoned'
      }
    };
  }

  // =================================================================
  // ROOM INFORMATION AND STATS
  // =================================================================

  /**
   * Gets room status summary
   */
  static getStatus(room: Room): {
    id: string;
    gameType: string;
    playerCount: number;
    maxPlayers: number;
    gameStatus: string;
    isReady: boolean;
    isFull: boolean;
    connectedPlayers: number;
  } {
    const connectedPlayers = room.game.players.filter(p => p.isConnected).length;

    return {
      id: room.id,
      gameType: room.gameType,
      playerCount: room.game.players.length,
      maxPlayers: room.maxPlayers,
      gameStatus: room.game.status,
      isReady: this.isReadyToPlay(room),
      isFull: this.isFull(room),
      connectedPlayers
    };
  }

  /**
   * Creates room summary for logging
   */
  static createSummary(room: Room): string {
    const status = this.getStatus(room);
    const gameIcon = room.gameType === 'human-vs-ai' ? '🤖' : '👥';
    return `${gameIcon} Room ${room.id}: ${status.connectedPlayers}/${status.maxPlayers} players, ${status.gameStatus}`;
  }

  /**
   * Resets the game in the same room (keeps win stats and players)
   */
  static resetGameInRoom(room: Room): void {
    // Get current players
    const players = room.game.players;

    // Create new game state with same players
    const newGameState = GameModel.createInitialGameState(
      room.game.id,
      players[0]?.symbol || 'X',
      players[1]?.symbol || 'O'
    );

    // Preserve players
    newGameState.players = players;

    // Update room with new game (winStats are preserved in room)
    room.game = newGameState;
    room.lastActivity = new Date();
  }

  /**
   * Updates win stats when a game ends
   * Returns special message if player achieved milestone (5 consecutive wins)
   */
  static updateWinStats(
    room: Room,
    winner: 'X' | 'O' | null,
    humanSymbol: 'X' | 'O'
  ): { specialMessage?: string; achievedMilestone: boolean } {
    if (!room.winStats) {
      room.winStats = {
        humanWins: 0,
        aiWins: 0,
        draws: 0,
        consecutiveHumanWins: 0
      };
    }

    let achievedMilestone = false;
    let specialMessage: string | undefined;

    if (winner === null) {
      // Draw
      room.winStats.draws++;
      room.winStats.consecutiveHumanWins = 0;
    } else if (winner === humanSymbol) {
      // Human won
      room.winStats.humanWins++;
      room.winStats.consecutiveHumanWins++;

      // Check for 5 consecutive wins milestone
      if (room.winStats.consecutiveHumanWins === 5) {
        achievedMilestone = true;
        specialMessage = "🎉 CONGRATULATIONS! You've defeated the AI 5 times in a row! You've earned a special reward! 🏆";
      } else if (room.winStats.consecutiveHumanWins > 5 && room.winStats.consecutiveHumanWins % 5 === 0) {
        // Additional milestones every 5 wins
        achievedMilestone = true;
        specialMessage = `🔥 INCREDIBLE! ${room.winStats.consecutiveHumanWins} wins in a row! You're unstoppable! 🔥`;
      }
    } else {
      // AI won
      room.winStats.aiWins++;
      room.winStats.consecutiveHumanWins = 0;
    }

    return { specialMessage, achievedMilestone };
  }

  // =================================================================
  // UTILITY METHODS
  // =================================================================

  /**
   * Generates a short, memorable room ID
   *
   * Format: 3 letters + 3 numbers (e.g., "ABC123")
   * Why this format?
   * - Easy to type and remember
   * - Sufficient uniqueness for concurrent rooms
   * - No offensive words possible
   */
  private static generateRoomId(): string {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';

    let result = '';

    // 3 random letters
    for (let i = 0; i < 3; i++) {
      result += letters.charAt(Math.floor(Math.random() * letters.length));
    }

    // 3 random numbers
    for (let i = 0; i < 3; i++) {
      result += numbers.charAt(Math.floor(Math.random() * numbers.length));
    }

    return result;
  }

  /**
   * Validates room configuration
   */
  static validateRoom(room: Partial<Room>): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!room.id) {
      errors.push('Room ID is required');
    }

    if (!room.gameType) {
      errors.push('Game type is required');
    }

    if (room.gameType && !['human-vs-ai', 'multiplayer'].includes(room.gameType)) {
      errors.push('Invalid game type');
    }

    if (!room.maxPlayers || room.maxPlayers < 2) {
      errors.push('Max players must be at least 2');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

export default RoomModel;