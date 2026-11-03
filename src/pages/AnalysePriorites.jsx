import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabaseClient'

const extractDateString = (dateStr) => {
  if (!dateStr) return null;
  const str = String(dateStr).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.substring(0, 10);
  if (/^\d{2}\/\d{2}\/\d{4}/.test(str)) { const parts = str.split('/'); return `${parts[2]}-${parts[1]}-${parts[0]}`; }
  const months = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
  const match = str.match(/^(\d{1,2})[-\s]([a-zA-Z]{3})[-\s](\d{4})/);
  if (match) { const month = months[match[2].toLowerCase()]; if (month) return `${match[3]}-${month}-${String(match[1]).padStart(2, '0')}`; }
  return null;
}

const getWeekNumber = (dateStr, rawSemaine) => {
  if (rawSemaine !== undefined && rawSemaine !== null && rawSemaine !== '') return `S${String(rawSemaine).padStart(2, '0')}`
  const dateOnly = extractDateString(dateStr);
  if (!dateOnly) return null;
  const d = new Date(`${dateOnly}T12:00:00`);
  if (isNaN(d.getTime())) return null;
  const target = new Date(d.valueOf()); const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3); const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  return `S${String(1 + Math.ceil((firstThursday - target) / 604800000)).padStart(2, '0')}`;
}

const pillars = [
  { name: '1S - Trier', range: [0, 3] },
  { name: '2S - Ranger', range: [4, 8] },
  { name: '3S - Nettoyer', range: [9, 14] },
  { name: '4S - Standardiser', range: [15, 21] },
  { name: '5S - Respecter', range: [22, 25] }
]

export default function AnalysePriorites() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [weekFilter, setWeekFilter] = useState('')

  useEffect(() => {
    supabase.from('audits').select('*').order('date', { ascending: false }).then(({ data, error }) => {
      if (!error) setData(data || [])
      setLoading(false)
    })
  }, [])

  const availableWeeks = useMemo(() => {
    const set = new Set(); data.forEach(a => { const w = getWeekNumber(a.date, a.semaine); if (w) set.add(w); }); return Array.from(set).sort()
  }, [data])

  const filteredData = useMemo(() => {
    return data.filter(row => {
      const dStr = extractDateString(row.date); if (!dStr) return false
      if (startDate && dStr < startDate) return false
      if (endDate && dStr > endDate) return false
      if (weekFilter && getWeekNumber(row.date, row.semaine) !== weekFilter) return false
      return true
    })
  }, [data, startDate, endDate, weekFilter])

  // 🌟 CALCUL DES STATISTIQUES (5S)
  const stats = useMemo(() => {
    const questionStats = {}
    const pillarStats = pillars.map(p => ({ ...p, ok: 0, nok: 0, total: 0 }))

    filteredData.forEach(audit => {
      let checkpoints = audit.checkpoints
      if (typeof checkpoints === 'string') {
        try { checkpoints = JSON.parse(checkpoints) } catch (e) { return }
      }
      if (!Array.isArray(checkpoints)) return

      checkpoints.forEach((cp, index) => {
        const s = String(cp.s || '').toUpperCase()
        if (s === 'N/A') return
        
        // 1. Stats par question (pour le Top 5)
        if (cp.q) {
          const q = cp.q.trim()
          if (!questionStats[q]) questionStats[q] = { ok: 0, nok: 0 }
          if (s === 'OK') questionStats[q].ok++
          if (s === 'NOK') questionStats[q].nok++
        }
        
        // 2. Stats par pilier (pour les cartes du haut)
        const pillar = pillarStats.find(p => p.range && index >= p.range[0] && index <= p.range[1])
        if (pillar) {
          pillar.total++
          if (s === 'OK') pillar.ok++
          else if (s === 'NOK') pillar.nok++
        }
      })
    })

    const formattedPillars = pillarStats.map(p => ({
      ...p, score: p.total > 0 ? Math.round((p.ok / p.total) * 100) : 0
    })).sort((a, b) => b.score - a.score)

    const topOk = Object.entries(questionStats)
      .map(([q, s]) => ({ q, ok: s.ok, total: s.ok + s.nok }))
      .filter(item => item.ok > 0)
      .sort((a, b) => b.ok - a.ok)
      .slice(0, 5)

    const topNok = Object.entries(questionStats)
      .map(([q, s]) => ({ q, nok: s.nok, total: s.ok + s.nok }))
      .filter(item => item.nok > 0)
      .sort((a, b) => b.nok - a.nok)
      .slice(0, 5)

    return {
      bestPillar: formattedPillars[0] || { name: '-', score: 0 },
      worstPillar: formattedPillars[formattedPillars.length - 1] || { name: '-', score: 0 },
      topOk,
      topNok
    }
  }, [filteredData])

  // 🌟 RECOMMANDATIONS
  const recommendations = useMemo(() => {
    const recs = [];
    if (!stats.bestPillar || !stats.worstPillar) return recs;

    if (stats.worstPillar.score < 80) {
      recs.push({ type: 'danger', icon: '🚨', title: 'Plan d\'action d\'urgence requis', text: `Le pilier "${stats.worstPillar.name}" est critique (${stats.worstPillar.score}%). Organisez une réunion immédiate avec les responsables.` });
    } else if (stats.worstPillar.score < 90) {
      recs.push({ type: 'warning', icon: '⚠️', title: 'Amélioration continue nécessaire', text: `Le pilier "${stats.worstPillar.name}" est à ${stats.worstPillar.score}%. Analysez les non-conformités récurrentes.` });
    } else {
      recs.push({ type: 'success', icon: '✅', title: 'Performance stable', text: `Le pilier le plus faible est à ${stats.worstPillar.score}%, ce qui est très bon.` });
    }

    if (stats.topNok && stats.topNok.length > 0) {
      recs.push({ type: 'info', icon: '🔍', title: 'Action ciblée sur le problème récurrent', text: `Le problème le plus fréquent est : "${stats.topNok[0].q}" (${stats.topNok[0].nok} fois). Utilisez la méthode des 5 Pourquoi.` });
    }

    if (stats.bestPillar && stats.bestPillar.score >= 90) {
      recs.push({ type: 'success', icon: '🏆', title: 'Capitaliser sur les points forts', text: `Le pilier "${stats.bestPillar.name}" atteint ${stats.bestPillar.score}%. Dupliquez ces bonnes pratiques.` });
    }

    return recs;
  }, [stats]);

  if (loading) return <p className="muted" style={{ padding: '2rem' }}>Chargement…</p>

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: '1.5rem', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Analyse & Priorités 5S</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--surface)', padding: '0.4rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}><label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Du</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ background: 'transparent', color: 'var(--text-main)', border: 'none', outline: 'none', fontSize: '0.85rem' }} /></div>
            <div style={{ display: 'flex', flexDirection: 'column' }}><label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Au</label><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ background: 'transparent', color: 'var(--text-main)', border: 'none', outline: 'none', fontSize: '0.85rem' }} /></div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Semaine</label>
            <select className="filter-control" value={weekFilter} onChange={e => setWeekFilter(e.target.value)}>
              <option value="">Toutes</option>{availableWeeks.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>
          <button className="btn btn-secondary" onClick={() => { setStartDate(''); setEndDate(''); setWeekFilter(''); }} style={{ height: '36px', marginTop: 'auto' }}>Réinitialiser</button>
        </div>
      </div>

      {/* RECOMMANDATIONS */}
      {recommendations.length > 0 && (
        <div className="card" style={{ marginBottom: '2rem', background: 'linear-gradient(145deg, rgba(30, 41, 59, 1) 0%, rgba(15, 23, 42, 1) 100%)', border: '1px solid var(--border)' }}>
          <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.2rem', marginBottom: '1.5rem', color: '#f8fafc' }}>💡 Recommandations du Manager Qualité</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
            {recommendations.map((rec, idx) => (
              <div key={idx} style={{ padding: '1rem', borderRadius: '8px', 
                background: rec.type === 'danger' ? 'rgba(239, 68, 68, 0.1)' : rec.type === 'warning' ? 'rgba(245, 158, 11, 0.1)' : rec.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                borderLeft: `4px solid ${rec.type === 'danger' ? 'var(--danger)' : rec.type === 'warning' ? 'var(--warning)' : rec.type === 'success' ? 'var(--success)' : 'var(--accent)'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontWeight: 'bold', color: 'var(--text-main)' }}><span style={{ fontSize: '1.2rem' }}>{rec.icon}</span> {rec.title}</div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>{rec.text}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid-2">
        <div className="card" style={{ borderLeft: '4px solid var(--success)', background: 'linear-gradient(90deg, rgba(16,185,129,0.1) 0%, var(--bg-card) 100%)' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--success)', fontSize: '1rem' }}>🛡️ Pilier 5S à maintenir</h3>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)' }}>{stats.bestPillar.name}</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--success)' }}>{stats.bestPillar.score}%</div>
        </div>

        <div className="card">
          <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.1rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span>🌟</span> Top 5 des points forts (OK)</h3>
          <ul className="top-list">
            {stats.topOk.length === 0 ? <p className="muted">Aucune donnée.</p> : stats.topOk.map((item, i) => (
              <li key={i} style={{ background: 'var(--bg-main)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 'bold', color: 'var(--success)' }}>Point fort #{i + 1}</span>
                  <span className="badge ok">{item.ok} OK / {item.total} évaluations</span>
                </div>
                <div style={{ fontSize: '0.875rem', whiteSpace: 'normal' }}>{item.q}</div>
              </li>
            ))}
          </ul>
        </div>

        <div className="card" style={{ borderLeft: '4px solid var(--danger)', background: 'linear-gradient(90deg, rgba(239,68,68,0.1) 0%, var(--bg-card) 100%)' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--danger)', fontSize: '1rem' }}>🚨 Pilier 5S à améliorer</h3>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)' }}>{stats.worstPillar.name}</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--danger)' }}>{stats.worstPillar.score}%</div>
        </div>

        <div className="card">
          <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.1rem', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span>⚠️</span> Top 5 des vrais problèmes (NOK)</h3>
          <ul className="top-list">
            {stats.topNok.length === 0 ? <p className="muted">Aucun problème spécifique détecté.</p> : stats.topNok.map((item, i) => (
              <li key={i} style={{ background: 'var(--bg-main)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 'bold', color: 'var(--danger)' }}>Problème #{i + 1}</span>
                  <span className="badge bad">{item.nok} NOK / {item.total} évaluations</span>
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
