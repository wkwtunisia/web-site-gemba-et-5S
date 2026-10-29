import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, LabelList } from 'recharts'

const normalizeString = (str) => {
  if (!str) return ''
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()
}

const getUap5S = (zone) => {
  if (!zone) return 'Autres'
  const clean = normalizeString(zone).trim()
  if (clean.includes('MAGASIN') || clean.includes('STOCKAGE')) return 'Logistique'
  if (clean.includes('T') || clean.includes('ENGEL') || clean.includes('DEMAG') || clean.includes('BOY') || clean.includes('BILLION')) {
    if (clean.includes('MUR')) return 'UAP 1'
    return 'UAP 2'
  }
  if (clean.includes('F') || clean.includes('L') || clean.includes('A12') || clean.includes('80') || clean.includes('125') || clean.includes('MUR')) return 'UAP 1'
  return 'Autres'
}

const getColorGemba = (score) => score >= 90 ? '#10b981' : score >= 85 ? '#f59e0b' : '#ef4444'
const getColor5S = (score) => score >= 86 ? '#10b981' : score >= 80 ? '#f59e0b' : '#ef4444'

const parseDate = (dateStr) => {
  if (!dateStr) return null
  let d = new Date(dateStr)
  if (!isNaN(d.getTime())) return d
  const str = String(dateStr).trim()
  const match = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/)
  if (match) {
    d = new Date(`${match[3]}-${match[2]}-${match[1]}`)
    if (!isNaN(d.getTime())) return d
  }
  const matchISO = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (matchISO) {
    d = new Date(`${matchISO[1]}-${matchISO[2]}-${matchISO[3]}`)
    if (!isNaN(d.getTime())) return d
  }
  return null
}

const fetchAll = async (tableName) => {
  let allData = []
  let from = 0
  const step = 1000
  let hasMore = true
  while (hasMore) {
    const { data, error } = await supabase.from(tableName).select('*').order('date', { ascending: false }).range(from, from + step - 1)
    if (error) { console.error(`Erreur sur ${tableName}:`, error); break }
    if (data.length === 0) { hasMore = false } else { allData = [...allData, ...data]; from += step }
  }
  return allData
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: '#1e293b', border: '1px solid #334155', padding: '10px', borderRadius: '5px', color: 'white', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
        <p style={{ margin: 0, fontWeight: 'bold', color: '#38bdf8' }}>{label}</p>
        {payload.map((entry, index) => (
          <p key={index} style={{ margin: '5px 0', color: entry.color, fontWeight: 'bold' }}>
            {entry.name} : {entry.value}
          </p>
        ))}
      </div>
    )
  }
  return null
}

export default function ResultatsS1() {
  const [audits5S, setAudits5S] = useState([])
  const [auditsGemba, setAuditsGemba] = useState([])
  const [loading, setLoading] = useState(true)

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    Promise.all([fetchAll('audits'), fetchAll('gemba_audits')]).then(([res5S, resGemba]) => {
      setAudits5S(res5S || [])
      setAuditsGemba(resGemba || [])
      setLoading(false)
    })
  }, [])

  const isWithinDateRange = (dateStr) => {
    if (!startDate && !endDate) return true
    const d = parseDate(dateStr)
    if (!d) return false
    const s = startDate ? new Date(startDate) : new Date(0)
    const e = endDate ? new Date(endDate) : new Date(8640000000000000)
    s.setHours(0, 0, 0, 0)
    e.setHours(23, 59, 59, 999)
    d.setHours(12, 0, 0, 0)
    return d >= s && d <= e
  }

  const kpiStats = useMemo(() => {
    const gembaSessions = new Set()
    const gembaLignes = new Set()
    auditsGemba.forEach(a => {
      if (isWithinDateRange(a.date)) {
        gembaSessions.add(`${a.date}|${a.ligne}`)
        gembaLignes.add(a.ligne)
      }
    })
    const realise5S = audits5S.filter(a => isWithinDateRange(a.date)).length
    return { gembaLignes: gembaLignes.size, gembaAudits: gembaSessions.size, realise5S }
  }, [audits5S, auditsGemba, startDate, endDate])

  const dataChartGemba = useMemo(() => {
    const gembaGroups = {}
    auditsGemba.forEach(a => {
      if (!isWithinDateRange(a.date)) return
      const ligne = (a.ligne || '').trim()
      const d = String(a.date).substring(5, 10).replace('-', '/') // ex: 10/28
      const key = `${ligne} (${d})` // On ajoute la date pour différencier
      if (!gembaGroups[key]) gembaGroups[key] = { ok: 0, total: 0 }
      gembaGroups[key].total++
      if (String(a.reponse).toUpperCase() === 'OK') gembaGroups[key].ok++
    })
    return Object.entries(gembaGroups).map(([key, data]) => ({ name: key, score: Math.round((data.ok / data.total) * 100) })).sort((a, b) => b.score - a.score)
  }, [auditsGemba, startDate, endDate])

  const dataChart5S = useMemo(() => {
    const stats5S = {}
    audits5S.forEach(a => {
      if (!isWithinDateRange(a.date) || !a.zone) return
      const d = String(a.date).substring(5, 10).replace('-', '/') // ex: 10/28
      const key = `${a.zone} (${d})` // On ajoute la date pour différencier
      if (!stats5S[key]) stats5S[key] = { sum: 0, count: 0 }
      stats5S[key].sum += Number(a.score_pct) || 0
      stats5S[key].count++
    })
    return Object.entries(stats5S).map(([key, data]) => ({ name: key, score: Math.round(data.sum / data.count) })).sort((a, b) => b.score - a.score)
  }, [audits5S, startDate, endDate])

  const scoresGlobaux = useMemo(() => {
    const scores5S = []
    audits5S.forEach(a => { if (isWithinDateRange(a.date)) scores5S.push(Number(a.score_pct) || 0) })
    const moy5S = scores5S.length > 0 ? Math.round(scores5S.reduce((a, b) => a + b, 0) / scores5S.length) : 0

    const gembaGroups = {}
    auditsGemba.forEach(a => {
      if (!isWithinDateRange(a.date)) return
      const ligne = (a.ligne || '').trim()
      if (!gembaGroups[ligne]) gembaGroups[ligne] = { ok: 0, total: 0 }
      gembaGroups[ligne].total++
      if (String(a.reponse).toUpperCase() === 'OK') gembaGroups[ligne].ok++
    })
    let totalGemba = 0, countGemba = 0
    Object.values(gembaGroups).forEach(data => {
      if (data.total > 0) { totalGemba += (data.ok / data.total) * 100; countGemba++ }
    })
    const moyGemba = countGemba > 0 ? Math.round(totalGemba / countGemba) : 0

    return { gemba: moyGemba, s5: moy5S }
  }, [audits5S, auditsGemba, startDate, endDate])

  const classementsLignes = useMemo(() => {
    const stats5S = {}
    audits5S.forEach(a => {
      if (!isWithinDateRange(a.date) || !a.zone) return
      if (!stats5S[a.zone]) stats5S[a.zone] = { sum: 0, count: 0 }
      stats5S[a.zone].sum += Number(a.score_pct) || 0
      stats5S[a.zone].count++
    })
    const list5S = Object.entries(stats5S).map(([ligne, data]) => ({ name: ligne, taux: Math.round(data.sum / data.count) })).sort((a, b) => b.taux - a.taux)

    const gembaGroups = {}
    auditsGemba.forEach(a => {
      if (!isWithinDateRange(a.date) || !a.ligne) return
      const key = a.ligne.trim()
      if (!gembaGroups[key]) gembaGroups[key] = { ok: 0, total: 0 }
      gembaGroups[key].total++
      if (String(a.reponse).toUpperCase() === 'OK') gembaGroups[key].ok++
    })
    const listGemba = Object.entries(gembaGroups).map(([ligne, data]) => ({ name: ligne, taux: Math.round((data.ok / data.total) * 100) })).sort((a, b) => b.taux - a.taux)

    return {
      top3_5S: list5S.slice(0, 3),
      bottom3_5S: list5S.slice(-3).reverse(),
      top3_Gemba: listGemba.slice(0, 3),
      bottom3_Gemba: listGemba.slice(-3).reverse()
    }
  }, [audits5S, auditsGemba, startDate, endDate])

  const classementsQuestions = useMemo(() => {
    const stats5S = {}
    audits5S.forEach(a => {
      if (!isWithinDateRange(a.date)) return
      const cps = a.checkpoints || []
      cps.forEach(cp => {
        if (!cp.q) return
        const q = cp.q.trim()
        if (!stats5S[q]) stats5S[q] = { ok: 0, total: 0 }
        stats5S[q].total++
        if (String(cp.s).toUpperCase() === 'OK') stats5S[q].ok++
      })
    })
    const list5S = Object.entries(stats5S).map(([q, data]) => ({ name: q, taux: Math.round((data.ok / data.total) * 100), total: data.total }))
      .filter(q => q.total >= 2).sort((a, b) => b.taux - a.taux)

    const statsGemba = {}
    auditsGemba.forEach(a => {
      if (!isWithinDateRange(a.date)) return
      const q = (a.question || '').trim()
      if (!q) return
      if (!statsGemba[q]) statsGemba[q] = { ok: 0, total: 0 }
      statsGemba[q].total++
      if (String(a.reponse).toUpperCase() === 'OK') statsGemba[q].ok++
    })
    const listGemba = Object.entries(statsGemba).map(([q, data]) => ({ name: q, taux: Math.round((data.ok / data.total) * 100), total: data.total }))
      .filter(q => q.total >= 2).sort((a, b) => b.taux - a.taux)

    return {
      top3_5S: list5S.slice(0, 3),
      bottom3_5S: list5S.slice(-3).reverse(),
      top3_Gemba: listGemba.slice(0, 3),
      bottom3_Gemba: listGemba.slice(-3).reverse()
    }
  }, [audits5S, auditsGemba, startDate, endDate])

  const moyennesUap = useMemo(() => {
    const stats5S = { 'UAP 1': [], 'UAP 2': [], 'Logistique': [] }
    audits5S.forEach(a => {
      if (!isWithinDateRange(a.date)) return
      const uap = getUap5S(a.zone)
      if (stats5S[uap]) stats5S[uap].push(Number(a.score_pct) || 0)
    })
    const moy5S = {}
    Object.entries(stats5S).forEach(([uap, scores]) => {
      moy5S[uap] = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
    })

    const gembaGroups = {} 
    auditsGemba.forEach(a => {
      if (!isWithinDateRange(a.date)) return
      let uap = (a.uap || '').trim().toUpperCase()
      if (uap.includes('UAP 1') || uap.includes('UAP1')) uap = 'UAP 1'
      else if (uap.includes('UAP 2') || uap.includes('UAP2')) uap = 'UAP 2'
      else if (uap.includes('LOG')) uap = 'Logistique'
      else return
      const ligne = (a.ligne || '').trim()
      if (!gembaGroups[uap]) gembaGroups[uap] = {}
      if (!gembaGroups[uap][ligne]) gembaGroups[uap][ligne] = { ok: 0, total: 0 }
      gembaGroups[uap][ligne].total++
      if (String(a.reponse).toUpperCase() === 'OK') gembaGroups[uap][ligne].ok++
    })

    const moyGemba = {}
    Object.entries(gembaGroups).forEach(([uap, lignes]) => {
      let totalScore = 0, countLignes = 0
      Object.values(lignes).forEach(data => {
        if (data.total > 0) { totalScore += (data.ok / data.total) * 100; countLignes++ }
      })
      moyGemba[uap] = countLignes > 0 ? totalScore / countLignes : 0
    })

    return [
      { name: 'UAP 1', s5: Math.round(moy5S['UAP 1']), gemba: Math.round(moyGemba['UAP 1'] || 0) },
      { name: 'UAP 2', s5: Math.round(moy5S['UAP 2']), gemba: Math.round(moyGemba['UAP 2'] || 0) },
      { name: 'Logistique', s5: Math.round(moy5S['Logistique']), gemba: Math.round(moyGemba['Logistique'] || 0) }
    ]
  }, [audits5S, auditsGemba, startDate, endDate])

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-main)' }}>Chargement des données...</div>

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: '1.5rem', alignItems: 'center' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>📅 Résultats d'une Période</h1>
        
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        <div className="card" style={{ padding: '1.5rem', textAlign: 'center', borderLeft: '8px solid #38bdf8' }}>
          <h2 style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Score Gemba</h2>
          <div style={{ fontSize: '3rem', fontWeight: 'bold', color: getColorGemba(scoresGlobaux.gemba) }}>{scoresGlobaux.gemba}%</div>
        </div>
        
        <div className="card" style={{ padding: '1.5rem', textAlign: 'center', borderLeft: '8px solid #f59e0b' }}>
          <h2 style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Score 5S</h2>
          <div style={{ fontSize: '3rem', fontWeight: 'bold', color: getColor5S(scoresGlobaux.s5) }}>{scoresGlobaux.s5}%</div>
        </div>

        <div className="card" style={{ padding: '1.5rem', textAlign: 'center', borderLeft: '8px solid #8b5cf6' }}>
          <h2 style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Gemba (Lignes / Audits)</h2>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: '0.5rem' }}>
            <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#8b5cf6' }}>{kpiStats.gembaAudits}</div>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Audits Gemba réalisés</div>
        </div>

        <div className="card" style={{ padding: '1.5rem', textAlign: 'center', borderLeft: '8px solid #10b981' }}>
          <h2 style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>5S (Réalisé)</h2>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: '0.5rem' }}>
            <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#10b981' }}>{kpiStats.realise5S}</div>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>audits réalisés</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
        <div className="card" style={{ padding: '1.5rem', background: '#111827', borderRadius: '8px' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#f8fafc', margin: 0 }}>Gemba — Résultat par ligne</h2>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0.2rem 0 0 0' }}>{dataChartGemba.length} ligne(s) auditée(s)</p>
          </div>
          <div style={{ height: '300px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataChartGemba} margin={{ top: 30, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} unit="%" stroke="#94a3b8" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                  {dataChartGemba.map((entry, index) => <Cell key={`cell-${index}`} fill={getColorGemba(entry.score)} />)}
                  <LabelList dataKey="score" position="top" formatter={(val) => `${val}%`} fill="#f8fafc" fontSize={12} fontWeight="bold" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card" style={{ padding: '1.5rem', background: '#111827', borderRadius: '8px' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#f8fafc', margin: 0 }}>5S — Résultat par zone</h2>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0.2rem 0 0 0' }}>{dataChart5S.length} zone(s) auditée(s)</p>
          </div>
          <div style={{ height: '300px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataChart5S} margin={{ top: 30, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} unit="%" stroke="#94a3b8" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                  {dataChart5S.map((entry, index) => <Cell key={`cell-${index}`} fill={getColor5S(entry.score)} />)}
                  <LabelList dataKey="score" position="top" formatter={(val) => `${val}%`} fill="#f8fafc" fontSize={12} fontWeight="bold" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <h2 className="card-title" style={{ marginBottom: '1.5rem' }}>📊 Classement des Lignes</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          <div>
            <h3 style={{ color: '#38bdf8', marginBottom: '1rem', textAlign: 'center' }}>GEMBA</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ background: 'var(--surface)', padding: '1rem', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.8rem', color: '#10b981', marginBottom: '0.5rem', fontWeight: 'bold' }}>✅ TOP 3</div>
                {classementsLignes.top3_Gemba.map((p, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.9rem' }}>
                    <span>{p.name}</span>
                    <span style={{ fontWeight: 'bold', color: getColorGemba(p.taux) }}>{p.taux}%</span>
                  </div>
                ))}
              </div>
              <div style={{ background: 'var(--surface)', padding: '1rem', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.8rem', color: '#ef4444', marginBottom: '0.5rem', fontWeight: 'bold' }}>⚠️ BOTTOM 3</div>
                {classementsLignes.bottom3_Gemba.map((p, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.9rem' }}>
                    <span>{p.name}</span>
                    <span style={{ fontWeight: 'bold', color: getColorGemba(p.taux) }}>{p.taux}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <h3 style={{ color: '#f59e0b', marginBottom: '1rem', textAlign: 'center' }}>5S</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ background: 'var(--surface)', padding: '1rem', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.8rem', color: '#10b981', marginBottom: '0.5rem', fontWeight: 'bold' }}>✅ TOP 3</div>
                {classementsLignes.top3_5S.map((p, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.9rem' }}>
                    <span>{p.name}</span>
                    <span style={{ fontWeight: 'bold', color: getColor5S(p.taux) }}>{p.taux}%</span>
                  </div>
                ))}
              </div>
              <div style={{ background: 'var(--surface)', padding: '1rem', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.8rem', color: '#ef4444', marginBottom: '0.5rem', fontWeight: 'bold' }}>⚠️ BOTTOM 3</div>
                {classementsLignes.bottom3_5S.map((p, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.9rem' }}>
                    <span>{p.name}</span>
                    <span style={{ fontWeight: 'bold', color: getColor5S(p.taux) }}>{p.taux}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <h2 className="card-title" style={{ marginBottom: '1.5rem' }}>💡 Points Forts & À Améliorer (Questions)</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          <div>
            <h3 style={{ color: '#38bdf8', marginBottom: '1rem', textAlign: 'center' }}>GEMBA</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ background: 'var(--surface)', padding: '1rem', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.8rem', color: '#10b981', marginBottom: '0.5rem', fontWeight: 'bold' }}>✅ TOP 3</div>
                {classementsQuestions.top3_Gemba.map((p, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px' }} title={p.name}>{p.name}</span>
                    <span style={{ fontWeight: 'bold', color: getColorGemba(p.taux) }}>{p.taux}%</span>
                  </div>
                ))}
              </div>
              <div style={{ background: 'var(--surface)', padding: '1rem', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.8rem', color: '#ef4444', marginBottom: '0.5rem', fontWeight: 'bold' }}>⚠️ BOTTOM 3</div>
                {classementsQuestions.bottom3_Gemba.map((p, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px' }} title={p.name}>{p.name}</span>
                    <span style={{ fontWeight: 'bold', color: getColorGemba(p.taux) }}>{p.taux}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <h3 style={{ color: '#f59e0b', marginBottom: '1rem', textAlign: 'center' }}>5S</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ background: 'var(--surface)', padding: '1rem', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.8rem', color: '#10b981', marginBottom: '0.5rem', fontWeight: 'bold' }}>✅ TOP 3</div>
                {classementsQuestions.top3_5S.map((p, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px' }} title={p.name}>{p.name}</span>
                    <span style={{ fontWeight: 'bold', color: getColor5S(p.taux) }}>{p.taux}%</span>
                  </div>
                ))}
              </div>
              <div style={{ background: 'var(--surface)', padding: '1rem', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.8rem', color: '#ef4444', marginBottom: '0.5rem', fontWeight: 'bold' }}>⚠️ BOTTOM 3</div>
                {classementsQuestions.bottom3_5S.map((p, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px' }} title={p.name}>{p.name}</span>
                    <span style={{ fontWeight: 'bold', color: getColor5S(p.taux) }}>{p.taux}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: '1.5rem' }}>
        <h2 className="card-title" style={{ marginBottom: '1.5rem' }}>🏭 Moyenne par UAP</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
          {moyennesUap.map((uap, i) => (
            <div key={i} style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <h3 style={{ textAlign: 'center', margin: '0 0 1.5rem 0', fontSize: '1.2rem' }}>{uap.name}</h3>
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Gemba</span>
                  <span style={{ fontWeight: 'bold', color: getColorGemba(uap.gemba) }}>{uap.gemba}%</span>
                </div>
                <div style={{ width: '100%', background: 'var(--border)', height: '10px', borderRadius: '5px', overflow: 'hidden' }}>
                  <div style={{ width: `${uap.gemba}%`, background: getColorGemba(uap.gemba), height: '100%' }}></div>
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>5S</span>
                  <span style={{ fontWeight: 'bold', color: getColor5S(uap.s5) }}>{uap.s5}%</span>
                </div>
                <div style={{ width: '100%', background: 'var(--border)', height: '10px', borderRadius: '5px', overflow: 'hidden' }}>
                  <div style={{ width: `${uap.s5}%`, background: getColor5S(uap.s5), height: '100%' }}></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
