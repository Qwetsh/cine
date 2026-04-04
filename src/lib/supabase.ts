import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Variables Supabase manquantes. Vérifiez votre fichier .env (VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY).'
  )
}

// Le générique Database est omis car les types hand-written ne sont pas
// compatibles avec l'API interne de supabase-js v2.101.
// Générez les types avec : npx supabase gen types typescript --project-id <id>
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
