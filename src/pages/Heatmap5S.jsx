import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { QUESTIONS } from '../constants/checklist'

export default function Heatmap5S() {
  const [audits, setAudits] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('audits').select('*').then(({ data, error }) => {
      if (!error) setAudits(data || [])
      setLoading(false)
    })
  }, [])

  // Calcul de la matrice (Zone vs Question)
  const heatmapData = useMemo(() => {
    const zones = [...new Set(audits.map(a => a.zone).filter(Boolean))].sort()
    
    const data = zones.map(zone => {
      const row = { zone }
      
      // On parcourt les 26 questions (index 0 à 25)
      QUESTIONS.forEach((q, index) => {
        // On cherche le pourcentage de OK pour cette question spécifique dans cette zone
        let total = 0
        let ok = 0
        
        audits.filter(a => a.zone === zone).forEach(audit => {
          const cp = (audit.checkpoints || [])[index]
          if (cp && cp.s && cp.s !== 'N/A') {
            total++
            if (cp.s === 'OK') ok++
          }
        })

        if (total > 0) {
          row[index] = Math.round((ok / total) * 100)
        } else {
          row[index] = null
        }
      })
      return row
    })

    return { zones, data }
  }, [audits])

  const getColor = (score) => {
    if (score === null) return 'var(--bg-input)'
    if (score >= 87) return 'rgba(16, 185, 129, 0.8)'  // Vert
    if (score >= 85) return 'rgba(245, 158, 11, 0.8)'  // Orange
    return 'rgba(239, 68, 68, 0.8)'                    // Rouge
  }

  if (loading) return <p className="muted" style={{ padding: '2rem' }}>Chargement…</p>

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Heatmap 5S (Zones vs 26 Questions)</h1>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.75rem' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '0.5rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', position: 'sticky', left: 0, background: 'var(--bg-card)', zIndex: 2 }}>
                Zone / Question
              </th>
              {QUESTIONS.map((q, i) => (
                <th key={i} style={{ textAlign: 'center', padding: '0.5rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', width: '30px', verticalAlign: 'bottom' }}>
                  Q{i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {heatmapData.data.map(row => (
              <tr key={row.zone}>
                <td style={{ padding: '0.5rem', fontWeight: 'bold', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', position: 'sticky', left: 0, background: 'var(--bg-card)', zIndex: 1 }}>
                  {row.zone}
                </td>
                {QUESTIONS.map((q, index) => (
                  <td 
                    key={index} 
                    style={{ 
                      textAlign: 'center', 
                      padding: '0.5rem 0', 
                      borderBottom: '1px solid var(--border)',
                      background: getColor(row[index]),
                      color: row[index] !== null ? '#fff' : 'var(--text-muted)',
                      fontWeight: row[index] !== null ? 'bold' : 'normal',
                    }}
                    title={row[index] !== null ? `${q}\nScore : ${row[index]}%` : `${q}\nAucune donnée`}
                  >
                    {row[index] !== null ? `${row[index]}%` : '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Légende des questions pour s'y retrouver */}
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <h3 className="card-title" style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>Légende des questions</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '0.5rem', fontSize: '0.75rem' }}>
          {QUESTIONS.map((q, i) => (
            <div key={i} style={{ display: 'flex', gap: '0.5rem', color: 'var(--text-muted)' }}>
              <strong style={{ color: 'var(--primary)' }}>Q{i + 1}</strong>
              <span style={{ whiteSpace: 'normal' }}>{q}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
