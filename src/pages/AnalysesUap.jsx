import { useState, useMemo, useEffect } from 'react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, LabelList } from 'recharts'

const UAP_CONFIG = {
  uap1: { title: 'UAP 1', zones: ['F02', 'F01', 'F83', 'F85', 'F86', 'F99', 'L76', 'L77'], color: '#3b82f6' },
  uap2: { title: 'UAP 2', zones: [], color: '#8b5cf6' },
  logistique: { title: 'Logistique', zones: ['MAGASIN GENERAL', 'MAGASIN P1', 'MAGASIN P2'], color: '#f59e0b' },
  usine: { title: 'Usine', color: '#10b981' }
}

const getColor = (score) => score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444'
const axisStyle = { fontSize: 12, fill: '#94a3b8' }

// 🌟 FONCTION POUR EXTRAIRE LA DATE AU FORMAT YYYY-MM-DD (Sans bug de fuseau)
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

// 🌟 CALCUL DU NUMÉRO DE SEMAINE
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

export default function AnalysesUap({ audits }) {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [weekFilter, setWeekFilter] = useState('')

  // 🌟 LISTE DES SEMAINES DISPONIBLES
  const availableWeeks = useMemo(() => {
    const set = new Set()
    audits.forEach(a => {
      const w = getWeekNumber(a.date)
      if (w) set.add(w)
    })
    return Array.from(set).sort()
  }, [audits])

  // 🌟 FILTRAGE DES DONNÉES
  const filteredAudits = useMemo(() => {
    return audits.filter(a => {
      const dStr = extractDateString(a.date)
      if (!dStr) return false

      // Filtre par date Du / Au
      if (startDate && dStr < startDate) return false
      if (endDate && dStr > endDate) return false

      // Filtre par Semaine
      if (weekFilter && getWeekNumber(a.date) !== weekFilter) return false

      return true
    })
  }, [audits, startDate, endDate, weekFilter])

  const isUap1 = (z) => UAP_CONFIG.uap1.zones.includes(z?.trim())
  const isLogistique = (z) => UAP_CONFIG.logistique.zones.includes(z?.trim())
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
    
    // 🌟 ADAPTATION DE L'AFFICHAGE SELON LE FILTRE
    if (weekFilter) {
      groupBy = 'day'
    } else if (startDate || endDate) {
      groupBy = 'week'
    }

    const groups = {}

    filteredAudits.forEach(a => {
      const dStr = extractDateString(a.date)
      if (!dStr) return
      
      let key = ''
      if (groupBy === 'month') key = dStr.substring(0, 7) // YYYY-MM
      if (groupBy === 'week') key = getWeekNumber(a.date)
      if (groupBy === 'day') key = dStr

      if (!key) return
      if (!groups[key]) groups[key] = { key, uap1: [], uap2: [], logistique: [], usine: [] }

      const score = Number(a.score_pct) || 0
      groups[key].usine.push(score)
      if (isUap1(a.zone)) groups[key].uap1.push(score)
      else if (isLogistique(a.zone)) groups[key].logistique.push(score)
      else groups[key].uap2.push(score)
    })

    const calcAvgForArr = (arr) => arr.length ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)) : null

    return Object.values(groups)
      .map(g => {
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
      })
      .sort((a, b) => String(a.key).localeCompare(String(b.key)))
  }, [filteredAudits, startDate, endDate, weekFilter])

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
          <div className="muted" style={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Aucune donnée pour cette période</div>
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

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: '1.5rem', alignItems: 'center' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Analyses par UAP</h1>
        
        {/* 🌟 FILTRES DE DATE ET SEMAINE */}
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
        <GraphCard title="Courbe UAP 1" dataKey="uap1" color={UAP_CONFIG.uap1.color} />
        <GraphCard title="Courbe UAP 2" dataKey="uap2" color={UAP_CONFIG.uap2.color} />
        <GraphCard title="Courbe Logistique" dataKey="logistique" color={UAP_CONFIG.logistique.color} />
        <GraphCard title="Courbe Moyenne Usine" dataKey="usine" color={UAP_CONFIG.usine.color} />
      </div>
    </div>
  )
}
