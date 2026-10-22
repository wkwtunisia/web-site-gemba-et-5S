import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { fetchActions } from '../services/actionsApi'

export default function PilotesGemba() {
  const [audits, setAudits] = useState([])
  const [actions, setActions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('gemba_audits').select('*'),
      fetchActions()
    ]).then(([auditsRes, actionsRes]) => {
      if (!auditsRes.error) setAudits(auditsRes.data || [])
      setActions(actionsRes)
      setLoading(false)
    })
  }, [])

  const piloteStats = useMemo(() => {
    const stats = {}
    actions.filter(a => a.type === 'GEMBA').forEach(action => {
      if (!action.pilote_email) return 
      const pilote = action.pilote_email
      if (!stats[pilote]) stats[pilote] = { total: 0, realisees: 0, nonRealisees: 0, enRetard: 0 }
      stats[pilote].total++
      if (action.progression === 100) {
        stats[pilote].realisees++
      } else {
        stats[pilote].nonRealisees++
        if (action.date_prevue && new Date(action.date_prevue) < new Date(new Date().toISOString().split('T')[0])) {
          stats[pilote].enRetard++
        }
      }
    })
    return Object.entries(stats).map(([email, data]) => ({
      email,
      ...data,
      taux: data.total > 0 ? Math.round((data.realisees / data.total) * 100) : 0
    })).sort((a, b) => b.total - a.total)
  }, [actions])

  const totalEnRetard = piloteStats.reduce((sum, p) => sum + p.enRetard, 0)

  if (loading) return <p className="muted" style={{ padding: '2rem' }}>Chargement…</p>

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Suivi par Pilote (Gemba)</h1>
      </div>

      {totalEnRetard > 0 && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', borderLeft: '4px solid var(--danger)', padding: '1rem', borderRadius: '4px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.5rem' }}>🚨</span>
          <div>
            <div style={{ fontWeight: 'bold', color: 'var(--danger)' }}>Alerte globale : {totalEnRetard} action(s) Gemba en retard dans l'usine.</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Veuillez relancer les pilotes concernés.</div>
          </div>
        </div>
      )}

      {/* Grille avec cartes limitées à 350px max */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {piloteStats.length === 0 ? (
          <p className="muted">Aucune action assignée pour le moment.</p>
        ) : piloteStats.map((p) => (
          <div key={p.email} className="card" style={{ 
            borderTop: `4px solid ${p.enRetard > 0 ? 'var(--danger)' : p.taux === 100 ? 'var(--success)' : 'var(--warning)'}`,
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem'
          }}>
            <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              👤 {p.email.split('@')[0]}
            </h3>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{p.total}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total</div>
              </div>
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--success)' }}>{p.realisees}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Faites</div>
              </div>
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--warning)' }}>{p.nonRealisees}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>En cours</div>
              </div>
              {p.enRetard > 0 && (
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--danger)' }}>{p.enRetard}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--danger)', fontWeight: 'bold', textTransform: 'uppercase' }}>Retard</div>
                </div>
              )}
            </div>

            <div>
              <div style={{ width: '100%', height: '6px', background: 'var(--bg-hover)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${p.taux}%`, height: '100%', background: p.taux === 100 ? 'var(--success)' : 'var(--warning)', borderRadius: '4px' }} />
              </div>
              <div style={{ textAlign: 'right', fontSize: '0.7rem', marginTop: '0.25rem', color: 'var(--text-muted)' }}>{p.taux}%</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
