import { supabase } from '../supabaseClient'
import imageCompression from 'browser-image-compression'

const BUCKET = 'gemba-actions'

export async function uploadActionPhoto(file, key) {
  if (!file) return null

  let fileToUpload = file

  // 🌟 COMPRESSION AUTOMATIQUE
  // Si l'image fait plus de 200 Ko, on la compresse
  if (file.size > 200 * 1024) {
    const options = {
      maxSizeMB: 0.2, // 200 Ko max
      maxWidthOrHeight: 1200, // Résolution max (HD)
      useWebWorker: true,
      fileType: 'image/jpeg' // Force le format JPEG (plus léger)
    }
    try {
      fileToUpload = await imageCompression(file, options)
      console.log(`Image compressée : ${(file.size / 1024 / 1024).toFixed(2)} Mo -> ${(fileToUpload.size / 1024).toFixed(0)} Ko`)
    } catch (error) {
      console.error("Erreur de compression, envoi de l'original:", error)
      fileToUpload = file
    }
  }

  const ext = (fileToUpload.name.split('.').pop() || 'jpg').toLowerCase()
  const safeKey = key.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${safeKey}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, fileToUpload, { cacheControl: '3600', upsert: false, contentType: fileToUpload.type })

  if (error) {
    console.error('Erreur upload photo:', error)
    return null
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { url: data?.publicUrl || null, path }
}

export async function deleteStorageFile(storagePath) {
  if (!storagePath) return
  const { error } = await supabase.storage.from(BUCKET).remove([storagePath])
  if (error) console.error('Erreur suppression fichier:', error)
}
