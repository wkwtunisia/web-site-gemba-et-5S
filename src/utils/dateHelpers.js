/** 
 * Retourne le numéro de semaine ISO et l'année.
 * Ex: "2026-S15"
 */
export function getWeekKey(dateStr) {
  const d = new Date(dateStr)
  if (isNaN(d)) return null
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7)
  const week1 = new Date(d.getFullYear(), 0, 4)
  const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7)
  return `${d.getFullYear()}-S${String(weekNum).padStart(2, '0')}`
}

/** 
 * Retourne le libellé du mois et l'année. 
 * Ex: "2026-04" (Avril 2026)
 */
export function getMonthKey(dateStr) {
  return dateStr ? dateStr.slice(0, 7) : null
}

/** 
 * Formate une clé de semaine en texte lisible
 * Ex: "2026-S15" -> "S15 (2026)"
 */
export function formatWeekLabel(weekKey) {
  if (!weekKey) return ''
  const [year, week] = weekKey.split('-')
  return `${week} (${year})`
}

/** 
 * Formate une clé de mois en texte lisible
 * Ex: "2026-04" -> "Avril 2026"
 */
export function formatMonthLabel(monthKey) {
  if (!monthKey) return ''
  const [year, month] = monthKey.split('-')
  const date = new Date(year, parseInt(month) - 1, 1)
  return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

/** 
 * Retourne la clé de la semaine précédente (S-1) par rapport à aujourd'hui
 */
export function getPreviousWeekKey() {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return getWeekKey(d.toISOString())
}
