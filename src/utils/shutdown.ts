// =================================================================
// GRACEFUL SHUTDOWN HANDLER
// =================================================================

import { logger } from './logger';

type CleanupFunction = () => Promise<void> | void;

class ShutdownHandler {
  private cleanupFunctions: CleanupFunction[] = [];
  private isShuttingDown = false;

  /**
   * Register a cleanup function to run on shutdown
   */
  register(cleanup: CleanupFunction) {
    this.cleanupFunctions.push(cleanup);
  }

  /**
   * Perform graceful shutdown
   */
  async shutdown(signal: string) {
    if (this.isShuttingDown) {
      logger.warn('Shutdown already in progress, forcing exit...');
      process.exit(1);
    }

    this.isShuttingDown = true;
    logger.info(`Received ${signal}, starting graceful shutdown...`);

    try {
      // Run all cleanup functions
      logger.info(`Running ${this.cleanupFunctions.length} cleanup tasks...`);

      await Promise.all(
        this.cleanupFunctions.map(async (cleanup, index) => {
          try {
            await cleanup();
            logger.debug(`Cleanup task ${index + 1} completed`);
          } catch (error) {
            logger.error(`Cleanup task ${index + 1} failed`, error);
          }
        })
      );

      logger.info('Graceful shutdown completed successfully');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', error);
      process.exit(1);
    }
  }

  /**
   * Setup shutdown handlers for various signals
   */
  setup() {
    // Handle termination signals
    process.on('SIGTERM', () => this.shutdown('SIGTERM'));
    process.on('SIGINT', () => this.shutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught Exception', error);

      // In production, try to shutdown gracefully
      if (process.env.NODE_ENV === 'production') {
        this.shutdown('uncaughtException');
      } else {
        // In development, exit immediately for debugging
        process.exit(1);
      }
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      logger.error('Unhandled Promise Rejection', {
        reason: reason instanceof Error ? reason.message : reason,
        stack: reason instanceof Error ? reason.stack : undefined,
      });

      // In production, try to continue running
      // In development, it's better to crash and see the error
      if (process.env.NODE_ENV === 'development') {
        this.shutdown('unhandledRejection');
      }
    });

    logger.info('Shutdown handlers registered');
  }
}

// Export singleton instance
export const shutdownHandler = new ShutdownHandler();
