import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Variables Supabase manquantes. Vérifiez votre fichier .env (VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY).'
  )
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
