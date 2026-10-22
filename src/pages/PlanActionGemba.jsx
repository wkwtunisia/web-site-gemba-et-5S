import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { fetchActions, upsertAction, logActionHistory } from '../services/actionsApi'
import { fetchUsers } from '../services/usersApi'

export default function PlanActionGemba() {
  const [audits, setAudits] = useState([])
  const [actions, setActions] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  const [editMode, setEditMode] = useState({})
  const [drafts, setDrafts] = useState({})

  useEffect(() => {
    Promise.all([
      supabase.from('gemba_audits').select('*').order('date', { ascending: false }),
      fetchActions(),
      fetchUsers()
    ]).then(([auditsRes, actionsRes, usersRes]) => {
      if (!auditsRes.error) setAudits(auditsRes.data || [])
      setActions(actionsRes)
      setUsers(usersRes)
      setLoading(false)
    })
  }, [])

  const nokQuestions = useMemo(() => {
    const list = []
    audits.forEach(audit => {
      if (String(audit.reponse).toUpperCase() === 'NOK') {
        const existingAction = actions.find(a => 
          a.type === 'GEMBA' && 
          a.audit_date === audit.date && 
          a.ligne === audit.ligne && 
          a.question === audit.question
        )
        
        list.push({
          id: existingAction?.id,
          type: 'GEMBA', 
          audit_date: audit.date, 
          ligne: audit.ligne, 
          point_m: audit.point_m, 
          question: audit.question,
          action_texte: existingAction?.action_texte || audit.action || '', 
          progression: existingAction?.progression || 0,
          pilote_email: existingAction?.pilote_email || '',
          date_prevue: existingAction?.date_prevue || '',
          date_realisation: existingAction?.date_realisation || null
        })
      }
    })
    return list
  }, [audits, actions])

  const totalActions = nokQuestions.length
  const actionsRealisees = nokQuestions.filter(a => a.progression === 100).length
  const actionsNonRealisees = totalActions - actionsRealisees
  const tauxRealisation = totalActions > 0 ? Math.round((actionsRealisees / totalActions) * 100) : 0

  const handleDraftChange = (key, field, value) => {
    setDrafts(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value }
    }))
  }

  const enableEdit = (item, key) => {
    setEditMode(prev => ({ ...prev, [key]: true }))
    setDrafts(prev => ({
      ...prev,
      [key]: {
        action_texte: item.action_texte,
        pilote_email: item.pilote_email,
        date_prevue: item.date_prevue
      }
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
    const updated = { 
      ...item, 
      action_texte: draft.action_texte,
      pilote_email: draft.pilote_email,
      date_prevue: draft.date_prevue
    }
    
    const savedData = await upsertAction(updated)
    
    if (savedData && (draft.action_texte !== item.action_texte || draft.pilote_email !== item.pilote_email || draft.date_prevue !== item.date_prevue)) {
      await logActionHistory({
        action_id: savedData.id,
        modified_by: 'Admin',
        old_progression: item.progression,
        new_progression: item.progression,
        old_action: item.action_texte,
        new_action: draft.action_texte,
        date_prevue: draft.date_prevue
      })
    }

    setActions(prev => {
      if (!savedData) return prev;
      const idx = prev.findIndex(a => a.audit_date === savedData.audit_date && a.ligne === savedData.ligne && a.question === savedData.question)
      if (idx >= 0) { const copy = [...prev]; copy[idx] = savedData; return copy }
      return [...prev, savedData]
    })

    cancelEdit(key)
  }

  const handleUpdateProgression = async (item, newProgression) => {
    const updated = { ...item, progression: newProgression }
    const savedData = await upsertAction(updated)
    
    setActions(prev => {
      if (!savedData) return prev;
      const idx = prev.findIndex(a => a.audit_date === savedData.audit_date && a.ligne === savedData.ligne && a.question === savedData.question)
      if (idx >= 0) { const copy = [...prev]; copy[idx] = savedData; return copy }
      return [...prev, savedData]
    })
  }

  if (loading) return <p className="muted" style={{ padding: '2rem' }}>Chargement…</p>

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Plan d'Action Gemba</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="card" style={{ textAlign: 'center', padding: '1.5rem' }}>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Total</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800 }}>{totalActions}</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '1.5rem' }}>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Réalisées</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--success)' }}>{actionsRealisees}</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '1.5rem' }}>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Non réalisées</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--danger)' }}>{actionsNonRealisees}</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '1.5rem' }}>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Taux d'avancement</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--primary)' }}>{tauxRealisation} %</div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Ligne</th>
                <th>Point M</th>
                <th>Problème (NOK)</th>
                <th style={{ width: '20%' }}>Action Corrective</th>
                <th style={{ width: '15%' }}>Pilote</th>
                <th style={{ width: '12%' }}>Date Prévue</th>
                <th style={{ width: '12%' }}>Date Réalisée</th>
                <th style={{ width: '150px' }}>Progression</th>
                <th style={{ width: '120px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {nokQuestions.map((item, i) => {
                const key = `${item.audit_date}|${item.ligne}|${item.question}`
                const isEditing = editMode[key]
                const draft = drafts[key] || {}

                return (
                  <tr key={i}>
                    <td>{new Date(item.audit_date).toLocaleDateString('fr-FR')}</td>
                    <td style={{ fontWeight: 'bold' }}>{item.ligne}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{item.point_m}</td>
                    <td style={{ whiteSpace: 'normal', maxWidth: '150px' }}>{item.question}</td>
                    <td>
                      {isEditing ? (
                        <input type="text" className="filter-control" style={{ width: '100%' }} value={draft.action_texte || ''} onChange={(e) => handleDraftChange(key, 'action_texte', e.target.value)} />
                      ) : (
                        <span style={{ color: 'var(--warning)' }}>{item.action_texte || '—'}</span>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <select className="filter-control" style={{ width: '100%' }} value={draft.pilote_email || ''} onChange={(e) => handleDraftChange(key, 'pilote_email', e.target.value)}>
                          <option value="">-- Choisir --</option>
                          {users.map(u => (
                            <option key={u.email} value={u.email}>{u.email}</option>
                          ))}
                        </select>
                      ) : (
                        item.pilote_email || <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input type="date" className="filter-control" style={{ width: '100%' }} value={draft.date_prevue || ''} onChange={(e) => handleDraftChange(key, 'date_prevue', e.target.value)} />
                      ) : (
                        item.date_prevue ? new Date(item.date_prevue).toLocaleDateString('fr-FR') : <span className="muted">—</span>
                      )}
                    </td>
                    <td style={{ color: item.date_realisation ? 'var(--success)' : 'var(--text-muted)', textAlign: 'center' }}>
                      {item.date_realisation ? new Date(item.date_realisation).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input type="range" min="0" max="100" step="25" value={item.progression} disabled={isEditing} onChange={(e) => handleUpdateProgression(item, Number(e.target.value))} style={{ flex: 1 }} />
                        <span style={{ width: '40px', textAlign: 'right', fontWeight: 'bold', color: item.progression === 100 ? 'var(--success)' : 'var(--text-main)' }}>{item.progression}%</span>
                      </div>
                    </td>
                    <td>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button className="btn btn-primary" onClick={() => saveEdit(item, key)} style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}>💾 Sauver</button>
                          <button className="btn btn-secondary" onClick={() => cancelEdit(key)} style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}>❌</button>
                        </div>
                      ) : (
                        <button className="btn btn-secondary" onClick={() => enableEdit(item, key)} style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}>✏️ Modifier</button>
                      )}
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
