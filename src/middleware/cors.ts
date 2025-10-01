// =================================================================
// CORS MIDDLEWARE - Cross-Origin Resource Sharing configuration
// =================================================================

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
  if (process.env.NODE_ENV !== 'production') {
    origins.push(
      'http://localhost:3000',
      'http://localhost:3001',  // pag_mich dev server
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001'
    );
  }

  // Environment-based origins (for both dev and production)
  if (process.env.CORS_ORIGIN) {
    const envOrigins = process.env.CORS_ORIGIN.split(',').map(origin => origin.trim());
    origins.push(...envOrigins);
  }

  // Default production patterns (Vercel)
  if (process.env.NODE_ENV === 'production') {
    origins.push(
      'https://*.vercel.app',
      'https://your-app.vercel.app' // Replace with actual domain
    );
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
    return true;
  }

  // Pattern matching for wildcard domains
  for (const allowedOrigin of allowedOrigins) {
    if (allowedOrigin.includes('*')) {
      const pattern = allowedOrigin.replace('*', '.*');
      const regex = new RegExp(`^${pattern}$`);
      if (regex.test(origin)) {
        return true;
      }
    }
  }

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
  const headers = createCorsHeaders(origin);

  console.log(`🔗 CORS preflight from origin: ${origin || 'none'}`);

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
    console.log('🔗 Response already has CORS headers, skipping middleware');
    return response;
  }

  const origin = request.headers.get('origin');
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

  console.log('🔗 Added CORS headers via middleware');
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
    console.warn('⚠️ WebSocket connection without origin header');
    return true; // Allow in development
  }

  const allowed = isOriginAllowed(origin);

  if (!allowed) {
    console.error(`❌ WebSocket connection from disallowed origin: ${origin}`);
  } else {
    console.log(`✅ WebSocket connection from allowed origin: ${origin}`);
  }

  return allowed;
};

// Export configuration for testing
export const corsConfig = {
  getAllowedOrigins,
  isOriginAllowed,
  createCorsHeaders
};