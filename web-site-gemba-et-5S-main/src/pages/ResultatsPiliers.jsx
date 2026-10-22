import { useState, useMemo } from 'react'
import { 
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, 
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, LabelList 
} from 'recharts'
import { getMonthKey, getWeekKey, formatMonthLabel, formatWeekLabel } from '../utils/dateHelpers'

// Découpage des 26 questions en 5 piliers (Index de 0 à 25)
const PILLARS_CONFIG = [
  { name: '1. Seiri (Trier)', range: [0, 3], color: '#3b82f6' },           // Q1 à Q4
  { name: '2. Seiton (Ranger)', range: [4, 8], color: '#10b981' },         // Q5 à Q9
  { name: '3. Seiso (Nettoyer)', range: [9, 14], color: '#f59e0b' },       // Q10 à Q15
  { name: '4. Seiketsu (Standardiser)', range: [15, 21], color: '#8b5cf6' }, // Q16 à Q22
  { name: '5. Shitsuke (Respecter)', range: [22, 25], color: '#ec4899' }     // Q23 à Q26
]

const axisStyle = { fontSize: 12, fill: '#94a3b8' }
const getColor = (score) => score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444'

export default function ResultatsPiliers({ audits }) {
  const [filters, setFilters] = useState({ month: '', week: '' })

  const months = useMemo(() => [...new Set(audits.map(a => getMonthKey(a.date)).filter(Boolean))].sort().reverse(), [audits])
  const weeks = useMemo(() => [...new Set(audits.map(a => getWeekKey(a.date)).filter(Boolean))].sort().reverse(), [audits])

  const filteredAudits = useMemo(() => audits.filter(a => {
    if (filters.month && getMonthKey(a.date) !== filters.month) return false
    if (filters.week && getWeekKey(a.date) !== filters.week) return false
    return true
  }), [audits, filters])

  // Calcul des scores par pilier
  const pillarData = useMemo(() => {
    return PILLARS_CONFIG.map(pillar => {
      let totalOk = 0
      let totalEvaluated = 0
      
      filteredAudits.forEach(audit => {
        const cps = audit.checkpoints || []
        // On boucle sur les questions du pilier
        for (let i = pillar.range[0]; i <= pillar.range[1]; i++) {
          const cp = cps[i]
          if (cp && cp.s) {
            const status = String(cp.s).toUpperCase()
            if (status === 'OK') totalOk++
            if (status === 'OK' || status === 'NOK') totalEvaluated++
          }
        }
      })

      const score = totalEvaluated > 0 ? Math.round((totalOk / totalEvaluated) * 100) : 0
      return { 
        subject: pillar.name.split('. ')[1], // On garde juste le nom (ex: "Seiri (Trier)")
        fullName: pillar.name,
        score,
        color: pillar.color
      }
    })
  }, [filteredAudits])

  // Calcul du score global
  const globalScore = useMemo(() => {
    if (pillarData.length === 0) return 0
    return Math.round(pillarData.reduce((acc, p) => acc + p.score, 0) / pillarData.length)
  }, [pillarData])

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Résultats par Axe (5 Piliers)</h1>
      </div>

      {/* Filtres */}
      <div className="card" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Filtrer par Mois</label>
          <select className="filter-control" value={filters.month} onChange={e => setFilters({ month: e.target.value, week: '' })}>
            <option value="">Tous les mois</option>
            {months.map(m => <option key={m} value={m}>{formatMonthLabel(m)}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Filtrer par Semaine</label>
          <select className="filter-control" value={filters.week} onChange={e => setFilters({ month: '', week: e.target.value })}>
            <option value="">Toutes les semaines</option>
            {weeks.map(w => <option key={w} value={w}>{formatWeekLabel(w)}</option>)}
          </select>
        </div>
        <button className="btn btn-secondary" onClick={() => setFilters({ month: '', week: '' })}>
          Réinitialiser
        </button>
      </div>

      <div className="grid-2">
        {/* RADAR CHART */}
        <div className="card">
          <h2 className="card-title" style={{ textAlign: 'center' }}>Équilibre Global (Radar)</h2>
          <p className="muted" style={{ textAlign: 'center', marginTop: '-1rem', marginBottom: '2rem', fontSize: '0.875rem' }}>
            Score moyen global : <strong style={{ color: getColor(globalScore), fontSize: '1.2rem' }}>{globalScore}%</strong>
          </p>
          <div style={{ height: 350 }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={pillarData}>
                <PolarGrid stroke="#334155" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#f8fafc', fontSize: 13, fontWeight: 600 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Tooltip 
                  contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#fff' }} 
                  formatter={(v) => [`${v} %`, 'Score']} 
                />
                <Radar name="Score" dataKey="score" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* BAR CHART */}
        <div className="card">
          <h2 className="card-title" style={{ textAlign: 'center' }}>Détail par Pilier (Barres)</h2>
          <div style={{ height: 350, marginTop: '2rem' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pillarData} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" />
                <XAxis type="number" domain={[0, 100]} tick={axisStyle} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="subject" tick={{ fill: '#f8fafc', fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} width={130} />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#fff' }} 
                  formatter={(v) => [`${v} %`, 'Score']} 
                />
                <Bar dataKey="score" radius={[0, 6, 6, 0]} barSize={30}>
                  {pillarData.map((entry, index) => (
                    <Cell key={index} fill={getColor(entry.score)} />
                  ))}
                  <LabelList dataKey="score" position="right" fill="#f8fafc" formatter={(v) => `${v}%`} fontSize={13} fontWeight="bold" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
