import { useState, useEffect, useMemo, Fragment } from 'react'
import { supabase } from '../supabaseClient'
import { getMonthKey, formatMonthLabel } from '../utils/dateHelpers'

export default function GembaAudits() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [monthFilter, setMonthFilter] = useState('')
  const [expandedAudit, setExpandedAudit] = useState(null)

  useEffect(() => {
    supabase.from('gemba_audits').select('*').order('date', { ascending: false }).then(({ data, error }) => {
      if (!error) setData(data || [])
      setLoading(false)
    })
  }, [])

  const months = useMemo(() => [...new Set(data.map(d => getMonthKey(d.date)).filter(Boolean))].sort().reverse(), [data])
  const filtered = useMemo(() => data.filter(d => !monthFilter || getMonthKey(d.date) === monthFilter), [data, monthFilter])

  // Regroupement par Audit (Date + Ligne) ET SUPPRESSION DES DOUBLONS DE QUESTIONS
  const auditsGrouped = useMemo(() => {
    const groups = {}
    
    filtered.forEach(row => {
      const auditKey = `${row.date}|${row.ligne}`
      if (!groups[auditKey]) {
        groups[auditKey] = { 
          id: auditKey,
          date: row.date, 
          ligne: row.ligne, 
          uap: row.uap, 
          ok: 0, 
          nok: 0, 
          na: 0,
          total_questions: 0,
          rows: [],
          seenQuestions: new Set() // Pour éviter les doublons
        }
      }
      
      // On nettoie le nom de la question pour comparer
      const questionText = String(row.question).trim().toLowerCase()
      
      // Si on a déjà vu cette question pour cet audit, on l'ignore
      if (groups[auditKey].seenQuestions.has(questionText)) {
        return
      }
      
      // Sinon on l'ajoute
      groups[auditKey].seenQuestions.add(questionText)
      
      const rep = String(row.reponse).toUpperCase()
      if (rep === 'OK') groups[auditKey].ok++
      if (rep === 'NOK') groups[auditKey].nok++
      if (rep === 'N/A') groups[auditKey].na++
      
      if (rep !== 'N/A') groups[auditKey].total_questions++
      
      groups[auditKey].rows.push(row)
    })

    return Object.values(groups).map(audit => {
      // On supprime le Set avant de renvoyer l'objet
      delete audit.seenQuestions
      
      const score = audit.total_questions > 0 
        ? Math.round((audit.ok / audit.total_questions) * 100) 
        : 0
      return { ...audit, score }
    }).sort((a, b) => b.date.localeCompare(a.date))
  }, [filtered])

  if (loading) return <p className="muted" style={{ padding: '2rem' }}>Chargement…</p>

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Liste des Audits Gemba</h1>
        
        <select className="filter-control" value={monthFilter} onChange={e => setMonthFilter(e.target.value)}>
          <option value="">Tous les mois</option>
          {months.map(m => <option key={m} value={m}>{formatMonthLabel(m)}</option>)}
        </select>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrapper" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Ligne</th>
                <th>UAP</th>
                <th>Score</th>
                <th>Détail (OK / NOK / N/A)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {auditsGrouped.map(audit => {
                const scoreClass = audit.score >= 87 ? 'ok' : audit.score >= 85 ? 'warn' : 'bad'
                const isExpanded = expandedAudit === audit.id

                return (
                  <Fragment key={audit.id}>
                    <tr style={{ cursor: 'pointer', background: isExpanded ? 'var(--bg-hover)' : 'transparent' }} onClick={() => setExpandedAudit(isExpanded ? null : audit.id)}>
                      <td>{new Date(audit.date).toLocaleDateString('fr-FR')}</td>
                      <td style={{ fontWeight: 'bold' }}>{audit.ligne}</td>
                      <td>{audit.uap}</td>
                      <td className={`score ${scoreClass}`} style={{ fontSize: '1.1rem' }}>{audit.score} %</td>
                      <td>
                        <span style={{ color: 'var(--success)' }}>{audit.ok} OK</span> / 
                        <span style={{ color: 'var(--danger)', margin: '0 0.5rem' }}>{audit.nok} NOK</span> / 
                        <span style={{ color: 'var(--text-muted)' }}>{audit.na} N/A</span>
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--primary)' }}>
                        {isExpanded ? '▼ Masquer' : '▶ Voir les questions'}
                      </td>
                    </tr>
                    
                    {/* LIGNES DÉTAILLÉES (Affichées si on clique sur l'audit) */}
                    {isExpanded && (
                      <tr>
                        <td colSpan="6" style={{ padding: 0, background: 'var(--bg-main)' }}>
                          <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)' }}>
                            <table className="data-table" style={{ fontSize: '0.85rem' }}>
                              <thead>
                                <tr>
                                  <th>Point M</th>
                                  <th>Question</th>
                                  <th>Réponse</th>
                                  <th>Action / Commentaire</th>
                                  <th>Pilote</th>
                                </tr>
                              </thead>
                              <tbody>
                                {audit.rows.map((r, i) => (
                                  <tr key={i} style={{ background: r.reponse === 'NOK' ? 'rgba(239,68,68,0.05)' : 'transparent' }}>
                                    <td style={{ color: 'var(--text-muted)' }}>{r.point_m}</td>
                                    <td style={{ whiteSpace: 'normal', maxWidth: '300px' }}>{r.question}</td>
                                    <td>
                                      <span className={`badge ${r.reponse === 'OK' ? 'ok' : r.reponse === 'NOK' ? 'bad' : ''}`}>
                                        {r.reponse}
                                      </span>
                                    </td>
                                    <td style={{ whiteSpace: 'normal', maxWidth: '300px', color: 'var(--warning)' }}>{r.action}</td>
                                    <td>{r.pilote}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
