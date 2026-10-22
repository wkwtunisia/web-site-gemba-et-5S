import { useState, useMemo, useEffect } from 'react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, LabelList, ReferenceLine } from 'recharts'
import { getWeekKey, getMonthKey, formatWeekLabel, formatMonthLabel } from '../utils/dateHelpers'

const axisStyle = { fontSize: 11, fill: '#94a3b8' }
const COLORS = ['#3b82f6', '#f97316', '#10b981', '#8b5cf6', '#ec4899', '#f59e0b', '#06b6d4', '#ef4444']

export default function TendanceLigne({ audits }) {
  const [filterType, setFilterType] = useState('week') // 'week' ou 'month'
  const [selectedPeriod, setSelectedPeriod] = useState('')

  // Listes de périodes
  const weeks = useMemo(() => [...new Set(audits.map(a => getWeekKey(a.date)).filter(Boolean))].sort().reverse(), [audits])
  const months = useMemo(() => [...new Set(audits.map(a => getMonthKey(a.date)).filter(Boolean))].sort().reverse(), [audits])

  // Réinitialiser la sélection quand on change de type de filtre
  useEffect(() => {
    if (filterType === 'week') setSelectedPeriod(weeks[0] || '')
    if (filterType === 'month') setSelectedPeriod(months[0] || '')
  }, [filterType, weeks, months])

  // Audits de la période sélectionnée (pour savoir QUOI afficher)
  const periodAudits = useMemo(() => {
    if (!selectedPeriod) return []
    if (filterType === 'week') return audits.filter(a => getWeekKey(a.date) === selectedPeriod)
    return audits.filter(a => getMonthKey(a.date) === selectedPeriod)
  }, [audits, selectedPeriod, filterType])

  // Lignes uniques auditées dans cette période
  const availableZones = useMemo(() => {
    return [...new Set(periodAudits.map(a => a.zone).filter(Boolean))].sort()
  }, [periodAudits])

  // Préparation des données : L'HISTORIQUE COMPLET de chaque ligne
  const historyData = useMemo(() => {
    const dataByZone = {}
    
    availableZones.forEach(zone => {
      // On récupère TOUS les audits de cette ligne (toutes semaines confondues)
      const zoneAudits = audits.filter(a => a.zone === zone)
      
      // On regroupe par semaine
      const byWeek = {}
      zoneAudits.forEach(a => {
        const wk = getWeekKey(a.date)
        if (!wk) return
        if (!byWeek[wk]) byWeek[wk] = { sum: 0, count: 0 }
        byWeek[wk].sum += Number(a.score_pct)
        byWeek[wk].count++
      })

      // On formate pour le graphique
      dataByZone[zone] = Object.entries(byWeek)
        .map(([wk, d]) => ({
          weekKey: wk,
          label: formatWeekLabel(wk),
          score: Number((d.sum / d.count).toFixed(1))
        }))
        .sort((a, b) => a.weekKey.localeCompare(b.weekKey))
    })

    return dataByZone
  }, [audits, availableZones])

  // Label de la période sélectionnée
  const selectedPeriodLabel = selectedPeriod 
    ? (filterType === 'week' ? formatWeekLabel(selectedPeriod) : formatMonthLabel(selectedPeriod))
    : ''

  const CustomLabel = (props) => {
    const { x, y, value, payload } = props
    if (value === null || value === undefined) return null
    
    // On met en évidence si c'est dans la période sélectionnée
    let isInPeriod = false
    if (filterType === 'week' && payload) isInPeriod = payload.label === selectedPeriodLabel
    if (filterType === 'month' && payload) {
        // Verification simplifiée
        const [year, month] = selectedPeriod.split('-')
        const d = new Date(year, parseInt(month) - 1, 1)
        const monthName = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
        // La comparaison exacte de date serait mieux, mais on fait simple pour le label
    }

    return (
      <text x={x} y={y - 10} fill={isInPeriod ? '#3b82f6' : '#f8fafc'} fontSize={isInPeriod ? 12 : 10} fontWeight={isInPeriod ? 'bold' : 'normal'} textAnchor="middle">
        {value}%
      </text>
    )
  }

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Tendance des audits par Période</h1>
      </div>

      <div className="card" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '2rem' }}>
        
        {/* Choix du type de filtre */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Type de filtre</label>
          <select className="filter-control" value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="week">Par Semaine</option>
            <option value="month">Par Mois</option>
          </select>
        </div>

        {/* Sélection de la période */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: '200px' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Choisir la période</label>
          <select className="filter-control" value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value)}>
            <option value="">-- Sélectionner --</option>
            {filterType === 'week' 
              ? weeks.map(w => <option key={w} value={w}>{formatWeekLabel(w)}</option>)
              : months.map(m => <option key={m} value={m}>{formatMonthLabel(m)}</option>)
            }
          </select>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title" style={{ marginBottom: '2rem', color: 'var(--primary)' }}>
          Historique des lignes auditées en {selectedPeriodLabel}
        </h2>
        
        {availableZones.length === 0 ? (
          <div className="muted" style={{ padding: '3rem', textAlign: 'center' }}>
            Aucun audit pour cette période.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
            {availableZones.map((zone, idx) => {
              const color = COLORS[idx % COLORS.length]
              const zoneData = historyData[zone] || []

              return (
                <div key={zone} style={{ background: 'var(--bg-main)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: color, fontWeight: 'bold' }}>
                    Ligne : {zone} <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 'normal' }}>(Historique complet)</span>
                  </h3>
                  
                  <div style={{ height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={zoneData} margin={{ top: 25, right: 30, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                        <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} dy={10} />
                        <YAxis domain={[0, 100]} tick={axisStyle} axisLine={false} tickLine={false} />
                        <Tooltip 
                          contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#fff' }}
                          formatter={(v) => [`${v} %`, zone]}
                          labelFormatter={(label) => `Semaine : ${label}`}
                        />
                        
                        {/* Ligne verticale (uniquement si filtre par semaine) */}
                        {filterType === 'week' && (
                          <ReferenceLine x={selectedPeriodLabel} stroke="#64748b" strokeDasharray="3 3" label={{ position: 'top', value: 'Semaine choisie', fill: '#64748b', fontSize: 10 }} />
                        )}

                        <Line 
                          type="monotone" 
                          dataKey="score" 
                          stroke={color} 
                          strokeWidth={3} 
                          dot={{ r: 5, fill: color, stroke: '#1e293b', strokeWidth: 2 }} 
                          activeDot={{ r: 7 }} 
                          connectNulls
                        >
                          <LabelList content={<CustomLabel />} />
                        </Line>
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
