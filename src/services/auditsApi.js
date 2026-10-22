import { supabase } from '../supabaseClient'

export async function fetchAudits() {
  const { data, error } = await supabase
    .from('audits')
    .select('*')
    .order('date', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function upsertAudits(rows, chunkSize = 50) {
  let processed = 0
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const { error } = await supabase
      .from('audits')
      .upsert(chunk, { onConflict: 'date,zone,auditor' })
    if (error) throw error
    processed += chunk.length
  }
  return processed
}

/**
 * Supprime toutes les lignes et vérifie qu'il n'en reste aucune.
 * @returns {Promise<number>} nombre de lignes supprimées
 */
export async function deleteAllAudits() {
  // 1) Compter avant
  const { count: before, error: countErr } = await supabase
    .from('audits')
    .select('*', { count: 'exact', head: true })
  if (countErr) throw new Error(`Comptage impossible : ${countErr.message}`)

  // 2) Supprimer
  const { data, error } = await supabase
    .from('audits')
    .delete()
    .not('date', 'is', null)
    .select('date')          // demande à Supabase de renvoyer les lignes supprimées
  if (error) throw new Error(`Suppression refusée : ${error.message}`)

  const deleted = data?.length ?? 0

  // 3) Vérifier après
  const { count: after, error: countErr2 } = await supabase
    .from('audits')
    .select('*', { count: 'exact', head: true })
  if (countErr2) throw new Error(`Vérification impossible : ${countErr2.message}`)

  if (after > 0) {
    throw new Error(
      `Suppression incomplète : ${before} lignes avant, ${deleted} supprimées, ` +
      `${after} encore en base. RLS bloque probablement le DELETE.`
    )
  }
  return before ?? deleted
}
