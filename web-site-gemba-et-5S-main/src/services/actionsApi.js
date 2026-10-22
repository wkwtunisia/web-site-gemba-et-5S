import { supabase } from '../supabaseClient'

export async function fetchActions() {
  const { data, error } = await supabase.from('action_plans').select('*')
  if (error) {
    console.error('Erreur fetchActions:', error)
    return []
  }
  return data || []
}

export async function upsertAction(action) {
  // On s'assure de ne pas envoyer de champs vides ou mal formatés
  const payload = {
    type: action.type,
    audit_date: action.audit_date,
    ligne: action.ligne,
    question: action.question,
    point_m: action.point_m || '',
    action_texte: action.action_texte || '',
    progression: action.progression || 0,
    pilote_email: action.pilote_email || null,
    date_prevue: action.date_prevue || null,
    date_realisation: action.date_realisation || null
  }

  const { data, error } = await supabase
    .from('action_plans')
    .upsert(payload, { onConflict: 'type,audit_date,ligne,question' })
    .select()
    .single()
    
  if (error) {
    console.error('Erreur upsertAction:', error)
    return null
  }
  return data
}

export async function logActionHistory(log) {
  // On ne log que si on a un ID valide
  if (!log.action_id) return

  const { error } = await supabase.from('action_history').insert({
    action_id: log.action_id,
    modified_by: log.modified_by,
    old_progression: log.old_progression,
    new_progression: log.new_progression,
    old_action: log.old_action,
    new_action: log.new_action,
    date_prevue: log.date_prevue || null,
    date_realisation: log.date_realisation || null
  })
  
  if (error) console.error('Erreur logActionHistory:', error)
}
