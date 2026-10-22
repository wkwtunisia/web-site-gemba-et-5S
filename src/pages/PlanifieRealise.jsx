import { useState, useMemo } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, LabelList } from 'recharts'
import { getWeekKey, getMonthKey, formatWeekLabel, formatMonthLabel } from '../utils/dateHelpers'

const OBJECTIF_SEMAINE = 5 // Objectif par défaut
const axisStyle = { fontSize: 12, fill: '#94a3b8' }

export default function PlanifieRealise({ audits }) {
  const [filters, setFilters] = useState({ month: '', week: '' })

  // Génération des listes de filtres
  const months = useMemo(() => [...new Set(audits.map(a => getMonthKey(a.date)).filter(Boolean))].sort().reverse(), [audits])
  const weeks = useMemo(() => [...new Set(audits.map(a => getWeekKey(a.date)).filter(Boolean))].sort().reverse(), [audits])

  // Filtrage des données
  const filteredAudits = useMemo(() => audits.filter(a => {
    if (filters.month && getMonthKey(a.date) !== filters.month) return false
    if (filters.week && getWeekKey(a.date) !== filters.week) return false
    return true
  }), [audits, filters])

  // Calcul des données par semaine
  const weeklyData = useMemo(() => {
    const weeks = {}
    
    filteredAudits.forEach(a => {
      const wk = getWeekKey(a.date)
      if (wk) weeks[wk] = (weeks[wk] || 0) + 1
    })

    return Object.entries(weeks)
      .map(([weekKey, realises]) => {
        const planifie = OBJECTIF_SEMAINE
        // On gère le dépassement pour que la barre ne soit pas disproportionnée
        const depassement = realises > planifie ? realises - planifie : 0
        const realiseStandard = realises > planifie ? planifie : realises

        return {
          weekKey,
          label: formatWeekLabel(weekKey),
          'Planifié': planifie,
          'Réalisé': realiseStandard,
          'Bonus': depassement,
          totalRealises: realises
        }
      })
      .sort((a, b) => a.weekKey.localeCompare(b.weekKey))
  }, [filteredAudits])

  // Totaux pour les KPI en haut
  const totalPlanifie = weeklyData.length * OBJECTIF_SEMAINE
  const totalRealise = weeklyData.reduce((sum, w) => sum + w.totalRealises, 0)

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Planifié vs Réalisé</h1>
      </div>

      {/* Barre de filtres */}
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

      {/* KPI Globaux */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="card" style={{ textAlign: 'center', padding: '1.5rem' }}>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Objectif Total</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#3b82f6' }}>{totalPlanifie}</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '1.5rem' }}>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Audits Réalisés</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#f97316' }}>{totalRealise}</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '1.5rem' }}>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Taux de réalisation</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: totalRealise >= totalPlanifie ? 'var(--success)' : 'var(--danger)' }}>
            {totalPlanifie > 0 ? Math.round((totalRealise / totalPlanifie) * 100) : 0} %
          </div>
        </div>
      </div>

      {/* Graphique Histogramme Empilé */}
      <div className="card">
        <h2 className="card-title" style={{ marginBottom: '2rem' }}>Suivi Hebdomadaire (Objectif : {OBJECTIF_SEMAINE} audits)</h2>
        
        {weeklyData.length === 0 ? (
          <div className="muted" style={{ padding: '2rem', textAlign: 'center' }}>Aucune donnée pour cette période.</div>
        ) : (
          <div style={{ height: 450 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData} margin={{ top: 30, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} dy={10} />
                <YAxis allowDecimals={false} tick={axisStyle} axisLine={false} tickLine={false} />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#fff' }} 
                  formatter={(value, name) => [value, name]}
                  labelFormatter={(label) => `Semaine : ${label}`}
                />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                
                {/* Barre Planifiée (Bleu) */}
                <Bar dataKey="Planifié" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} maxBarSize={60}>
                  <LabelList dataKey="Planifié" position="inside" fill="#fff" fontSize={12} fontWeight="bold" />
                </Bar>
                
                {/* Barre Réalisée (Orange) */}
                <Bar dataKey="Réalisé" stackId="a" fill="#f97316" radius={[0, 0, 0, 0]} maxBarSize={60}>
                  <LabelList dataKey="Réalisé" position="inside" fill="#fff" fontSize={12} fontWeight="bold" />
                </Bar>

                {/* Barre Dépassement (Vert) - Si plus de 5 audits */}
                <Bar dataKey="Bonus" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={60}>
                  <LabelList dataKey="Bonus" position="top" fill="#10b981" fontSize={12} fontWeight="bold" formatter={(v) => v > 0 ? `+${v}` : ''} />
                </Bar>

              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
