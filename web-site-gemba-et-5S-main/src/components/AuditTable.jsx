const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : ''

const scoreClass = (pct) =>
  Number(pct) >= 80 ? 'score ok'
  : Number(pct) >= 60 ? 'score warn'
  : 'score bad'

export default function AuditTable({ audits }) {
  // plus récents en premier
  const rows = [...audits].reverse()

  return (
    <div className="table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Zone</th>
            <th>Pilote</th>
            <th>Auditeur</th>
            <th>Score</th>
            <th>NOK</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => {
            const nok = (a.checkpoints ?? []).filter((c) => c.s === 'NOK').length
            return (
              <tr key={`${a.date}|${a.zone}|${a.auditor}`}>
                <td>{fmtDate(a.date)}</td>
                <td>{a.zone}</td>
                <td>{a.pilot}</td>
                <td>{a.auditor}</td>
                <td className={scoreClass(a.score_pct)}>{a.score_pct} %</td>
                <td>{nok}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
