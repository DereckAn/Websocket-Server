// =================================================================
// SHARED UTILITIES - Common functions used across the application
// =================================================================

import { logger } from './logger';

/**
 * Generates a unique ID using random strings
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * Structured logging with levels
 * @deprecated Use the main logger from './logger' instead
 * This function is kept for backward compatibility but should not be used in new code
 */
export function log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any): void {
  // Delegate to main logger
  switch (level) {
    case 'debug':
      logger.debug(message, data);
      break;
    case 'info':
      logger.info(message, data);
      break;
    case 'warn':
      logger.warn(message, data);
      break;
    case 'error':
      logger.error(message, new Error(message), data);
      break;
  }
}

/**
 * Handles BigInt serialization for JSON
 */
export function handleBigIntSerialization(key: string, value: any): any {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  return value;
}

/**
 * Validates environment variables for Square integration
 */
export function validateSquareEnvironment(): {
  isValid: boolean;
  missing: string[];
  warnings: string[];
} {
  const required = [
    'SQUARE_ACCESS_TOKEN',
    'SQUARE_WEBHOOK_SIGNATURE_KEY'
  ];

  const optional = [
    'SQUARE_APPLICATION_ID',
    'WEBHOOK_URL'
  ];

  const missing = required.filter(env => !process.env[env]);
  const warnings = optional.filter(env => !process.env[env]);

  if (missing.length > 0) {
    logger.error('Missing required Square environment variables', { missing });
  }

  if (warnings.length > 0) {
    logger.warn('Missing optional Square environment variables', { warnings });
  }

  return {
    isValid: missing.length === 0,
    missing,
    warnings
  };
}

/**
 * Formats time duration in human-readable format
 */
export function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Formats memory usage in human-readable format
 */
export function formatMemory(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  const gb = mb / 1024;

  if (gb >= 1) {
    return `${gb.toFixed(2)} GB`;
  } else {
    return `${mb.toFixed(1)} MB`;
  }
}

/**
 * Safely parses JSON with error handling
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json);
  } catch (error) {
    logger.warn('Failed to parse JSON, using fallback', { error: String(error) });
    return fallback;
  }
}

/**
 * Creates a delayed promise (for testing/throttling)
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Validates if a string is a valid UUID v4
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Truncates text to specified length with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Gets client IP from request headers (proxy-aware)
 */
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');

  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown';
  }

  if (realIp) {
    return realIp;
  }

  return 'unknown';
}

/**
 * Creates a request ID for tracing
 */
export function createRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `req_${timestamp}_${random}`;
}

/**
 * Escapes string for safe logging (removes sensitive data patterns)
 */
export function sanitizeForLogging(text: string): string {
  return text
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/, 'Bearer ***')
    .replace(/[A-Za-z0-9]{32,}/, '***')
    .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, '****-****-****-****');
}