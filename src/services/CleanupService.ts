// =================================================================
// CLEANUP SERVICE - Auto-cleanup inactive rooms and connections
// =================================================================

import { logger } from '../utils/logger';
import { env } from '../config/env';
import GameService from './GameService';
import WebSocketService from './WebSocketService';
import RoomModel from '../models/RoomModel';

export class CleanupService {
  private intervalId: Timer | null = null;
  private isRunning = false;

  /**
   * Start the cleanup service
   */
  start() {
    if (this.isRunning) {
      logger.warn('Cleanup service already running');
      return;
    }

    this.isRunning = true;
    logger.info(`Starting cleanup service (interval: ${env.ROOM_CLEANUP_INTERVAL}ms)`);

    // Run immediately
    this.cleanup();

    // Then run periodically
    this.intervalId = setInterval(() => {
      this.cleanup();
    }, env.ROOM_CLEANUP_INTERVAL);
  }

  /**
   * Stop the cleanup service
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    logger.info('Cleanup service stopped');
  }

  /**
   * Perform cleanup of inactive rooms
   */
  private async cleanup() {
    try {
      const startTime = Date.now();
      logger.debug('Starting cleanup cycle...');

      const allRooms = GameService.getAllRooms();
      let cleanedCount = 0;

      for (const room of allRooms) {
        // Check if room should be cleaned up
        if (RoomModel.shouldCleanup(room)) {
          logger.info(`Cleaning up inactive room: ${room.id}`, {
            roomId: room.id,
            gameType: room.gameType,
            lastActivity: room.lastActivity,
          });

          // Prepare room for cleanup
          const cleanedRoom = RoomModel.prepareForCleanup(room);

          // Notify all connected clients
          WebSocketService.broadcastToRoom(room.id, {
            type: 'room_closed',
            data: {
              message: 'Room closed due to inactivity',
              roomId: room.id,
            },
            timestamp: new Date(),
          });

          // Delete the room
          GameService.forceCloseGame(room.id);
          cleanedCount++;
        }
      }

      const duration = Date.now() - startTime;

      if (cleanedCount > 0) {
        logger.info(`Cleanup cycle completed: removed ${cleanedCount} rooms in ${duration}ms`);
      } else {
        logger.debug(`Cleanup cycle completed: no rooms to clean (${duration}ms)`);
      }

      // Log current state
      const stats = GameService.getServerStats();
      logger.debug('Server stats after cleanup', stats);

    } catch (error) {
      logger.error('Error during cleanup cycle', error);
    }
  }

  /**
   * Manually trigger cleanup (for testing)
   */
  async triggerCleanup() {
    logger.info('Manual cleanup triggered');
    await this.cleanup();
  }

  /**
   * Get cleanup service status
   */
  getStatus() {
    return {
      running: this.isRunning,
      interval: env.ROOM_CLEANUP_INTERVAL,
      inactiveTimeout: env.INACTIVE_ROOM_TIMEOUT,
    };
  }
}

// Export singleton instance
export default new CleanupService();
