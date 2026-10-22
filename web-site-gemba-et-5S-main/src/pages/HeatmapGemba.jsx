import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabaseClient'

export default function HeatmapGemba() {
  const [audits, setAudits] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('gemba_audits').select('*').then(({ data, error }) => {
      if (!error) setAudits(data || [])
      setLoading(false)
    })
  }, [])

  const heatmapData = useMemo(() => {
    const lignes = [...new Set(audits.map(a => a.ligne).filter(Boolean))].sort()
    const pointMs = [...new Set(audits.map(a => a.point_m).filter(Boolean))].sort()
    
    // On prépare les données
    const data = lignes.map(ligne => {
      const row = { ligne }
      pointMs.forEach(m => {
        const mAudits = audits.filter(a => a.ligne === ligne && a.point_m === m && a.reponse !== 'N/A')
        if (mAudits.length > 0) {
          const okCount = mAudits.filter(a => a.reponse === 'OK').length
          row[m] = Math.round((okCount / mAudits.length) * 100)
        } else {
          row[m] = null
        }
      })
      return row
    })

    return { lignes, pointMs, data }
  }, [audits])

  const getColor = (score) => {
    if (score === null) return 'var(--bg-input)'
    if (score >= 87) return 'rgba(16, 185, 129, 0.8)'
    if (score >= 85) return 'rgba(245, 158, 11, 0.8)'
    return 'rgba(239, 68, 68, 0.8)'
  }

  if (loading) return <p className="muted" style={{ padding: '2rem' }}>Chargement…</p>

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Heatmap Gemba (Lignes vs 5M)</h1>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.85rem' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '0.5rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>Ligne / Zone</th>
              {heatmapData.pointMs.map(m => (
                <th key={m} style={{ textAlign: 'center', padding: '0.5rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {heatmapData.data.map(row => (
              <tr key={row.ligne}>
                <td style={{ padding: '0.5rem', fontWeight: 'bold', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{row.ligne}</td>
                {heatmapData.pointMs.map(m => (
                  <td 
                    key={m} 
                    style={{ 
                      textAlign: 'center', 
                      padding: '0.5rem', 
                      borderBottom: '1px solid var(--border)',
                      background: getColor(row[m]),
                      color: row[m] !== null ? '#fff' : 'var(--text-muted)',
                      fontWeight: row[m] !== null ? 'bold' : 'normal',
                      transition: 'all 0.2s'
                    }}
                    title={row[m] !== null ? `Score : ${row[m]}%` : 'Aucune donnée'}
                  >
                    {row[m] !== null ? `${row[m]}%` : '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
