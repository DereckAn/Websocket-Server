// =================================================================
// SQUARE CLIENT SINGLETON - Single instance for all Square API calls
// =================================================================

import { SquareClient } from 'square';

// Note: Using console.log instead of logger to avoid circular dependency
// logger imports env.ts which can cause issues during module initialization

if (!process.env.SQUARE_ACCESS_TOKEN) {
  console.error('❌ SQUARE_ACCESS_TOKEN is not defined');
  console.error('❌ Square client will not be initialized. Webhook processing will fail.');
  // Don't throw - let the server start and handle errors gracefully
}

// Create singleton instance (will be undefined if token is missing)
const squareClient = process.env.SQUARE_ACCESS_TOKEN
  ? new SquareClient({
      token: process.env.SQUARE_ACCESS_TOKEN,
      // Environment is auto-detected from token
    })
  : undefined as any; // Type assertion to allow undefined

if (squareClient) {
  console.log('✅ Square client singleton initialized');
} else {
  console.warn('⚠️  Square client NOT initialized - missing SQUARE_ACCESS_TOKEN');
}

export default squareClient;
