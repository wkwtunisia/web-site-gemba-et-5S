import { supabase } from '../supabaseClient'

const BUCKET = 'gemba-actions'

export async function uploadActionPhoto(file, key) {
  if (!file) return null
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const safeKey = key.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${safeKey}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type })

  if (error) { console.error('Erreur upload photo:', error); return null }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { url: data?.publicUrl || null, path }
}

export async function deleteStorageFile(storagePath) {
  if (!storagePath) return
  const { error } = await supabase.storage.from(BUCKET).remove([storagePath])
  if (error) console.error('Erreur suppression fichier:', error)
}
