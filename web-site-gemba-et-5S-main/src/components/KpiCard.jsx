export default function KpiCard({ label, value, tone }) {
  const cls = tone ? `kpi-value accent-${tone}` : 'kpi-value'
  return (
    <div className="card">
      <div className="kpi-label">{label}</div>
      <div className={cls}>{value}</div>
    </div>
  )
}
