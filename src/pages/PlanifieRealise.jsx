import { useState, useMemo } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, LabelList } from 'recharts'

const OBJECTIF_SEMAINE = 5
const axisStyle = { fontSize: 12, fill: '#94a3b8' }

const parseDate = (dateStr) => {
  if (!dateStr) return null
  let d = new Date(dateStr)
  if (!isNaN(d.getTime())) return d
  const str = String(dateStr).trim()
  const match = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/)
  if (match) {
    d = new Date(`${match[3]}-${match[2]}-${match[1]}`)
    if (!isNaN(d.getTime())) return d
  }
  const matchISO = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (matchISO) {
    d = new Date(`${matchISO[1]}-${matchISO[2]}-${matchISO[3]}`)
    if (!isNaN(d.getTime())) return d
  }
  return null
}

const getWeekNum = (d) => {
  if (!d) return null
  const target = new Date(d.valueOf())
  const dayNr = (d.getDay() + 6) % 7
  target.setDate(target.getDate() - dayNr + 3) 
  const firstThursday = target.valueOf()
  target.setMonth(0, 1)
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7)
  }
  return 1 + Math.ceil((firstThursday - target) / 604800000)
}

export default function PlanifieRealise({ audits }) {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const isWithinDateRange = (dateStr) => {
    if (!startDate && !endDate) return true
    const d = parseDate(dateStr)
    if (!d) return false
    const s = startDate ? new Date(startDate) : new Date(0)
    const e = endDate ? new Date(endDate) : new Date(8640000000000000)
    s.setHours(0, 0, 0, 0)
    e.setHours(23, 59, 59, 999)
    d.setHours(12, 0, 0, 0)
    return d >= s && d <= e
  }

  const filteredAudits = useMemo(() => audits.filter(a => isWithinDateRange(a.date)), [audits, startDate, endDate])

  const weeklyData = useMemo(() => {
    const weeks = {}
    
    filteredAudits.forEach(a => {
      const d = parseDate(a.date)
      if (!d) return
      const wk = getWeekNum(d)
      if (wk) {
        const label = `S${String(wk).padStart(2, '0')}`
        weeks[label] = (weeks[label] || 0) + 1
      }
    })

    return Object.entries(weeks)
      .map(([label, realises]) => {
        const planifie = OBJECTIF_SEMAINE
        const depassement = realises > planifie ? realises - planifie : 0
        const realiseStandard = realises > planifie ? planifie : realises

        return {
          label,
          'Planifié': planifie,
          'Réalisé': realiseStandard,
          'Bonus': depassement,
          totalRealises: realises
        }
      })
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [filteredAudits])

  const totalPlanifie = weeklyData.length * OBJECTIF_SEMAINE
  const totalRealise = weeklyData.reduce((sum, w) => sum + w.totalRealises, 0)

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: '1.5rem', alignItems: 'center' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Planifié vs Réalisé (5S)</h1>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', background: 'var(--surface)', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Du</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ background: 'transparent', color: 'var(--text-main)', border: 'none', outline: 'none', fontSize: '0.9rem' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Au</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ background: 'transparent', color: 'var(--text-main)', border: 'none', outline: 'none', fontSize: '0.9rem' }} />
          </div>
        </div>
      </div>

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
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#fff' }} />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Bar dataKey="Planifié" stackId="a" fill="#3b82f6" maxBarSize={60}>
                  <LabelList dataKey="Planifié" position="inside" fill="#fff" fontSize={12} fontWeight="bold" />
                </Bar>
                <Bar dataKey="Réalisé" stackId="a" fill="#f97316" maxBarSize={60}>
                  <LabelList dataKey="Réalisé" position="inside" fill="#fff" fontSize={12} fontWeight="bold" />
                </Bar>
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
