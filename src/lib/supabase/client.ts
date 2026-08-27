import { createBrowserClient } from '@supabase/ssr'

/**
 * Supabase-Client für den Browser.
 *
 * Legt die Sitzung in Cookies ab, nicht im Browser-Speicher — nur so kann der Server
 * bei der nächsten Anfrage wissen, wer anfragt. Der Schlüssel ist öffentlich; genau
 * deshalb muss Row Level Security sitzen (siehe supabase/migrations/).
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
