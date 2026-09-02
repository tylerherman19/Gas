import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Read-only client for the dashboard. Returns null when the project isn't
 * configured yet so the page can render an honest empty state instead of
 * crashing the build.
 */
export const supabase = url && anonKey ? createClient(url, anonKey, {
  auth: { persistSession: false },
}) : null;

export const isConfigured = Boolean(supabase);
