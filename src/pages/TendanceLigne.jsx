import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Legend, LabelList } from 'recharts'

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

// 🌟 LOGIQUE DE COULEURS
const getColorGemba = (score) => score >= 90 ? '#10b981' : score >= 85 ? '#f59e0b' : '#ef4444';
const getColor5S = (score) => score >= 86 ? '#10b981' : score >= 80 ? '#f59e0b' : '#ef4444';

// 🌟 INFOBULLE
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: '#1e293b', border: '1px solid #334155', padding: '12px', borderRadius: '8px', color: 'white', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
        <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', color: '#38bdf8' }}>Date : {label}</p>
        {payload.map((entry, index) => {
          if (entry.dataKey.startsWith('trend')) return null;
          if (entry.value === null) return null;
          
          const scoreColor = entry.dataKey === 'Gemba' ? getColorGemba(entry.value) : getColor5S(entry.value);

          return (
            <div key={index} style={{ display: 'flex', justifyContent: 'space-between', gap: '15px', marginBottom: '5px' }}>
              <span style={{ color: '#e2e8f0', fontWeight: 'bold' }}>{entry.name} :</span>
              <span style={{ color: scoreColor, fontWeight: 'bold' }}>{entry.value}%</span>
            </div>
          )
        })}
      </div>
    )
  }
  return null
}

// 🌟 POINT COLORÉ
const CustomDot = (props) => {
  const { cx, cy, payload, dataKey } = props;
  const value = payload[dataKey];
  if (value === null || value === undefined) return null;

  const fill = dataKey === 'Gemba' ? getColorGemba(value) : getColor5S(value);
  return <circle cx={cx} cy={cy} r={4} fill={fill} stroke="#0f172a" strokeWidth={1} />;
};

// 🌟 ÉTIQUETTE (VALEUR) COLORÉE
const CustomLabel = (props) => {
  const { x, y, value, dataKey } = props;
  if (value === null || value === undefined) return null;
  
  const color = dataKey === 'Gemba' ? getColorGemba(value) : getColor5S(value);

  return (
    <text x={x} y={y - 8} fill={color} fontSize={10} fontWeight="bold" textAnchor="middle">
      {value}%
    </text>
  );
};

export default function TendanceLigne() {
  const [auditsGemba, setAuditsGemba] = useState([])
  const [audits5S, setAudits5S] = useState([])
  const [loading, setLoading] = useState(true)
  
  const [selectedType, setSelectedType] = useState('ALL')
  const [selectedLigne, setSelectedLigne] = useState('ALL')
  const [selectedWeek, setSelectedWeek] = useState('ALL')

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

  const allWeeks = useMemo(() => {
    const set = new Set()
    audits5S.forEach(a => { const w = getWeekNumber(a.date); if (w) set.add(w) })
    auditsGemba.forEach(a => { const w = getWeekNumber(a.date); if (w) set.add(w) })
    return Array.from(set).sort()
  }, [auditsGemba, audits5S])

  const linesData = useMemo(() => {
    const groupedByLine = {}

    if (selectedType === 'ALL' || selectedType === 'GEMBA') {
      auditsGemba.forEach(a => {
        const ligne = a.ligne?.trim()
        const dStr = extractDateString(a.date)
        const week = getWeekNumber(a.date)
        if (!ligne || !dStr) return
        if (selectedWeek !== 'ALL' && week !== selectedWeek) return;

        if (!groupedByLine[ligne]) groupedByLine[ligne] = {}
        if (!groupedByLine[ligne][dStr]) groupedByLine[ligne][dStr] = { gemba_ok: 0, gemba_total: 0, s5_sum: 0, s5_count: 0 }
        groupedByLine[ligne][dStr].gemba_total++
        if (String(a.reponse).toUpperCase() === 'OK') groupedByLine[ligne][dStr].gemba_ok++
      })
    }

    if (selectedType === 'ALL' || selectedType === '5S') {
      audits5S.forEach(a => {
        const ligne = a.zone?.trim()
        const dStr = extractDateString(a.date)
        const week = getWeekNumber(a.date)
        if (!ligne || !dStr) return
        if (selectedWeek !== 'ALL' && week !== selectedWeek) return;

        if (!groupedByLine[ligne]) groupedByLine[ligne] = {}
        if (!groupedByLine[ligne][dStr]) groupedByLine[ligne][dStr] = { gemba_ok: 0, gemba_total: 0, s5_sum: 0, s5_count: 0 }
        groupedByLine[ligne][dStr].s5_sum += Number(a.score_pct) || 0
        groupedByLine[ligne][dStr].s5_count++
      })
    }

    const result = Object.entries(groupedByLine).map(([ligne, dates]) => {
      const chartData = Object.entries(dates).map(([date, data]) => {
        const gembaScore = data.gemba_total > 0 ? Math.round((data.gemba_ok / data.gemba_total) * 100) : null;
        const s5Score = data.s5_count > 0 ? Math.round(data.s5_sum / data.s5_count) : null;
        return { date, Gemba: gembaScore, S5: s5Score };
      }).sort((a, b) => a.date.localeCompare(b.date));

      const finalChartData = chartData.map(d => ({
        ...d,
        Gemba: (selectedType === 'ALL' || selectedType === 'GEMBA') ? d.Gemba : null,
        S5: (selectedType === 'ALL' || selectedType === '5S') ? d.S5 : null
      }))

      let withTrend = calculateTrendLine(finalChartData, 'Gemba');
      withTrend = calculateTrendLine(withTrend, 'S5');

      const gembaData = withTrend.filter(d => d.Gemba !== null);
      const s5Data = withTrend.filter(d => d.S5 !== null);
      
      const avgGemba = gembaData.length > 0 ? (gembaData.reduce((s, p) => s + p.Gemba, 0) / gembaData.length).toFixed(1) : '-';
      const avg5S = s5Data.length > 0 ? (s5Data.reduce((s, p) => s + p.S5, 0) / s5Data.length).toFixed(1) : '-';

      return {
        ligne,
        chartData: withTrend,
        totalAudits: withTrend.length,
        avgGemba,
        avg5S
      }
    }).filter(line => line.totalAudits > 0)

    return result;
  }, [auditsGemba, audits5S, selectedWeek, selectedType])

  const filteredLines = useMemo(() => {
    if (selectedLigne === 'ALL') return linesData;
    return linesData.filter(l => l.ligne === selectedLigne);
  }, [linesData, selectedLigne])

  if (loading) return <p className="muted" style={{ padding: '2rem' }}>Chargement des données…</p>

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: '1.5rem', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>📈 Tendance par ligne</h1>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Type :</label>
            <select className="filter-control" value={selectedType} onChange={e => setSelectedType(e.target.value)} style={{ minWidth: '130px', fontWeight: 'bold' }}>
              <option value="ALL">Tous</option>
              <option value="GEMBA">Gemba</option>
              <option value="5S">5S</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Semaine :</label>
            <select className="filter-control" value={selectedWeek} onChange={e => setSelectedWeek(e.target.value)} style={{ minWidth: '100px', fontWeight: 'bold' }}>
              <option value="ALL">Toutes</option>
              {allWeeks.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Ligne :</label>
            <select className="filter-control" value={selectedLigne} onChange={e => setSelectedLigne(e.target.value)} style={{ minWidth: '150px', fontWeight: 'bold' }}>
              <option value="ALL">Toutes</option>
              {allLignes.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>
      </div>

      {filteredLines.length === 0 ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Aucune donnée pour cette sélection.
        </div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: selectedLigne === 'ALL' ? 'repeat(auto-fit, minmax(450px, 1fr))' : '1fr', 
          gap: '2rem' 
        }}>
          {filteredLines.map(line => (
            <div key={line.ligne} className="card" style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '10px', border: '1px solid #334155' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#f8fafc', margin: 0 }}>{line.ligne}</h2>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <span style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', padding: '0.3rem 0.6rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold', border: '1px solid #38bdf8' }}>
                    {line.totalAudits} audits
                  </span>
                </div>
              </div>

              {/* 🌟 GRAPHIQUE */}
              <div style={{ height: selectedLigne === 'ALL' ? '250px' : '400px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={line.chartData} margin={{ top: 25, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} dy={5} />
                    <YAxis domain={[0, 100]} unit="%" stroke="#94a3b8" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ paddingTop: '10px' }} />
                    
                    <ReferenceLine y={90} stroke="#38bdf8" strokeDasharray="3 3" />
                    <ReferenceLine y={85} stroke="#f59e0b" strokeDasharray="3 3" />

                    {(selectedType === 'ALL' || selectedType === 'GEMBA') && (
                      <>
                        <Line type="monotone" dataKey="trend_Gemba" stroke="#38bdf8" strokeWidth={1} strokeDasharray="5 5" dot={false} activeDot={false} name="Tend. Gemba" />
                        <Line type="monotone" dataKey="Gemba" stroke="#38bdf8" strokeWidth={2} dot={<CustomDot />} activeDot={{ r: 6 }} name="Gemba" connectNulls>
                          <LabelList dataKey="Gemba" content={<CustomLabel dataKey="Gemba" />} />
                        </Line>
                      </>
                    )}

                    {(selectedType === 'ALL' || selectedType === '5S') && (
                      <>
                        <Line type="monotone" dataKey="trend_S5" stroke="#f59e0b" strokeWidth={1} strokeDasharray="5 5" dot={false} activeDot={false} name="Tend. 5S" />
                        <Line type="monotone" dataKey="S5" stroke="#f59e0b" strokeWidth={2} dot={<CustomDot />} activeDot={{ r: 6 }} name="5S" connectNulls>
                          <LabelList dataKey="S5" content={<CustomLabel dataKey="S5" />} />
                        </Line>
                      </>
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #334155' }}>
                {(selectedType === 'ALL' || selectedType === 'GEMBA') && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#94a3b8', fontSize: '0.85rem' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#38bdf8' }}></div>
                    Moy Gemba : <span style={{ color: getColorGemba(Number(line.avgGemba)), fontWeight: 'bold' }}>{line.avgGemba}%</span>
                  </div>
                )}
                
                {(selectedType === 'ALL' || selectedType === '5S') && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#94a3b8', fontSize: '0.85rem' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b' }}></div>
                    Moy 5S : <span style={{ color: getColor5S(Number(line.avg5S)), fontWeight: 'bold' }}>{line.avg5S}%</span>
                  </div>
                )}
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  )
}
