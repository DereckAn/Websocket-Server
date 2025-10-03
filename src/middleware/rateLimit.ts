// =================================================================
// RATE LIMITING MIDDLEWARE - Prevents abuse and ensures fair usage
// =================================================================

import { logger } from "../utils/logger";

/**
 * Rate Limiting for Gomoku server
 *
 * Why rate limiting?
 * - Prevent abuse of AI calculation resources
 * - Ensure fair usage among restaurant customers
 * - Protect against DoS attacks
 * - Maintain server performance for all users
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
  firstRequest: number;
}

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  message: string; // Error message
}

// Different rate limits for different endpoints
const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // General API requests
  general: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    message: "Too many requests. Please try again later.",
  },

  // Game creation (more restrictive)
  gameCreation: {
    windowMs: 10 * 60 * 1000, // 10 minutes
    maxRequests: 5,
    message:
      "Too many games created. Please wait before creating another game.",
  },

  // Game moves (moderate)
  gameMoves: {
    windowMs: 1 * 60 * 1000, // 1 minute
    maxRequests: 60, // 1 move per second average
    message: "Too many moves. Please slow down.",
  },

  // Admin endpoints (very restrictive)
  admin: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 10,
    message: "Too many admin requests. Please wait.",
  },
};

// In-memory store for rate limiting
// In production, this should be Redis for horizontal scaling
class RateLimitStore {
  private store: Map<string, RateLimitEntry> = new Map();

  // Clean up expired entries periodically
  private cleanupInterval: Timer;

  constructor() {
    // Cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  get(key: string): RateLimitEntry | undefined {
    return this.store.get(key);
  }

  set(key: string, entry: RateLimitEntry): void {
    this.store.set(key, entry);
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  private cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info(
        `🧹 Rate limit cleanup: removed ${cleanedCount} expired entries`
      );
    }
  }

  // Get store size for monitoring
  getSize(): number {
    return this.store.size;
  }
}

// Global store instance
const rateLimitStore = new RateLimitStore();

/**
 * Gets client identifier for rate limiting
 */
const getClientId = (request: Request): string => {
  // Try to get real IP from headers (for proxies)
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");

  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }

  if (realIp) {
    return realIp;
  }

  // Fallback to connection info (might not be available in all environments)
  return "unknown";
};

/**
 * Determines rate limit type based on request path
 */
const getRateLimitType = (path: string): string => {
  if (path.includes("/admin/")) {
    return "admin";
  }

  if (path.includes("/quick-start")) {
    return "gameCreation";
  }

  if (path.includes("/move")) {
    return "gameMoves";
  }

  return "general";
};

/**
 * Rate limiting middleware
 */
export const rateLimitMiddleware = (request: Request): Response | null => {
  const url = new URL(request.url);
  const path = url.pathname;
  const clientId = getClientId(request);
  const limitType = getRateLimitType(path);
  const config = RATE_LIMITS[limitType];

  if (!config) {
    logger.warn("No rate limit config for type", { limitType });
    return null; // Allow request if no config
  }

  const key = `${limitType}:${clientId}`;
  const now = Date.now();

  // Get current entry
  const entry = rateLimitStore.get(key);

  if (!entry) {
    // First request from this client
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
      firstRequest: now,
    });

    logger.info(
      `🚦 Rate limit: First request from ${clientId} for ${limitType}`
    );
    return null; // Allow request
  }

  // Check if window has expired
  if (now > entry.resetTime) {
    // Reset the counter
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
      firstRequest: now,
    });

    logger.info(`🚦 Rate limit: Window reset for ${clientId} for ${limitType}`);
    return null; // Allow request
  }

  // Increment counter
  entry.count++;
  rateLimitStore.set(key, entry);

  // Check if limit exceeded
  if (entry.count > config.maxRequests) {
    const timeRemaining = Math.ceil((entry.resetTime - now) / 1000);

    logger.warn("Rate limit exceeded", {
      clientId,
      limitType,
      count: entry.count,
      maxRequests: config.maxRequests,
    });

    return new Response(
      JSON.stringify({
        success: false,
        error: config.message,
        retryAfter: timeRemaining,
        limit: config.maxRequests,
        remaining: 0,
        resetTime: new Date(entry.resetTime).toISOString(),
      }),
      {
        status: 429, // Too Many Requests
        headers: {
          "Content-Type": "application/json",
          "Retry-After": timeRemaining.toString(),
          "X-RateLimit-Limit": config.maxRequests.toString(),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": entry.resetTime.toString(),
        },
      }
    );
  }

  // Request allowed - add rate limit headers
  const remaining = config.maxRequests - entry.count;
  logger.info(
    `🚦 Rate limit: ${clientId} for ${limitType} (${entry.count}/${config.maxRequests})`
  );

  // We'll add headers in the response later
  // Store info for response headers
  (request as any).rateLimit = {
    limit: config.maxRequests,
    remaining,
    resetTime: entry.resetTime,
    used: entry.count,
  };

  return null; // Allow request
};

/**
 * Adds rate limit headers to response
 */
export const addRateLimitHeaders = (
  response: Response,
  request: Request
): Response => {
  const rateLimitInfo = (request as any).rateLimit;

  if (!rateLimitInfo) {
    return response; // No rate limit info available
  }

  // Add headers to existing response
  const headers = new Headers(response.headers);
  headers.set("X-RateLimit-Limit", rateLimitInfo.limit.toString());
  headers.set("X-RateLimit-Remaining", rateLimitInfo.remaining.toString());
  headers.set("X-RateLimit-Reset", rateLimitInfo.resetTime.toString());
  headers.set("X-RateLimit-Used", rateLimitInfo.used.toString());

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

/**
 * WebSocket rate limiting (simpler approach)
 */
export const checkWebSocketRateLimit = (request: Request): boolean => {
  const clientId = getClientId(request);
  const key = `websocket:${clientId}`;
  const now = Date.now();

  // Allow 3 WebSocket connections per minute per IP
  const config = {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 3,
  };

  const entry = rateLimitStore.get(key);

  if (!entry) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
      firstRequest: now,
    });
    return true;
  }

  if (now > entry.resetTime) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
      firstRequest: now,
    });
    return true;
  }

  if (entry.count >= config.maxRequests) {
    logger.warn(`🚨 WebSocket rate limit exceeded for ${clientId}`);
    return false;
  }

  entry.count++;
  rateLimitStore.set(key, entry);
  return true;
};

/**
 * Gets rate limiting statistics (for admin)
 */
export const getRateLimitStats = (): {
  totalEntries: number;
  byType: Record<string, number>;
  topClients: Array<{ client: string; requests: number }>;
} => {
  const stats = {
    totalEntries: rateLimitStore.getSize(),
    byType: {} as Record<string, number>,
    topClients: [] as Array<{ client: string; requests: number }>,
  };

  // This would require accessing the internal store
  // For now, return basic stats
  return stats;
};

// Export for testing and monitoring
export const rateLimitConfig = {
  RATE_LIMITS,
  getClientId,
  getRateLimitType,
};
