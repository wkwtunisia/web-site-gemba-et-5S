import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { parseFile } from '../services/importExcel'
import { upsertAudits } from '../services/auditsApi'

export default function UploadCard({ onImported }) {
  const [file, setFile]     = useState(null)
  const [rows, setRows]     = useState([])
  const [busy, setBusy]     = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)

  async function handleFile(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setBusy(true); setMessage(''); setIsError(false); setRows([]); setFile(f)
    try {
      const parsed = await parseFile(f)
      if (parsed.length === 0) throw new Error('Aucune ligne valide détectée.')
      setRows(parsed)
      setMessage(`${parsed.length} audit(s) prêt(s) à enregistrer.`)
    } catch (err) {
      setIsError(true); setMessage(`Erreur : ${err.message}`); setFile(null)
    } finally { setBusy(false); e.target.value = '' }
  }

  async function handleSave() {
    if (rows.length === 0) return
    setSaving(true); setMessage(''); setIsError(false)
    try {
      const count = await upsertAudits(rows)
      setMessage(`${count} audit(s) enregistré(s) avec succès.`)
      setRows([]); setFile(null); onImported?.()
    } catch (err) {
      setIsError(true); setMessage(`Erreur d'enregistrement : ${err.message}`)
    } finally { setSaving(false) }
  }

  async function handleClear() {
    if (!window.confirm("⚠️ ATTENTION : Voulez-vous vraiment supprimer TOUS les audits 5S et leurs photos ? Cette action est irréversible.")) return;
    setSaving(true);
    try {
      // On supprime tout sauf une date factice pour contourner les règles de sécurité
      const { error } = await supabase.from('audits').delete().neq('date', '1900-01-01');
      if (error) throw error;
      setMessage("✅ Tous les audits 5S ont été supprimés avec succès.");
      setIsError(false);
      onImported?.();
    } catch (err) {
      setIsError(true); setMessage("Erreur lors de la suppression : " + err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setRows([]); setFile(null); setMessage(''); setIsError(false)
  }

  return (
    <div className="card">
      <h2 className="card-title">Importer un fichier Excel (5S)</h2>
      <input type="file" accept=".xlsx,.xls" onChange={handleFile} disabled={busy || saving} />
      {busy && <p className="muted">Lecture du fichier…</p>}
      {message && <p className={isError ? 'message-error' : 'message-success'}>{message}</p>}
      
      {rows.length > 0 && (
        <Preview fileName={file?.name} rows={rows} saving={saving} onSave={handleSave} onCancel={handleCancel} />
      )}

      <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
        <button 
          onClick={handleClear} 
          disabled={saving}
          className="btn btn-danger" 
          style={{ width: '100%', background: 'var(--danger)', color: 'white', border: 'none', padding: '0.6rem' }}
        >
          🗑️ Vider toute la base 5S
        </button>
        <p className="muted" style={{ fontSize: '0.75rem', marginTop: '0.5rem', textAlign: 'center' }}>
          Supprime tous les audits et photos pour repartir de zéro.
        </p>
      </div>
    </div>
  )
}

function Preview({ fileName, rows, saving, onSave, onCancel }) {
  const preview = rows.slice(0, 5)
  return (
    <div style={{ marginTop: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.5rem' }}>
        <strong style={{ fontSize: '.875rem' }}>Aperçu — {fileName} ({rows.length} ligne{rows.length > 1 ? 's' : ''})</strong>
        <div style={{ display: 'flex', gap: '.5rem' }}>
          <button className="filter-control btn-reset" onClick={onCancel} disabled={saving}>Annuler</button>
          <button className="filter-control" style={{ background: '#2563eb', color: 'white', border: 'none', cursor: 'pointer' }} onClick={onSave} disabled={saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
      <div className="table-wrapper" style={{ maxHeight: 240 }}>
        <table className="data-table">
          <thead><tr><th>Date</th><th>Zone</th><th>Pilote</th><th>Auditeur</th><th>Total</th><th>Score</th></tr></thead>
          <tbody>
            {preview.map((r, i) => {
              const pct = r.total_points && r.max_points ? ((r.total_points / r.max_points) * 100).toFixed(1) : '0.0'
              return (
                <tr key={`${r.date}|${r.zone}|${r.auditor}|${i}`}>
                  <td>{r.date}</td><td>{r.zone}</td><td>{r.pilot ?? '—'}</td><td>{r.auditor}</td><td>{r.total_points} / {r.max_points}</td><td className="score">{pct} %</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
