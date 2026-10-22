import { useState } from 'react'
import { parseFile } from '../services/importExcel'
import { upsertAudits } from '../services/auditsApi'

export default function UploadCard({ onImported }) {
  const [file, setFile]     = useState(null)
  const [rows, setRows]     = useState([])     // données parsées, PAS encore en base
  const [busy, setBusy]     = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)

  // ── Étape 1 : import → parse uniquement, rien n'est envoyé ──────
  async function handleFile(e) {
    const f = e.target.files?.[0]
    if (!f) return

    setBusy(true)
    setMessage('')
    setIsError(false)
    setRows([])
    setFile(f)

    try {
      const parsed = await parseFile(f)
      if (parsed.length === 0) throw new Error('Aucune ligne valide détectée.')
      setRows(parsed)
      setMessage(`${parsed.length} audit(s) prêt(s) à enregistrer. Vérifiez l'aperçu puis cliquez sur "Enregistrer".`)
    } catch (err) {
      setIsError(true)
      setMessage(`Erreur : ${err.message}`)
      setFile(null)
    } finally {
      setBusy(false)
      e.target.value = ''
    }
  }

  // ── Étape 2 : enregistrement en base ────────────────────────────
  async function handleSave() {
    if (rows.length === 0) return
    setSaving(true)
    setMessage('')
    setIsError(false)

    try {
      const count = await upsertAudits(rows)
      setMessage(`${count} audit(s) enregistré(s) avec succès dans Supabase.`)
      setRows([])
      setFile(null)
      onImported?.()
    } catch (err) {
      setIsError(true)
      setMessage(`Erreur d'enregistrement : ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  // ── Annulation : on jette l'aperçu, rien n'a été sauvegardé ─────
  function handleCancel() {
    setRows([])
    setFile(null)
    setMessage('')
    setIsError(false)
  }

  return (
    <div className="card">
      <h2 className="card-title">Importer un fichier Excel</h2>

      <input
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFile}
        disabled={busy || saving}
      />

      {busy && <p className="muted">Lecture du fichier…</p>}

      {message && (
        <p className={isError ? 'message-error' : 'message-success'}>{message}</p>
      )}

      {/* Aperçu — affiché uniquement si des lignes sont en attente */}
      {rows.length > 0 && (
        <Preview
          fileName={file?.name}
          rows={rows}
          saving={saving}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )}
    </div>
  )
}

/* ── Sous-composant : aperçu + boutons ─────────────────────────── */

function Preview({ fileName, rows, saving, onSave, onCancel }) {
  const preview = rows.slice(0, 5)

  return (
    <div style={{ marginTop: '1rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '.5rem',
        }}
      >
        <strong style={{ fontSize: '.875rem' }}>
          Aperçu — {fileName} ({rows.length} ligne{rows.length > 1 ? 's' : ''})
        </strong>
        <div style={{ display: 'flex', gap: '.5rem' }}>
          <button
            className="filter-control btn-reset"
            onClick={onCancel}
            disabled={saving}
          >
            Annuler
          </button>
          <button
            className="filter-control"
            style={{ background: '#2563eb', color: 'white', border: 'none', cursor: 'pointer' }}
            onClick={onSave}
            disabled={saving}
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>

      <div className="table-wrapper" style={{ maxHeight: 240 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Zone</th>
              <th>Pilote</th>
              <th>Auditeur</th>
              <th>Total</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {preview.map((r, i) => {
              const pct = r.total_points && r.max_points
                ? ((r.total_points / r.max_points) * 100).toFixed(1)
                : '0.0'
              return (
                <tr key={`${r.date}|${r.zone}|${r.auditor}|${i}`}>
                  <td>{r.date}</td>
                  <td>{r.zone}</td>
                  <td>{r.pilot ?? '—'}</td>
                  <td>{r.auditor}</td>
                  <td>{r.total_points} / {r.max_points}</td>
                  <td className="score">{pct} %</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {rows.length > 5 && (
        <p className="muted" style={{ marginTop: '.5rem', fontSize: '.8rem' }}>
          … et {rows.length - 5} autre{rows.length - 5 > 1 ? 's' : ''} ligne{rows.length - 5 > 1 ? 's' : ''}.
        </p>
      )}
    </div>
  )
}
