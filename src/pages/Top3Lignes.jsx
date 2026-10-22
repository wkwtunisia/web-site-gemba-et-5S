import { useState, useMemo } from 'react'
import { getMonthKey, formatMonthLabel } from '../utils/dateHelpers'

export default function Top3Lignes({ audits }) {
  const [selectedMonth, setSelectedMonth] = useState('')

  const months = useMemo(() => [...new Set(audits.map(a => getMonthKey(a.date)).filter(Boolean))].sort().reverse(), [audits])

  // Fonction pour nettoyer le nom de la ligne (fusionner les doublons d'accents)
  const cleanZoneName = (zone) => {
    if (!zone) return ''
    let clean = zone.toUpperCase()
    clean = clean.normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Enlève les accents
    clean = clean.replace(/\s+/g, ' ').trim()
    if (clean === 'MAGASIN GÉNÉRAL' || clean === 'MAGASIN GENERAL') return 'MAGASIN GENERAL'
    return clean
  }

  // Fonction pour calculer le classement
  const getRanking = (auditList) => {
    const scores = new Map()

    auditList.forEach(a => {
      if (!a.zone) return
      const zoneName = cleanZoneName(a.zone)
      
      if (!scores.has(zoneName)) scores.set(zoneName, { sum: 0, count: 0 })
      const current = scores.get(zoneName)
      current.sum += Number(a.score_pct)
      current.count++
    })

    const array = Array.from(scores.entries()).map(([zone, data]) => ({
      zone,
      score: Number((data.sum / data.count).toFixed(1)),
      count: data.count
    }))

    array.sort((a, b) => b.score - a.score)
    return array
  }

  const globalRanking = useMemo(() => getRanking(audits), [audits])
  
  const monthRanking = useMemo(() => {
    if (!selectedMonth) return []
    const filtered = audits.filter(a => getMonthKey(a.date) === selectedMonth)
    return getRanking(filtered)
  }, [audits, selectedMonth])

  const RankingList = ({ title, data, isTop }) => {
    const color = isTop ? '#10b981' : '#ef4444'
    const icon = isTop ? '🏆' : '⚠️'
    
    const displayData = data.slice(0, 3)

    return (
      <div className="card" style={{ borderTop: `4px solid ${color}`, height: '100%' }}>
        <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.1rem', color: color, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>{icon}</span> {title}
        </h3>
        {displayData.length === 0 ? (
          <p className="muted">Pas assez de données.</p>
        ) : (
          <ul className="top-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {displayData.map((item, index) => (
              <li key={item.zone} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-main)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>#{index + 1}</span>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '1rem', color: 'var(--text-main)' }}>{item.zone}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.count} audit(s)</div>
                  </div>
                </div>
                <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: color }}>
                  {item.score}%
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Top & Bottom 3 Lignes</h1>
      </div>

      {/* NOTICE EXPLICATIVE */}
      <div className="card" style={{ background: 'rgba(59, 130, 246, 0.1)', borderLeft: '4px solid #3b82f6', marginBottom: '2rem', padding: '1rem 1.5rem' }}>
        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          ℹ️ Comment sont calculés ces classements ?
        </h3>
        <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: 1.6 }}>
          <li><strong>Moyenne par ligne :</strong> Le score affiché est la moyenne de tous les audits réalisés sur cette ligne (ex: 2 audits à 80% et 90% donnent 85%).</li>
          <li><strong>Fusion des doublons :</strong> Les noms de lignes sont nettoyés (ex: "MAGASIN GÉNÉRAL" avec accent et "MAGASIN GENERAL" sans accent sont additionnés comme une seule ligne).</li>
          <li><strong>Sélection Top/Bottom 3 :</strong> Toutes les lignes sont triées de la meilleure à la moins bonne moyenne. Le Top 3 prend les 3 premières, le Bottom 3 prend les 3 dernières.</li>
        </ul>
      </div>

      {/* SECTION GLOBALE */}
      <div style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--text-main)' }}>Classement Global (Tous les audits)</h2>
        <div className="grid-2">
          <RankingList title="Top 3 Meilleures Lignes" data={globalRanking} isTop={true} />
          <RankingList title="Bottom 3 Lignes à améliorer" data={[...globalRanking].reverse()} isTop={false} />
        </div>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '3rem 0' }} />

      {/* SECTION PAR MOIS */}
      <div>
        <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.2rem', margin: 0, color: 'var(--text-main)' }}>Classement par Mois</h2>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <label style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Sélectionner un mois :</label>
            <select className="filter-control" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
              <option value="">-- Choisir un mois --</option>
              {months.map(m => <option key={m} value={m}>{formatMonthLabel(m)}</option>)}
            </select>
          </div>
        </div>

        {!selectedMonth ? (
          <div className="card muted" style={{ textAlign: 'center', padding: '3rem' }}>
            Veuillez sélectionner un mois ci-dessus pour afficher le classement.
          </div>
        ) : monthRanking.length === 0 ? (
          <div className="card muted" style={{ textAlign: 'center', padding: '3rem' }}>
            Aucun audit pour ce mois.
          </div>
        ) : (
          <div className="grid-2">
            <RankingList title={`Top 3 en ${formatMonthLabel(selectedMonth)}`} data={monthRanking} isTop={true} />
            <RankingList title={`Bottom 3 en ${formatMonthLabel(selectedMonth)}`} data={[...monthRanking].reverse()} isTop={false} />
          </div>
        )}
      </div>

    </div>
  )
}
