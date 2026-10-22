import { useState, useMemo } from 'react'
import { getMonthKey, getWeekKey, formatMonthLabel, formatWeekLabel } from '../utils/dateHelpers'
import { QUESTIONS } from '../constants/checklist'

// Configuration des 5 piliers
const PILLARS_CONFIG = [
  { name: 'Seiri (Trier)', range: [0, 3] },
  { name: 'Seiton (Ranger)', range: [4, 8] },
  { name: 'Seiso (Nettoyer)', range: [9, 14] },
  { name: 'Seiketsu (Standardiser)', range: [15, 21] },
  { name: 'Shitsuke (Respecter)', range: [22, 25] }
]

export default function AnalysePriorites({ audits }) {
  const [filters, setFilters] = useState({ month: '', week: '', zone: '' })

  // Listes pour les menus déroulants
  const months = useMemo(() => [...new Set(audits.map(a => getMonthKey(a.date)).filter(Boolean))].sort().reverse(), [audits])
  const weeks = useMemo(() => [...new Set(audits.map(a => getWeekKey(a.date)).filter(Boolean))].sort().reverse(), [audits])
  const zones = useMemo(() => [...new Set(audits.map(a => a.zone).filter(Boolean))].sort(), [audits])

  // Application des filtres
  const filteredAudits = useMemo(() => audits.filter(a => {
    if (filters.month && getMonthKey(a.date) !== filters.month) return false
    if (filters.week && getWeekKey(a.date) !== filters.week) return false
    if (filters.zone && a.zone !== filters.zone) return false
    return true
  }), [audits, filters])

  // --- 1. CALCUL DES QUESTIONS (NOK ET OK) ---
  const questionStats = useMemo(() => {
    const stats = QUESTIONS.map((q, index) => ({ text: q, index, ok: 0, nok: 0 }))

    filteredAudits.forEach(audit => {
      (audit.checkpoints || []).forEach((cp, idx) => {
        if (!stats[idx]) return
        const s = String(cp.s).toUpperCase()
        if (s === 'OK') stats[idx].ok++
        if (s === 'NOK') stats[idx].nok++
      })
    })

    return stats
  }, [filteredAudits])

  // Top 5 NOK (Problèmes)
  const top5Nok = useMemo(() => {
    return [...questionStats].sort((a, b) => b.nok - a.nok).filter(q => q.nok > 0).slice(0, 5)
  }, [questionStats])

  // Top 5 OK (Points forts)
  const top5Ok = useMemo(() => {
    return [...questionStats].sort((a, b) => b.ok - a.ok).filter(q => q.ok > 0).slice(0, 5)
  }, [questionStats])

  // --- 2. CALCUL DES AXES (PILIERS) ---
  const pillarScores = useMemo(() => {
    return PILLARS_CONFIG.map(p => {
      let ok = 0, nok = 0
      for (let i = p.range[0]; i <= p.range[1]; i++) {
        if (questionStats[i]) {
          ok += questionStats[i].ok
          nok += questionStats[i].nok
        }
      }
      const total = ok + nok
      const score = total > 0 ? Math.round((ok / total) * 100) : 0
      return { name: p.name, score }
    })
  }, [questionStats])

  // Trouver le meilleur et le pire pilier
  const bestPillar = useMemo(() => {
    return [...pillarScores].sort((a, b) => b.score - a.score)[0] || { name: '-', score: 0 }
  }, [pillarScores])

  const worstPillar = useMemo(() => {
    return [...pillarScores].sort((a, b) => a.score - b.score)[0] || { name: '-', score: 0 }
  }, [pillarScores])

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Analyse & Priorités d'Action</h1>
      </div>

      {/* Barre de filtres complète */}
      <div className="card" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ligne / Zone</label>
          <select className="filter-control" value={filters.zone} onChange={e => setFilters({ ...filters, zone: e.target.value })}>
            <option value="">Toutes les lignes</option>
            {zones.map(z => <option key={z} value={z}>{z}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Mois</label>
          <select className="filter-control" value={filters.month} onChange={e => setFilters({ ...filters, month: e.target.value, week: '' })}>
            <option value="">Tous les mois</option>
            {months.map(m => <option key={m} value={m}>{formatMonthLabel(m)}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Semaine</label>
          <select className="filter-control" value={filters.week} onChange={e => setFilters({ ...filters, month: '', week: e.target.value })}>
            <option value="">Toutes les semaines</option>
            {weeks.map(w => <option key={w} value={w}>{formatWeekLabel(w)}</option>)}
          </select>
        </div>
        <button className="btn btn-secondary" onClick={() => setFilters({ month: '', week: '', zone: '' })}>
          Réinitialiser
        </button>
      </div>

      {/* SECTION AXES : MAINTENIR VS AMÉLIORER */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="card" style={{ borderLeft: '4px solid var(--success)', background: 'linear-gradient(90deg, rgba(16,185,129,0.1) 0%, var(--bg-card) 100%)' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--success)', fontSize: '1rem' }}>🛡️ Axe à maintenir en priorité</h3>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)' }}>{bestPillar.name}</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--success)' }}>{bestPillar.score}%</div>
          <p className="muted" style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem' }}>C'est votre point fort. Continuez à appliquer ces standards.</p>
        </div>

        <div className="card" style={{ borderLeft: '4px solid var(--danger)', background: 'linear-gradient(90deg, rgba(239,68,68,0.1) 0%, var(--bg-card) 100%)' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--danger)', fontSize: '1rem' }}>🚨 Axe nécessitant une amélioration</h3>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)' }}>{worstPillar.name}</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--danger)' }}>{worstPillar.score}%</div>
          <p className="muted" style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem' }}>Concentrez vos efforts et vos plans d'action sur ce pilier.</p>
        </div>
      </div>

      <div className="grid-2">
        {/* TOP 5 NOK */}
        <div className="card">
          <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.1rem', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>⚠️</span> Top 5 des questions à améliorer (NOK)
          </h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {top5Nok.length === 0 ? <p className="muted">Aucun problème détecté !</p> : top5Nok.map((q, i) => (
              <li key={q.index} style={{ background: 'var(--bg-main)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 'bold', color: 'var(--danger)' }}>Problème #{i + 1}</span>
                  <span className="badge bad">{q.nok} NOK</span>
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-main)', lineHeight: 1.4 }}>{q.text}</div>
              </li>
            ))}
          </ul>
        </div>

        {/* TOP 5 OK */}
        <div className="card">
          <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.1rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>🌟</span> Top 5 des questions fortes (OK)
          </h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {top5Ok.length === 0 ? <p className="muted">Aucune donnée.</p> : top5Ok.map((q, i) => (
              <li key={q.index} style={{ background: 'var(--bg-main)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 'bold', color: 'var(--success)' }}>Point fort #{i + 1}</span>
                  <span className="badge ok">{q.ok} OK</span>
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-main)', lineHeight: 1.4 }}>{q.text}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
