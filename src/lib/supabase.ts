// ─── Supabase Client ───
// Simple browser client - no auth, no cookies. Just anon access.

import { createClient } from "@supabase/supabase-js";

// Minimal type so .from() returns usable insert/update types
type Tables = {
  public: {
    Tables: {
      entries: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> };
      orbits: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> };
      sessions: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> };
      reminders: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> };
    };
  };
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

let client: ReturnType<typeof createClient<Tables>> | null = null;

export function getSupabase(): ReturnType<typeof createClient<Tables>> {
  if (!client) {
    client = createClient<Tables>(supabaseUrl, supabaseAnonKey, {
      db: { schema: "public" },
    });
  }
  return client!;
}
