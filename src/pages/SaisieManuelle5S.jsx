import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'


const getUap5S = (zone) => {
  if (!zone) return 'UAP 2'
  const clean = String(zone).trim().toUpperCase().replace(/\s+/g, '')
  if (clean.includes('MAGASIN') || clean.includes('STOCKAGE') || clean === 'LOGISTIQUE') return 'Logistique'
  if (clean === 'UAP1' || clean === 'UAP 1') return 'UAP 1'
  if (clean === 'UAP2' || clean === 'UAP 2') return 'UAP 2'
  const uap1List = ['F01', 'F02', 'F83', 'F99', 'F86', 'F85', 'L77', 'L76']
  if (uap1List.includes(clean)) return 'UAP 1'
  return 'UAP 2'
}

export default function SaisieManuelle5S() {
  const [date, setDate] = useState('')
  const [zone, setZone] = useState('')
  const [uap, setUap] = useState('UAP 1')
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
      uap: uap,
      total_points: Number(score), // 🌟 On donne les points (ex: 85)
      max_points: 100,             // 🌟 Sur un maximum de 100
      checkpoints: [],             // Tableau vide
      auditor: 'Saisie Manuelle 5S'
    }])

    if (error) {
      alert("Erreur : " + error.message)
    } else {
      setDate(''); setZone(''); setScore(''); setUap('UAP 1')
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
            <select className="filter-control" value={zone} onChange={e => {
              const val = e.target.value;
              setZone(val);
              setUap(getUap5S(val));
            }} required>
              <option value="">-- Choisir une zone --</option>
              {zonesDisponibles.map(z => <option key={z} value={z}>{z}</option>)}
            </select>
          </div>

          
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>UAP</label>
            <select className="filter-control" value={uap} onChange={e => setUap(e.target.value)}>
              <option value="UAP 1">UAP 1</option>
              <option value="UAP 2">UAP 2</option>
              <option value="Logistique">Logistique</option>
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
              <thead><tr><th>Date</th><th>Zone</th>
<th>UAP</th><th>Score</th><th>Source</th><th>Action</th></tr></thead>
              <tbody>
                {scores.map(s => (
                  <tr key={s.id}>
                    <td>{new Date(s.date).toLocaleDateString('fr-FR')}</td>
                    <td>{s.zone}</td>
<td>{s.uap || '-'}</td>
                    <td style={{ fontWeight: 'bold', color: s.score_pct >= 86 ? 'var(--success)' : s.score_pct >= 80 ? 'var(--warning)' : 'var(--danger)' }}>{Number(s.score_pct).toFixed(1)}%</td>
                    <td>{s.auditor === 'Saisie Manuelle 5S' ? 'Manuelle' : 'Import Excel'}</td>
                    <td>
                      {s.auditor === 'Saisie Manuelle 5S' && (
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
