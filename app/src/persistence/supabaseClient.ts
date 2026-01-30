import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cached:
  | {
      url: string
      anonKey: string
      client: SupabaseClient
    }
  | undefined

export function getSupabaseClient() {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

  if (!url || !anonKey) return null

  if (cached && cached.url === url && cached.anonKey === anonKey) return cached.client

  const client: SupabaseClient = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })

  cached = { url, anonKey, client }
  return client
}

export function isSupabaseConfigured(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
}
