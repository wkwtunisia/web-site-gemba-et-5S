import { useState } from 'react'
import { parseGembaFile } from '../services/importGemba'
import { supabase } from '../supabaseClient'

export default function ImportGemba() {
  const [rows, setRows] = useState([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true); setMessage('')
    try {
      const parsed = await parseGembaFile(file)
      setRows(parsed)
      setMessage(`${parsed.length} lignes Gemba prêtes à être enregistrées.`)
    } catch (err) {
      setMessage('❌ ' + err.message)
    } finally {
      setBusy(false)
      e.target.value = ''
    }
  }

  async function handleSave() {
    if (rows.length === 0) return
    setBusy(true); setMessage('Enregistrement...')
    try {
      // On envoie les données dans une table "gemba_audits" (à créer dans Supabase)
      const { error } = await supabase.from('gemba_audits').insert(rows)
      if (error) throw error
      setMessage(`✅ ${rows.length} lignes enregistrées avec succès !`)
      setRows([])
    } catch (err) {
      setMessage('❌ Erreur : ' + err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Importation Gemba (5M)</h1>
      </div>

      {message && (
        <div className={`alert alert-${message.includes('❌') ? 'error' : 'success'}`}>
          {message}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="card">
          <div className="upload-zone">
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏭</div>
            <h2 style={{ marginBottom: '1rem' }}>Importer votre fichier Gemba</h2>
            <p className="muted" style={{ marginBottom: '2rem' }}>
              Sélectionnez votre fichier (.xlsx) contenant les colonnes : Date, Ligne, UAP, Auditeur, Point M, Question, etc.
            </p>
            <label className="btn btn-primary" style={{ cursor: busy ? 'not-allowed' : 'pointer' }}>
              {busy ? 'Lecture...' : 'Choisir un fichier Excel'}
              <input type="file" accept=".xlsx, .xls" onChange={handleFile} disabled={busy} style={{ display: 'none' }} />
            </label>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="flex-between" style={{ marginBottom: '1rem' }}>
            <h2 className="card-title" style={{ margin: 0 }}>Aperçu des données Gemba ({rows.length} lignes)</h2>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="btn btn-secondary" onClick={() => setRows([])} disabled={busy}>Annuler</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={busy}>
                {busy ? 'Enregistrement...' : 'Enregistrer dans Supabase'}
              </button>
            </div>
          </div>

          <div className="table-wrapper" style={{ maxHeight: '600px' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Ligne</th>
                  <th>UAP</th>
                  <th>Auditeur</th>
                  <th>Point M</th>
                  <th>Question</th>
                  <th>Réponse</th>
                  <th>Action</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} style={{ background: r.reponse === 'NOK' ? 'rgba(239, 68, 68, 0.05)' : 'transparent' }}>
                    <td>{r.date ? new Date(r.date).toLocaleDateString('fr-FR') : '—'}</td>
                    <td style={{ fontWeight: 'bold' }}>{r.ligne}</td>
                    <td>{r.uap}</td>
                    <td>{r.auditeur}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{r.point_m}</td>
                    <td style={{ whiteSpace: 'normal', maxWidth: '300px' }}>{r.question}</td>
                    <td>
                      <span className={`badge ${r.reponse === 'OK' ? 'ok' : r.reponse === 'NOK' ? 'bad' : ''}`}>
                        {r.reponse}
                      </span>
                    </td>
                    <td style={{ whiteSpace: 'normal', maxWidth: '300px', color: 'var(--warning)' }}>{r.action}</td>
                    <td style={{ fontWeight: 'bold' }}>{r.score}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
