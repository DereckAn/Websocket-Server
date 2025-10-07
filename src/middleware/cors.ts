// =================================================================
// CORS MIDDLEWARE - Cross-Origin Resource Sharing configuration
// =================================================================

import { env, isProduction } from '../config/env';
import { logger } from '../utils/logger';

/**
 * CORS Middleware for Gomoku server
 *
 * Why CORS is needed?
 * - Frontend (pag_mich) on Vercel will call backend on Railway
 * - Different domains = CORS required
 * - WebSocket connections also need CORS
 * - Production vs development different origins
 */

// Allowed origins configuration
const getAllowedOrigins = (): string[] => {
  const origins: string[] = [];

  // Development origins
  if (!isProduction()) {
    origins.push(
      'http://localhost:3000',
      'http://localhost:3001',  // pag_mich dev server
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001'
    );
  }

  // Add configured origins from environment
  origins.push(...env.ALLOWED_ORIGINS);

  // Warn if no origins configured in production
  if (isProduction() && origins.length === 0) {
    logger.warn('No ALLOWED_ORIGINS configured in production! This is insecure.');
  }

  // Remove duplicates and return
  return [...new Set(origins)];
};

/**
 * Checks if origin is allowed
 */
export const isOriginAllowed = (origin: string | null): boolean => {
  if (!origin) return true; // Allow requests without origin (like Postman)

  const allowedOrigins = getAllowedOrigins();

  // Exact match
  if (allowedOrigins.includes(origin)) {
    logger.debug(`✅ Origin allowed (exact match): ${origin}`);
    return true;
  }

  // Pattern matching for wildcard domains
  for (const allowedOrigin of allowedOrigins) {
    if (allowedOrigin.includes('*')) {
      const pattern = allowedOrigin.replace('*', '.*');
      const regex = new RegExp(`^${pattern}$`);
      if (regex.test(origin)) {
        logger.debug(`✅ Origin allowed (pattern match): ${origin} matches ${allowedOrigin}`);
        return true;
      }
    }
  }

  logger.warn(`❌ Origin NOT allowed: ${origin}`, {
    requestedOrigin: origin,
    allowedOrigins: allowedOrigins
  });
  return false;
};

/**
 * Creates CORS headers for responses
 */
export const createCorsHeaders = (origin?: string | null): Record<string, string> => {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400', // 24 hours
  };

  // Set origin if allowed
  if (origin && isOriginAllowed(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  } else if (!origin) {
    headers['Access-Control-Allow-Origin'] = '*';
  }

  // Allow credentials for same-origin requests
  if (origin && isOriginAllowed(origin)) {
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return headers;
};

/**
 * Handles CORS preflight requests (OPTIONS)
 */
export const handleCorsPrelight = (request: Request): Response => {
  const origin = request.headers.get('origin');
  const isAllowed = isOriginAllowed(origin);
  const headers = createCorsHeaders(origin);

  logger.info(`🔀 CORS preflight from origin: ${origin || 'none'} - ${isAllowed ? '✅ ALLOWED' : '❌ BLOCKED'}`, {
    origin,
    isAllowed,
    allowedOrigins: getAllowedOrigins(),
    headers: Object.keys(headers)
  });

  return new Response(null, {
    status: 200,
    headers
  });
};

/**
 * Adds CORS headers to any response (only if they don't already exist)
 */
export const addCorsHeaders = (response: Response, request: Request): Response => {
  const existingHeaders = Object.fromEntries(response.headers.entries());

  // Check if response already has CORS headers
  const hasCorsHeaders = existingHeaders['Access-Control-Allow-Origin'] ||
                        existingHeaders['access-control-allow-origin'];

  if (hasCorsHeaders) {
    // Response already has CORS headers, don't add more
    logger.debug('Response already has CORS headers, skipping middleware');
    return response;
  }

  const origin = request.headers.get('origin');
  const isAllowed = isOriginAllowed(origin);
  const corsHeaders = createCorsHeaders(origin);

  // Create new response with CORS headers
  const newResponse = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: {
      ...existingHeaders,
      ...corsHeaders
    }
  });

  logger.info(`🔀 CORS headers applied to response - Origin: ${origin || 'none'} - ${isAllowed ? '✅ ALLOWED' : '❌ BLOCKED'}`, {
    origin,
    isAllowed,
    allowedOrigins: getAllowedOrigins(),
    corsHeadersAdded: Object.keys(corsHeaders),
    hasAccessControlAllowOrigin: !!corsHeaders['Access-Control-Allow-Origin']
  });

  return newResponse;
};

/**
 * Middleware function for Bun server
 */
export const corsMiddleware = (request: Request, response: Response): Response => {
  return addCorsHeaders(response, request);
};

/**
 * WebSocket CORS validation
 */
export const validateWebSocketOrigin = (request: Request): boolean => {
  const origin = request.headers.get('origin');

  if (!origin) {
    logger.warn('WebSocket connection without origin header');
    return !isProduction(); // Allow in development, block in production
  }

  const allowed = isOriginAllowed(origin);

  if (!allowed) {
    logger.error(`WebSocket connection from disallowed origin: ${origin}`);
  } else {
    logger.debug(`WebSocket connection from allowed origin: ${origin}`);
  }

  return allowed;
};

// Export configuration for testing
export const corsConfig = {
  getAllowedOrigins,
  isOriginAllowed,
  createCorsHeaders
};