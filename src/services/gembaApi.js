import { supabase } from '../supabaseClient'

export const fetchAllGembaData = async () => {
  let allData = []
  let from = 0
  const step = 1000
  let hasMore = true
  
  // 1. Récupérer les vrais audits
  while (hasMore) {
    const { data, error } = await supabase.from('gemba_audits').select('*').order('date', { ascending: false }).range(from, from + step - 1)
    if (error) { console.error(error); break }
    if (data.length === 0) { hasMore = false } else { allData = [...allData, ...data]; from += step }
  }
  
  // 2. Récupérer les scores manuels
  const { data: manual, error: errManual } = await supabase.from('gemba_manual_scores').select('*')
  if (errManual) console.error(errManual)
  
  if (manual && manual.length > 0) {
    console.log(`[Gemba API] ${manual.length} scores manuels trouvés dans Supabase.`)
    
    const existingAudits = new Set()
    allData.forEach(a => {
      const dateStr = String(a.date).substring(0, 10)
      if (dateStr && a.ligne) existingAudits.add(`${dateStr}|${a.ligne.trim()}`)
    })

    const mapped = manual
      .filter(m => !existingAudits.has(`${m.date}|${m.ligne.trim()}`))
      .map(m => ({
        date: m.date, 
        ligne: m.ligne, 
        uap: m.uap,
        question: 'MANUEL', 
        reponse: 'OK', 
        point_m: 'GLOBAL',
        is_manual: true, 
        score_pct: m.score_pct
      }))
      
    allData = [...allData, ...mapped]
    console.log(`[Gemba API] Total de lignes (réelles + manuelles) : ${allData.length}`)
  } else {
    console.log("[Gemba API] Aucun score manuel trouvé (la table est peut-être vide).")
  }
  
  return allData
}
