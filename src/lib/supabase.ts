import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
)

export const supabaseConfigured = Boolean(
  String(import.meta.env.VITE_SUPABASE_URL ?? '').trim() &&
    String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim(),
)
