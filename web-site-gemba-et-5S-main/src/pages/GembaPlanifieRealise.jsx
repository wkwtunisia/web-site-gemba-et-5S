import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LabelList, Legend } from 'recharts'
import { formatMonthLabel } from '../utils/dateHelpers'

const OBJECTIF_SEMAINE = 5

export default function GembaPlanifieRealise() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [monthFilter, setMonthFilter] = useState('')

  useEffect(() => {
    supabase.from('gemba_audits').select('*').order('date', { ascending: true }).then(({ data, error }) => {
      if (!error) setData(data || [])
      setLoading(false)
    })
  }, [])

  const getMonthKey = (dateStr) => dateStr ? dateStr.slice(0, 7) : null
  const months = useMemo(() => [...new Set(data.map(d => getMonthKey(d.date)).filter(Boolean))].sort().reverse(), [data])

  // 1. Filtrer les données par mois
  const filtered = useMemo(() => data.filter(d => !monthFilter || getMonthKey(d.date) === monthFilter), [data, monthFilter])

  // 2. Regrouper les audits par date + ligne (pour ne pas compter les questions multiples)
  const auditsGrouped = useMemo(() => {
    const groups = {}
    filtered.forEach(row => {
      const auditKey = `${row.date}|${row.ligne}`
      if (!groups[auditKey]) {
        groups[auditKey] = { date: row.date, semaine: row.semaine, ligne: row.ligne }
      }
    })
    return Object.values(groups)
  }, [filtered])

  // 3. Calculer les données par semaine
  const weeklyData = useMemo(() => {
    const weeksMap = {}
    
    // Initialiser toutes les semaines du mois
    if (monthFilter) {
      const [year, month] = monthFilter.split('-')
      const date = new Date(year, parseInt(month) - 1, 1)
      while (date.getMonth() === parseInt(month) - 1) {
        const weekNum = getWeekNum(date)
        if (weekNum) weeksMap[weekNum] = 0
        date.setDate(date.getDate() + 1)
      }
    }

    // Remplir avec les vrais chiffres
    auditsGrouped.forEach(audit => {
      if (!audit.semaine) return
      if (!weeksMap[audit.semaine]) weeksMap[audit.semaine] = 0
      weeksMap[audit.semaine]++
    })

    return Object.entries(weeksMap)
      .map(([weekNum, count]) => ({
        label: `S${String(weekNum).padStart(2, '0')}`,
        'Objectif': OBJECTIF_SEMAINE,
        'Réalisé': count
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [auditsGrouped, monthFilter])

  const totalRealise = auditsGrouped.length
  const totalPlanifie = weeklyData.length * OBJECTIF_SEMAINE

  if (loading) return <p className="muted" style={{ padding: '2rem' }}>Chargement…</p>

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Planifié vs Réalisé (Gemba)</h1>
        <select className="filter-control" value={monthFilter} onChange={e => setMonthFilter(e.target.value)}>
          <option value="">Tous les mois</option>
          {months.map(m => <option key={m} value={m}>{formatMonthLabel(m)}</option>)}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="card" style={{ textAlign: 'center', padding: '1.5rem' }}>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Objectif Total</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#3b82f6' }}>{totalPlanifie}</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '1.5rem' }}>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Audits Réalisés</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#f97316' }}>{totalRealise}</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '1.5rem' }}>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Taux de réalisation</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: totalRealise >= totalPlanifie ? 'var(--success)' : 'var(--danger)' }}>
            {totalPlanifie > 0 ? Math.round((totalRealise / totalPlanifie) * 100) : 0} %
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title" style={{ marginBottom: '2rem' }}>Suivi Hebdomadaire (Objectif : {OBJECTIF_SEMAINE} audits)</h2>
        {weeklyData.length === 0 ? (
          <div className="muted" style={{ padding: '2rem', textAlign: 'center' }}>Aucune donnée.</div>
        ) : (
          <div style={{ height: 450 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData} margin={{ top: 30, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} dy={10} />
                <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#fff' }} />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Bar dataKey="Objectif" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={50}>
                  <LabelList dataKey="Objectif" position="top" fill="#3b82f6" fontSize={12} fontWeight="bold" />
                </Bar>
                <Bar dataKey="Réalisé" fill="#f97316" radius={[4, 4, 0, 0]} maxBarSize={50}>
                  <LabelList dataKey="Réalisé" position="top" fill="#f97316" fontSize={12} fontWeight="bold" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}

function getWeekNum(d) {
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3); 
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - target) / 604800000);
}
