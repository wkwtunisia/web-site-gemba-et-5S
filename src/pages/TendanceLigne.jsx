import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Legend } from 'recharts'

const extractDateString = (dateStr) => {
  if (!dateStr) return null;
  const str = String(dateStr).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.substring(0, 10);
  if (/^\d{2}\/\d{2}\/\d{4}/.test(str)) {
    const parts = str.split('/');
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return null;
}

const fetchAll = async (tableName) => {
  let allData = []
  let from = 0
  const step = 1000
  let hasMore = true
  while (hasMore) {
    const { data, error } = await supabase.from(tableName).select('*').order('date', { ascending: true }).range(from, from + step - 1)
    if (error) { console.error(error); break }
    if (data.length === 0) { hasMore = false } else { allData = [...allData, ...data]; from += step }
  }
  return allData
}

const calculateTrendLine = (data, key) => {
  const validData = data.filter(d => d[key] !== null);
  if (validData.length < 2) return data;
  
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  const n = validData.length;
  
  validData.forEach((point, index) => {
    const y = point[key];
    sumX += index;
    sumY += y;
    sumXY += index * y;
    sumXX += index * index;
  });

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  return data.map((point) => {
    if (point[key] === null) return { ...point, [`trend_${key}`]: null };
    const index = validData.indexOf(point);
    return { ...point, [`trend_${key}`]: Math.round(slope * index + intercept) };
  });
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: '#1e293b', border: '1px solid #334155', padding: '12px', borderRadius: '8px', color: 'white', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
        <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', color: '#38bdf8' }}>Date : {label}</p>
        {payload.map((entry, index) => {
          if (entry.dataKey.startsWith('trend')) return null;
          if (entry.value === null) return null;
          return (
            <div key={index} style={{ display: 'flex', justifyContent: 'space-between', gap: '15px', marginBottom: '5px' }}>
              <span style={{ color: entry.color, fontWeight: 'bold' }}>{entry.name} : {entry.value}%</span>
            </div>
          )
        })}
      </div>
    )
  }
  return null
}

const CustomDot = (props) => {
  const { cx, cy, payload, dataKey } = props;
  // On colore le point en fonction de la ligne (bleu pour Gemba, orange pour 5S)
  const fill = dataKey === 'Gemba' ? '#38bdf8' : '#f59e0b';
  return <circle cx={cx} cy={cy} r={4} fill={fill} stroke="#0f172a" strokeWidth={1} />;
};

export default function TendanceLigne() {
  const [auditsGemba, setAuditsGemba] = useState([])
  const [audits5S, setAudits5S] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedLigne, setSelectedLigne] = useState('ALL')

  useEffect(() => {
    Promise.all([fetchAll('gemba_audits'), fetchAll('audits')]).then(([resGemba, res5S]) => {
      setAuditsGemba(resGemba || [])
      setAudits5S(res5S || [])
      setLoading(false)
    })
  }, [])

  const allLignes = useMemo(() => {
    const set = new Set()
    audits5S.forEach(a => { if (a.zone) set.add(a.zone.trim()) })
    auditsGemba.forEach(a => { if (a.ligne) set.add(a.ligne.trim()) })
    return Array.from(set).sort()
  }, [auditsGemba, audits5S])

  const linesData = useMemo(() => {
    const groupedByLine = {}

    // 1. Gemba
    auditsGemba.forEach(a => {
      const ligne = a.ligne?.trim()
      const dStr = extractDateString(a.date)
      if (!ligne || !dStr) return
      if (!groupedByLine[ligne]) groupedByLine[ligne] = {}
      if (!groupedByLine[ligne][dStr]) groupedByLine[ligne][dStr] = { gemba_ok: 0, gemba_total: 0, s5_sum: 0, s5_count: 0 }
      groupedByLine[ligne][dStr].gemba_total++
      if (String(a.reponse).toUpperCase() === 'OK') groupedByLine[ligne][dStr].gemba_ok++
    })

    // 2. 5S
    audits5S.forEach(a => {
      const ligne = a.zone?.trim()
      const dStr = extractDateString(a.date)
      if (!ligne || !dStr) return
      if (!groupedByLine[ligne]) groupedByLine[ligne] = {}
      if (!groupedByLine[ligne][dStr]) groupedByLine[ligne][dStr] = { gemba_ok: 0, gemba_total: 0, s5_sum: 0, s5_count: 0 }
      groupedByLine[ligne][dStr].s5_sum += Number(a.score_pct) || 0
      groupedByLine[ligne][dStr].s5_count++
    })

    // 3. Transformation
    const result = Object.entries(groupedByLine).map(([ligne, dates]) => {
      const chartData = Object.entries(dates).map(([date, data]) => {
        const gembaScore = data.gemba_total > 0 ? Math.round((data.gemba_ok / data.gemba_total) * 100) : null;
        const s5Score = data.s5_count > 0 ? Math.round(data.s5_sum / data.s5_count) : null;
        return { date, Gemba: gembaScore, S5: s5Score };
      }).sort((a, b) => a.date.localeCompare(b.date));

      // Calcul des tendances
      let withTrend = calculateTrendLine(chartData, 'Gemba');
      withTrend = calculateTrendLine(withTrend, 'S5');

      // KPI
      const gembaData = chartData.filter(d => d.Gemba !== null);
      const s5Data = chartData.filter(d => d.S5 !== null);
      
      const avgGemba = gembaData.length > 0 ? (gembaData.reduce((s, p) => s + p.Gemba, 0) / gembaData.length).toFixed(1) : '-';
      const avg5S = s5Data.length > 0 ? (s5Data.reduce((s, p) => s + p.S5, 0) / s5Data.length).toFixed(1) : '-';

      return {
        ligne,
        chartData: withTrend,
        totalAudits: chartData.length,
        avgGemba,
        avg5S
      }
    })

    return result;
  }, [auditsGemba, audits5S])

  const filteredLines = useMemo(() => {
    if (selectedLigne === 'ALL') return linesData;
    return linesData.filter(l => l.ligne === selectedLigne);
  }, [linesData, selectedLigne])

  if (loading) return <p className="muted" style={{ padding: '2rem' }}>Chargement des données…</p>

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: '1.5rem', alignItems: 'center' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>📈 Tendance par ligne (Gemba & 5S)</h1>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Filtrer par ligne :</label>
          <select 
            className="filter-control" 
            value={selectedLigne} 
            onChange={e => setSelectedLigne(e.target.value)}
            style={{ minWidth: '200px', fontWeight: 'bold' }}
          >
            <option value="ALL">Toutes les lignes</option>
            {allLignes.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: selectedLigne === 'ALL' ? 'repeat(auto-fit, minmax(450px, 1fr))' : '1fr', 
        gap: '2rem' 
      }}>
        {filteredLines.map(line => (
          <div key={line.ligne} className="card" style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '10px', border: '1px solid #334155' }}>
            
            {/* EN-TÊTE */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#f8fafc', margin: 0 }}>{line.ligne}</h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <span style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', padding: '0.3rem 0.6rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold', border: '1px solid #38bdf8' }}>
                  {line.totalAudits} audits
                </span>
              </div>
            </div>

            {/* GRAPHIQUE */}
            <div style={{ height: selectedLigne === 'ALL' ? '250px' : '400px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={line.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} dy={5} />
                  <YAxis domain={[0, 100]} unit="%" stroke="#94a3b8" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ paddingTop: '10px' }} />
                  
                  {/* Objectifs */}
                  <ReferenceLine y={90} stroke="#38bdf8" strokeDasharray="3 3" />
                  <ReferenceLine y={85} stroke="#f59e0b" strokeDasharray="3 3" />

                  {/* Courbes de tendance (Pointillés) */}
                  <Line type="monotone" dataKey="trend_Gemba" stroke="#38bdf8" strokeWidth={1} strokeDasharray="5 5" dot={false} activeDot={false} name="Tend. Gemba" />
                  <Line type="monotone" dataKey="trend_S5" stroke="#f59e0b" strokeWidth={1} strokeDasharray="5 5" dot={false} activeDot={false} name="Tend. 5S" />

                  {/* Courbes Réelles */}
                  <Line type="monotone" dataKey="Gemba" stroke="#38bdf8" strokeWidth={2} dot={<CustomDot />} activeDot={{ r: 6 }} name="Gemba" connectNulls />
                  <Line type="monotone" dataKey="S5" stroke="#f59e0b" strokeWidth={2} dot={<CustomDot />} activeDot={{ r: 6 }} name="5S" connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* PIED DE LA CARTE (KPI) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #334155' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#94a3b8', fontSize: '0.85rem' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#38bdf8' }}></div>
                Moy Gemba : <span style={{ color: '#f8fafc', fontWeight: 'bold' }}>{line.avgGemba}%</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#94a3b8', fontSize: '0.85rem' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b' }}></div>
                Moy 5S : <span style={{ color: '#f8fafc', fontWeight: 'bold' }}>{line.avg5S}%</span>
              </div>
            </div>

          </div>
        ))}
      </div>
    </div>
  )
}
