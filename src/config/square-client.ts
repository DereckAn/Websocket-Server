// =================================================================
// SQUARE CLIENT SINGLETON - Single instance for all Square API calls
// =================================================================

import { SquareClient } from 'square';
import { logger } from '../utils/logger';

if (!process.env.SQUARE_ACCESS_TOKEN) {
  logger.error('❌ SQUARE_ACCESS_TOKEN is not defined');
  throw new Error('SQUARE_ACCESS_TOKEN is required');
}

// Create singleton instance
const squareClient = new SquareClient({
  token: process.env.SQUARE_ACCESS_TOKEN,
  // Environment is auto-detected from token
});

logger.info('✅ Square client singleton initialized');

export default squareClient;
