import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { fetchActions } from '../services/actionsApi'

const ROLES = {
  'ahmed.khamassi@wkw-group.com': 'Directeur',
  'firas.hafaiedh@wkw-group.com': 'Sup. UAP1 Extrusion',
  'hichem.zerria@wkw-group.com': 'Resp. Qualité',
  'houssine.trabelsi@wkw-group.com': 'Tech. Amélioration',
  'moez.maghraoui@wkw-group.com': 'Resp. Indus',
  'mohamed.chemsi@wkw-group.com': 'Resp. UAP1',
  'mounir.louati@wkw-group.com': 'Sup. UAP2',
  'naoufel.benhassine@wkw-group.com': 'Coord. Logistique',
  'raja.dhaouadi@wkw-group.com': 'Sup. UAP1 Transfo',
  'sahbi.chakroun@wkw-group.com': 'Resp. Maintenance'
}

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
const getColorGlobal = (score) => score >= 90 ? '#10b981' : score >= 85 ? '#f59e0b' : '#ef4444'

// 🌟 TÉLÉCHARGEMENT PAR PAQUETS (PAGINATION) POUR ÉVITER LA LIMITE DE 1000 LIGNES
const fetchAll = async (tableName) => {
  let allData = []
  let from = 0
  const step = 1000
  let hasMore = true

  while (hasMore) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .range(from, from + step - 1)

    if (error) {
      console.error(`Erreur sur ${tableName}:`, error)
      break
    }
    
    if (data.length === 0) {
      hasMore = false
    } else {
      allData = [...allData, ...data]
      from += step
    }
  }
  return allData
}

export default function TvDashboard() {
  const [actions, setActions] = useState([])
  const [audits5S, setAudits5S] = useState([])
  const [auditsGemba, setAuditsGemba] = useState([])
  const [loading, setLoading] = useState(true)
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const loadData = async () => {
    try {
      const actionsData = await fetchActions()
      const res5S = await fetchAll('audits')
      const resGemba = await fetchAll('gemba_audits')

      setActions(actionsData || [])
      setAudits5S(res5S || [])
      setAuditsGemba(resGemba || [])
      setLoading(false)
    } catch (err) {
      console.error("Erreur chargement:", err)
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 300000)
    return () => clearInterval(interval)
  }, [])

  const totalActions = actions.length
  const actionsRealisees = actions.filter(a => a.progression === 100).length
  const tauxGlobal = totalActions > 0 ? Math.round((actionsRealisees / totalActions) * 100) : 0

  const topPilotes = useMemo(() => {
    const stats = {}
    actions.forEach(a => {
      if (!a.pilote_email) return
      if (!stats[a.pilote_email]) stats[a.pilote_email] = { realises: 0, nonRealises: 0, total: 0 }
      stats[a.pilote_email].total++
      if (a.progression === 100) stats[a.pilote_email].realises++
      else stats[a.pilote_email].nonRealises++
    })
    return Object.entries(stats).map(([email, data]) => ({
      email, name: ROLES[email] || email.split('@')[0], ...data,
      taux: data.total > 0 ? Math.round((data.realises / data.total) * 100) : 0
    })).filter(p => p.total > 0).sort((a, b) => b.taux - a.taux || b.total - a.total).slice(0, 5)
  }, [actions])

  const isPrevMonth = (dateStr) => {
    if (!dateStr) return false
    const now = new Date()
    const targetMonth = now.getMonth() === 0 ? 12 : now.getMonth()
    const targetYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
    const monthStr = String(targetMonth).padStart(2, '0')
    const yearStr = String(targetYear)
    
    const str = String(dateStr)
    return str.includes(`${yearStr}-${monthStr}`) || 
           str.includes(`${monthStr}/${yearStr}`) || 
           str.includes(`${monthStr}-${yearStr}`)
  }

  const classementsM1 = useMemo(() => {
    const stats5S = {}
    audits5S.forEach(a => {
      if (!isPrevMonth(a.date) || !a.zone) return
      if (!stats5S[a.zone]) stats5S[a.zone] = { sum: 0, count: 0 }
      stats5S[a.zone].sum += Number(a.score_pct) || 0
      stats5S[a.zone].count++
    })
    const list5S = Object.entries(stats5S).map(([ligne, data]) => ({ name: ligne, taux: Math.round(data.sum / data.count) })).sort((a, b) => b.taux - a.taux)

    const gembaGroups = {}
    auditsGemba.forEach(a => {
      if (!isPrevMonth(a.date) || !a.ligne) return
      const key = `${a.date}|${a.ligne}`
      if (!gembaGroups[key]) gembaGroups[key] = { ligne: a.ligne, ok: 0, total: 0 }
      gembaGroups[key].total++
      if (String(a.reponse).toUpperCase() === 'OK') gembaGroups[key].ok++
    })

    const statsGemba = {}
    Object.values(gembaGroups).forEach(g => {
      if (!statsGemba[g.ligne]) statsGemba[g.ligne] = { sum: 0, count: 0 }
      statsGemba[g.ligne].sum += (g.ok / g.total) * 100
      statsGemba[g.ligne].count++
    })
    const listGemba = Object.entries(statsGemba).map(([ligne, data]) => ({ name: ligne, taux: Math.round(data.sum / data.count) })).sort((a, b) => b.taux - a.taux)

    return {
      top3_5S: list5S.slice(0, 3), bottom3_5S: list5S.slice(-3).reverse(),
      top3_Gemba: listGemba.slice(0, 3), bottom3_Gemba: listGemba.slice(-3).reverse()
    }
  }, [audits5S, auditsGemba])

  const moyennesUap = useMemo(() => {
    const stats5S = { 'UAP 1': [], 'UAP 2': [], 'Logistique': [] }
    audits5S.forEach(a => {
      if (!isPrevMonth(a.date)) return
      const uap = getUap5S(a.zone)
      if (stats5S[uap]) stats5S[uap].push(Number(a.score_pct) || 0)
    })
    const moy5S = {}
    Object.entries(stats5S).forEach(([uap, scores]) => {
      moy5S[uap] = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
    })

    const gembaGroups = {} 
    auditsGemba.forEach(a => {
      if (!isPrevMonth(a.date)) return
      
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
      let totalScore = 0
      let countLignes = 0

      Object.entries(lignes).forEach(([nomLigne, data]) => {
        if (data.total > 0) {
          totalScore += (data.ok / data.total) * 100
          countLignes++
        }
      })
      moyGemba[uap] = countLignes > 0 ? totalScore / countLignes : 0
    })

    return [
      { name: 'UAP 1', s5: Math.round(moy5S['UAP 1']), gemba: Math.round(moyGemba['UAP 1'] || 0) },
      { name: 'UAP 2', s5: Math.round(moy5S['UAP 2']), gemba: Math.round(moyGemba['UAP 2'] || 0) },
      { name: 'Logistique', s5: Math.round(moy5S['Logistique']), gemba: Math.round(moyGemba['Logistique'] || 0) }
    ]
  }, [audits5S, auditsGemba])


  if (loading) return <div style={{ background: '#0f172a', color: 'white', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>Chargement des données...</div>

  return (
    <div style={{ background: '#0f172a', color: 'white', minHeight: '100vh', padding: '2rem', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '2px solid #334155', paddingBottom: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2.5rem', color: '#38bdf8' }}>TABLEAU DE BORD GEMBA / 5S</h1>
          <p style={{ margin: 0, fontSize: '1.2rem', color: '#94a3b8' }}>WKW Tunisie - Performance en temps réel</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{time.toLocaleTimeString('fr-FR')}</div>
          <div style={{ fontSize: '1.2rem', color: '#94a3b8' }}>{time.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>
        <div style={{ background: '#1e293b', padding: '1rem 2rem', borderRadius: '10px', borderLeft: `8px solid ${getColorGlobal(tauxGlobal)}` }}>
          <div style={{ fontSize: '1rem', color: '#94a3b8' }}>TAUX GLOBAL ACTIONS</div>
          <div style={{ fontSize: '3rem', fontWeight: 'bold', color: getColorGlobal(tauxGlobal) }}>{tauxGlobal}%</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
        <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '10px' }}>
          <h2 style={{ fontSize: '1.5rem', marginTop: 0, color: '#e2e8f0', marginBottom: '2rem' }}>🏆 TOP 5 PILOTES (Actions)</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {topPilotes.map((p, i) => {
              const color = getColorGlobal(p.taux)
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: '#0f172a', padding: '0.8rem', borderRadius: '8px' }}>
                  <div style={{ width: '180px', fontSize: '0.95rem', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                  <div style={{ flex: 1, background: '#334155', height: '16px', borderRadius: '8px', overflow: 'hidden' }}>
                    <div style={{ width: `${p.taux}%`, background: color, height: '100%' }}></div>
                  </div>
                  <div style={{ width: '50px', textAlign: 'right', fontWeight: 'bold', color: color }}>{p.taux}%</div>
                  <div style={{ width: '100px', fontSize: '0.8rem', color: '#94a3b8', textAlign: 'right' }}>
                    <span style={{ color: '#10b981' }}>{p.realises} R</span> / <span style={{ color: '#ef4444' }}>{p.nonRealises} NR</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '10px' }}>
          <h2 style={{ fontSize: '1.5rem', marginTop: 0, color: '#e2e8f0', marginBottom: '1.5rem' }}>📊 RÉSULTATS DES AUDITS (M-1)</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div style={{ background: '#0f172a', padding: '1rem', borderRadius: '8px' }}>
              <h3 style={{ color: '#38bdf8', textAlign: 'center', margin: '0 0 1rem 0', fontSize: '1.1rem' }}>GEMBA</h3>
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem' }}>TOP 3 🥇</div>
                {classementsM1.top3_Gemba.map((p, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid #1e293b', fontSize: '0.9rem' }}>
                    <span>{p.name}</span>
                    <span style={{ fontWeight: 'bold', color: getColorGemba(p.taux) }}>{p.taux}%</span>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem' }}>BOTTOM 3 🚨</div>
                {classementsM1.bottom3_Gemba.map((p, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid #1e293b', fontSize: '0.9rem' }}>
                    <span>{p.name}</span>
                    <span style={{ fontWeight: 'bold', color: getColorGemba(p.taux) }}>{p.taux}%</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: '#0f172a', padding: '1rem', borderRadius: '8px' }}>
              <h3 style={{ color: '#f59e0b', textAlign: 'center', margin: '0 0 1rem 0', fontSize: '1.1rem' }}>5S</h3>
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem' }}>TOP 3 🥇</div>
                {classementsM1.top3_5S.map((p, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid #1e293b', fontSize: '0.9rem' }}>
                    <span>{p.name}</span>
                    <span style={{ fontWeight: 'bold', color: getColor5S(p.taux) }}>{p.taux}%</span>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem' }}>BOTTOM 3 🚨</div>
                {classementsM1.bottom3_5S.map((p, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid #1e293b', fontSize: '0.9rem' }}>
                    <span>{p.name}</span>
                    <span style={{ fontWeight: 'bold', color: getColor5S(p.taux) }}>{p.taux}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '10px' }}>
        <h2 style={{ fontSize: '1.5rem', marginTop: 0, color: '#e2e8f0', marginBottom: '1.5rem' }}>🏭 MOYENNE DES RÉSULTATS PAR UAP (M-1)</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
          {moyennesUap.map((uap, i) => (
            <div key={i} style={{ background: '#0f172a', padding: '1.5rem', borderRadius: '8px', border: '1px solid #334155' }}>
              <h3 style={{ textAlign: 'center', color: '#e2e8f0', margin: '0 0 1.5rem 0', fontSize: '1.3rem' }}>{uap.name}</h3>
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                  <span style={{ color: '#94a3b8' }}>Gemba</span>
                  <span style={{ fontWeight: 'bold', color: getColorGemba(uap.gemba) }}>{uap.gemba}%</span>
                </div>
                <div style={{ width: '100%', background: '#334155', height: '12px', borderRadius: '6px', overflow: 'hidden' }}>
                  <div style={{ width: `${uap.gemba}%`, background: getColorGemba(uap.gemba), height: '100%' }}></div>
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                  <span style={{ color: '#94a3b8' }}>5S</span>
                  <span style={{ fontWeight: 'bold', color: getColor5S(uap.s5) }}>{uap.s5}%</span>
                </div>
                <div style={{ width: '100%', background: '#334155', height: '12px', borderRadius: '6px', overflow: 'hidden' }}>
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
