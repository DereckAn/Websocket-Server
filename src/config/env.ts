// =================================================================
// ENVIRONMENT CONFIGURATION WITH VALIDATION
// =================================================================

// Note: Cannot import logger here due to circular dependency
// Logger will be available after this module loads

export interface EnvConfig {
  NODE_ENV: "development" | "production" | "test";
  PORT: number;
  LOG_LEVEL: "debug" | "info" | "warn" | "error";
  ALLOWED_ORIGINS: string[];

  // Gomoku Config
  MAX_ACTIVE_ROOMS: number;
  ROOM_CLEANUP_INTERVAL: number;
  INACTIVE_ROOM_TIMEOUT: number;
  AI_MAX_TIME_PER_MOVE: number;

  // Rate Limiting
  MAX_GAME_CREATIONS_PER_MINUTE: number;
  MAX_MOVES_PER_MINUTE: number;

  // Supabase
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

/**
 * Validates and loads environment variables
 */
function loadEnvConfig(): EnvConfig {
  const errors: string[] = [];

  // Helper to get required env var
  const getRequired = (key: string, defaultValue?: string): string => {
    const value = process.env[key] || defaultValue;
    if (!value) {
      errors.push(`Missing required environment variable: ${key}`);
      return "";
    }
    return value;
  };

  // Helper to get number
  const getNumber = (key: string, defaultValue: number): number => {
    const value = process.env[key];
    if (!value) return defaultValue;
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      errors.push(`Invalid number for ${key}: ${value}`);
      return defaultValue;
    }
    return num;
  };

  // Load and validate
  const nodeEnv = getRequired(
    "NODE_ENV",
    "development"
  ) as EnvConfig["NODE_ENV"];
  if (!["development", "production", "test"].includes(nodeEnv)) {
    errors.push(
      `Invalid NODE_ENV: ${nodeEnv}. Must be development, production, or test`
    );
  }

  const logLevel = getRequired("LOG_LEVEL", "info") as EnvConfig["LOG_LEVEL"];
  if (!["debug", "info", "warn", "error"].includes(logLevel)) {
    errors.push(
      `Invalid LOG_LEVEL: ${logLevel}. Must be debug, info, warn, or error`
    );
  }

  // Parse ALLOWED_ORIGINS with proper fallback logic
  const allowedOriginsRaw = process.env.ALLOWED_ORIGINS || process.env.CORS_ORIGIN || "";

  const allowedOrigins = allowedOriginsRaw
    ? allowedOriginsRaw.split(",").map((origin) => origin.trim()).filter(o => o.length > 0)
    : nodeEnv === "production"
      ? [] // No defaults in production - must be explicitly set
      : ["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000", "http://127.0.0.1:3001"];

  // Warn about CORS configuration issues
  if (nodeEnv === "production" && allowedOrigins.length === 0) {
    console.error("❌ ERROR: No ALLOWED_ORIGINS set in production! All CORS requests will be blocked.");
    console.error("   Set ALLOWED_ORIGINS environment variable with comma-separated origins.");
  }

  if (nodeEnv === "production" && allowedOrigins.some((origin) => origin.includes("localhost"))) {
    console.warn("⚠️  WARNING: Using localhost origins in production mode!");
  }

  // Check for errors
  if (errors.length > 0) {
    console.error("❌ Environment validation failed:");
    errors.forEach((error) => console.error(`  - ${error}`));
    throw new Error("Invalid environment configuration");
  }

  // Supabase configuration (optional)
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.warn(
      "⚠️  WARNING: Missing Supabase environment variables. Supabase client will not be initialized."
    );
  }

  const config: EnvConfig = {
    NODE_ENV: nodeEnv,
    PORT: getNumber("PORT", 3000),
    LOG_LEVEL: logLevel,
    ALLOWED_ORIGINS: allowedOrigins,

    // Gomoku
    MAX_ACTIVE_ROOMS: getNumber("MAX_ACTIVE_ROOMS", 1000),
    ROOM_CLEANUP_INTERVAL: getNumber("ROOM_CLEANUP_INTERVAL", 300000), // 5 minutes
    INACTIVE_ROOM_TIMEOUT: getNumber("INACTIVE_ROOM_TIMEOUT", 1800000), // 30 minutes
    AI_MAX_TIME_PER_MOVE: getNumber("AI_MAX_TIME_PER_MOVE", 10000), // 10 seconds

    // Rate Limiting
    MAX_GAME_CREATIONS_PER_MINUTE: getNumber(
      "MAX_GAME_CREATIONS_PER_MINUTE",
      5
    ),
    MAX_MOVES_PER_MINUTE: getNumber("MAX_MOVES_PER_MINUTE", 60),

    // Supabase (conditionally add only if defined)
    ...(supabaseUrl && { SUPABASE_URL: supabaseUrl }),
    ...(supabaseKey && { SUPABASE_SERVICE_ROLE_KEY: supabaseKey }),
  };

  // Log configuration in development (using console to avoid circular dependency)
  if (config.NODE_ENV === "development") {
    console.log("🔧 Configuration loaded:", {
      environment: config.NODE_ENV,
      port: config.PORT,
      logLevel: config.LOG_LEVEL,
      allowedOrigins: config.ALLOWED_ORIGINS,
      hasSupabase: !!(supabaseUrl && supabaseKey),
    });
  }

  return config;
}

// Export singleton config
export const env = loadEnvConfig();

// Helper to check if production
export const isProduction = () => env.NODE_ENV === "production";
export const isDevelopment = () => env.NODE_ENV === "development";
