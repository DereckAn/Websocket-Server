// =================================================================
// TEST SETUP - Configuration and helpers for tests
// =================================================================

import { beforeAll, afterAll } from 'bun:test';

// Test environment setup
beforeAll(() => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.WEBHOOK_PORT = '3001';
  process.env.LOG_LEVEL = 'error';

  console.log('🧪 Test environment initialized');
});

afterAll(() => {
  console.log('🧪 Test suite completed');
});

// Test utilities
export const TestUtils = {
  // Create a test game board
  createEmptyBoard: (): (string | null)[][] => {
    return Array(15).fill(null).map(() => Array(15).fill(null));
  },

  // Create a test board with some moves
  createTestBoard: (moves: Array<{row: number, col: number, symbol: string}>): (string | null)[][] => {
    const board = TestUtils.createEmptyBoard();
    moves.forEach(move => {
      board[move.row][move.col] = move.symbol;
    });
    return board;
  },

  // Wait for async operations
  sleep: (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  // Generate test IDs
  generateTestId: (): string => {
    return `test_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  },

  // Mock HTTP request
  createMockRequest: (method: string, url: string, body?: any): Request => {
    const init: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (body) {
      init.body = JSON.stringify(body);
    }

    return new Request(url, init);
  }
};

// Export for use in tests
export default TestUtils;