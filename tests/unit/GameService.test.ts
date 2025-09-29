// =================================================================
// GAME SERVICE TESTS - Critical tests for game logic
// =================================================================

import { describe, it, expect, beforeEach } from 'bun:test';
import GameService from '../../src/services/GameService';
import { TestUtils } from '../helpers/setup';
import type { QuickStartRequest } from '../../src/types/gomoku';

describe('GameService - Critical Tests', () => {
  beforeEach(() => {
    // Clear any existing games
    GameService.cleanup();
  });

  describe('Game Creation', () => {
    it('should create game with human vs AI', () => {
      const request: QuickStartRequest = {
        playerSymbol: 'X'
      };

      const result = GameService.createHumanVsAIGame(request);

      expect(result.success).toBe(true);
      expect(result.gameId).toBeDefined();
      expect(result.roomId).toBeDefined();
      expect(result.playerId).toBeDefined();
      expect(result.playerSymbol).toBe('X');
      expect(result.aiSymbol).toBe('O');
    });

    it('should auto-assign symbol when not specified', () => {
      const request: QuickStartRequest = {};

      const result = GameService.createHumanVsAIGame(request);

      expect(result.success).toBe(true);
      expect(['X', 'O']).toContain(result.playerSymbol);
      expect(result.playerSymbol !== result.aiSymbol).toBe(true);
    });

    it('should create unique game IDs', () => {
      const request1: QuickStartRequest = { playerSymbol: 'X' };
      const request2: QuickStartRequest = { playerSymbol: 'O' };

      const result1 = GameService.createHumanVsAIGame(request1);
      const result2 = GameService.createHumanVsAIGame(request2);

      expect(result1.gameId).not.toBe(result2.gameId);
      expect(result1.roomId).not.toBe(result2.roomId);
      expect(result1.playerId).not.toBe(result2.playerId);
    });

    it('should initialize game state correctly', () => {
      const request: QuickStartRequest = { playerSymbol: 'X' };
      const result = GameService.createHumanVsAIGame(request);

      expect(result.gameState).toBeDefined();
      expect(result.gameState.id).toBe(result.gameId);
      expect(result.gameState.status).toBe('playing');
      expect(result.gameState.currentPlayer).toBe('X');
      expect(result.gameState.winner).toBeNull();
      expect(result.gameState.moves).toHaveLength(0);
      expect(result.gameState.players).toHaveLength(2);
    });
  });

  describe('Game Retrieval', () => {
    it('should retrieve existing game', () => {
      const request: QuickStartRequest = { playerSymbol: 'X' };
      const created = GameService.createHumanVsAIGame(request);

      const retrieved = GameService.getGame(created.gameId);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.gameId);
      expect(retrieved?.status).toBe('playing');
    });

    it('should return null for non-existent game', () => {
      const result = GameService.getGame('non-existent-game-id');
      expect(result).toBeNull();
    });

    it('should get game state correctly', () => {
      const request: QuickStartRequest = { playerSymbol: 'X' };
      const created = GameService.createHumanVsAIGame(request);

      const gameState = GameService.getGameState(created.gameId);

      expect(gameState).toBeDefined();
      expect(gameState?.id).toBe(created.gameId);
      expect(gameState?.board).toHaveLength(15);
      expect(gameState?.board[0]).toHaveLength(15);
    });
  });

  describe('Statistics', () => {
    it('should track active games correctly', () => {
      const initialStats = GameService.getStats();
      expect(initialStats.activeGames).toBe(0);

      const request: QuickStartRequest = { playerSymbol: 'X' };
      GameService.createHumanVsAIGame(request);

      const updatedStats = GameService.getStats();
      expect(updatedStats.activeGames).toBe(1);
      expect(updatedStats.humanVsAIGames).toBe(1);
    });

    it('should track multiple games', () => {
      const request1: QuickStartRequest = { playerSymbol: 'X' };
      const request2: QuickStartRequest = { playerSymbol: 'O' };

      GameService.createHumanVsAIGame(request1);
      GameService.createHumanVsAIGame(request2);

      const stats = GameService.getStats();
      expect(stats.activeGames).toBe(2);
      expect(stats.humanVsAIGames).toBe(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid symbol gracefully', () => {
      const request: QuickStartRequest = {
        playerSymbol: 'Z' as any // Invalid symbol
      };

      // Should still create game with auto-assigned symbol
      const result = GameService.createHumanVsAIGame(request);
      expect(result.success).toBe(true);
      expect(['X', 'O']).toContain(result.playerSymbol);
    });

    it('should handle cleanup correctly', () => {
      const request: QuickStartRequest = { playerSymbol: 'X' };
      GameService.createHumanVsAIGame(request);

      const statsBefore = GameService.getStats();
      expect(statsBefore.activeGames).toBe(1);

      GameService.cleanup();

      const statsAfter = GameService.getStats();
      expect(statsAfter.activeGames).toBe(0);
    });
  });

  describe('WebSocket Integration', () => {
    it('should provide correct WebSocket endpoint', () => {
      const request: QuickStartRequest = { playerSymbol: 'X' };
      const result = GameService.createHumanVsAIGame(request);

      expect(result.wsEndpoint).toBeDefined();
      expect(result.wsEndpoint).toContain('ws://');
      expect(result.wsEndpoint).toContain(result.roomId);
    });
  });
});