// =================================================================
// STRUCTURED LOGGING UTILITY
// =================================================================

import { env, isProduction } from '../config/env';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private minLevel: number;

  constructor() {
    this.minLevel = LOG_LEVELS[env.LOG_LEVEL] || LOG_LEVELS.info;
  }

  /**
   * Check if a log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= this.minLevel;
  }

  /**
   * Format log message
   */
  private formatMessage(level: LogLevel, message: string, data?: any): string {
    const timestamp = new Date().toISOString();

    if (isProduction()) {
      // JSON format for production (easy to parse)
      const logObject = {
        timestamp,
        level,
        message,
        ...(data && { data }),
      };
      return JSON.stringify(logObject);
    } else {
      // Human-readable format for development
      const emoji = {
        debug: '🔍',
        info: 'ℹ️',
        warn: '⚠️',
        error: '❌',
      }[level];

      let output = `${emoji} [${level.toUpperCase()}] ${message}`;
      if (data) {
        output += `\n${JSON.stringify(data, null, 2)}`;
      }
      return output;
    }
  }

  /**
   * Log debug message (development only)
   */
  debug(message: string, data?: any) {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message, data));
    }
  }

  /**
   * Log info message
   */
  info(message: string, data?: any) {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message, data));
    }
  }

  /**
   * Log warning message
   */
  warn(message: string, data?: any) {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, data));
    }
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error | any, additionalData?: any) {
    if (this.shouldLog('error')) {
      let data: any;

      if (error instanceof Error) {
        data = {
          name: error.name,
          message: error.message,
          stack: isProduction() ? undefined : error.stack,
          ...(additionalData && additionalData),
        };
      } else if (error) {
        data = {
          ...error,
          ...(additionalData && additionalData),
        };
      } else {
        data = additionalData;
      }

      console.error(this.formatMessage('error', message, data));
    }
  }

  /**
   * Log HTTP request
   */
  http(method: string, path: string, status: number, duration?: number) {
    const message = `${method} ${path} - ${status}`;
    const data = duration ? { duration: `${duration}ms` } : undefined;

    if (status >= 500) {
      this.error(message, data);
    } else if (status >= 400) {
      this.warn(message, data);
    } else {
      this.debug(message, data);
    }
  }

  /**
   * Log game event
   */
  game(event: string, roomId?: string, data?: any) {
    this.info(`[Game] ${event}`, {
      roomId,
      ...data,
    });
  }

  /**
   * Log WebSocket event
   */
  ws(event: string, connectionId?: string, data?: any) {
    this.debug(`[WebSocket] ${event}`, {
      connectionId,
      ...data,
    });
  }

  /**
   * Log AI event
   */
  ai(event: string, data?: any) {
    this.debug(`[AI] ${event}`, data);
  }
}

// Export singleton instance
export const logger = new Logger();
