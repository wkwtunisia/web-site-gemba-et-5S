import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { 
  ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, CartesianGrid, LabelList,
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
  LineChart, Line
} from 'recharts'
import { formatMonthLabel } from '../utils/dateHelpers'

const getScoreColor = (score) => score >= 87 ? '#10b981' : score >= 85 ? '#f59e0b' : '#ef4444'

export default function GembaDashboard({ view }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [monthFilter, setMonthFilter] = useState('')
  const [weekFilter, setWeekFilter] = useState('')

  useEffect(() => {
    supabase.from('gemba_audits').select('*').order('date', { ascending: true }).then(({ data, error }) => {
      if (!error) setData(data || [])
      setLoading(false)
    })
  }, [])

  const getMonthKey = (dateStr) => dateStr ? dateStr.slice(0, 7) : null
  const months = useMemo(() => [...new Set(data.map(d => getMonthKey(d.date)).filter(Boolean))].sort().reverse(), [data])
  
  const weeks = useMemo(() => {
    const filteredByMonth = monthFilter ? data.filter(d => getMonthKey(d.date) === monthFilter) : data
    const uniqueWeeks = [...new Set(filteredByMonth.map(d => d.semaine).filter(Boolean))]
    return uniqueWeeks.sort((a, b) => a - b)
  }, [data, monthFilter])

  const filteredData = useMemo(() => {
    let result = data
    if (monthFilter) result = result.filter(d => getMonthKey(d.date) === monthFilter)
    if (weekFilter) result = result.filter(d => d.semaine === Number(weekFilter))
    return result
  }, [data, monthFilter, weekFilter])

  const auditsGrouped = useMemo(() => {
    const groups = {}
    filteredData.forEach(row => {
      const auditKey = `${row.date}|${row.ligne}`
      if (!groups[auditKey]) {
        groups[auditKey] = { 
          date: row.date, ligne: row.ligne, uap: row.uap, 
          ok: 0, nok: 0, total_questions: 0, seenQuestions: new Set() 
        }
      }
      const qText = String(row.question).trim().toLowerCase()
      if (groups[auditKey].seenQuestions.has(qText)) return
      groups[auditKey].seenQuestions.add(qText)
      
      const rep = String(row.reponse).toUpperCase()
      if (rep === 'OK') groups[auditKey].ok++
      if (rep === 'NOK') groups[auditKey].nok++
      if (rep !== 'N/A') groups[auditKey].total_questions++
    })
    return Object.values(groups).map(a => ({
      ...a,
      score: a.total_questions > 0 ? Math.round((a.ok / a.total_questions) * 100) : 0
    }))
  }, [filteredData])

  const uapStats = useMemo(() => {
    const stats = {
      'UAP 1': { sum: 0, count: 0 }, 'UAP 2': { sum: 0, count: 0 },
      'LOGISTIQUE': { sum: 0, count: 0 }, 'USINE': { sum: 0, count: 0 }
    }
    auditsGrouped.forEach(audit => {
      if (!audit.uap) return
      const uapName = audit.uap.toUpperCase()
      if (stats[uapName]) { stats[uapName].sum += audit.score; stats[uapName].count++ }
      stats['USINE'].sum += audit.score; stats['USINE'].count++
    })
    const format = (name) => stats[name].count > 0 ? Math.round(stats[name].sum / stats[name].count) : 0
    return [
      { uap: 'UAP 1', score: format('UAP 1') }, { uap: 'UAP 2', score: format('UAP 2') },
      { uap: 'Logistique', score: format('LOGISTIQUE') }, { uap: 'Usine (Global)', score: format('USINE') }
    ]
  }, [auditsGrouped])

  const trendData = useMemo(() => {
    const monthsMap = {}
    auditsGrouped.forEach(audit => {
      const monthKey = audit.date.slice(0, 7)
      if (!monthsMap[monthKey]) {
        monthsMap[monthKey] = {
          month: monthKey, label: new Date(monthKey + '-01').toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
          uap1: { sum: 0, count: 0 }, uap2: { sum: 0, count: 0 },
          logistique: { sum: 0, count: 0 }, usine: { sum: 0, count: 0 }
        }
      }
      const uapName = audit.uap ? audit.uap.toUpperCase() : ''
      const m = monthsMap[monthKey]
      if (uapName === 'UAP 1') { m.uap1.sum += audit.score; m.uap1.count++ }
      else if (uapName === 'UAP 2') { m.uap2.sum += audit.score; m.uap2.count++ }
      else if (uapName === 'LOGISTIQUE') { m.logistique.sum += audit.score; m.logistique.count++ }
      m.usine.sum += audit.score; m.usine.count++
    })
    return Object.values(monthsMap).map(m => ({
      label: m.label,
      uap1: m.uap1.count > 0 ? Math.round(m.uap1.sum / m.uap1.count) : null,
      uap2: m.uap2.count > 0 ? Math.round(m.uap2.sum / m.uap2.count) : null,
      logistique: m.logistique.count > 0 ? Math.round(m.logistique.sum / m.logistique.count) : null,
      usine: m.usine.count > 0 ? Math.round(m.usine.sum / m.usine.count) : null
    })).sort((a, b) => new Date(`01 ${a.label}`) - new Date(`01 ${b.label}`))
  }, [auditsGrouped])

  const lineStats = useMemo(() => {
    const groups = {}
    auditsGrouped.forEach(a => {
      if (!a.ligne) return
      if (!groups[a.ligne]) groups[a.ligne] = { sum: 0, count: 0 }
      groups[a.ligne].sum += a.score
      groups[a.ligne].count++
    })
    return Object.entries(groups).map(([ligne, s]) => ({ ligne, score: Math.round(s.sum / s.count) })).sort((a, b) => b.score - a.score)
  }, [auditsGrouped])

  const mStats = useMemo(() => {
    const groups = {}
    filteredData.forEach(row => {
      if (!row.point_m) return
      const rep = String(row.reponse).toUpperCase()
      if (rep === 'N/A') return 
      if (!groups[row.point_m]) groups[row.point_m] = { ok: 0, total: 0 }
      groups[row.point_m].total++
      if (rep === 'OK') groups[row.point_m].ok++
    })
    return Object.entries(groups).map(([subject, s]) => ({ subject, score: Math.round((s.ok / s.total) * 100) })).sort((a, b) => b.score - a.score)
  }, [filteredData])

  const CustomLabel = (props) => {
    const { x, y, value } = props
    if (value === null || value === undefined) return null
    return <text x={x} y={y - 12} fill="#f8fafc" fontSize={11} fontWeight="bold" textAnchor="middle">{value}%</text>
  }

  if (loading) return <p className="muted" style={{ padding: '2rem' }}>Chargement…</p>

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>
          {view === 'uap_gemba' && 'Moyennes par UAP'}
          {view === 'lignes_gemba' && 'Résultats par Ligne'}
          {view === 'top3_gemba' && 'Top & Bottom 3 Lignes'}
          {view === 'piliers_gemba' && 'Résultats par M (Radar & Barres)'}
        </h1>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <select className="filter-control" value={monthFilter} onChange={e => { setMonthFilter(e.target.value); setWeekFilter('') }}>
            <option value="">Tous les mois</option>
            {months.map(m => <option key={m} value={m}>{formatMonthLabel(m)}</option>)}
          </select>
          <select className="filter-control" value={weekFilter} onChange={e => setWeekFilter(e.target.value)}>
            <option value="">Toutes les semaines</option>
            {weeks.map(w => <option key={w} value={w}>Semaine S{String(w).padStart(2, '0')}</option>)}
          </select>
        </div>
      </div>

      {view === 'uap_gemba' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
            {uapStats.map((stat) => (
              <div key={stat.uap} className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1.5rem', borderTop: `4px solid ${getScoreColor(stat.score)}` }}>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{stat.uap}</h3>
                <div style={{ fontSize: '3rem', fontWeight: 800, color: getScoreColor(stat.score) }}>{stat.score}%</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
            {['UAP 1', 'UAP 2', 'Logistique', 'Usine'].map((name, idx) => {
              const key = name.toLowerCase().replace(' ', '')
              const colors = ['#3b82f6', '#f97316', '#10b981', '#8b5cf6']
              return (
                <div key={name} className="card">
                  <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: colors[idx] }}>Tendance {name}</h3>
                  <div style={{ height: 200 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendData} margin={{ top: 20, right: 30, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                        <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#fff' }} />
                        <Line type="monotone" dataKey={key} stroke={colors[idx]} strokeWidth={3} dot={{ r: 4, fill: colors[idx] }} connectNulls>
                          <LabelList content={<CustomLabel />} />
                        </Line>
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {view === 'lignes_gemba' && (
        <div className="card">
          <div style={{ height: 500 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={lineStats} margin={{ top: 30, right: 30, left: 0, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                <XAxis dataKey="ligne" tick={{ fill: '#94a3b8' }} angle={-45} textAnchor="end" />
                <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8' }} />
                <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#fff' }} formatter={(v) => [`${v}%`, 'Score']} />
                <Bar dataKey="score" radius={[6, 6, 0, 0]} maxBarSize={60}>
                  {lineStats.map((entry, index) => <Cell key={index} fill={getScoreColor(entry.score)} />)}
                  <LabelList dataKey="score" position="top" fill="#f8fafc" formatter={(v) => `${v}%`} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {view === 'top3_gemba' && (
        <div>
          <div className="card" style={{ background: 'rgba(59, 130, 246, 0.1)', borderLeft: '4px solid #3b82f6', marginBottom: '2rem', padding: '1rem 1.5rem' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              ℹ️ Comment sont calculés ces classements ?
            </h3>
            <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: 1.6 }}>
              <li><strong>Moyenne par ligne :</strong> Le score affiché est la moyenne de tous les audits réalisés sur cette ligne.</li>
              <li><strong>Calcul des points :</strong> Les réponses "OK" valent 1 point, les "NOK" valent 0. Les "N/A" sont ignorés.</li>
              <li><strong>Top & Bottom 3 :</strong> Toutes les lignes auditées sont triées de la meilleure moyenne à la moins bonne. Le Top 3 prend les 3 premières, le Bottom 3 prend les 3 dernières.</li>
            </ul>
          </div>

          <div className="grid-2">
            <div className="card" style={{ borderTop: '4px solid var(--success)' }}>
              <h3 className="card-title" style={{ color: 'var(--success)' }}>🏆 Top 3 Lignes Gemba</h3>
              <ul className="top-list">
                {lineStats.slice(0, 3).map((item, i) => (
                  <li key={item.ligne} style={{ padding: '1rem', background: 'var(--bg-main)', borderRadius: 8, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                    <span><strong>#{i+1}</strong> {item.ligne}</span>
                    <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>{item.score}%</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="card" style={{ borderTop: '4px solid var(--danger)' }}>
              <h3 className="card-title" style={{ color: 'var(--danger)' }}>⚠️ Bottom 3 Lignes Gemba</h3>
              <ul className="top-list">
                {[...lineStats].reverse().slice(0, 3).map((item, i) => (
                  <li key={item.ligne} style={{ padding: '1rem', background: 'var(--bg-main)', borderRadius: 8, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                    <span><strong>#{i+1}</strong> {item.ligne}</span>
                    <span style={{ color: 'var(--danger)', fontWeight: 'bold' }}>{item.score}%</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {view === 'piliers_gemba' && (
        <div className="grid-2">
          {/* RADAR CHART */}
          <div className="card">
            <h2 className="card-title" style={{ textAlign: 'center' }}>Radar des 5M</h2>
            <div style={{ height: 350 }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={mStats}>
                  <PolarGrid stroke="#334155" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#f8fafc', fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#fff' }} formatter={(v) => [`${v}%`, 'Score']} />
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
                <BarChart data={mStats} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="subject" tick={{ fill: '#f8fafc', fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} width={130} />
                  <Tooltip 
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#fff' }} 
                    formatter={(v) => [`${v} %`, 'Score']} 
                  />
                  <Bar dataKey="score" radius={[0, 6, 6, 0]} barSize={30}>
                    {mStats.map((entry, index) => <Cell key={index} fill={getScoreColor(entry.score)} />)}
                    <LabelList dataKey="score" position="right" fill="#f8fafc" formatter={(v) => `${v}%`} fontSize={13} fontWeight="bold" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
