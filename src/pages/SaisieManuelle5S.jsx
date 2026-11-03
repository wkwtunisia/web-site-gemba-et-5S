import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function SaisieManuelle5S() {
  const [date, setDate] = useState('')
  const [zone, setZone] = useState('')
  const [score, setScore] = useState('')
  const [scores, setScores] = useState([])
  const [zonesDisponibles, setZonesDisponibles] = useState([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    setLoading(true)
    
    // 1. Charger l'historique
    const { data: manualData } = await supabase.from('audits').select('*').order('date', { ascending: false })
    if (manualData) setScores(manualData)

    // 2. Charger la liste des zones existantes
    const { data: auditsData } = await supabase.from('audits').select('zone')
    if (auditsData) {
      const uniqueZones = [...new Set(auditsData.map(a => a.zone ? a.zone.trim() : null).filter(Boolean))]
      setZonesDisponibles(uniqueZones.sort())
    }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    if (!date || !zone || !score) return alert("Veuillez remplir tous les champs.")
    
    // On insère dans la table 'audits' avec un tableau de checkpoints vide
    const { error } = await supabase.from('audits').insert([{
      date: date,
      zone: zone,
      score_pct: Number(score),
      checkpoints: [], // Tableau vide pour ne pas fausser les calculs
      auditeur: 'Saisie Manuelle 5S'
    }])

    if (error) {
      alert("Erreur : " + error.message)
    } else {
      setDate(''); setZone(''); setScore('')
      loadData()
    }
  }

  const handleDelete = async (id) => {
    if (!confirm("Supprimer ce score ?")) return
    await supabase.from('audits').delete().eq('id', id)
    loadData()
  }

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>📝 Saisie Manuelle des Scores (5S)</h1>
      
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h2 className="card-title">Ajouter un score global 5S</h2>
        <form onSubmit={handleSave} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Date de l'audit</label>
            <input type="date" className="filter-control" value={date} onChange={e => setDate(e.target.value)} required />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', minWidth: '200px' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Zone / Ligne</label>
            <select className="filter-control" value={zone} onChange={e => setZone(e.target.value)} required>
              <option value="">-- Choisir une zone --</option>
              {zonesDisponibles.map(z => <option key={z} value={z}>{z}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Score (%)</label>
            <input type="number" min="0" max="100" step="0.01" className="filter-control" placeholder="Ex: 85" value={score} onChange={e => setScore(e.target.value)} required />
          </div>

          <button type="submit" className="btn btn-primary" style={{ height: '42px', padding: '0 2rem' }}>Ajouter</button>
        </form>
      </div>

      <div className="card">
        <h2 className="card-title">Historique des saisies 5S</h2>
        {loading ? <p>Chargement...</p> : scores.length === 0 ? <p className="muted">Aucun score manuel enregistré.</p> : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead><tr><th>Date</th><th>Zone</th><th>Score</th><th>Source</th><th>Action</th></tr></thead>
              <tbody>
                {scores.map(s => (
                  <tr key={s.id}>
                    <td>{new Date(s.date).toLocaleDateString('fr-FR')}</td>
                    <td>{s.zone}</td>
                    <td style={{ fontWeight: 'bold', color: s.score_pct >= 86 ? 'var(--success)' : s.score_pct >= 80 ? 'var(--warning)' : 'var(--danger)' }}>{Number(s.score_pct).toFixed(1)}%</td>
                    <td>{s.auditeur === 'Saisie Manuelle 5S' ? 'Manuelle' : 'Import Excel'}</td>
                    <td>
                      {s.auditeur === 'Saisie Manuelle 5S' && (
                        <button onClick={() => handleDelete(s.id)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>🗑️</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
