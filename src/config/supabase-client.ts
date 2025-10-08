import { createClient } from "@supabase/supabase-js";

// Note: Using console.log instead of logger to avoid circular dependency
// logger imports env.ts which can cause issues during module initialization

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing Supabase environment variables.");
  console.error("❌ Supabase client will not be initialized. Online orders will fail.");
  // Don't throw - let the server start and handle errors gracefully
}

export const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : undefined as any; // Type assertion to allow undefined

if (supabase) {
  console.log("✅ Supabase client initialized.");
} else {
  console.warn("⚠️  Supabase client NOT initialized - missing environment variables");
}