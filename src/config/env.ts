// =================================================================
// ENVIRONMENT CONFIGURATION WITH VALIDATION
// =================================================================

import { logger } from "@/utils/logger";

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

  const allowedOrigins = (
    process.env.ALLOWED_ORIGINS ||
    process.env.CORS_ORIGIN ||
    "http://localhost:3001"
  )
    .split(",")
    .map((origin) => origin.trim());

  // Warn if using default origins in production
  if (
    nodeEnv === "production" &&
    allowedOrigins.some((origin) => origin.includes("localhost"))
  ) {
    logger.warn("Using localhost origins in production mode!");
  }

  // Check for errors
  if (errors.length > 0) {
    logger.error("Environment validation failed", { errors });
    throw new Error("Invalid environment configuration");
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
  };

  // Log configuration in development
  if (config.NODE_ENV === "development") {
    logger.info("🔧 Configuration loaded:", {
      environment: config.NODE_ENV,
      port: config.PORT,
      logLevel: config.LOG_LEVEL,
      allowedOrigins: config.ALLOWED_ORIGINS,
    });
  }

  return config;
}

// Export singleton config
export const env = loadEnvConfig();

// Helper to check if production
export const isProduction = () => env.NODE_ENV === "production";
export const isDevelopment = () => env.NODE_ENV === "development";
