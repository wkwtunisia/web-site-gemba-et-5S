import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabaseClient'

export default function GembaAnalyse() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('gemba_audits').select('*').then(({ data, error }) => {
      if (!error) setData(data || [])
      setLoading(false)
    })
  }, [])

  // 1. Top 5 des problèmes (Questions avec le plus de NOK)
  const topNok = useMemo(() => {
    const nokCount = {}
    data.forEach(row => {
      if (String(row.reponse).toUpperCase() === 'NOK') {
        const q = row.question
        nokCount[q] = (nokCount[q] || 0) + 1
      }
    })
    return Object.entries(nokCount).map(([q, count]) => ({ q, count })).sort((a, b) => b.count - a.count).slice(0, 5)
  }, [data])

  // 2. Top 5 des points forts (Questions avec le plus de OK)
  const topOk = useMemo(() => {
    const okCount = {}
    data.forEach(row => {
      if (String(row.reponse).toUpperCase() === 'OK') {
        const q = row.question
        okCount[q] = (okCount[q] || 0) + 1
      }
    })
    return Object.entries(okCount).map(([q, count]) => ({ q, count })).sort((a, b) => b.count - a.count).slice(0, 5)
  }, [data])

  // 3. Axes (Piliers) : Meilleur et Pire
  const pillarStats = useMemo(() => {
    const groups = {}
    data.forEach(row => {
      if (!row.point_m) return
      const rep = String(row.reponse).toUpperCase()
      if (rep === 'N/A') return
      
      if (!groups[row.point_m]) groups[row.point_m] = { ok: 0, total: 0 }
      groups[row.point_m].total++
      if (rep === 'OK') groups[row.point_m].ok++
    })

    return Object.entries(groups).map(([name, s]) => ({
      name,
      score: Math.round((s.ok / s.total) * 100)
    })).sort((a, b) => b.score - a.score)
  }, [data])

  const bestPillar = pillarStats[0] || { name: '-', score: 0 }
  const worstPillar = pillarStats[pillarStats.length - 1] || { name: '-', score: 0 }

  if (loading) return <p className="muted" style={{ padding: '2rem' }}>Chargement…</p>

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Analyse & Priorités Gemba</h1>
      </div>

      {/* SECTION AXES : MAINTENIR VS AMÉLIORER */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="card" style={{ borderLeft: '4px solid var(--success)', background: 'linear-gradient(90deg, rgba(16,185,129,0.1) 0%, var(--bg-card) 100%)' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--success)', fontSize: '1rem' }}>🛡️ Pilier à maintenir (M)</h3>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)' }}>{bestPillar.name}</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--success)' }}>{bestPillar.score}%</div>
        </div>

        <div className="card" style={{ borderLeft: '4px solid var(--danger)', background: 'linear-gradient(90deg, rgba(239,68,68,0.1) 0%, var(--bg-card) 100%)' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--danger)', fontSize: '1rem' }}>🚨 Pilier à améliorer (M)</h3>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)' }}>{worstPillar.name}</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--danger)' }}>{worstPillar.score}%</div>
        </div>
      </div>

      <div className="grid-2">
        {/* TOP 5 NOK */}
        <div className="card">
          <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.1rem', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>⚠️</span> Top 5 des problèmes (NOK)
          </h3>
          <ul className="top-list">
            {topNok.length === 0 ? <p className="muted">Aucun problème détecté.</p> : topNok.map((item, i) => (
              <li key={i} style={{ background: 'var(--bg-main)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 'bold', color: 'var(--danger)' }}>Problème #{i + 1}</span>
                  <span className="badge bad">{item.count} NOK</span>
                </div>
                <div style={{ fontSize: '0.875rem', whiteSpace: 'normal' }}>{item.q}</div>
              </li>
            ))}
          </ul>
        </div>

        {/* TOP 5 OK */}
        <div className="card">
          <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.1rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>🌟</span> Top 5 des points forts (OK)
          </h3>
          <ul className="top-list">
            {topOk.length === 0 ? <p className="muted">Aucune donnée.</p> : topOk.map((item, i) => (
              <li key={i} style={{ background: 'var(--bg-main)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 'bold', color: 'var(--success)' }}>Point fort #{i + 1}</span>
                  <span className="badge ok">{item.count} OK</span>
                </div>
                <div style={{ fontSize: '0.875rem', whiteSpace: 'normal' }}>{item.q}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
