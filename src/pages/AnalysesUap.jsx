import { useState, useMemo } from 'react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, LabelList } from 'recharts'
import { getMonthKey, getWeekKey, formatMonthLabel, formatWeekLabel } from '../utils/dateHelpers'

const UAP_CONFIG = {
  uap1: { title: 'UAP 1', zones: ['F02', 'F01', 'F83', 'F85', 'F86', 'F99', 'L76', 'L77'], color: '#3b82f6' },
  uap2: { title: 'UAP 2', zones: [], color: '#8b5cf6' },
  logistique: { title: 'Logistique', zones: ['MAGASIN GENERAL', 'MAGASIN P1', 'MAGASIN P2'], color: '#f59e0b' },
  usine: { title: 'Usine', color: '#10b981' }
}

const getColor = (score) => score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444'
const axisStyle = { fontSize: 12, fill: '#94a3b8' }

export default function AnalysesUap({ audits }) {
  const [filters, setFilters] = useState({ month: '', week: '' })

  const months = useMemo(() => [...new Set(audits.map(a => getMonthKey(a.date)).filter(Boolean))].sort().reverse(), [audits])
  const weeks = useMemo(() => [...new Set(audits.map(a => getWeekKey(a.date)).filter(Boolean))].sort().reverse(), [audits])

  const filteredAudits = useMemo(() => audits.filter(a => {
    if (filters.month && getMonthKey(a.date) !== filters.month) return false
    if (filters.week && getWeekKey(a.date) !== filters.week) return false
    return true
  }), [audits, filters])

  const isUap1 = (z) => UAP_CONFIG.uap1.zones.includes(z)
  const isLogistique = (z) => UAP_CONFIG.logistique.zones.includes(z)
  const isUap2 = (z) => !isUap1(z) && !isLogistique(z)

  const kpis = useMemo(() => {
    const calcAvg = (arr) => arr.length === 0 ? 0 : Number((arr.reduce((acc, a) => acc + Number(a.score_pct || 0), 0) / arr.length).toFixed(1))
    const uap1Audits = filteredAudits.filter(a => isUap1(a.zone))
    const uap2Audits = filteredAudits.filter(a => isUap2(a.zone))
    const logAudits = filteredAudits.filter(a => isLogistique(a.zone))

    return {
      uap1: calcAvg(uap1Audits),
      uap2: calcAvg(uap2Audits),
      logistique: calcAvg(logAudits),
      usine: calcAvg(filteredAudits)
    }
  }, [filteredAudits])

  const trendData = useMemo(() => {
    let groupBy = 'month'
    let labelFn = (key) => formatMonthLabel(key)

    if (filters.month) {
      groupBy = 'week'
      labelFn = (key) => formatWeekLabel(key)
    } else if (filters.week) {
      groupBy = 'day'
      labelFn = (key) => key ? new Date(key).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : ''
    }

    const groups = {}

    filteredAudits.forEach(a => {
      if (!a.date) return
      let key = ''
      if (groupBy === 'month') key = getMonthKey(a.date)
      if (groupBy === 'week') key = getWeekKey(a.date)
      if (groupBy === 'day') key = a.date

      if (!key) return
      if (!groups[key]) groups[key] = { key, uap1: [], uap2: [], logistique: [], usine: [] }

      groups[key].usine.push(Number(a.score_pct))
      if (isUap1(a.zone)) groups[key].uap1.push(Number(a.score_pct))
      else if (isLogistique(a.zone)) groups[key].logistique.push(Number(a.score_pct))
      else groups[key].uap2.push(Number(a.score_pct))
    })

    const calcAvgForArr = (arr) => arr.length ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)) : null

    return Object.values(groups)
      .map(g => ({
        label: labelFn(g.key),
        key: g.key,
        uap1: calcAvgForArr(g.uap1),
        uap2: calcAvgForArr(g.uap2),
        logistique: calcAvgForArr(g.logistique),
        usine: calcAvgForArr(g.usine)
      }))
      .sort((a, b) => {
        if (!a.key || !b.key) return 0
        return String(a.key).localeCompare(String(b.key))
      })
  }, [filteredAudits, filters])

  const KpiCard = ({ title, score }) => (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{title}</h3>
      <div style={{ fontSize: '2.5rem', fontWeight: 800, color: getColor(score), lineHeight: 1 }}>
        {score} <span style={{ fontSize: '1.2rem' }}>%</span>
      </div>
    </div>
  )

  // Composant pour dessiner les pourcentages sur la courbe
  const CustomLabel = (props) => {
    const { x, y, value } = props
    if (value === null || value === undefined) return null
    return (
      <text x={x} y={y - 12} fill="#f8fafc" fontSize={11} fontWeight="bold" textAnchor="middle">
        {value}%
      </text>
    )
  }

  const GraphCard = ({ title, dataKey, color }) => {
    const hasData = trendData.some(d => d[dataKey] !== null)

    return (
      <div className="card" style={{ padding: '1rem' }}>
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: color }}>{title}</h3>
        {!hasData ? (
          <div className="muted" style={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Aucune donnée</div>
        ) : (
          <div style={{ height: 260 }}> {/* Un peu plus haut pour laisser de la place aux textes */}
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 25, right: 15, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} dy={10} />
                <YAxis domain={[0, 100]} tick={axisStyle} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#fff' }}
                  formatter={(v) => [`${v} %`, title]}
                />
                <Line 
                  type="monotone" 
                  dataKey={dataKey} 
                  stroke={color} 
                  strokeWidth={3} 
                  dot={{ r: 5, fill: color, stroke: '#1e293b', strokeWidth: 2 }} 
                  activeDot={{ r: 7 }} 
                  connectNulls 
                >
                  {/* C'est cette ligne qui affiche les résultats sur la courbe */}
                  <LabelList content={<CustomLabel />} />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Analyses par UAP</h1>
      </div>

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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <KpiCard title="UAP 1" score={kpis.uap1} />
        <KpiCard title="UAP 2" score={kpis.uap2} />
        <KpiCard title="Logistique" score={kpis.logistique} />
        <KpiCard title="Moyenne Usine" score={kpis.usine} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '1.5rem' }}>
        <GraphCard title="Courbe UAP 1" dataKey="uap1" color={UAP_CONFIG.uap1.color} />
        <GraphCard title="Courbe UAP 2" dataKey="uap2" color={UAP_CONFIG.uap2.color} />
        <GraphCard title="Courbe Logistique" dataKey="logistique" color={UAP_CONFIG.logistique.color} />
        <GraphCard title="Courbe Moyenne Usine" dataKey="usine" color={UAP_CONFIG.usine.color} />
      </div>
    </div>
  )
}
