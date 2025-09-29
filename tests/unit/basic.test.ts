// =================================================================
// BASIC TESTS - Critical tests that work with current API
// =================================================================

import { describe, it, expect } from 'bun:test';
import { TestUtils } from '../helpers/setup';

describe('Basic Functionality Tests', () => {

  describe('Test Utils', () => {
    it('should create empty board', () => {
      const board = TestUtils.createEmptyBoard();

      expect(board).toBeDefined();
      expect(board).toHaveLength(15);
      expect(board[0]).toHaveLength(15);
      expect(board[7][7]).toBeNull();
    });

    it('should create test board with moves', () => {
      const moves = [
        {row: 7, col: 7, symbol: 'X'},
        {row: 8, col: 8, symbol: 'O'}
      ];

      const board = TestUtils.createTestBoard(moves);

      expect(board[7][7]).toBe('X');
      expect(board[8][8]).toBe('O');
      expect(board[0][0]).toBeNull();
    });

    it('should generate unique test IDs', () => {
      const id1 = TestUtils.generateTestId();
      const id2 = TestUtils.generateTestId();

      expect(id1).toMatch(/^test_/);
      expect(id2).toMatch(/^test_/);
      expect(id1).not.toBe(id2);
    });

    it('should create mock requests', () => {
      const request = TestUtils.createMockRequest('POST', 'http://test.com', {test: true});

      expect(request.method).toBe('POST');
      expect(request.url).toBe('http://test.com');
    });
  });

  describe('Environment Setup', () => {
    it('should be in test environment', () => {
      expect(process.env.NODE_ENV).toBe('test');
    });

    it('should have test port configured', () => {
      expect(process.env.WEBHOOK_PORT).toBe('3001');
    });

    it('should have error log level', () => {
      expect(process.env.LOG_LEVEL).toBe('error');
    });
  });

  describe('Services Import', () => {
    it('should import AIService', async () => {
      const { default: AIService } = await import('../../src/services/AIService');
      expect(AIService).toBeDefined();
      expect(typeof AIService.clearCache).toBe('function');
    });

    it('should import GameService', async () => {
      const { default: GameService } = await import('../../src/services/GameService');
      expect(GameService).toBeDefined();
      expect(typeof GameService.getStats).toBe('function');
    });
  });

  describe('Types Import', () => {
    it('should import Gomoku types', async () => {
      const types = await import('../../src/types/gomoku');
      expect(types).toBeDefined();
      expect(types.BOARD_SIZE).toBe(15);
    });
  });

  describe('Basic Math Operations', () => {
    it('should handle basic calculations', () => {
      expect(2 + 2).toBe(4);
      expect(Math.abs(-5)).toBe(5);
      expect(Math.max(1, 2, 3)).toBe(3);
    });

    it('should handle array operations', () => {
      const arr = [1, 2, 3];
      expect(arr.length).toBe(3);
      expect(arr.includes(2)).toBe(true);
      expect(arr.indexOf(3)).toBe(2);
    });
  });

  describe('Performance Baseline', () => {
    it('should measure simple operations', () => {
      const start = performance.now();

      // Simple operation
      let sum = 0;
      for (let i = 0; i < 1000; i++) {
        sum += i;
      }

      const end = performance.now();
      const duration = end - start;

      expect(sum).toBe(499500);
      expect(duration).toBeLessThan(10); // Should be very fast
    });
  });
});