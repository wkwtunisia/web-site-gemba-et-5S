import { useState, useMemo } from 'react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, LabelList } from 'recharts'

const getColor = (score) => score >= 86 ? '#10b981' : score >= 80 ? '#f59e0b' : '#ef4444'
const axisStyle = { fontSize: 12, fill: '#94a3b8' }

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

const getUap5S = (zone) => {
  if (!zone) return 'UAP 2'
  const clean = String(zone).trim().toUpperCase().replace(/\s+/g, '')
  if (clean.includes('MAGASIN') || clean.includes('STOCKAGE') || clean === 'LOGISTIQUE') return 'Logistique'
  if (clean === 'UAP1' || clean === 'UAP 1') return 'UAP 1'
  if (clean === 'UAP2' || clean === 'UAP 2') return 'UAP 2'
  const uap1List = ['F01', 'F02', 'F83', 'F99', 'F86', 'F85', 'L77', 'L76']
  if (uap1List.includes(clean)) return 'UAP 1'
  return 'UAP 2'
}

export default function AnalysesUap({ audits }) {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [weekFilter, setWeekFilter] = useState('')

  // On normalise les données pour s'adapter à la structure de la base 5S
  const normalizedAudits = useMemo(() => {
    return (audits || []).map(row => {
      // Si c'est un audit 5S avec score_pct
      if (row.score_pct !== undefined && row.score_pct !== null) {
        return { ...row, computedScore: Number(row.score_pct) || 0, zoneOrLigne: row.zone || row.ligne }
      }
      // Si c'est un audit par question (comme le Gemba)
      const rep = String(row.reponse || '').toUpperCase()
      let ok = rep === 'OK' ? 1 : 0
      let total = rep !== 'N/A' ? 1 : 0
      return { 
        ...row, 
        computedScore: total > 0 ? Math.round((ok / total) * 100) : 0,
        zoneOrLigne: row.zone || row.ligne,
        _isRowLevel: true 
      }
    })
  }, [audits])

  // Si les données sont ligne par ligne, on doit les regrouper par audit
  const groupedAudits = useMemo(() => {
    const hasRowLevel = normalizedAudits.some(a => a._isRowLevel)
    if (!hasRowLevel) return normalizedAudits // Déjà groupé (cas score_pct)

    const groups = {}
    normalizedAudits.forEach(row => {
      const date = extractDateString(row.date)
      const zone = row.zoneOrLigne?.trim()
      if (!date || !zone) return
      const key = `${date}|${zone}`
      if (!groups[key]) {
        groups[key] = { date, zone, uap: row.uap, semaine: row.semaine, ok: 0, total: 0, score_pct: null }
      }
      const rep = String(row.reponse).toUpperCase()
      if (rep !== 'N/A') {
        groups[key].total++
        if (rep === 'OK') groups[key].ok++
      }
    })
    return Object.values(groups).map(g => ({
      ...g,
      computedScore: g.total > 0 ? Math.round((g.ok / g.total) * 100) : 0,
      zoneOrLigne: g.zone
    }))
  }, [normalizedAudits])

  const availableWeeks = useMemo(() => {
    const set = new Set()
    groupedAudits.forEach(a => { 
      const w = getWeekNumber(a.date, a.semaine)
      if (w) set.add(w) 
    })
    return Array.from(set).sort()
  }, [groupedAudits])

  const filteredAudits = useMemo(() => {
    return groupedAudits.filter(a => {
      const dStr = extractDateString(a.date); if (!dStr) return false
      if (startDate && dStr < startDate) return false
      if (endDate && dStr > endDate) return false
      if (weekFilter && getWeekNumber(a.date, a.semaine) !== weekFilter) return false
      return true
    })
  }, [groupedAudits, startDate, endDate, weekFilter])

  const kpis = useMemo(() => {
    const uaps = { 'UAP 1': [], 'UAP 2': [], 'Logistique': [], 'Usine': [] }
    
    filteredAudits.forEach(a => {
      uaps['Usine'].push(a.computedScore)
      const uapName = a.uap ? getUap5S(a.uap) : getUap5S(a.zoneOrLigne)
      if (uaps[uapName]) uaps[uapName].push(a.computedScore)
    })

    const calcAvg = (arr) => arr.length === 0 ? 0 : Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)

    return {
      uap1: calcAvg(uaps['UAP 1']),
      uap2: calcAvg(uaps['UAP 2']),
      logistique: calcAvg(uaps['Logistique']),
      usine: calcAvg(uaps['Usine'])
    }
  }, [filteredAudits])

  const trendData = useMemo(() => {
    let groupBy = (startDate || endDate) ? 'day' : weekFilter ? 'day' : 'month'
    const groups = {}

    filteredAudits.forEach(a => {
      const dStr = extractDateString(a.date)
      if (!dStr) return

      let key = ''
      let label = ''

      if (groupBy === 'month') {
        key = dStr.substring(0, 7)
        label = new Date(`${key}-01T12:00:00`).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
      } else if (groupBy === 'week') {
        key = getWeekNumber(a.date, a.semaine)
        label = key
      } else if (groupBy === 'day') {
        key = dStr
        label = new Date(`${dStr}T12:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
      }

      if (!key) return
      if (!groups[key]) groups[key] = { key, label, uap1: [], uap2: [], logistique: [], usine: [] }

      groups[key].usine.push(a.computedScore)
      const uapName = a.uap ? getUap5S(a.uap) : getUap5S(a.zoneOrLigne)
      if (uapName === 'UAP 1') groups[key].uap1.push(a.computedScore)
      else if (uapName === 'UAP 2') groups[key].uap2.push(a.computedScore)
      else if (uapName === 'Logistique') groups[key].logistique.push(a.computedScore)
    })

    const calcAvgForArr = (arr) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null

    return Object.values(groups).map(g => ({
      label: g.label,
      key: g.key,
      uap1: calcAvgForArr(g.uap1),
      uap2: calcAvgForArr(g.uap2),
      logistique: calcAvgForArr(g.logistique),
      usine: calcAvgForArr(g.usine)
    })).sort((a, b) => a.key.localeCompare(b.key))
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
    return <text x={x} y={y - 12} fill="#f8fafc" fontSize={11} fontWeight="bold" textAnchor="middle">{value}%</text>
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
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} dy={10} angle={-20} textAnchor="end" height={50} />
                <YAxis domain={[0, 100]} tick={axisStyle} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#fff' }} formatter={(v) => [`${v} %`, title]} />
                <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={3} dot={{ r: 5, fill: color, stroke: '#1e293b', strokeWidth: 2 }} activeDot={{ r: 7 }} connectNulls>
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
      <div className="flex-between" style={{ marginBottom: '1.5rem', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Analyses par UAP (5S)</h1>
        
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
