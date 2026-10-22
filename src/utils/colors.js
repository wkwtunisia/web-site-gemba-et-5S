/**
 * Règle de couleurs officielle pour le projet Gemba 5S
 * 0 - 84% : Rouge
 * 85 - 86% : Orange
 * 87 - 100% : Vert
 */

export const getScoreColor = (score) => {
  const s = Number(score)
  if (s >= 87) return '#10b981' // Vert
  if (s >= 85) return '#f59e0b' // Orange
  return '#ef4444'             // Rouge
}

// Pour les classes CSS (badges, textes)
export const getScoreClass = (score) => {
  const s = Number(score)
  if (s >= 87) return 'ok'    // Vert
  if (s >= 85) return 'warn'  // Orange
  return 'bad'                // Rouge
}
