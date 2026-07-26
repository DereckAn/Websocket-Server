// =================================================================
// STRUCTURED LOGGING UTILITY
// =================================================================
// Two independent filters:
//   LOG_LEVEL  — minimum severity: debug < info < warn < error
//   LOG_SCOPE  — comma-separated allowlist of categories (subsystems),
//                e.g. "orders" or "game,ai". Unset or "*" = all categories.
//
// Every log line carries a `category` (subsystem). Create a scoped logger
// per module with `createLogger('orders')`; all its calls are stamped with
// that category so `LOG_SCOPE=orders` shows only that subsystem. Adding a
// new feature is just `createLogger('my-feature')` — no changes here.

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const isProduction = () => process.env.NODE_ENV === 'production';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LEVEL_EMOJI: Record<LogLevel, string> = {
  debug: '🔍',
  info: 'ℹ️',
  warn: '⚠️',
  error: '❌',
};

// Parse LOG_SCOPE into an allowlist. null => no category filter (show all).
function parseScope(raw: string | undefined): Set<string> | null {
  const value = raw?.trim();
  if (!value || value === '*') return null;
  return new Set(
    value
      .split(',')
      .map((category) => category.trim().toLowerCase())
      .filter(Boolean),
  );
}

class Logger {
  private readonly category: string;
  private readonly minLevel: number;
  private readonly scope: Set<string> | null;

  constructor(category: string = 'system') {
    this.category = category;
    this.minLevel =
      LOG_LEVELS[process.env.LOG_LEVEL as LogLevel] ?? LOG_LEVELS.info;
    this.scope = parseScope(process.env.LOG_SCOPE);
  }

  /** A logger bound to a subsystem category (e.g. 'orders', 'game', 'ai'). */
  child(category: string): Logger {
    return new Logger(category);
  }

  private shouldLog(level: LogLevel, category: string): boolean {
    if (LOG_LEVELS[level] < this.minLevel) return false;
    if (this.scope && !this.scope.has(category)) return false;
    return true;
  }

  private format(
    level: LogLevel,
    category: string,
    message: string,
    data?: unknown,
  ): string {
    const timestamp = new Date().toISOString();

    if (isProduction()) {
      // JSON for production — one line per event, easy to parse and query.
      return JSON.stringify({
        timestamp,
        level,
        category,
        message,
        ...(data !== undefined ? { data } : {}),
      });
    }

    let output = `${LEVEL_EMOJI[level]} [${level.toUpperCase()}] [${category}] ${message}`;
    if (data !== undefined) {
      output += `\n${JSON.stringify(data, null, 2)}`;
    }
    return output;
  }

  private emit(
    level: LogLevel,
    category: string,
    message: string,
    data?: unknown,
  ) {
    if (!this.shouldLog(level, category)) return;
    const line = this.format(level, category, message, data);
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
  }

  debug(message: string, data?: unknown) {
    this.emit('debug', this.category, message, data);
  }

  info(message: string, data?: unknown) {
    this.emit('info', this.category, message, data);
  }

  warn(message: string, data?: unknown) {
    this.emit('warn', this.category, message, data);
  }

  error(message: string, error?: Error | any, additionalData?: any) {
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

    this.emit('error', this.category, message, data);
  }

  /**
   * Log an HTTP request. Always categorized as 'http' regardless of the
   * instance's category, so HTTP access logs filter independently.
   */
  http(method: string, path: string, status: number, duration?: number) {
    const message = `${method} ${path} - ${status}`;
    const data = duration ? { duration: `${duration}ms` } : undefined;
    const level: LogLevel =
      status >= 500 ? 'error' : status >= 400 ? 'warn' : 'debug';
    this.emit(level, 'http', message, data);
  }

  /** Game event — always categorized as 'game'. */
  game(event: string, roomId?: string, data?: any) {
    this.emit('info', 'game', event, { roomId, ...data });
  }

  /** WebSocket event — always categorized as 'websocket'. */
  ws(event: string, connectionId?: string, data?: any) {
    this.emit('debug', 'websocket', event, { connectionId, ...data });
  }

  /** AI event — always categorized as 'ai'. */
  ai(event: string, data?: any) {
    this.emit('debug', 'ai', event, data);
  }
}

// Default singleton (category 'system') for infrastructure/shared code.
export const logger = new Logger();

/** Create a logger scoped to a subsystem category (e.g. 'orders', 'game'). */
export function createLogger(category: string): Logger {
  return new Logger(category);
}
