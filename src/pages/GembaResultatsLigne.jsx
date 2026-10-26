import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, LabelList } from 'recharts'

const extractDateString = (dateStr) => {
  if (!dateStr) return null;
  const str = String(dateStr).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.substring(0, 10);
  if (/^\d{2}\/\d{2}\/\d{4}/.test(str)) {
    const parts = str.split('/');
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  const months = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
  const match = str.match(/^(\d{1,2})[-\s]([a-zA-Z]{3})[-\s](\d{4})/);
  if (match) {
    const month = months[match[2].toLowerCase()];
    if (month) return `${match[3]}-${month}-${String(match[1]).padStart(2, '0')}`;
  }
  return null;
}

const getWeekNumber = (dateStr) => {
  const dateOnly = extractDateString(dateStr);
  if (!dateOnly) return null;
  const d = new Date(`${dateOnly}T12:00:00`);
  if (isNaN(d.getTime())) return null;
  
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3); 
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  const weekNum = 1 + Math.ceil((firstThursday - target) / 604800000);
  return `S${String(weekNum).padStart(2, '0')}`;
}

const getColorGemba = (score) => score >= 90 ? '#10b981' : score >= 85 ? '#f59e0b' : '#ef4444'

const fetchAllGemba = async () => {
  let allData = []
  let from = 0
  const step = 1000
  let hasMore = true
  while (hasMore) {
    const { data, error } = await supabase.from('gemba_audits').select('*').order('date', { ascending: false }).range(from, from + step - 1)
    if (error) { console.error(error); break }
    if (data.length === 0) { hasMore = false } else { allData = [...allData, ...data]; from += step }
  }
  return allData
}

export default function GembaResultatsLigne() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [weekFilter, setWeekFilter] = useState('')

  useEffect(() => {
    fetchAllGemba().then(res => {
      setData(res || [])
      setLoading(false)
    })
  }, [])

  const availableWeeks = useMemo(() => {
    const set = new Set()
    data.forEach(a => {
      const w = getWeekNumber(a.date)
      if (w) set.add(w)
    })
    return Array.from(set).sort()
  }, [data])

  const filteredData = useMemo(() => {
    return data.filter(row => {
      const dStr = extractDateString(row.date)
      if (!dStr) return false
      if (startDate && dStr < startDate) return false
      if (endDate && dStr > endDate) return false
      if (weekFilter && getWeekNumber(row.date) !== weekFilter) return false
      return true
    })
  }, [data, startDate, endDate, weekFilter])

  const lineScores = useMemo(() => {
    const auditGroups = {}
    filteredData.forEach(row => {
      const date = extractDateString(row.date)
      const ligne = row.ligne?.trim()
      if (!date || !ligne) return

      const key = `${date}|${ligne}`
      if (!auditGroups[key]) auditGroups[key] = { date, ligne, ok: 0, total: 0 }
      
      if (String(row.reponse).toUpperCase() !== 'N/A') {
        auditGroups[key].total++
        if (String(row.reponse).toUpperCase() === 'OK') auditGroups[key].ok++
      }
    })

    const audits = Object.values(auditGroups).map(a => ({
      ...a,
      score: a.total > 0 ? Math.round((a.ok / a.total) * 100) : 0
    }))

    const lineStats = {}
    audits.forEach(a => {
      if (!lineStats[a.ligne]) lineStats[a.ligne] = { sum: 0, count: 0 }
      lineStats[a.ligne].sum += a.score
      lineStats[a.ligne].count++
    })

    return Object.entries(lineStats).map(([ligne, stats]) => ({
      name: ligne,
      score: Math.round(stats.sum / stats.count)
    })).sort((a, b) => b.score - a.score)
  }, [filteredData])

  if (loading) return <p className="muted" style={{ padding: '2rem' }}>Chargement…</p>

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: '1.5rem', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>📍 Résultats par Ligne (Gemba)</h1>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--surface)', padding: '0.4rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Du</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ background: 'transparent', color: 'var(--text-main)', border: 'none', outline: 'none', fontSize: '0.85rem' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Au</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ background: 'transparent', color: 'var(--text-main)', border: 'none', outline: 'none', fontSize: '0.85rem' }} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Filtrer par Semaine</label>
            <select className="filter-control" value={weekFilter} onChange={e => setWeekFilter(e.target.value)}>
              <option value="">Toutes les semaines</option>
              {availableWeeks.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>

          <button className="btn btn-secondary" onClick={() => { setStartDate(''); setEndDate(''); setWeekFilter(''); }} style={{ height: '36px', marginTop: 'auto' }}>
            Réinitialiser
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#f8fafc', margin: '0 0 1.5rem 0' }}>
          Score moyen par ligne
        </h2>
        
        {lineScores.length === 0 ? (
          <div className="muted" style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            Aucune donnée pour cette période.
          </div>
        ) : (
          <div style={{ height: 400, width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              {/* 🌟 GRAPHIQUE VERTICAL (Barres qui montent) */}
              <BarChart data={lineScores} margin={{ top: 30, right: 10, left: -20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                {/* Axe X : les noms des lignes (inclinés pour ne pas se chevaucher) */}
                <XAxis 
                  dataKey="name" 
                  stroke="#94a3b8" 
                  tick={{ fontSize: 11, fill: '#f8fafc', fontWeight: 'bold' }} 
                  axisLine={false} 
                  tickLine={false} 
                  angle={-45} 
                  textAnchor="end" 
                  height={60} 
                />
                {/* Axe Y : les pourcentages */}
                <YAxis 
                  type="number" 
                  domain={[0, 100]} 
                  unit="%" 
                  stroke="#94a3b8" 
                  tick={{ fontSize: 12, fill: '#94a3b8' }} 
                  axisLine={false} 
                  tickLine={false} 
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: 'white' }}
                  formatter={(value) => [`${value}%`, 'Score moyen']}
                />
                <Bar dataKey="score" radius={[4, 4, 0, 0]} maxBarSize={50}>
                  {lineScores.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getColorGemba(entry.score)} />
                  ))}
                  <LabelList dataKey="score" position="top" formatter={(val) => `${val}%`} fill="#f8fafc" fontSize={12} fontWeight="bold" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
