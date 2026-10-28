import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabaseClient'

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

const formatMonthLabel = (monthStr) => {
  if (!monthStr) return ''
  const [year, month] = monthStr.split('-')
  const date = new Date(Number(year), Number(month) - 1, 1)
  return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

export default function Top3Lignes() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [monthFilter, setMonthFilter] = useState('')
  const [weekFilter, setWeekFilter] = useState('')

  useEffect(() => {
    supabase.from('audits').select('*').order('date', { ascending: false }).then(({ data, error }) => {
      if (!error) setData(data || [])
      setLoading(false)
    })
  }, [])

  const getMonthKey = (dateStr) => dateStr ? String(dateStr).substring(0, 7) : null
  
  const months = useMemo(() => [...new Set(data.map(d => getMonthKey(d.date)).filter(Boolean))].sort().reverse(), [data])
  
  const weeks = useMemo(() => {
    const filteredByMonth = monthFilter ? data.filter(d => getMonthKey(d.date) === monthFilter) : data
    const uniqueWeeks = [...new Set(filteredByMonth.map(d => getWeekNumber(d.date, d.semaine)).filter(Boolean))]
    return uniqueWeeks.sort()
  }, [data, monthFilter])

  const filteredData = useMemo(() => {
    let result = data
    if (monthFilter) result = result.filter(d => getMonthKey(d.date) === monthFilter)
    if (weekFilter) result = result.filter(d => getWeekNumber(d.date, d.semaine) === weekFilter)
    return result
  }, [data, monthFilter, weekFilter])

  const lineStats = useMemo(() => {
    const groups = {}
    filteredData.forEach(audit => {
      const zone = audit.zone || audit.ligne || 'Inconnue'
      if (!groups[zone]) groups[zone] = { totalPoints: 0, maxPoints: 0, count: 0 }
      
      groups[zone].totalPoints += Number(audit.total_points) || 0
      groups[zone].maxPoints += Number(audit.max_points) || 0
      groups[zone].count++
    })

    return Object.entries(groups).map(([zone, s]) => ({
      zone,
      score: s.maxPoints > 0 ? Math.round((s.totalPoints / s.maxPoints) * 100) : 0
    })).sort((a, b) => b.score - a.score)
  }, [filteredData])

  if (loading) return <p className="muted" style={{ padding: '2rem' }}>Chargement…</p>

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: '1.5rem', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>🏆 Top & Bottom 3 Lignes (5S)</h1>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="filter-control" value={monthFilter} onChange={e => { setMonthFilter(e.target.value); setWeekFilter('') }}>
            <option value="">Tous les mois</option>
            {months.map(m => <option key={m} value={m}>{formatMonthLabel(m)}</option>)}
          </select>
          <select className="filter-control" value={weekFilter} onChange={e => setWeekFilter(e.target.value)}>
            <option value="">Toutes les semaines</option>
            {weeks.map(w => <option key={w} value={w}>Semaine {w}</option>)}
          </select>
          <button className="btn btn-secondary" onClick={() => { setMonthFilter(''); setWeekFilter('') }}>
            Réinitialiser
          </button>
        </div>
      </div>

      <div className="grid-2">
        <div className="card" style={{ borderTop: '4px solid var(--success)', background: 'linear-gradient(180deg, rgba(16,185,129,0.05) 0%, var(--bg-card) 100%)' }}>
          <h3 className="card-title" style={{ color: 'var(--success)', fontSize: '1.2rem', marginBottom: '1.5rem' }}>🏆 Top 3 Meilleures Lignes</h3>
          <ul className="top-list">
            {lineStats.slice(0, 3).map((item, i) => (
              <li key={item.zone} style={{ padding: '1rem', background: 'var(--bg-main)', borderRadius: 8, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '1.1rem' }}><strong>#{i+1}</strong> {item.zone}</span>
                <span style={{ color: 'var(--success)', fontWeight: 'bold', fontSize: '1.2rem' }}>{item.score}%</span>
              </li>
            ))}
            {lineStats.length === 0 && <p className="muted">Aucune donnée pour cette période.</p>}
          </ul>
        </div>

        <div className="card" style={{ borderTop: '4px solid var(--danger)', background: 'linear-gradient(180deg, rgba(239,68,68,0.05) 0%, var(--bg-card) 100%)' }}>
          <h3 className="card-title" style={{ color: 'var(--danger)', fontSize: '1.2rem', marginBottom: '1.5rem' }}>⚠️ Bottom 3 Lignes à améliorer</h3>
          <ul className="top-list">
            {[...lineStats].reverse().slice(0, 3).map((item, i) => (
              <li key={item.zone} style={{ padding: '1rem', background: 'var(--bg-main)', borderRadius: 8, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '1.1rem' }}><strong>#{i+1}</strong> {item.zone}</span>
                <span style={{ color: 'var(--danger)', fontWeight: 'bold', fontSize: '1.2rem' }}>{item.score}%</span>
              </li>
            ))}
            {lineStats.length === 0 && <p className="muted">Aucune donnée pour cette période.</p>}
          </ul>
        </div>
      </div>
    </div>
  )
}
