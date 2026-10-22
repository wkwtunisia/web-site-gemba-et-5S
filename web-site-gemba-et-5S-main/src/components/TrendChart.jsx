import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  Tooltip, CartesianGrid,
} from 'recharts'

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : ''

export default function TrendChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" tickFormatter={fmtDate} fontSize={12} />
        <YAxis domain={[0, 100]} fontSize={12} />
        <Tooltip labelFormatter={fmtDate} formatter={(v) => [`${v} %`, 'Score']} />
        <Line
          type="monotone"
          dataKey="score"
          stroke="#2563eb"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
