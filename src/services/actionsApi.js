import { supabase } from '../supabaseClient'

export async function fetchActions() {
  const { data, error } = await supabase.from('action_plans').select('*')
  if (error) return []
  return data || []
}

export async function upsertAction(action) {
  const cleanAction = {
    type: action.type,
    audit_date: action.audit_date,
    ligne: action.ligne,
    question: action.question,
    point_m: action.point_m || null,
    action_texte: action.action_texte || null,
    progression: action.progression || 0,
    pilote_email: action.pilote_email || null,
    date_prevue: action.date_prevue || null,
    date_realisation: action.date_realisation || null
  }

  const { data: existing } = await supabase
    .from('action_plans')
    .select('id')
    .eq('type', action.type)
    .eq('audit_date', action.audit_date)
    .eq('ligne', action.ligne)
    .eq('question', action.question)
    .maybeSingle()

  if (existing) {
    const { data, error } = await supabase.from('action_plans').update(cleanAction).eq('id', existing.id).select().single()
    if (error) { console.error('Erreur UPDATE:', error); return null }
    return data
  } else {
    const { data, error } = await supabase.from('action_plans').insert(cleanAction).select().single()
    if (error) { console.error('Erreur INSERT:', error); return null }
    return data
  }
}

export async function logActionHistory(log) {
  if (!log.action_id) return
  
  const { error } = await supabase.from('action_history').insert({
    action_id: log.action_id,
    modified_by: log.modified_by,
    old_progression: log.old_progression,
    new_progression: log.new_progression,
    old_action: log.old_action,
    new_action: log.new_action,
    date_prevue: log.date_prevue || null,
    date_realisation: log.date_realisation || null,
    target_pilot: log.target_pilot || null,
    action_type: log.action_type || null,
    audit_ligne: log.audit_ligne || null,
    audit_question: log.audit_question || null
  })
  
  if (error) console.error('Erreur logActionHistory:', error)
}
