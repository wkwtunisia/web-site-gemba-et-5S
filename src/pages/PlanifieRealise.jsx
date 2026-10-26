import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, LabelList } from 'recharts'

const OBJECTIF_SEMAINE = 5
const axisStyle = { fontSize: 12, fill: '#94a3b8' }

// 🌟 1. TRANSFORMATION DE LA DATE EN TEXTE PUR (YYYY-MM-DD)
const normalizeToYYYYMMDD = (dateStr) => {
  if (!dateStr) return null;
  const str = String(dateStr).trim();

  // Si c'est déjà au format YYYY-MM-DD...
  let match = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (match) return `${match[1]}-${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}`;

  // Si c'est au format DD/MM/YYYY ou DD-MM-YYYY
  match = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (match) return `${match[3]}-${String(match[2]).padStart(2, '0')}-${String(match[1]).padStart(2, '0')}`;

  // Si c'est au format 18-Oct-2026
  const months = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
  match = str.match(/^(\d{1,2})[-\s]([a-zA-Z]{3})[-\s](\d{4})/);
  if (match) {
    const month = months[match[2].toLowerCase()];
    if (month) return `${match[3]}-${month}-${String(match[1]).padStart(2, '0')}`;
  }

  // Fallback
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return null;
}

const getWeekNum = (dateStr) => {
  const dateOnly = normalizeToYYYYMMDD(dateStr);
  if (!dateOnly) return null;
  const d = new Date(`${dateOnly}T12:00:00`); // Midi pour éviter les décalages
  if (isNaN(d.getTime())) return null;
  
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

const fetchAllAudits = async () => {
  let allData = []
  let from = 0
  const step = 1000
  let hasMore = true
  while (hasMore) {
    const { data, error } = await supabase.from('audits').select('*').order('date', { ascending: false }).range(from, from + step - 1)
    if (error) { console.error(error); break }
    if (data.length === 0) { hasMore = false } else { allData = [...allData, ...data]; from += step }
  }
  return allData
}

export default function PlanifieRealise() {
  const [audits, setAudits] = useState([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    fetchAllAudits().then(data => {
      setAudits(data)
      setLoading(false)
    })
  }, [])

  // 🌟 2. COMPARAISON DE TEXTE (Zéro bug de fuseau horaire)
  const isWithinDateRange = (dateStr) => {
    if (!startDate && !endDate) return true;
    const dStr = normalizeToYYYYMMDD(dateStr);
    if (!dStr) return false;

    // startDate et endDate sont déjà au format YYYY-MM-DD grâce à l'input type="date"
    if (startDate && dStr < startDate) return false;
    if (endDate && dStr > endDate) return false;
    return true;
  }

  const filteredAudits = useMemo(() => audits.filter(a => isWithinDateRange(a.date)), [audits, startDate, endDate])

  const weeklyData = useMemo(() => {
    const weeks = {}
    filteredAudits.forEach(a => {
      const wk = getWeekNum(a.date)
      if (wk) {
        const label = `S${String(wk).padStart(2, '0')}`
        weeks[label] = (weeks[label] || 0) + 1
      }
    })

    return Object.entries(weeks)
      .map(([label, totalRealises]) => ({
        label,
        'Planifié': OBJECTIF_SEMAINE,
        'Réalisé': totalRealises
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [filteredAudits])

  const totalPlanifie = weeklyData.length * OBJECTIF_SEMAINE
  const totalRealise = weeklyData.reduce((sum, w) => sum + w.Réalisé, 0)

  if (loading) return <p className="muted" style={{ padding: '2rem' }}>Chargement…</p>

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: '1.5rem', alignItems: 'center' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Planifié vs Réalisé (5S)</h1>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', background: 'var(--surface)', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Du</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ background: 'transparent', color: 'var(--text-main)', border: 'none', outline: 'none', fontSize: '0.9rem' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Au</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ background: 'transparent', color: 'var(--text-main)', border: 'none', outline: 'none', fontSize: '0.9rem' }} />
          </div>
        </div>
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
          <div className="muted" style={{ padding: '2rem', textAlign: 'center' }}>Aucune donnée pour cette période.</div>
        ) : (
          <div style={{ height: 450 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData} margin={{ top: 30, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} dy={10} />
                <YAxis allowDecimals={false} tick={axisStyle} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#fff' }} />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Bar dataKey="Planifié" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={50}>
                  <LabelList dataKey="Planifié" position="top" fill="#3b82f6" fontSize={12} fontWeight="bold" />
                </Bar>
                <Bar dataKey="Réalisé" fill="#f97316" radius={[4, 4, 0, 0]} maxBarSize={50}>
                  <LabelList dataKey="Réalisé" position="top" fill="#f97316" fontSize={12} fontWeight="bold" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* 🌟 BOÎTE DE DIAGNOSTIC POUR VOIR LES DATES */}
      {filteredAudits.length > 0 && (
        <div className="card" style={{ marginTop: '2rem', background: '#1e293b', padding: '1rem', borderRadius: '8px', border: '1px solid #334155' }}>
          <h3 style={{ fontSize: '1rem', color: '#38bdf8', marginTop: 0 }}>🔍 Diagnostic : Dates des {filteredAudits.length} audits trouvés pour cette période</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
            {filteredAudits.map((a, i) => (
              <span key={i} style={{ background: '#0f172a', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', color: '#e2e8f0', border: '1px solid #334155' }}>
                {a.date} ➜ {normalizeToYYYYMMDD(a.date)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
