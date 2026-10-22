import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !/^https:\/\/[a-z0-9]+\.supabase\.co\/?$/.test(url)) {
  throw new Error(
    `VITE_SUPABASE_URL invalide : "${url}". ` +
    `Format attendu : https://<ref>.supabase.co — vérifiez .env.local puis relancez "npm run dev".`
  )
}
if (!key || key.length < 100) {
  throw new Error(
    'VITE_SUPABASE_PUBLISHABLE_KEY manquante ou tronquée (doit être le JWT anon complet).'
  )
}

export const supabase = createClient(url, key)
