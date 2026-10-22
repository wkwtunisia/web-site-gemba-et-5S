import { useCallback, useEffect, useState } from 'react'
import { fetchAudits } from '../services/auditsApi'

/**
 * Charge les audits depuis Supabase.
 * `refreshKey` permet de forcer un rechargement après import.
 */
export function useAudits(refreshKey = 0) {
  const [audits, setAudits]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchAudits()
      setAudits(data)
    } catch (e) {
      setError(e.message ?? String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load, refreshKey])

  return { audits, loading, error, reload: load }
}
