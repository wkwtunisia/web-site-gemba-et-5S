import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabaseClient'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Cell
} from 'recharts'

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : ''

export default function Dashboard({ refreshKey = 0 }) {
  const [audits, setAudits] = useState([])
  const [loading, setLoading] = useState(true)
  const [zoneFilter, setZoneFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('audits').select('*').order('date', { ascending: true })
      if (!cancelled) {
        if (error) console.error(error)
        setAudits(data ?? [])
        setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [refreshKey])

  const zones = useMemo(
    () => [...new Set(audits.map(a => a.zone).filter(Boolean))].sort(),
    [audits]
  )

  const filtered = useMemo(() => audits.filter(a => {
    if (zoneFilter && a.zone !== zoneFilter) return false
    if (fromDate && a.date < fromDate) return false
    if (toDate && a.date > toDate) return false
    return true
  }), [audits, zoneFilter, fromDate, toDate])

  const kpi = useMemo(() => {
    if (filtered.length === 0) return { avg: 0, count: 0, nok: 0, best: '-', worst: '-' }
    const avg = filtered.reduce((s, a) => s + Number(a.score_pct ?? 0), 0) / filtered.length
    let nok = 0
    for (const a of filtered) for (const c of (a.checkpoints || [])) if (c.s === 'NOK') nok++
    const byZone = {}
    for (const a of filtered) {
      if (!a.zone) continue
      byZone[a.zone] ??= { sum: 0, n: 0 }
      byZone[a.zone].sum += Number(a.score_pct ?? 0)
      byZone[a.zone].n++
    }
    const ranked = Object.entries(byZone).map(([z, v]) => [z, v.sum / v.n]).sort((a, b) => b[1] - a[1])
    return {
      avg: avg.toFixed(1),
      count: filtered.length,
      nok,
      best: ranked[0]?.[0] ?? '-',
      worst: ranked[ranked.length - 1]?.[0] ?? '-'
    }
  }, [filtered])

  const trend = useMemo(() => {
    const byDate = {}
    for (const a of filtered) {
      byDate[a.date] ??= { sum: 0, n: 0 }
      byDate[a.date].sum += Number(a.score_pct ?? 0)
      byDate[a.date].n++
    }
    return Object.entries(byDate)
      .map(([date, v]) => ({ date, score: +(v.sum / v.n).toFixed(1) }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [filtered])

  const zoneRanking = useMemo(() => {
    const byZone = {}
    for (const a of filtered) {
      if (!a.zone) continue
      byZone[a.zone] ??= { sum: 0, n: 0 }
      byZone[a.zone].sum += Number(a.score_pct ?? 0)
      byZone[a.zone].n++
    }
    return Object.entries(byZone)
      .map(([zone, v]) => ({ zone, score: +(v.sum / v.n).toFixed(1), count: v.n }))
      .sort((a, b) => b.score - a.score)
  }, [filtered])

  const topNok = useMemo(() => {
    const byQ = {}
    for (const a of filtered) for (const c of (a.checkpoints || [])) {
      if (c.s !== 'NOK') continue
      byQ[c.q] ??= { q: c.q, count: 0, samples: [] }
      byQ[c.q].count++
      if (c.a && byQ[c.q].samples.length < 3) byQ[c.q].samples.push(c.a)
    }
    return Object.values(byQ).sort((a, b) => b.count - a.count).slice(0, 10)
  }, [filtered])

  if (loading) return <p style={{ padding: '2rem' }}>Chargement…</p>
  if (audits.length === 0) return (
    <p style={{ padding: '2rem', color: '#64748b' }}>
      Aucune donnée. Importez le fichier Excel ci-dessus.
    </p>
  )

  return (
    <div style={{ padding: '0 2rem 2rem' }}>
      <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        <select value={zoneFilter} onChange={e => setZoneFilter(e.target.value)} style={filterStyle}>
          <option value="">Toutes les zones</option>
          {zones.map(z => <option key={z} value={z}>{z}</option>)}
        </select>
        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={filterStyle} />
        <input type="date" value={toDate}   onChange={e => setToDate(e.target.value)}   style={filterStyle} />
        <button onClick={() => { setZoneFilter(''); setFromDate(''); setToDate('') }}
          style={{ ...filterStyle, cursor: 'pointer' }}>Réinitialiser</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <Kpi label="Score moyen" value={`${kpi.avg} %`} />
        <Kpi label="Audits" value={kpi.count} />
        <Kpi label="Points NOK" value={kpi.nok} accent="#dc2626" />
        <Kpi label="Meilleure zone" value={kpi.best} accent="#16a34a" />
        <Kpi label="Zone à améliorer" value={kpi.worst} accent="#f59e0b" />
      </div>

      <Card title="Évolution du score (%)">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={trend}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tickFormatter={fmtDate} fontSize={12} />
            <YAxis domain={[0, 100]} fontSize={12} />
            <Tooltip labelFormatter={fmtDate} formatter={v => [`${v} %`, 'Score']} />
            <Line type="monotone" dataKey="score" stroke="#2563eb" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', margin: '1rem 0' }}>
        <Card title="Classement des zones (score moyen)">
          <ResponsiveContainer width="100%" height={Math.max(260, zoneRanking.length * 28)}>
            <BarChart data={zoneRanking} layout="vertical" margin={{ left: 90 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" domain={[0, 100]} fontSize={12} />
              <YAxis type="category" dataKey="zone" fontSize={12} width={90} />
              <Tooltip formatter={v => `${v} %`} />
              <Bar dataKey="score">
                {zoneRanking.map((z, i) => (
                  <Cell key={i} fill={z.score >= 80 ? '#16a34a' : z.score >= 60 ? '#f59e0b' : '#dc2626'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Top 10 points NOK">
          <ol style={{ paddingLeft: '1.2rem', margin: 0, fontSize: '.85rem' }}>
            {topNok.map(n => (
              <li key={n.q} style={{ marginBottom: '.6rem' }}>
                <strong>{n.count}×</strong> — {n.q}
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <Card title={`Audits (${filtered.length})`}>
        <div style={{ maxHeight: 420, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.875rem' }}>
            <thead style={{ position: 'sticky', top: 0, background: '#f8fafc' }}>
              <tr>
                {['Date', 'Zone', 'Pilote', 'Auditeur', 'Score', 'NOK'].map(h =>
                  <th key={h} style={th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {[...filtered].reverse().map(a => {
                const nok = (a.checkpoints || []).filter(c => c.s === 'NOK').length
                return (
                  <tr key={`${a.date}|${a.zone}|${a.auditor}`}>
                    <td style={td}>{fmtDate(a.date)}</td>
                    <td style={td}>{a.zone}</td>
                    <td style={td}>{a.pilot}</td>
                    <td style={td}>{a.auditor}</td>
                    <td style={{ ...td, fontWeight: 600,
                      color: Number(a.score_pct) >= 80 ? '#16a34a'
                            : Number(a.score_pct) >= 60 ? '#f59e0b' : '#dc2626' }}>
                      {a.score_pct} %
                    </td>
                    <td style={td}>{nok}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

const filterStyle = { padding: '.5rem .75rem', border: '1px solid #cbd5e1', borderRadius: 6, background: 'white', fontSize: '.875rem' }
const th = { textAlign: 'left', padding: '.5rem .75rem', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 600 }
const td = { padding: '.5rem .75rem', borderBottom: '1px solid #f1f5f9' }

function Kpi({ label, value, accent = '#0f172a' }) {
  return (
    <div style={{ background: 'white', borderRadius: 8, padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
      <div style={{ fontSize: '.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '.03em' }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: accent, marginTop: '.25rem' }}>{value}</div>
    </div>
  )
}

function Card({ title, children }) {
  return (
    <div style={{ background: 'white', borderRadius: 8, padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,.08)', marginBottom: '1rem' }}>
      <h3 style={{ margin: '0 0 .75rem', fontSize: '.95rem', color: '#0f172a' }}>{title}</h3>
      {children}
    </div>
  )
}
