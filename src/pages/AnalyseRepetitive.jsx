import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, LabelList } from 'recharts'

export default function AnalyseRepetitive() {
  const [dataGemba, setDataGemba] = useState([])
  const [data5S, setData5S] = useState([])
  const [loading, setLoading] = useState(true)
  const [type, setType] = useState('gemba')

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      
      // 1. Gemba : on prend les NOK
      const { data: gemba } = await supabase.from('gemba_audits').select('*').eq('reponse', 'NOK')
      if (gemba) setDataGemba(gemba)

      // 2. 5S : on récupère tout et on filtrera le JSON dans le code
      const { data: s5 } = await supabase.from('audits').select('*')
      if (s5) setData5S(s5)
      
      setLoading(false)
    }
    fetchData()
  }, [])

  const topProblemes = useMemo(() => {
    const counts = {}

    if (type === 'gemba') {
      // Logique Gemba standard
      dataGemba.forEach(row => {
        const probleme = row.question;
        if (!probleme) return;
        counts[probleme] = (counts[probleme] || 0) + 1;
      })
    } else {
      // Logique 5S avec le JSON 'checkpoints'
      data5S.forEach(audit => {
        if (!audit.checkpoints) return;
        
        let points = [];
        try {
          points = typeof audit.checkpoints === 'string' ? JSON.parse(audit.checkpoints) : audit.checkpoints;
        } catch (e) {
          return; // Si le JSON est invalide, on ignore
        }

        if (Array.isArray(points)) {
          points.forEach(pt => {
            // On considère que si 'a' est null ou false, c'est un problème (NOK)
            // Adaptez la condition selon votre structure exacte (ex: pt.a === false)
            if (pt.a === null || pt.a === false || pt.a === 0 || pt.a === 'NOK') {
              const texteProbleme = pt.q || "Problème sans description";
              counts[texteProbleme] = (counts[texteProbleme] || 0) + 1;
            }
          })
        }
      })
    }

    const sorted = Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    return sorted.map(s => ({
      ...s,
      shortName: s.name.length > 50 ? s.name.substring(0, 50) + '...' : s.name
    }))
  }, [dataGemba, data5S, type])

  if (loading) return <p className="muted" style={{ padding: '2rem' }}>Chargement des données…</p>

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: '1.5rem', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Analyse des Problèmes Répétitifs (Pareto)</h1>
        
        <div style={{ display: 'flex', background: 'var(--surface)', borderRadius: '8px', padding: '0.25rem', border: '1px solid var(--border)' }}>
          <button 
            onClick={() => setType('gemba')}
            style={{ padding: '0.5rem 1.2rem', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 'bold',
              background: type === 'gemba' ? '#3b82f6' : 'transparent', 
              color: type === 'gemba' ? '#fff' : 'var(--text-muted)' }}
          >
            Gemba
          </button>
          <button 
            onClick={() => setType('5s')}
            style={{ padding: '0.5rem 1.2rem', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 'bold',
              background: type === '5s' ? '#8b5cf6' : 'transparent', 
              color: type === '5s' ? '#fff' : 'var(--text-muted)' }}
          >
            5S
          </button>
        </div>
      </div>

      <div className="card">
        <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.1rem', color: type === 'gemba' ? '#3b82f6' : '#8b5cf6' }}>
          Top 10 des problèmes les plus fréquents ({type === 'gemba' ? 'Gemba' : '5S'})
        </h3>
        
        {topProblemes.length === 0 ? (
          <p className="muted">Aucun problème NOK trouvé pour cette catégorie.</p>
        ) : (
          <div style={{ height: 500 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProblemes} layout="vertical" margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" />
                <XAxis type="number" tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="shortName" tick={{ fill: '#f8fafc', fontSize: 12 }} axisLine={false} tickLine={false} width={350} />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#fff' }} 
                  formatter={(v, name, props) => [`${v} fois`, props.payload.name]}
                />
                <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={25}>
                  {topProblemes.map((entry, index) => (
                    <Cell key={index} fill={index < 3 ? '#ef4444' : (type === 'gemba' ? '#3b82f6' : '#8b5cf6')} />
                  ))}
                  <LabelList dataKey="count" position="right" fill="#f8fafc" fontSize={12} fontWeight="bold" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
