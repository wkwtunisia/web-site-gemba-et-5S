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

const getStandard5M = (point_m) => {
  if (!point_m) return null
  const clean = String(point_m).trim().toLowerCase()
  if (clean.includes("main d'œuvre") || clean.includes("main d'oeuvre") || clean.includes("main d'oeuvre")) return "Main d'œuvre"
  if (clean.includes('matière') || clean.includes('matiere')) return 'Matière'
  if (clean.includes('méthode') || clean.includes('methode')) return 'Méthode'
  if (clean.includes('milieu')) return 'Milieu'
  if (clean.includes('maintenance')) return 'Maintenance'
  return null;
}

const fetchAllGemba = async () => {
  let allData = []; let from = 0; const step = 1000; let hasMore = true
  while (hasMore) {
    const { data, error } = await supabase.from('gemba_audits').select('*').order('date', { ascending: false }).range(from, from + step - 1)
    if (error) { console.error(error); break }
    if (data.length === 0) { hasMore = false } else { allData = [...allData, ...data]; from += step }
  }
  return allData
}

export default function GembaAnalyse() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [weekFilter, setWeekFilter] = useState('')

  useEffect(() => { fetchAllGemba().then(res => { setData(res || []); setLoading(false); }) }, [])

  const availableWeeks = useMemo(() => {
    const set = new Set(); data.forEach(a => { const w = getWeekNumber(a.date, a.semaine); if (w) set.add(w); }); return Array.from(set).sort()
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

  // 🌟 FONCTION DE FILTRE POUR IGNORER LES NOMS DES PILIERS
  const isValidProblem = (q) => {
    if (!q) return false;
    const clean = String(q).trim().toUpperCase();
    // On ignore les questions qui sont juste le nom du pilier
    const isGeneric = ['MILIEU', 'MATIÈRE', 'MATIERE', 'MÉTHODE', 'METHODE', 'MAINTENANCE', "MAIN D'OEUVRE", "MAIN D'ŒUVRE"].includes(clean);
    return !isGeneric;
  };

  const topNok = useMemo(() => {
    const nokCount = {}
    filteredData.forEach(row => { 
      if (String(row.reponse).toUpperCase() === 'NOK' && isValidProblem(row.question)) {
        nokCount[row.question] = (nokCount[row.question] || 0) + 1 
      }
    })
    return Object.entries(nokCount).map(([q, count]) => ({ q, count })).sort((a, b) => b.count - a.count).slice(0, 5)
  }, [filteredData])

  const topOk = useMemo(() => {
    const okCount = {}
    filteredData.forEach(row => { 
      if (String(row.reponse).toUpperCase() === 'OK' && isValidProblem(row.question)) {
        okCount[row.question] = (okCount[row.question] || 0) + 1 
      }
    })
    return Object.entries(okCount).map(([q, count]) => ({ q, count })).sort((a, b) => b.count - a.count).slice(0, 5)
  }, [filteredData])

  const pillarStats = useMemo(() => {
    const groups = {}
    filteredData.forEach(row => {
      const rep = String(row.reponse).toUpperCase()
      if (rep === 'N/A') return
      
      const pilier = getStandard5M(row.point_m)
      if (!pilier) return 

      if (!groups[pilier]) groups[pilier] = { ok: 0, total: 0 }
      groups[pilier].total++
      if (rep === 'OK') groups[pilier].ok++
    })
    
    return Object.entries(groups).map(([name, s]) => ({ 
      name, 
      score: s.total > 0 ? Math.round((s.ok / s.total) * 100) : 0 
    })).sort((a, b) => b.score - a.score)
  }, [filteredData])

  const bestPillar = pillarStats[0] || { name: '-', score: 0 }
  const worstPillar = pillarStats[pillarStats.length - 1] || { name: '-', score: 0 }

  if (loading) return <p className="muted" style={{ padding: '2rem' }}>Chargement…</p>

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: '1.5rem', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Analyse & Priorités Gemba</h1>
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="card" style={{ borderLeft: '4px solid var(--success)', background: 'linear-gradient(90deg, rgba(16,185,129,0.1) 0%, var(--bg-card) 100%)' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--success)', fontSize: '1rem' }}>🛡️ Pilier à maintenir (M)</h3>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)' }}>{bestPillar.name}</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--success)' }}>{bestPillar.score}%</div>
        </div>
        <div className="card" style={{ borderLeft: '4px solid var(--danger)', background: 'linear-gradient(90deg, rgba(239,68,68,0.1) 0%, var(--bg-card) 100%)' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--danger)', fontSize: '1rem' }}>🚨 Pilier à améliorer (M)</h3>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)' }}>{worstPillar.name}</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--danger)' }}>{worstPillar.score}%</div>
        </div>
      </div>
      <div className="grid-2">
        <div className="card">
          <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.1rem', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span>⚠️</span> Top 5 des vrais problèmes (NOK)</h3>
          <ul className="top-list">
            {topNok.length === 0 ? <p className="muted">Aucun problème spécifique détecté.</p> : topNok.map((item, i) => (
              <li key={i} style={{ background: 'var(--bg-main)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}><span style={{ fontWeight: 'bold', color: 'var(--danger)' }}>Problème #{i + 1}</span><span className="badge bad">{item.count} NOK</span></div>
                <div style={{ fontSize: '0.875rem', whiteSpace: 'normal' }}>{item.q}</div>
              </li>
            ))}
          </ul>
        </div>
        <div className="card">
          <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.1rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span>🌟</span> Top 5 des points forts (OK)</h3>
          <ul className="top-list">
            {topOk.length === 0 ? <p className="muted">Aucune donnée.</p> : topOk.map((item, i) => (
              <li key={i} style={{ background: 'var(--bg-main)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}><span style={{ fontWeight: 'bold', color: 'var(--success)' }}>Point fort #{i + 1}</span><span className="badge ok">{item.count} OK</span></div>
                <div style={{ fontSize: '0.875rem', whiteSpace: 'normal' }}>{item.q}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
