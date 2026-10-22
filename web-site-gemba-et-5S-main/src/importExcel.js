import * as XLSX from 'xlsx'

// ── Exact column names as provided by the user ─────────────────────────────
const COL = {
  date:    'Date',
  auditor: 'Auditeur',
  zone:    'Zone/ Ligne/ Poste',
  pilot:   'Pilote de la zone',
  total:   'Total points',
}

// 26 questions, in the exact order they appear between
// "Pilote de la zone" and "Total points".
const QUESTIONS = [
  "Pas d'objets inutiles (objets, outils, matériaux) non liés au processus/ production en cours (également dans les armoires, casiers)",
  "Pas d'affichages inutiles",
  "Les équipements et outillages partagés par plusieurs lignes/postes sont placés dans un espace commun",
  "Pas d'objet, outillage, matériel, produit chimique,… présentant un risque sécurité",
  "Tous les éléments mobiles (outillage, gabarit)) ont un emplacement de stockage défini",
  "Les objets fréquemment utilisés sont situés à proximité de leur point d'utilisation",
  "Chaque chose à sa place, lorsqu'elle n'est pas utilisée",
  "Tous les objets sont dans leur état standard (armoires électriques, tiroirs, couvercles fermés, ,,,)",
  "Un marquage au sol est réalisé",
  "Accès libre au matériel incendie et issues de secours",
  "La zone de travail est propre et en bon état : sol, zoning, machines et équipements, câbles, outillages, conteneurs,postes et table de contrôle, documentation, armoires, racks, étagères, panneaux ...",
  "Les sources de saleté (fuite d'eau, d'huile) sont détectées et assignée pour l'élimination",
  "Kit de nettoyage disponible, accessible et adapté",
  "Tri sélectif du déchets / rebuts est respecté",
  "Chaque lieu de stockage défini pour un objet mobile (outillage, gabarit de contrôle,...) est identifié",
  "Les conditions standards Visuel 5S du périmètre sont respectés (y compris les armoires, tiroirs, luminaires et surfaces en contact direct avec le produit)",
  "Tous les objets/ contenants (y compris pour déchets) sont clairement identifiés",
  "Les instructions de nettoyage et de tri sélectif sont définis",
  "Marquage des zones, des canalisations et des équipements est réalisé",
  "Un standard de kit de nettoyage est défini et est disponible",
  "Un affichage visuel défini le standard du port des EPI",
  "Les standards définis dans la zone sont connues et respectées par tous les membres de l'équipe (y compris les nouveaux arrivants)",
  "Présence et respect du planning 5S",
  "Le personnel porte les EPI",
  "Tableau de marche et indicateurs du tableau de bord à jour",
  "Le flux de production (lay-out) est clair et respecté",
]

// "Action /Pilote / Date", "Action /Pilote / Date2", …, "Action /Pilote / Date26"
const ACTION_HEADERS = Array.from({ length: 26 }, (_, i) =>
  i === 0 ? 'Action /Pilote / Date' : `Action /Pilote / Date${i + 1}`
)

// Normalise un label pour comparaison tolérante aux espaces / accents de bord
const norm = (s) =>
  String(s ?? '').replace(/\u00a0/g, ' ').trim().replace(/\s+/g, ' ')

const toIso = (v) => {
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

export async function parseFile(file) {
  const buf = await file.arrayBuffer()
  const wb  = XLSX.read(buf, { type: 'array', cellDates: true })
  const ws  = wb.Sheets[wb.SheetNames[0]]
  if (!ws) throw new Error('Aucune feuille trouvée dans le fichier.')

  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true })
  if (aoa.length < 2) throw new Error('Fichier vide.')

  // Find the header row: the first row containing "Date" AND "Auditeur".
  let headerIdx = -1
  for (let i = 0; i < Math.min(aoa.length, 10); i++) {
    const row = aoa[i].map(norm)
    if (row.includes(COL.date) && row.includes(COL.auditor)) { headerIdx = i; break }
  }
  if (headerIdx < 0) throw new Error('En-têtes introuvables (Date / Auditeur).')

  const header = aoa[headerIdx].map(norm)

  // Build index lookup
  const idx = (name) => header.findIndex(h => h === norm(name))
  const iDate    = idx(COL.date)
  const iAuditor = idx(COL.auditor)
  const iZone    = idx(COL.zone)
  const iPilot   = idx(COL.pilot)
  const iTotal   = idx(COL.total)

  if (iDate < 0 || iAuditor < 0 || iZone < 0 || iTotal < 0)
    throw new Error('Colonnes obligatoires manquantes (Date / Auditeur / Zone / Total points).')

  // For each question, find its column index and the next "Action /Pilote / Date*" column
  const checkpointsMeta = QUESTIONS.map((q, qi) => {
    const iQ = idx(q)
    const iA = idx(ACTION_HEADERS[qi])
    return { question: q, iQ, iA }
  })
  const missingQ = checkpointsMeta.filter(c => c.iQ < 0)
  if (missingQ.length)
    throw new Error(
      `${missingQ.length} question(s) introuvable(s) dans l'en-tête, ex: "${missingQ[0].question.slice(0, 60)}…"`
    )

  const rows = []
  const seen = new Set()

  for (let r = headerIdx + 1; r < aoa.length; r++) {
    const row = aoa[r]
    if (!row || row.length === 0) continue

    const date    = toDate(row[iDate])
    const auditor = norm(row[iAuditor])
    const zone    = norm(row[iZone])
    if (!date && !auditor && !zone) continue          // blank row
    if (!date || !zone)             continue          // incomplete row

    const pilot = iPilot >= 0 ? norm(row[iPilot]) || null : null
    const total = Number(row[iTotal]) || 0

    const checkpoints = checkpointsMeta.map(({ question, iQ, iA }) => {
      const status = norm(row[iQ]).toUpperCase()
      const action = iA >= 0 ? norm(row[iA]) : ''
      return { q: question, s: status, a: action || null }
    })

    const key = `${date}|${zone}|${auditor}`
    if (seen.has(key)) continue
    seen.add(key)

    rows.push({
      date,
      auditor,
      zone,
      pilot,
      total_points: total,
      max_points: 26,
      checkpoints
    })
  }

  return rows
}
