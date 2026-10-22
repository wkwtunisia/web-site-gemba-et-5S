import KpiCard from './KpiCard'

export default function KpiGrid({ kpi }) {
  return (
    <div className="kpi-grid">
      <KpiCard label="Score moyen"       value={`${kpi.avg} %`} />
      <KpiCard label="Audits"            value={kpi.count} />
      <KpiCard label="Points NOK"        value={kpi.nok} tone="danger" />
      <KpiCard label="Meilleure zone"    value={kpi.best} tone="success" />
      <KpiCard label="Zone à améliorer"  value={kpi.worst} tone="warning" />
    </div>
  )
}
