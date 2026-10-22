import * as XLSX from 'xlsx'
import { QUESTIONS, ACTION_HEADERS, META_HEADERS } from '../constants/checklist'

const norm = (s) => String(s ?? '').replace(/\u00a0/g, ' ').trim().replace(/\s+/g, ' ')
const cleanText = (s) => {
  if (!s) return null
  return String(s).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase()
}

function toIso(v) {
  if (v == null || v === '') return null
  if (v instanceof Date) return v.toISOString()
  if (typeof v === 'number') {
    const ms = Math.round((v - 25569) * 86400 * 1000)
    return new Date(ms).toISOString()
  }
  const d = new Date(v)
  return isNaN(d) ? null : d.toISOString()
}
const toDate = (v) => { const iso = toIso(v); return iso ? iso.slice(0, 10) : null }

function findHeaderRow(aoa) {
  for (let i = 0; i < Math.min(aoa.length, 10); i++) {
    const row = (aoa[i] ?? []).map(norm)
    if (row.includes(norm(META_HEADERS.date)) && row.includes(norm(META_HEADERS.auditor))) return i
  }
  return -1
}

export async function parseFile(file) {
  const buf = await file.arrayBuffer()
  const wb  = XLSX.read(buf, { type: 'array', cellDates: true })
  const ws  = wb.Sheets[wb.SheetNames[0]]
  if (!ws) throw new Error('Aucune feuille trouvée dans le fichier.')

  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true })
  if (aoa.length < 2) throw new Error('Fichier vide.')

  const headerIdx = findHeaderRow(aoa)
  if (headerIdx < 0) throw new Error('En-têtes introuvables (Date / Auditeur).')

  const header = aoa[headerIdx].map(norm)
  const idx = (name) => header.indexOf(norm(name))

  const iDate    = idx(META_HEADERS.date)
  const iAuditor = idx(META_HEADERS.auditor)
  const iZone    = idx(META_HEADERS.zone)
  const iPilot   = idx(META_HEADERS.pilot)
  const iTotal   = idx(META_HEADERS.total)

  if (iDate < 0 || iAuditor < 0 || iZone < 0 || iTotal < 0) {
    throw new Error('Colonnes obligatoires manquantes (Date / Auditeur / Zone / Total points).')
  }

  const checkpointsMeta = QUESTIONS.map((q, qi) => ({
    question: q,
    iQ: idx(q),
    iA: idx(ACTION_HEADERS[qi]),
  }))
  const missing = checkpointsMeta.filter(c => c.iQ < 0)
  if (missing.length) {
    throw new Error(`${missing.length} question(s) introuvable(s) dans l'en-tête. Ex : "${missing[0].question.slice(0, 60)}…"`)
  }

  const rows = []
  const seen = new Set()

  for (let r = headerIdx + 1; r < aoa.length; r++) {
    const row = aoa[r]
    if (!row || row.length === 0) continue

    const date    = toDate(row[iDate])
    const auditor = cleanText(row[iAuditor]) || ''
    const zone    = cleanText(row[iZone])    || ''

    if (!date && !auditor && !zone) continue
    if (!date || !zone)             continue

    const key = `${date}|${zone}|${auditor}`
    if (seen.has(key)) continue
    seen.add(key)

    const pilot = iPilot >= 0 ? cleanText(row[iPilot]) : null
    const total = Number(row[iTotal]) || 0

    // NOUVEAU : Calcul du max_points en ignorant les N/A
    let evaluatedCount = 0
    const checkpoints = checkpointsMeta.map(({ question, iQ, iA }) => {
      const status = norm(row[iQ]).toUpperCase()
      if (status === 'OK' || status === 'NOK') evaluatedCount++
      return {
        q: question,
        s: status, 
        a: iA >= 0 ? norm(row[iA]) || null : null,
      }
    })

    // On sauvegarde le bon dénominateur (ex: 25 si 1 N/A)
    const maxPoints = evaluatedCount > 0 ? evaluatedCount : 26

    rows.push({
      date,
      auditor,
      zone,
      pilot,
      total_points: total,
      max_points: maxPoints, // Utilisé pour le calcul du % côté Base de Données
      checkpoints,
    })
  }

  return rows
}
