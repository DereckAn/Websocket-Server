// =================================================================
// API ENDPOINTS TESTS - Critical integration tests
// =================================================================

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { TestUtils } from '../helpers/setup';

// Test server configuration (using the running server)
const TEST_BASE_URL = 'http://localhost:3000';

describe('API Endpoints - Critical Integration Tests', () => {

  describe('Health and Status Endpoints', () => {
    it('should respond to health check', async () => {
      const response = await fetch(`${TEST_BASE_URL}/health`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.status).toBe('healthy');
    });

    it('should respond to API status', async () => {
      const response = await fetch(`${TEST_BASE_URL}/api/status`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.api).toBeDefined();
      expect(data.data.server).toBeDefined();
    });
  });

  describe('Gomoku Quick Start Endpoint', () => {
    it('should create game with specified symbol', async () => {
      const requestBody = { playerSymbol: 'X' };

      const response = await fetch(`${TEST_BASE_URL}/api/gomoku/quick-start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.gameId).toBeDefined();
      expect(data.data.playerSymbol).toBe('X');
      expect(data.data.aiSymbol).toBe('O');
      expect(data.data.wsEndpoint).toContain('ws://');
    });

    it('should create game without specified symbol', async () => {
      const response = await fetch(`${TEST_BASE_URL}/api/gomoku/quick-start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({})
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(['X', 'O']).toContain(data.data.playerSymbol);
      expect(['X', 'O']).toContain(data.data.aiSymbol);
      expect(data.data.playerSymbol !== data.data.aiSymbol).toBe(true);
    });

    it('should reject invalid symbol', async () => {
      const requestBody = { playerSymbol: 'Z' };

      const response = await fetch(`${TEST_BASE_URL}/api/gomoku/quick-start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid player symbol');
    });

    it('should reject invalid JSON', async () => {
      const response = await fetch(`${TEST_BASE_URL}/api/gomoku/quick-start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: 'invalid json'
      });

      expect(response.status).toBe(400);
    });

    it('should require POST method', async () => {
      const response = await fetch(`${TEST_BASE_URL}/api/gomoku/quick-start`, {
        method: 'GET'
      });

      expect(response.status).toBe(405);
    });
  });

  describe('Game State Endpoint', () => {
    let gameId: string;

    beforeAll(async () => {
      // Create a test game first
      const createResponse = await fetch(`${TEST_BASE_URL}/api/gomoku/quick-start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ playerSymbol: 'X' })
      });

      const createData = await createResponse.json();
      gameId = createData.data.gameId;
    });

    it('should get game state for existing game', async () => {
      const response = await fetch(`${TEST_BASE_URL}/api/gomoku/game/${gameId}/state`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(gameId);
      expect(data.data.board).toBeDefined();
      expect(data.data.board).toHaveLength(15);
      expect(data.data.status).toBe('playing');
      expect(data.data.players).toHaveLength(2);
    });

    it('should return 404 for non-existent game', async () => {
      const response = await fetch(`${TEST_BASE_URL}/api/gomoku/game/non-existent-id/state`);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it('should require GET method', async () => {
      const response = await fetch(`${TEST_BASE_URL}/api/gomoku/game/${gameId}/state`, {
        method: 'POST'
      });

      expect(response.status).toBe(405);
    });
  });

  describe('CORS Headers', () => {
    it('should include CORS headers in response', async () => {
      const response = await fetch(`${TEST_BASE_URL}/health`);

      expect(response.headers.get('Access-Control-Allow-Origin')).toBeDefined();
      expect(response.headers.get('Access-Control-Allow-Methods')).toBeDefined();
    });

    it('should handle OPTIONS preflight request', async () => {
      const response = await fetch(`${TEST_BASE_URL}/api/gomoku/quick-start`, {
        method: 'OPTIONS'
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeDefined();
      expect(response.headers.get('Access-Control-Allow-Methods')).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown endpoints', async () => {
      const response = await fetch(`${TEST_BASE_URL}/api/unknown-endpoint`);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it('should handle malformed requests gracefully', async () => {
      const response = await fetch(`${TEST_BASE_URL}/api/gomoku/quick-start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: '{'  // Malformed JSON
      });

      expect(response.status).toBe(400);
    });
  });

  describe('Rate Limiting', () => {
    it('should accept reasonable number of requests', async () => {
      // Make 5 quick requests
      const promises = Array(5).fill(null).map(() =>
        fetch(`${TEST_BASE_URL}/health`)
      );

      const responses = await Promise.all(promises);

      // All should succeed (no rate limiting for health checks)
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });
});