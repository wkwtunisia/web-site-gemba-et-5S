import { supabase } from '../supabaseClient'

export async function fetchUsers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('email, role')
    .order('email', { ascending: true })
    
  if (error) {
    console.error('Erreur chargement utilisateurs:', error)
    return []
  }
  return data || []
}
