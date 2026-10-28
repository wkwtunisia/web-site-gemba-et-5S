import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function ImportGemba() {
  const [rows, setRows] = useState([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    setMessage('')
    try {
      // Note: Assurez-vous que parseGembaFile est bien importé si vous l'utilisez
      // Sinon, adaptez selon votre logique de lecture Excel
      const XLSX = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array', cellDates: true })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json(ws, { defval: null })
      
      if (data.length === 0) throw new Error('Fichier vide')
      
      // On normalise les données pour éviter les problèmes de casse
      const parsed = data.map(row => ({
        date: row['Date'] ? String(row['Date']).substring(0, 10) : null,
        ligne: row['Ligne'],
        uap: row['UAP'],
        semaine: row['Semaine'],
        point_m: row['Point M'],
        question: row['Question'],
        reponse: String(row['Reponse'] || '').toUpperCase().trim(),
        auditeur: row['Auditeur']
      })).filter(r => r.date && r.ligne && r.question)

      setRows(parsed)
      setMessage(`✅ ${parsed.length} lignes prêtes à être importées.`)
    } catch (err) {
      setMessage(`❌ Erreur : ${err.message}`)
    } finally {
      setBusy(false)
      e.target.value = ''
    }
  }

  async function handleSave() {
    if (rows.length === 0) return
    setBusy(true); setMessage('Enregistrement...')
    try {
      // 🌟 DÉDUPLICATION AVANT L'INSERTION
      const seen = new Set()
      const uniqueRows = []
      rows.forEach(r => {
        const key = `${r.date}|${r.ligne}|${r.question}`
        if (!seen.has(key)) {
          seen.add(key)
          uniqueRows.push(r)
        }
      })

      const { error } = await supabase.from('gemba_audits').upsert(uniqueRows, { onConflict: 'date, ligne, question' })
      if (error) throw error
      
      setMessage(`✅ ${uniqueRows.length} lignes enregistrées (${rows.length - uniqueRows.length} doublons ignorés) !`)
      setRows([])
    } catch (err) {
      setMessage('❌ Erreur : ' + err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleClear = async () => {
    if (!window.confirm("⚠️ ATTENTION : Voulez-vous vraiment supprimer TOUS les audits Gemba ?")) return;
    setBusy(true);
    try {
      const { error } = await supabase.from('gemba_audits').delete().neq('date', '1900-01-01');
      if (error) throw error;
      alert("✅ Tous les audits Gemba ont été supprimés.");
      window.location.reload();
    } catch (err) {
      alert("Erreur : " + err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Importation Gemba (5M)</h1>
      
      {message && <div className={`alert ${message.includes('❌') ? 'alert-error' : 'alert-success'}`}>{message}</div>}

      {rows.length === 0 ? (
        <div className="card">
          <div className="upload-zone">
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏭</div>
            <h2 style={{ marginBottom: '1rem' }}>Importer votre fichier Gemba</h2>
            <label className="btn btn-primary" style={{ cursor: busy ? 'not-allowed' : 'pointer' }}>
              {busy ? 'Lecture...' : 'Choisir un fichier Excel'}
              <input type="file" accept=".xlsx, .xls" onChange={handleFile} disabled={busy} style={{ display: 'none' }} />
            </label>
          </div>
          
          <div style={{ marginTop: '1.5rem', textAlign: 'center', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
            <button className="btn btn-danger" style={{ background: 'var(--danger)', color: 'white', border: 'none', padding: '0.5rem 1rem', cursor: 'pointer', width: '100%', maxWidth: '300px' }} onClick={handleClear} disabled={busy}>
              🗑️ Vider toute la base Gemba
            </button>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="flex-between" style={{ marginBottom: '1rem' }}>
            <h2 className="card-title" style={{ margin: 0 }}>Aperçu ({rows.length} lignes)</h2>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="btn btn-secondary" onClick={() => setRows([])} disabled={busy}>Annuler</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={busy}>
                {busy ? 'Enregistrement...' : 'Enregistrer dans Supabase'}
              </button>
            </div>
          </div>
          {/* Tableau d'aperçu simplifié */}
        </div>
      )}
    </div>
  )
}
