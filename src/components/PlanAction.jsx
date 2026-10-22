export default function PlanAction({ audits }) {
  // On extrait toutes les actions de tous les audits
  const actionsList = []
  
  audits.forEach(audit => {
    audit.checkpoints?.forEach((cp, index) => {
      // Si une action a été saisie (le champ 'a' n'est pas vide) et que c'est NOK
      if (cp.a && cp.a.trim() !== '') {
        actionsList.push({
          date: audit.date,
          zone: audit.zone,
          auditor: audit.auditor,
          pilot: audit.pilot,
          problem: cp.q,
          action: cp.a,
          index
        })
      }
    })
  })

  // On trie par date (les plus récents en premier)
  actionsList.sort((a, b) => new Date(b.date) - new Date(a.date))

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Plan d'action (NOK)</h1>
        <div className="card" style={{ margin: 0, padding: '0.5rem 1rem', background: 'var(--bg-card)' }}>
          <strong>{actionsList.length}</strong> action(s) à traiter
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {actionsList.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center' }} className="muted">
            Aucune action enregistrée pour le moment.
          </div>
        ) : (
          <div className="table-wrapper" style={{ maxHeight: 'calc(100vh - 200px)', border: 'none' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Ligne / Zone</th>
                  <th>Pilote</th>
                  <th>Problème (Point 5S)</th>
                  <th>Action / Commentaire</th>
                </tr>
              </thead>
              <tbody>
                {actionsList.map((item, i) => (
                  <tr key={i}>
                    <td style={{ whiteSpace: 'nowrap' }}>{new Date(item.date).toLocaleDateString('fr-FR')}</td>
                    <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{item.zone}</td>
                    <td>{item.pilot || '—'}</td>
                    <td className="text-warning" style={{ maxWidth: '300px' }}>{item.problem}</td>
                    <td style={{ maxWidth: '400px', whiteSpace: 'normal', fontWeight: 500 }}>
                      {item.action}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
