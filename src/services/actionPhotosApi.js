import { supabase } from '../supabaseClient'
import { deleteStorageFile } from './storageApi'

export async function fetchPhotosByAction() {
  const { data, error } = await supabase
    .from('action_photos')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) { console.error('Erreur fetchPhotosByAction:', error); return {} }

  const map = {}
  ;(data || []).forEach(p => {
    if (!map[p.action_id]) map[p.action_id] = []
    map[p.action_id].push(p)
  })
  return map
}

export async function insertActionPhoto({ action_id, url, storage_path, uploaded_by }) {
  const { data, error } = await supabase
    .from('action_photos')
    .insert({ action_id, url, storage_path, uploaded_by: uploaded_by || null })
    .select()
    .single()

  if (error) { console.error('Erreur insertActionPhoto:', error); return null }
  return data
}

export async function deleteActionPhoto(photo) {
  if (!photo) return
  await deleteStorageFile(photo.storage_path)
  const { error } = await supabase.from('action_photos').delete().eq('id', photo.id)
  if (error) console.error('Erreur deleteActionPhoto:', error)
}
