import {
  ResponsiveContainer, BarChart, Bar, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'

const colorFor = (score) =>
  score >= 80 ? '#16a34a' : score >= 60 ? '#f59e0b' : '#dc2626'

export default function ZoneRankingChart({ data }) {
  const height = Math.max(260, data.length * 28)
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 90 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" domain={[0, 100]} fontSize={12} />
        <YAxis type="category" dataKey="zone" fontSize={12} width={90} />
        <Tooltip formatter={(v) => `${v} %`} />
        <Bar dataKey="score">
          {data.map((z, i) => (
            <Cell key={i} fill={colorFor(z.score)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
