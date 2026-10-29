import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function SaisieManuelleGemba() {
  const [date, setDate] = useState('')
  const [ligne, setLigne] = useState('')
  const [uap, setUap] = useState('UAP 1')
  const [score, setScore] = useState('')
  const [scores, setScores] = useState([])
  const [lignesDisponibles, setLignesDisponibles] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      
      // 1. Charger l'historique des saisies manuelles
      const { data: manualData } = await supabase.from('gemba_manual_scores').select('*').order('date', { ascending: false })
      if (manualData) setScores(manualData)

      // 2. Charger la liste UNIQUE des lignes existantes et leur UAP
      const { data: auditsData } = await supabase.from('gemba_audits').select('ligne, uap')
      if (auditsData) {
        const uniqueMap = new Map()
        auditsData.forEach(a => {
          if (a.ligne && !uniqueMap.has(a.ligne.trim())) {
            // On garde la casse d'origine mais on nettoie les espaces
            uniqueMap.set(a.ligne.trim(), a.uap || 'UAP 1')
          }
        })
        
        // On transforme en tableau et on trie par ordre alphabétique
        const list = Array.from(uniqueMap.entries())
          .map(([l, u]) => ({ ligne: l, uap: u }))
          .sort((a, b) => a.ligne.localeCompare(b.ligne))
          
        setLignesDisponibles(list)
      }
      setLoading(false)
    }
    loadData()
  }, [])

  // Quand on choisit une ligne, on remplit l'UAP automatiquement
  const handleLigneChange = (e) => {
    const selectedLigne = e.target.value
    setLigne(selectedLigne)
    
    const found = lignesDisponibles.find(l => l.ligne === selectedLigne)
    if (found && found.uap) {
      // On normalise l'UAP (au cas où il y a des minuscules dans la base)
      const uapClean = found.uap.toUpperCase()
      if (uapClean.includes('UAP 1') || uapClean.includes('UAP1')) setUap('UAP 1')
      else if (uapClean.includes('UAP 2') || uapClean.includes('UAP2')) setUap('UAP 2')
      else if (uapClean.includes('LOG')) setUap('Logistique')
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!date || !ligne || !score) return alert("Veuillez remplir tous les champs.")
    
    const { error } = await supabase.from('gemba_manual_scores').insert([{
      date, ligne, uap, score_pct: Number(score)
    }])

    if (error) alert("Erreur : " + error.message)
    else {
      setDate(''); setLigne(''); setScore(''); // On garde l'UAP
      // Recharger la liste
      const { data } = await supabase.from('gemba_manual_scores').select('*').order('date', { ascending: false })
      if (data) setScores(data)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm("Supprimer ce score ?")) return
    await supabase.from('gemba_manual_scores').delete().eq('id', id)
    setScores(scores.filter(s => s.id !== id))
  }

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>📝 Saisie Manuelle des Scores (Gemba)</h1>
      
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h2 className="card-title">Ajouter un score global</h2>
        <form onSubmit={handleSave} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Date</label>
            <input type="date" className="filter-control" value={date} onChange={e => setDate(e.target.value)} required />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', minWidth: '200px' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Ligne / Zone</label>
            <select className="filter-control" value={ligne} onChange={handleLigneChange} required>
              <option value="">-- Choisir une ligne --</option>
              {lignesDisponibles.map(l => (
                <option key={l.ligne} value={l.ligne}>{l.ligne}</option>
              ))}
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
            <input type="number" min="0" max="100" className="filter-control" placeholder="Ex: 80" value={score} onChange={e => setScore(e.target.value)} required />
          </div>

          <button type="submit" className="btn btn-primary" style={{ height: '42px', padding: '0 2rem' }}>Ajouter</button>
        </form>
      </div>

      <div className="card">
        <h2 className="card-title">Historique des saisies</h2>
        {loading ? <p>Chargement...</p> : scores.length === 0 ? <p className="muted">Aucun score manuel enregistré.</p> : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead><tr><th>Date</th><th>Ligne</th><th>UAP</th><th>Score</th><th>Action</th></tr></thead>
              <tbody>
                {scores.map(s => (
                  <tr key={s.id}>
                    <td>{new Date(s.date).toLocaleDateString('fr-FR')}</td>
                    <td>{s.ligne}</td>
                    <td>{s.uap}</td>
                    <td style={{ fontWeight: 'bold', color: s.score_pct >= 85 ? 'var(--success)' : 'var(--danger)' }}>{s.score_pct}%</td>
                    <td><button onClick={() => handleDelete(s.id)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>🗑️</button></td>
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
