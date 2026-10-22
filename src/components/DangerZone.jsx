import { useState } from 'react'
import { deleteAllAudits } from '../services/auditsApi'

export default function DangerZone({ onCleared }) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy]             = useState(false)
  const [message, setMessage]       = useState('')
  const [isError, setIsError]       = useState(false)

  async function handleClear() {
    setBusy(true)
    setMessage('')
    setIsError(false)

    try {
      const deleted = await deleteAllAudits()
      console.log('[DangerZone] deleted =', deleted)
      setMessage(`${deleted} ligne(s) supprimée(s).`)
      setConfirming(false)

      // Appel après mise à jour d'état — laisse React finir son cycle
      if (typeof onCleared === 'function') {
        console.log('[DangerZone] calling onCleared()')
        onCleared()
      } else {
        console.warn('[DangerZone] onCleared prop is missing!')
        // fallback : forcer un rechargement complet
        window.location.reload()
      }
    } catch (err) {
      console.error('[DangerZone] error:', err)
      setIsError(true)
      setMessage(`Erreur : ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card" style={{ borderLeft: '4px solid #dc2626', marginTop: '1.5rem' }}>
      <h2 className="card-title" style={{ color: '#dc2626' }}>Zone dangereuse</h2>

      {!confirming && (
        <>
          <p className="muted" style={{ marginTop: 0 }}>
            Supprime définitivement tous les audits enregistrés en base. Irréversible.
          </p>
          <button
            className="filter-control"
            style={{ background: '#dc2626', color: 'white', border: 'none', cursor: 'pointer' }}
            onClick={() => { setConfirming(true); setMessage('') }}
            disabled={busy}
          >
            Effacer toutes les données
          </button>
        </>
      )}

      {confirming && (
        <>
          <p style={{ marginTop: 0, fontWeight: 600 }}>
            Confirmer la suppression de <em>toutes</em> les données ?
          </p>
          <div style={{ display: 'flex', gap: '.5rem' }}>
            <button
              className="filter-control btn-reset"
              onClick={() => setConfirming(false)}
              disabled={busy}
            >
              Annuler
            </button>
            <button
              className="filter-control"
              style={{ background: '#dc2626', color: 'white', border: 'none', cursor: 'pointer' }}
              onClick={handleClear}
              disabled={busy}
            >
              {busy ? 'Suppression…' : 'Oui, tout supprimer'}
            </button>
          </div>
        </>
      )}

      {message && (
        <p className={isError ? 'message-error' : 'message-success'}>{message}</p>
      )}
    </div>
  )
}
