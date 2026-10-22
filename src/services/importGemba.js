import * as XLSX from 'xlsx'

const norm = (s) => String(s ?? '').replace(/\u00a0/g, ' ').trim().replace(/\s+/g, ' ')
const cleanText = (s) => {
  if (!s) return null
  return String(s).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase()
}

function parseExcelDate(v) {
  if (v == null || v === '') return null
  if (v instanceof Date) {
    return { iso: `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}` }
  }
  if (typeof v === 'number') {
    const date = new Date(Math.round((v - 25569) * 86400 * 1000))
    return { iso: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }
  }
  const str = String(v).trim()
  const matchSlash = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (matchSlash) {
    const [_, day, month, year] = matchSlash
    return { iso: `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}` }
  }
  const matchDash = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (matchDash) {
    const [_, year, month, day] = matchDash
    return { iso: `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}` }
  }
  const d = new Date(str)
  if (!isNaN(d)) {
    return { iso: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
  }
  return null
}

// Fonction pour extraire le vrai numéro de semaine
function getWeekNum(dateStr) {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day, 12, 0, 0);
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3); 
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - target) / 604800000);
}

export async function parseGembaFile(file) {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array', cellDates: false, raw: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) throw new Error('Aucune feuille trouvée.')

  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false })
  if (aoa.length < 2) throw new Error('Fichier vide.')

  let headerIdx = -1
  for (let i = 0; i < Math.min(aoa.length, 10); i++) {
    const row = (aoa[i] ?? []).map(norm)
    if (row.includes('Date') && row.includes('Point M')) {
      headerIdx = i; break
    }
  }
  if (headerIdx < 0) throw new Error('En-têtes introuvables.')

  const header = aoa[headerIdx].map(norm)
  const idx = (name) => header.indexOf(norm(name))

  const iDate = idx('Date'), iLigne = idx('Ligne'), iUAP = idx('UAP'), iAuditeur = idx('Auditeur')
  const iPointM = idx('Point M'), iQuestion = idx('Question'), iReponse = idx('Réponse')
  const iAction = idx('Action Corrective'), iPilote = idx('Pilote'), iDateAction = idx('Date Action'), iScore = idx('Score (%)')

  const rows = []
  let lastDateInfo = null
  let lastLigne = null
  let lastUAP = null

  for (let r = headerIdx + 1; r < aoa.length; r++) {
    const row = aoa[r]
    if (!row) continue
    if (row.every(cell => cell === null || cell === '')) continue;

    const question = norm(row[iQuestion])
    const pointM = norm(row[iPointM])
    if (!question && !pointM) continue;

    if (row[iDate]) {
      lastDateInfo = parseExcelDate(row[iDate])
    }
    if (row[iLigne]) lastLigne = row[iLigne]
    if (row[iUAP]) lastUAP = row[iUAP]

    if (!lastDateInfo) continue

    const dateActionInfo = parseExcelDate(row[iDateAction])
    const weekNum = getWeekNum(lastDateInfo.iso)

    rows.push({
      date: lastDateInfo.iso,
      semaine: weekNum, // ON SAUVEGARDE LA SEMAINE ICI
      ligne: cleanText(lastLigne) || '',
      uap: cleanText(lastUAP) || '',
      auditeur: cleanText(row[iAuditeur]) || '',
      point_m: pointM,
      question: question || pointM,
      reponse: norm(row[iReponse]).toUpperCase(),
      action: norm(row[iAction]),
      pilote: cleanText(row[iPilote]),
      date_action: dateActionInfo ? dateActionInfo.iso : null,
      score: Number(row[iScore]) || 0
    })
  }
  return rows
}
