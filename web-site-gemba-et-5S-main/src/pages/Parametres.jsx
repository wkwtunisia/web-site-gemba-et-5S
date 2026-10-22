import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function Parametres() {
  const [users, setUsers] = useState([])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('user')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState({ type: '', text: '' })

  const loadUsers = async () => {
    const { data } = await supabase.from('profiles').select('*').order('email')
    setUsers(data || [])
    setLoading(false)
  }

  useEffect(() => { loadUsers() }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    setMessage({ type: '', text: 'Création en cours...' })

    // Appel à la fonction Edge Supabase (qui utilise la clé service_role côté serveur)
    const { data, error } = await supabase.functions.invoke('create-user', {
      body: { email, password, role }
    })

    if (error) {
      setMessage({ type: 'error', text: 'Erreur : ' + error.message })
    } else if (data?.error) {
      setMessage({ type: 'error', text: 'Erreur : ' + data.error })
    } else {
      setMessage({ type: 'success', text: 'Utilisateur créé avec succès !' })
      setEmail('')
      setPassword('')
      loadUsers()
    }
  }

  const handleClearAllData = async () => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer TOUTES les données (Audits, Actions, Historique) ? Cette action est irréversible.")) return;
    
    setMessage({ type: '', text: 'Suppression en cours...' })
    
    try {
      const { error: err1 } = await supabase.from('audits').delete().neq('date', '1900-01-01')
      if (err1) throw err1

      const { error: err2 } = await supabase.from('gemba_audits').delete().neq('date', '1900-01-01')
      if (err2) throw err2

      const { error: err3 } = await supabase.from('action_plans').delete().neq('id', 0)
      if (err3) throw err3

      const { error: err4 } = await supabase.from('action_history').delete().neq('id', 0)
      if (err4) throw err4
      
      setMessage({ type: 'success', text: 'Toutes les données ont été supprimées avec succès.' })
    } catch (error) {
      setMessage({ type: 'error', text: 'Erreur lors de la suppression : ' + error.message })
    }
  }

  if (loading) return <p className="muted">Chargement…</p>

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Paramètres & Utilisateurs</h1>
      </div>

      {message.text && (
        <div className={`alert alert-${message.type === 'success' ? 'success' : 'error'}`}>
          {message.text}
        </div>
      )}

      <div className="grid-2">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div className="card">
            <h2 className="card-title">Créer un nouvel utilisateur</h2>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Adresse Email</label>
                <input type="email" className="filter-control" style={{ width: '100%', marginTop: '0.25rem' }} value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Mot de passe temporaire</label>
                <input type="text" className="filter-control" style={{ width: '100%', marginTop: '0.25rem' }} value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Rôle</label>
                <select className="filter-control" style={{ width: '100%', marginTop: '0.25rem' }} value={role} onChange={e => setRole(e.target.value)}>
                  <option value="user">Pilote / Auditeur (User)</option>
                  <option value="admin">Administrateur (Admin)</option>
                </select>
              </div>
              <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }}>Créer l'utilisateur</button>
            </form>
          </div>

          <div className="card" style={{ borderColor: 'var(--danger)' }}>
            <h2 className="card-title" style={{ color: 'var(--danger)' }}>Zone dangereuse</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Cette action supprimera définitivement tous les audits (5S et Gemba), les plans d'action et l'historique. Les comptes utilisateurs ne seront pas affectés.
            </p>
            <button type="button" className="btn btn-danger" style={{ width: '100%' }} onClick={handleClearAllData}>
              🗑️ Vider toutes les données
            </button>
          </div>

        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden', height: 'fit-content' }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)' }}>
            <h2 className="card-title" style={{ margin: 0 }}>Utilisateurs ({users.length})</h2>
          </div>
          <div className="table-wrapper" style={{ maxHeight: '500px', border: 'none' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Rôle</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>{u.email}</td>
                    <td>
                      <span className={`badge ${u.role === 'admin' ? 'ok' : ''}`} style={{ background: u.role === 'admin' ? 'rgba(59, 130, 246, 0.2)' : 'var(--bg-main)', color: u.role === 'admin' ? '#3b82f6' : 'var(--text-main)' }}>
                        {u.role.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
