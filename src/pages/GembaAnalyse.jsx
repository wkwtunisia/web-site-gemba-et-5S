import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, LabelList } from 'recharts'

const getColor = (score) => score >= 90 ? '#10b981' : score >= 85 ? '#f59e0b' : '#ef4444'
const axisStyle = { fontSize: 12, fill: '#94a3b8' }

const extractDateString = (dateStr) => {
  if (!dateStr) return null;
  const str = String(dateStr).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.substring(0, 10);
  if (/^\d{2}\/\d{2}\/\d{4}/.test(str)) {
    const parts = str.split('/');
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  const months = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
  const match = str.match(/^(\d{1,2})[-\s]([a-zA-Z]{3})[-\s](\d{4})/);
  if (match) {
    const month = months[match[2].toLowerCase()];
    if (month) return `${match[3]}-${month}-${String(match[1]).padStart(2, '0')}`;
  }
  return null;
}

const getWeekNumber = (dateStr) => {
  const dateOnly = extractDateString(dateStr);
  if (!dateOnly) return null;
  const d = new Date(`${dateOnly}T12:00:00`);
  if (isNaN(d.getTime())) return null;
  
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3); 
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  const weekNum = 1 + Math.ceil((firstThursday - target) / 604800000);
  return `S${String(weekNum).padStart(2, '0')}`;
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

export default function GembaAnalyse() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [weekFilter, setWeekFilter] = useState('')

  useEffect(() => {
    fetchAllGemba().then(res => {
      setData(res || [])
      setLoading(false)
    })
  }, [])

  const availableWeeks = useMemo(() => {
    const set = new Set()
    data.forEach(a => {
      const w = getWeekNumber(a.date)
      if (w) set.add(w)
    })
    return Array.from(set).sort()
  }, [data])

  const filteredData = useMemo(() => {
    return data.filter(row => {
      const dStr = extractDateString(row.date)
      if (!dStr) return false
      if (startDate && dStr < startDate) return false
      if (endDate && dStr > endDate) return false
      if (weekFilter && getWeekNumber(row.date) !== weekFilter) return false
      return true
    })
  }, [data, startDate, endDate, weekFilter])

  // 🌟 CALCUL DES KPI PAR UAP (En utilisant la colonne 'uap')
  const kpis = useMemo(() => {
    const uaps = { 'UAP 1': { ok: 0, total: 0 }, 'UAP 2': { ok: 0, total: 0 }, 'Logistique': { ok: 0, total: 0 }, 'Usine': { ok: 0, total: 0 } }
    
    filteredData.forEach(row => {
      const uap = (row.uap || '').trim()
      const rep = String(row.reponse).toUpperCase()
      if (rep === 'N/A') return

      // Global Usine
      uaps['Usine'].total++
      if (rep === 'OK') uaps['Usine'].ok++

      // Par UAP
      if (uap.includes('UAP 1') || uap.includes('UAP1')) {
        uaps['UAP 1'].total++
        if (rep === 'OK') uaps['UAP 1'].ok++
      } else if (uap.includes('UAP 2') || uap.includes('UAP2')) {
        uaps['UAP 2'].total++
        if (rep === 'OK') uaps['UAP 2'].ok++
      } else if (uap.includes('LOG')) {
        uaps['Logistique'].total++
        if (rep === 'OK') uaps['Logistique'].ok++
      }
    })

    const calcAvg = (data) => data.total === 0 ? 0 : Math.round((data.ok / data.total) * 100)

    return {
      uap1: calcAvg(uaps['UAP 1']),
      uap2: calcAvg(uaps['UAP 2']),
      logistique: calcAvg(uaps['Logistique']),
      usine: calcAvg(uaps['Usine'])
    }
  }, [filteredData])

  // 🌟 CALCUL DES DONNÉES DE TENDANCE
  const trendData = useMemo(() => {
    let groupBy = 'month'
    if (weekFilter) groupBy = 'day'
    else if (startDate || endDate) groupBy = 'week'

    const groups = {}

    filteredData.forEach(a => {
      const dStr = extractDateString(a.date)
      if (!dStr) return
      const rep = String(a.reponse).toUpperCase()
      if (rep === 'N/A') return

      let key = ''
      if (groupBy === 'month') key = dStr.substring(0, 7)
      if (groupBy === 'week') key = getWeekNumber(a.date)
      if (groupBy === 'day') key = dStr

      if (!key) return
      if (!groups[key]) groups[key] = { key, uap1: [], uap2: [], logistique: [], usine: [] }

      const score = rep === 'OK' ? 100 : 0
      groups[key].usine.push(score)
      
      const uap = (a.uap || '').trim()
      if (uap.includes('UAP 1') || uap.includes('UAP1')) groups[key].uap1.push(score)
      else if (uap.includes('UAP 2') || uap.includes('UAP2')) groups[key].uap2.push(score)
      else if (uap.includes('LOG')) groups[key].logistique.push(score)
    })

    const calcAvgForArr = (arr) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null

    return Object.values(groups).map(g => {
      let label = g.key
      if (groupBy === 'month') {
        const date = new Date(`${g.key}-01T12:00:00`)
        label = date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
      } else if (groupBy === 'day') {
        const date = new Date(`${g.key}T12:00:00`)
        label = date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
      }

      return {
        label,
        key: g.key,
        uap1: calcAvgForArr(g.uap1),
        uap2: calcAvgForArr(g.uap2),
        logistique: calcAvgForArr(g.logistique),
        usine: calcAvgForArr(g.usine)
      }
    }).sort((a, b) => String(a.key).localeCompare(String(b.key)))
  }, [filteredData, startDate, endDate, weekFilter])

  const KpiCard = ({ title, score }) => (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{title}</h3>
      <div style={{ fontSize: '2.5rem', fontWeight: 800, color: getColor(score), lineHeight: 1 }}>
        {score} <span style={{ fontSize: '1.2rem' }}>%</span>
      </div>
    </div>
  )

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
          <div style={{ height: 260 }}>
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
                  <LabelList content={<CustomLabel />} />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    )
  }

  if (loading) return <p className="muted" style={{ padding: '2rem' }}>Chargement…</p>

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: '1.5rem', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Analyses par UAP (Gemba)</h1>
        
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <KpiCard title="UAP 1" score={kpis.uap1} />
        <KpiCard title="UAP 2" score={kpis.uap2} />
        <KpiCard title="Logistique" score={kpis.logistique} />
        <KpiCard title="Moyenne Usine" score={kpis.usine} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '1.5rem' }}>
        <GraphCard title="Courbe UAP 1" dataKey="uap1" color="#3b82f6" />
        <GraphCard title="Courbe UAP 2" dataKey="uap2" color="#8b5cf6" />
        <GraphCard title="Courbe Logistique" dataKey="logistique" color="#f59e0b" />
        <GraphCard title="Courbe Moyenne Usine" dataKey="usine" color="#10b981" />
      </div>
    </div>
  )
}
