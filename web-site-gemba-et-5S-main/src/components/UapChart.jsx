import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, CartesianGrid, LabelList } from 'recharts'

const colorFor = (score) => score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444'
const axisStyle = { fontSize: 12, fill: '#94a3b8' }

export default function UapChart({ data, title }) {
  if (data.length === 0) {
    return <div className="card muted" style={{ textAlign: 'center', padding: '3rem' }}>Aucune donnée pour cet UAP.</div>
  }

  return (
    <div className="card">
      <h2 className="card-title">{title}</h2>
      <div style={{ height: 400, marginTop: '2rem' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 30, right: 30, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
            <XAxis dataKey="zone" tick={axisStyle} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={axisStyle} axisLine={false} tickLine={false} />
            <Tooltip 
              cursor={{ fill: 'rgba(255,255,255,0.05)' }}
              contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#fff' }} 
              formatter={(v) => [`${v} %`, 'Score Moyen']} 
            />
            <Bar dataKey="score" radius={[6, 6, 0, 0]} maxBarSize={80}>
              {data.map((entry, index) => <Cell key={index} fill={colorFor(entry.score)} />)}
              <LabelList dataKey="score" position="top" fill="#f8fafc" formatter={(v) => `${v}%`} fontSize={12} fontWeight="bold" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
