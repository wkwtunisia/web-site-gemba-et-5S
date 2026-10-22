import { useState, useMemo } from 'react'
import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, CartesianGrid, LabelList } from 'recharts'
import { getMonthKey, getWeekKey, formatMonthLabel, formatWeekLabel } from '../utils/dateHelpers'

import { getScoreColor } from '../utils/colors'
const getColor = getScoreColor
const axisStyle = { fontSize: 12, fill: '#94a3b8' }

export default function ResultatsLigne({ audits }) {
  const [filters, setFilters] = useState({ month: '', week: '' })

  const months = useMemo(() => [...new Set(audits.map(a => getMonthKey(a.date)).filter(Boolean))].sort().reverse(), [audits])
  const weeks = useMemo(() => [...new Set(audits.map(a => getWeekKey(a.date)).filter(Boolean))].sort().reverse(), [audits])

  // Filtrage
  const filteredAudits = useMemo(() => audits.filter(a => {
    if (filters.month && getMonthKey(a.date) !== filters.month) return false
    if (filters.week && getWeekKey(a.date) !== filters.week) return false
    return true
  }), [audits, filters])

  // Calcul des scores par ligne
  const lineScores = useMemo(() => {
    const scores = {}
    filteredAudits.forEach(a => {
      if (!a.zone) return
      if (!scores[a.zone]) scores[a.zone] = { sum: 0, count: 0 }
      scores[a.zone].sum += Number(a.score_pct)
      scores[a.zone].count++
    })

    return Object.entries(scores)
      .map(([zone, data]) => ({
        zone,
        score: Number((data.sum / data.count).toFixed(1))
      }))
      .sort((a, b) => b.score - a.score) // Tri du meilleur au moins bon
  }, [filteredAudits])

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Résultats par Ligne</h1>
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

      {/* Graphique en barres */}
      <div className="card">
        <h2 className="card-title" style={{ marginBottom: '2rem' }}>Score Moyen par Ligne / Zone</h2>
        
        {lineScores.length === 0 ? (
          <div className="muted" style={{ padding: '2rem', textAlign: 'center' }}>Aucune donnée pour cette période.</div>
        ) : (
          <div style={{ height: 500 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={lineScores} margin={{ top: 30, right: 30, left: 0, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis 
                  dataKey="zone" 
                  tick={axisStyle} 
                  axisLine={false} 
                  tickLine={false} 
                  angle={-45} 
                  textAnchor="end"
                  interval={0} 
                />
                <YAxis domain={[0, 100]} tick={axisStyle} axisLine={false} tickLine={false} />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#fff' }} 
                  formatter={(v) => [`${v} %`, 'Score Moyen']} 
                />
                <Bar dataKey="score" radius={[6, 6, 0, 0]} maxBarSize={60}>
                  {lineScores.map((entry, index) => (
                    <Cell key={index} fill={getColor(entry.score)} />
                  ))}
                  <LabelList dataKey="score" position="top" fill="#f8fafc" formatter={(v) => `${v}%`} fontSize={12} fontWeight="bold" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
