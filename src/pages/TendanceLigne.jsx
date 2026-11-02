import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { fetchAllGembaData } from '../services/gembaApi'
import { getGembaGroupedData, get5SGroupedData } from '../utils/stats'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, LabelList } from 'recharts'

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

const getWeekNumber = (dateStr, rawSemaine) => {
  if (rawSemaine !== undefined && rawSemaine !== null && rawSemaine !== '') return `S${String(rawSemaine).padStart(2, '0')}`
  const dateOnly = extractDateString(dateStr);
  if (!dateOnly) return null;
  const d = new Date(`${dateOnly}T12:00:00`);
  if (isNaN(d.getTime())) return null;
  const target = new Date(d.valueOf()); const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3); const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  return `S${String(1 + Math.ceil((firstThursday - target) / 604800000)).padStart(2, '0')}`;
}

const normalizeLigne = (str) => String(str || '').trim().toUpperCase().replace(/\s+/g, '')

export default function TendanceLigne() {
  const [type, setType] = useState('5S')
  const [dataGemba, setDataGemba] = useState([])
  const [data5S, setData5S] = useState([])
  const [loading, setLoading] = useState(true)

  const [selectedLigne, setSelectedLigne] = useState('')
  const [selectedWeek, setSelectedWeek] = useState('')

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

  const availableWeeks = useMemo(() => {
    const set = new Set()
    const source = type === 'Gemba' ? dataGemba : data5S
    source.forEach(d => {
      const w = getWeekNumber(d.date, d.semaine)
      if (w) set.add(w)
    })
    return Array.from(set).sort()
  }, [type, dataGemba, data5S])

  const chartData = useMemo(() => {
    if (!selectedLigne) return []
    
    const source = type === 'Gemba' ? dataGemba : data5S
    const targetLine = normalizeLigne(selectedLigne)

    // 1. Filtrer par ligne et semaine
    const filtered = source.filter(row => {
      const rowLigne = normalizeLigne(type === 'Gemba' ? row.ligne : row.zone)
      if (rowLigne !== targetLine) return false
      
      if (selectedWeek) {
        const w = getWeekNumber(row.date, row.semaine)
        if (w !== selectedWeek) return false
      }
      return true
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

    // 3. Calculer le score par date via les fonctions standardisées
    const result = []
    Object.entries(byDate).forEach(([dateStr, rows]) => {
      let score = 0
      if (type === 'Gemba') {
        const grouped = getGembaGroupedData(rows)
        if (grouped.length > 0) {
          score = Math.round(grouped.reduce((sum, g) => sum + g.score, 0) / grouped.length)
        }
      } else {
        const grouped = get5SGroupedData(rows)
        if (grouped.length > 0) {
          score = Math.round(grouped.reduce((sum, g) => sum + g.computedScore, 0) / grouped.length)
        }
      }
      
      result.push({
        date: dateStr,
        label: new Date(`${dateStr}T12:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
        score: score
      })
    })

    return result.sort((a, b) => a.date.localeCompare(b.date))
  }, [type, selectedLigne, selectedWeek, dataGemba, data5S])

  const CustomLabel = (props) => {
    const { x, y, value } = props; if (value === null || value === undefined) return null
    return <text x={x} y={y - 12} fill="#f8fafc" fontSize={11} fontWeight="bold" textAnchor="middle">{value}%</text>
  }

  if (loading) return <p className="muted" style={{ padding: '2rem' }}>Chargement des données…</p>

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: '1.5rem', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>📈 Tendance par ligne</h1>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Type :</label>
            <select className="filter-control" value={type} onChange={e => { setType(e.target.value); setSelectedLigne(''); setSelectedWeek(''); }}>
              <option value="5S">5S</option>
              <option value="Gemba">Gemba</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Semaine :</label>
            <select className="filter-control" value={selectedWeek} onChange={e => setSelectedWeek(e.target.value)}>
              <option value="">Toutes</option>
              {availableWeeks.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Ligne :</label>
            <select className="filter-control" value={selectedLigne} onChange={e => setSelectedLigne(e.target.value)}>
              <option value="">-- Choisir --</option>
              {availableLines.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        {!selectedLigne ? (
          <div className="muted" style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            Veuillez sélectionner une ligne pour voir son évolution.
          </div>
        ) : chartData.length === 0 ? (
          <div className="muted" style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            Aucune donnée pour cette sélection.
          </div>
        ) : (
          <div style={{ height: 400 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 30, right: 30, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} dy={10} />
                <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#fff' }} formatter={(v) => [`${v}%`, 'Score']} />
                <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={3} dot={{ r: 6, fill: '#3b82f6', stroke: '#1e293b', strokeWidth: 2 }} activeDot={{ r: 8 }}>
                  <LabelList content={<CustomLabel />} />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
