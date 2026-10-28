import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { 
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, 
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, LabelList 
} from 'recharts'

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

const getColorGemba = (score) => score >= 90 ? '#10b981' : score >= 85 ? '#f59e0b' : '#ef4444'

const getStandard5M = (point_m) => {
  if (!point_m) return 'Autres'
  const clean = String(point_m).trim().toLowerCase()
  if (clean.includes("main d'œuvre") || clean.includes("main d'oeuvre") || clean.includes("main d'oeuvre")) return "Main d'œuvre"
  if (clean.includes('matière') || clean.includes('matiere')) return 'Matière'
  if (clean.includes('méthode') || clean.includes('methode')) return 'Méthode'
  if (clean.includes('milieu')) return 'Milieu'
  if (clean.includes('maintenance')) return 'Maintenance'
  return 'Autres'
}

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

export default function GembaPiliers() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState(null)

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [weekFilter, setWeekFilter] = useState('')

  useEffect(() => {
    fetchAllGemba()
      .then(res => {
        setData(res || [])
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setErrorMsg("Erreur de chargement des données : " + err.message)
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
      const dStr = extractDateString(row.date)
      if (!dStr) return false
      if (startDate && dStr < startDate) return false
      if (endDate && dStr > endDate) return false
      if (weekFilter && getWeekNumber(row.date, row.semaine) !== weekFilter) return false
      return true
    })
  }, [data, startDate, endDate, weekFilter])

  const pilierScores = useMemo(() => {
    const groups = {
      'Milieu': { ok: 0, total: 0 },
      'Maintenance': { ok: 0, total: 0 },
      'Méthode': { ok: 0, total: 0 },
      "Main d'œuvre": { ok: 0, total: 0 },
      'Matière': { ok: 0, total: 0 }
    }

    filteredData.forEach(row => {
      const rep = String(row.reponse || '').toUpperCase()
      if (rep === 'N/A') return

      const pilier = getStandard5M(row.point_m)
      if (pilier && groups[pilier]) {
        groups[pilier].total++
        if (rep === 'OK') groups[pilier].ok++
      }
    })

    const order = ['Milieu', 'Maintenance', 'Méthode', "Main d'œuvre", 'Matière']
    
    return order.map(name => {
      const stats = groups[name]
      const score = stats.total > 0 ? Math.round((stats.ok / stats.total) * 100) : 0
      return { name: name, score: isNaN(score) ? 0 : score }
    })
  }, [filteredData])

  const radarData = useMemo(() => {
    return pilierScores.map(p => ({ subject: p.name, A: p.score, fullMark: 100 }))
  }, [pilierScores])

  if (loading) return <p className="muted" style={{ padding: '2rem' }}>Chargement…</p>
  if (errorMsg) return <div className="card" style={{ padding: '2rem', color: '#ef4444' }}>{errorMsg}</div>

  // Filet de sécurité (Error Boundary) pour Recharts
  try {
    return (
      <div>
        <div className="flex-between" style={{ marginBottom: '1.5rem', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <h1 style={{ fontSize: '1.5rem', margin: 0 }}>🧭 Résultats par M (Gemba)</h1>
          
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          
          <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#f8fafc', margin: '0 0 1.5rem 0' }}>
              Équilibre Global (Radar 5M)
            </h2>
            <div style={{ height: 350, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                  <PolarGrid stroke="#334155" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 'bold' }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <Radar name="Score" dataKey="A" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.5} />
                  <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#fff' }} formatter={(value) => [`${value}%`, 'Score']} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card" style={{ padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#f8fafc', margin: '0 0 1.5rem 0' }}>
              Détail par Pilier (Barres)
            </h2>
            <div style={{ height: 350, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pilierScores} margin={{ top: 30, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11, fill: '#f8fafc', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                  <YAxis type="number" domain={[0, 100]} unit="%" stroke="#94a3b8" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: 'white' }} formatter={(value) => [`${value}%`, 'Score moyen']} />
                  <Bar dataKey="score" radius={[4, 4, 0, 0]} maxBarSize={60}>
                    {pilierScores.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getColorGemba(entry.score)} />
                    ))}
                    <LabelList dataKey="score" position="top" formatter={(val) => `${val}%`} fill="#f8fafc" fontSize={12} fontWeight="bold" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    )
  } catch (err) {
    return (
      <div className="card" style={{ padding: '2rem', color: '#ef4444' }}>
        <h2>⚠️ Erreur d'affichage des graphiques</h2>
        <p>{err.message}</p>
      </div>
    )
  }
}
