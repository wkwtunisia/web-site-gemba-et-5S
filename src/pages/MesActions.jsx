import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { fetchActions, upsertAction, logActionHistory } from '../services/actionsApi'

export default function MesActions({ userEmail }) {
  const [audits5S, setAudits5S] = useState([])
  const [auditsGemba, setAuditsGemba] = useState([])
  const [actions, setActions] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('5S')

  const [editMode, setEditMode] = useState({})
  const [drafts, setDrafts] = useState({})

  useEffect(() => {
    Promise.all([
      supabase.from('audits').select('*'),
      supabase.from('gemba_audits').select('*'),
      fetchActions()
    ]).then(([res5S, resGemba, actionsRes]) => {
      if (!res5S.error) setAudits5S(res5S.data || [])
      if (!resGemba.error) setAuditsGemba(resGemba.data || [])
      setActions(actionsRes)
      setLoading(false)
    })
  }, [])

  const myActions = useMemo(() => actions.filter(a => a.pilote_email === userEmail), [actions, userEmail])
  const my5S = myActions.filter(a => a.type === '5S')
  const myGemba = myActions.filter(a => a.type === 'GEMBA')

  const currentList = tab === '5S' ? my5S : myGemba

  const actionsEnRetard = currentList.filter(item => {
    if (!item.date_prevue || item.progression === 100) return false
    return new Date(item.date_prevue) < new Date(new Date().toISOString().split('T')[0])
  })

  const enableEdit = (item, key) => {
    setEditMode(prev => ({ ...prev, [key]: true }))
    setDrafts(prev => ({
      ...prev,
      [key]: { progression: item.progression, date_realisation: item.date_realisation || '' }
    }))
  }

  const cancelEdit = (key) => {
    setEditMode(prev => ({ ...prev, [key]: false }))
    setDrafts(prev => {
      const copy = { ...prev }
      delete copy[key]
      return copy
    })
  }

  const saveEdit = async (item, key) => {
    const draft = drafts[key]
    let finalDate = draft.date_realisation
    if (draft.progression === 100 && !finalDate) finalDate = new Date().toISOString().split('T')[0]

    const updated = { ...item, progression: draft.progression, date_realisation: finalDate }
    const savedData = await upsertAction(updated)
    
    if (savedData) {
      await logActionHistory({
        action_id: savedData.id,
        modified_by: userEmail,
        old_progression: item.progression,
        new_progression: draft.progression,
        date_realisation: finalDate
      })
      setActions(prev => {
        const idx = prev.findIndex(a => a.audit_date === savedData.audit_date && a.ligne === savedData.ligne && a.question === savedData.question)
        if (idx >= 0) { const copy = [...prev]; copy[idx] = savedData; return copy }
        return [...prev, savedData]
      })
    }
    cancelEdit(key)
  }

  const handleValidate = async (item) => {
    const today = new Date().toISOString().split('T')[0]
    const updated = { ...item, progression: 100, date_realisation: today }
    const savedData = await upsertAction(updated)
    
    if (savedData) {
      await logActionHistory({
        action_id: savedData.id,
        modified_by: userEmail,
        old_progression: item.progression,
        new_progression: 100,
        date_realisation: today
      })
      setActions(prev => {
        const idx = prev.findIndex(a => a.audit_date === savedData.audit_date && a.ligne === savedData.ligne && a.question === savedData.question)
        if (idx >= 0) { const copy = [...prev]; copy[idx] = savedData; return copy }
        return [...prev, savedData]
      })
    }
  }

  const isLate = (item) => {
    if (!item.date_prevue || item.progression === 100) return false
    return new Date(item.date_prevue) < new Date(new Date().toISOString().split('T')[0])
  }

  if (loading) return <p className="muted" style={{ padding: '2rem' }}>Chargement…</p>

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Mes Actions</h1>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className={`btn ${tab === '5S' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('5S')}>
            5S ({my5S.length})
          </button>
          <button className={`btn ${tab === 'GEMBA' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('GEMBA')}>
            Gemba ({myGemba.length})
          </button>
        </div>
      </div>

      {/* BANNIÈRE D'ALERTE RETARD */}
      {actionsEnRetard.length > 0 && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', borderLeft: '4px solid var(--danger)', padding: '1rem', borderRadius: '4px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.5rem' }}>🔔</span>
          <div>
            <div style={{ fontWeight: 'bold', color: 'var(--danger)' }}>Attention, vous avez {actionsEnRetard.length} action(s) en retard !</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Veuillez mettre à jour leur progression dès que possible.</div>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date Audit</th>
                <th>{tab === '5S' ? 'Zone' : 'Ligne'}</th>
                {tab === 'GEMBA' && <th>Point M</th>}
                <th>Problème</th>
                <th>Action</th>
                <th>Date Prévue</th>
                <th style={{ width: '200px' }}>Progression</th>
                <th>Date Réalisation</th>
                <th style={{ width: '150px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentList.length === 0 ? (
                <tr><td colSpan="9" className="muted" style={{ textAlign: 'center', padding: '2rem' }}>Aucune action ne vous est assignée pour le moment.</td></tr>
              ) : currentList.map((item, i) => {
                const key = `${item.audit_date}|${item.ligne}|${item.question}`
                const isEditing = editMode[key]
                const draft = drafts[key] || {}
                const late = isLate(item)

                return (
                  <tr key={i}>
                    <td>{new Date(item.audit_date).toLocaleDateString('fr-FR')}</td>
                    <td style={{ fontWeight: 'bold' }}>{item.ligne}</td>
                    {tab === 'GEMBA' && <td style={{ color: 'var(--text-muted)' }}>{item.point_m}</td>}
                    <td style={{ whiteSpace: 'normal', maxWidth: '250px' }}>{item.question}</td>
                    <td style={{ whiteSpace: 'normal', maxWidth: '250px', color: 'var(--warning)' }}>{item.action_texte}</td>
                    <td>
                      {item.date_prevue ? (
                        <span style={{ color: late ? 'var(--danger)' : 'var(--text-main)', fontWeight: late ? 'bold' : 'normal' }}>
                          {new Date(item.date_prevue).toLocaleDateString('fr-FR')} {late && '(En retard)'}
                        </span>
                      ) : <span className="muted">—</span>}
                    </td>
                    <td>
                      {isEditing ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <input type="range" min="0" max="100" step="25" value={draft.progression} onChange={(e) => setDrafts(prev => ({ ...prev, [key]: { ...prev[key], progression: Number(e.target.value) } }))} style={{ flex: 1 }} />
                          <span style={{ width: '40px', textAlign: 'right', fontWeight: 'bold' }}>{draft.progression}%</span>
                        </div>
                      ) : (
                        <span style={{ display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: '1rem', fontSize: '0.8rem', fontWeight: 'bold', background: item.progression === 100 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)', color: item.progression === 100 ? 'var(--success)' : 'var(--warning)' }}>
                          {item.progression}%
                        </span>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input type="date" className="filter-control" style={{ width: '100%' }} value={draft.date_realisation || ''} onChange={(e) => setDrafts(prev => ({ ...prev, [key]: { ...prev[key], date_realisation: e.target.value } }))} />
                      ) : (
                        item.date_realisation ? (
                          <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>{new Date(item.date_realisation).toLocaleDateString('fr-FR')}</span>
                        ) : <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                        {isEditing ? (
                          <>
                            <button className="btn btn-primary" onClick={() => saveEdit(item, key)} style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}>💾 Sauver</button>
                            <button className="btn btn-secondary" onClick={() => cancelEdit(key)} style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}>❌</button>
                          </>
                        ) : (
                          <>
                            <button className="btn btn-secondary" onClick={() => enableEdit(item, key)} style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}>✏️ Modifier</button>
                            {item.progression < 100 && (
                              <button className="btn btn-primary" onClick={() => handleValidate(item)} style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', background: 'var(--success)', border: 'none' }}>✅ Valider</button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
