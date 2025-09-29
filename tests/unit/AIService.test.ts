// =================================================================
// AI SERVICE TESTS - Critical tests for AI functionality
// =================================================================

import { describe, it, expect, beforeEach } from 'bun:test';
import AIService from '../../src/services/AIService';
import { TestUtils } from '../helpers/setup';

describe('AIService - Critical Tests', () => {
  beforeEach(() => {
    // Clear AI cache before each test
    AIService.clearCache();
  });

  describe('Basic AI Functionality', () => {
    it('should make valid moves on empty board', async () => {
      const board = TestUtils.createEmptyBoard();
      const gameState = {
        board,
        currentPlayer: 'O' as const,
        aiSymbol: 'O' as const
      };
      const result = await AIService.calculateBestMove(gameState);
      const move = result.position;

      expect(move).toBeDefined();
      expect(move.row).toBeGreaterThanOrEqual(0);
      expect(move.row).toBeLessThan(15);
      expect(move.col).toBeGreaterThanOrEqual(0);
      expect(move.col).toBeLessThan(15);
      expect(board[move.row][move.col]).toBeNull(); // Position should be empty
    });

    it('should prefer center positions on empty board', () => {
      const board = TestUtils.createEmptyBoard();
      const move = AIService.getBestMove(board, 'O');

      // AI should prefer positions near center (7,7)
      const distanceFromCenter = Math.abs(move.row - 7) + Math.abs(move.col - 7);
      expect(distanceFromCenter).toBeLessThanOrEqual(3);
    });

    it('should block immediate win threats', () => {
      // Create a board where X has 4 in a row (horizontal)
      const board = TestUtils.createTestBoard([
        {row: 7, col: 5, symbol: 'X'},
        {row: 7, col: 6, symbol: 'X'},
        {row: 7, col: 7, symbol: 'X'},
        {row: 7, col: 8, symbol: 'X'}
      ]);

      const move = AIService.getBestMove(board, 'O');

      // AI should block at either end
      expect(
        (move.row === 7 && move.col === 4) ||
        (move.row === 7 && move.col === 9)
      ).toBe(true);
    });

    it('should take winning move when available', () => {
      // Create a board where O has 4 in a row and can win
      const board = TestUtils.createTestBoard([
        {row: 7, col: 5, symbol: 'O'},
        {row: 7, col: 6, symbol: 'O'},
        {row: 7, col: 7, symbol: 'O'},
        {row: 7, col: 8, symbol: 'O'}
      ]);

      const move = AIService.getBestMove(board, 'O');

      // AI should win at either end
      expect(
        (move.row === 7 && move.col === 4) ||
        (move.row === 7 && move.col === 9)
      ).toBe(true);
    });
  });

  describe('Performance Tests', () => {
    it('should return move within reasonable time', () => {
      const board = TestUtils.createEmptyBoard();
      const startTime = performance.now();

      const move = AIService.getBestMove(board, 'O');

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(move).toBeDefined();
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle board with many moves efficiently', () => {
      // Create a board with 10 random moves
      const moves = [];
      for (let i = 0; i < 10; i++) {
        moves.push({
          row: Math.floor(Math.random() * 15),
          col: Math.floor(Math.random() * 15),
          symbol: i % 2 === 0 ? 'X' : 'O'
        });
      }

      const board = TestUtils.createTestBoard(moves);
      const startTime = performance.now();

      const move = AIService.getBestMove(board, 'O');

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(move).toBeDefined();
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
    });
  });

  describe('Edge Cases', () => {
    it('should handle full board gracefully', () => {
      // Create a nearly full board
      const board = TestUtils.createEmptyBoard();
      let symbol = 'X';

      // Fill most positions
      for (let row = 0; row < 15; row++) {
        for (let col = 0; col < 14; col++) { // Leave last column empty
          board[row][col] = symbol;
          symbol = symbol === 'X' ? 'O' : 'X';
        }
      }

      const move = AIService.getBestMove(board, 'O');

      expect(move).toBeDefined();
      expect(move.col).toBe(14); // Should choose from available positions
      expect(board[move.row][move.col]).toBeNull();
    });

    it('should not make invalid moves', () => {
      const board = TestUtils.createTestBoard([
        {row: 7, col: 7, symbol: 'X'}
      ]);

      const move = AIService.getBestMove(board, 'O');

      // Should not try to play on occupied position
      expect(move.row !== 7 || move.col !== 7).toBe(true);
      expect(board[move.row][move.col]).toBeNull();
    });
  });
});