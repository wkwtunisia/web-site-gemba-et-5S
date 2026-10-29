import { useState, useEffect, useMemo } from 'react'
import { fetchAllGembaData } from '../services/gembaApi'
import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, CartesianGrid, LabelList } from 'recharts'

const getColor = (score) => score >= 90 ? '#10b981' : score >= 85 ? '#f59e0b' : '#ef4444'

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
  if (rawSemaine !== undefined && rawSemaine !== null && rawSemaine !== '') {
    return `S${String(rawSemaine).padStart(2, '0')}`
  }
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

export default function GembaResultatsLigne() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [weekFilter, setWeekFilter] = useState('')

  useEffect(() => {
    fetchAllGembaData().then(res => {
      setData(res || [])
      setLoading(false)
    })
  }, [])

  const availableWeeks = useMemo(() => {
    const set = new Set()
    data.forEach(a => { const w = getWeekNumber(a.date, a.semaine); if (w) set.add(w) })
    return Array.from(set).sort()
  }, [data])

  const filteredData = useMemo(() => {
    return data.filter(row => {
      const dStr = extractDateString(row.date); if (!dStr) return false
      if (startDate && dStr < startDate) return false
      if (endDate && dStr > endDate) return false
      if (weekFilter && getWeekNumber(row.date, row.semaine) !== weekFilter) return false
      return true
    })
  }, [data, startDate, endDate, weekFilter])

  const lineStats = useMemo(() => {
    const groups = {}
    
    filteredData.forEach(row => {
      const ligne = row.ligne?.trim()
      if (!ligne) return

      if (!groups[ligne]) {
        groups[ligne] = { ok: 0, total: 0 }
      }

      if (row.is_manual) {
        // Pour les données manuelles, on ajoute le score et on compte comme 100
        groups[ligne].ok += Number(row.score_pct)
        groups[ligne].total += 100
      } else {
        // Pour les vrais audits, on compte les OK et les NOK
        const rep = String(row.reponse).toUpperCase()
        if (rep !== 'N/A') {
          groups[ligne].total++
          if (rep === 'OK') groups[ligne].ok++
        }
      }
    })

    return Object.entries(groups)
      .map(([ligne, s]) => ({ 
        ligne, 
        score: s.total > 0 ? Math.round((s.ok / s.total) * 100) : 0 
      }))
      .sort((a, b) => b.score - a.score)
  }, [filteredData])

  if (loading) return <p className="muted" style={{ padding: '2rem' }}>Chargement…</p>

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: '1.5rem', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>📍 Résultats par Ligne (Gemba)</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--surface)', padding: '0.4rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}><label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Du</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ background: 'transparent', color: 'var(--text-main)', border: 'none', outline: 'none', fontSize: '0.85rem' }} /></div>
            <div style={{ display: 'flex', flexDirection: 'column' }}><label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Au</label><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ background: 'transparent', color: 'var(--text-main)', border: 'none', outline: 'none', fontSize: '0.85rem' }} /></div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Semaine</label>
            <select className="filter-control" value={weekFilter} onChange={e => setWeekFilter(e.target.value)}>
              <option value="">Toutes</option>{availableWeeks.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>
          <button className="btn btn-secondary" onClick={() => { setStartDate(''); setEndDate(''); setWeekFilter(''); }} style={{ height: '36px', marginTop: 'auto' }}>Réinitialiser</button>
        </div>
      </div>

      <div className="card">
        <div style={{ height: 500 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={lineStats} margin={{ top: 30, right: 30, left: 0, bottom: 50 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
              <XAxis dataKey="ligne" tick={{ fill: '#94a3b8' }} angle={-45} textAnchor="end" />
              <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8' }} />
              <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#fff' }} formatter={(v) => [`${v}%`, 'Score']} />
              <Bar dataKey="score" radius={[6, 6, 0, 0]} maxBarSize={60}>
                {lineStats.map((entry, index) => <Cell key={index} fill={getColor(entry.score)} />)}
                <LabelList dataKey="score" position="top" fill="#f8fafc" formatter={(v) => `${v}%`} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
