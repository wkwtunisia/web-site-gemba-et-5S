import { getGembaGroupedData, get5SGroupedData, calculerMoyennesUAPGemba, calculerMoyennesUAP5S } from '../utils/stats'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { fetchAllGembaData } from '../services/gembaApi'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, LabelList, Legend } from 'recharts'

const getColor = (score) => score >= 90 ? '#10b981' : score >= 85 ? '#f59e0b' : '#ef4444'
const axisStyle = { fontSize: 12, fill: '#94a3b8' }

const extractMonth = (dateStr) => {
  if (!dateStr) return null;
  const str = String(dateStr).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.substring(0, 7);
  if (/^\d{2}\/\d{2}\/\d{4}/.test(str)) {
    const parts = str.split('/');
    return `${parts[2]}-${parts[1]}`;
  }
  return null;
}

const formatMonthLabel = (monthStr) => {
  if (!monthStr) return ''
  const [year, month] = monthStr.split('-')
  const date = new Date(Number(year), Number(month) - 1, 1)
  return date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
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

export default function CourbesMensuelles() {
  const [type, setType] = useState('gemba')
  const [dataGemba, setDataGemba] = useState([])
  const [data5S, setData5S] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      const [gemba, s5] = await Promise.all([
        fetchAllGembaData(),
        supabase.from('audits').select('*')
      ])
      setDataGemba(gemba || [])
      setData5S(s5.data || [])
      setLoading(false)
    }
    loadData()
  }, [])

      const chartData = useMemo(() => {
    const dataParMois = {}
    const source = type === 'gemba' ? dataGemba : data5S
    
    source.forEach(row => {
      const month = extractMonth(row.date)
      if (!month) return
      if (!dataParMois[month]) dataParMois[month] = []
      dataParMois[month].push(row)
    })

    return Object.entries(dataParMois).map(([month, audits]) => {
      let kpis;
      if (type === 'gemba') {
        const grouped = getGembaGroupedData(audits);
        kpis = calculerMoyennesUAPGemba(grouped);
      } else {
        const grouped = get5SGroupedData(audits);
        kpis = calculerMoyennesUAP5S(grouped);
      }
        
      return {
        label: formatMonthLabel(month),
        month,
        uap1: kpis.uap1,
        uap2: kpis.uap2,
        logistique: kpis.logistique,
        usine: kpis.usine
      }
    }).sort((a, b) => a.month.localeCompare(b.month))
  }, [dataGemba, data5S, type])

  const CustomLabel = (props) => {
    const { x, y, value } = props; if (value === null || value === undefined) return null
    return <text x={x} y={y - 12} fill="#f8fafc" fontSize={11} fontWeight="bold" textAnchor="middle">{value}%</text>
  }

  const GraphCard = ({ title, dataKey, color }) => {
    const hasData = chartData.some(d => d[dataKey] !== null)
    return (
      <div className="card" style={{ padding: '1rem' }}>
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: color }}>{title}</h3>
        {!hasData ? <div className="muted" style={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Aucune donnée</div> : (
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 25, right: 15, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} dy={10} />
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

  if (loading) return <p className="muted" style={{ padding: '2rem' }}>Chargement des données annuelles…</p>

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: '1.5rem', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>📈 Courbes Mensuelles (Année)</h1>
        
        <div style={{ display: 'flex', background: 'var(--surface)', borderRadius: '8px', padding: '0.25rem', border: '1px solid var(--border)' }}>
          <button 
            onClick={() => setType('gemba')}
            style={{ padding: '0.5rem 1.2rem', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 'bold',
              background: type === 'gemba' ? '#3b82f6' : 'transparent', 
              color: type === 'gemba' ? '#fff' : 'var(--text-muted)' }}
          >
            Gemba
          </button>
          <button 
            onClick={() => setType('5s')}
            style={{ padding: '0.5rem 1.2rem', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 'bold',
              background: type === '5s' ? '#8b5cf6' : 'transparent', 
              color: type === '5s' ? '#fff' : 'var(--text-muted)' }}
          >
            5S
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '1.5rem' }}>
        <GraphCard title="Évolution UAP 1" dataKey="uap1" color="#3b82f6" />
        <GraphCard title="Évolution UAP 2" dataKey="uap2" color="#8b5cf6" />
        <GraphCard title="Évolution Logistique" dataKey="logistique" color="#f59e0b" />
        <GraphCard title="Évolution Moyenne Usine" dataKey="usine" color="#10b981" />
      </div>
    </div>
  )
}
