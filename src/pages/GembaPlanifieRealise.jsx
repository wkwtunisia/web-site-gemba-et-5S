import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { fetchAllGembaData } from '../services/gembaApi'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LabelList, Legend } from 'recharts'

const OBJECTIF_SEMAINE = 5

const normalizeToYYYYMMDD = (dateStr) => {
  if (!dateStr) return null;
  const str = String(dateStr).trim();

  let match = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (match) return `${match[1]}-${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}`;

  match = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (match) return `${match[3]}-${String(match[2]).padStart(2, '0')}-${String(match[1]).padStart(2, '0')}`;

  const months = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
  match = str.match(/^(\d{1,2})[-\s]([a-zA-Z]{3})[-\s](\d{4})/);
  if (match) {
    const month = months[match[2].toLowerCase()];
    if (month) return `${match[3]}-${month}-${String(match[1]).padStart(2, '0')}`;
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return null;
}

const getWeekNum = (dateStr) => {
  const dateOnly = normalizeToYYYYMMDD(dateStr);
  if (!dateOnly) return null;
  const d = new Date(`${dateOnly}T12:00:00`);
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

const fetchAllGemba = fetchAllGembaData;

export default function GembaPlanifieRealise() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    fetchAllGemba().then(res => {
      setData(res)
      setLoading(false)
    })
  }, [])

  const isWithinDateRange = (dateStr) => {
    if (!startDate && !endDate) return true;
    const dStr = normalizeToYYYYMMDD(dateStr);
    if (!dStr) return false;

    if (startDate && dStr < startDate) return false;
    if (endDate && dStr > endDate) return false;
    return true;
  }

  const filtered = useMemo(() => data.filter(d => isWithinDateRange(d.date)), [data, startDate, endDate])

  const auditsGrouped = useMemo(() => {
    const groups = {}
    filtered.forEach(row => {
      const auditKey = `${row.date}|${row.ligne}`
      if (!groups[auditKey]) {
        groups[auditKey] = { date: row.date, ligne: row.ligne }
      }
    })
    return Object.values(groups)
  }, [filtered])

  const weeklyData = useMemo(() => {
    const weeksMap = {}
    
    auditsGrouped.forEach(audit => {
      const weekNum = getWeekNum(audit.date)
      if (!weekNum) return
      const label = `S${String(weekNum).padStart(2, '0')}`
      if (!weeksMap[label]) weeksMap[label] = 0
      weeksMap[label]++
    })

    return Object.entries(weeksMap)
      .map(([label, count]) => ({
        label,
        'Objectif': OBJECTIF_SEMAINE,
        'Réalisé': count
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [auditsGrouped])

  const totalRealise = auditsGrouped.length
  const totalPlanifie = weeklyData.length * OBJECTIF_SEMAINE

  if (loading) return <p className="muted" style={{ padding: '2rem' }}>Chargement…</p>

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: '1.5rem', alignItems: 'center' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Planifié vs Réalisé (Gemba)</h1>
        
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
