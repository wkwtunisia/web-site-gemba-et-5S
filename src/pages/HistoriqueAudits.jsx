import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { fetchAllGembaData } from '../services/gembaApi'
import { getGembaGroupedData, get5SGroupedData } from '../utils/stats'

const extractDateString = (dateStr) => {
  if (!dateStr) return null;
  const str = String(dateStr).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.substring(0, 10);
  if (/^\d{2}\/\d{2}\/\d{4}/.test(str)) { const parts = str.split('/'); return `${parts[2]}-${parts[1]}-${parts[0]}`; }
  const months = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
  const match = str.match(/^(\d{1,2})[-\s]([a-zA-Z]{3})[-\s](\d{4})/);
  if (match) { const month = months[match[2].toLowerCase()]; if (month) return `${match[3]}-${month}-${String(match[1]).padStart(2, '0')}`; }
  return null;
}

const normalizeLigne = (str) => String(str || '').trim().toUpperCase().replace(/\s+/g, '')
const getColor = (score) => score >= 90 ? '#10b981' : score >= 80 ? '#f59e0b' : '#ef4444'

export default function HistoriqueAudits() {
  const [type, setType] = useState('5S')
  const [dataGemba, setDataGemba] = useState([])
  const [data5S, setData5S] = useState([])
  const [loading, setLoading] = useState(true)

  const [selectedLigne, setSelectedLigne] = useState('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const [gembaRes, s5Res] = await Promise.all([
        fetchAllGembaData(),
        supabase.from('audits').select('*')
      ])
      setDataGemba(gembaRes || [])
      setData5S(s5Res.data || [])
      setLoading(false)
    }
    load()
  }, [])

  const availableLines = useMemo(() => {
    const set = new Set()
    if (type === 'Gemba') {
      dataGemba.forEach(d => { if (d.ligne) set.add(d.ligne.trim()) })
    } else {
      data5S.forEach(d => { if (d.zone) set.add(d.zone.trim()) })
    }
    return Array.from(set).sort()
  }, [type, dataGemba, data5S])

  // Calcul de l'historique
  const historique = useMemo(() => {
    if (!selectedLigne) return []
    
    const source = type === 'Gemba' ? dataGemba : data5S
    const targetLine = normalizeLigne(selectedLigne)

    // 1. Filtrer par ligne
    const filtered = source.filter(row => {
      const rowLigne = normalizeLigne(type === 'Gemba' ? row.ligne : row.zone)
      return rowLigne === targetLine
    })

    if (filtered.length === 0) return []

    // 2. Grouper par date
    const byDate = {}
    filtered.forEach(row => {
      const dStr = extractDateString(row.date)
      if (!dStr) return
      if (!byDate[dStr]) byDate[dStr] = []
      byDate[dStr].push(row)
    })

    // 3. Calculer le score pour chaque date
    const result = []
    Object.entries(byDate).forEach(([dateStr, rows]) => {
      let score = 0
      if (type === 'Gemba') {
        const grouped = getGembaGroupedData(rows)
        if (grouped.length > 0) score = Math.round(grouped.reduce((sum, g) => sum + g.score, 0) / grouped.length)
      } else {
        const grouped = get5SGroupedData(rows)
        if (grouped.length > 0) score = Math.round(grouped.reduce((sum, g) => sum + g.computedScore, 0) / grouped.length)
      }
      
      if (score > 0) {
        result.push({
          date: dateStr,
          label: new Date(`${dateStr}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }),
          score: score
        })
      }
    })

    // Trier par date décroissante (du plus récent au plus ancien)
    return result.sort((a, b) => b.date.localeCompare(a.date))
  }, [type, selectedLigne, dataGemba, data5S])

  if (loading) return <p className="muted" style={{ padding: '2rem' }}>Chargement des données…</p>

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: '1.5rem', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>📜 Historique des Audits</h1>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="filter-control" value={type} onChange={e => { setType(e.target.value); setSelectedLigne(''); }}>
            <option value="5S">5S</option>
            <option value="Gemba">Gemba</option>
          </select>

          <select className="filter-control" value={selectedLigne} onChange={e => setSelectedLigne(e.target.value)}>
            <option value="">-- Choisir une {type === 'Gemba' ? 'ligne' : 'zone'} --</option>
            {availableLines.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      </div>

      <div className="card">
        {!selectedLigne ? (
          <div className="muted" style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            Veuillez sélectionner une {type === 'Gemba' ? 'ligne' : 'zone'} pour voir l'historique.
          </div>
        ) : historique.length === 0 ? (
          <div className="muted" style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            Aucun audit trouvé pour cette sélection.
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date de l'audit</th>
                  <th>Résultat (Score)</th>
                  <th>Niveau de performance</th>
                </tr>
              </thead>
              <tbody>
                {historique.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ textTransform: 'capitalize' }}>{item.label}</td>
                    <td>
                      <span style={{ 
                        fontSize: '1.2rem', 
                        fontWeight: 'bold', 
                        color: getColor(item.score) 
                      }}>
                        {item.score} %
                      </span>
                    </td>
                    <td>
                      <span className="badge" style={{ 
                        background: item.score >= 90 ? 'rgba(16, 185, 129, 0.2)' : item.score >= 80 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                        color: getColor(item.score)
                      }}>
                        {item.score >= 90 ? 'Excellent' : item.score >= 80 ? 'Moyen' : 'Critique'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
