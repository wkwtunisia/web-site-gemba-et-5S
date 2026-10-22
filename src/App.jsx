import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import PlanAction from './components/PlanAction'
import AnalysesUap from './pages/AnalysesUap'
import PlanifieRealise from './pages/PlanifieRealise'
import ResultatsLigne from './pages/ResultatsLigne'
import TendanceLigne from './pages/TendanceLigne'
import Top3Lignes from './pages/Top3Lignes'
import ResultatsPiliers from './pages/ResultatsPiliers'
import AnalysePriorites from './pages/AnalysePriorites'
import RapportPdf from './pages/RapportPdf'
import PlanAction5S from './pages/PlanAction5S'
import Pilotes5S from './pages/Pilotes5S'
import MesActions from './pages/MesActions'
import HistoriqueActions from './pages/HistoriqueActions'
import Heatmap5S from './pages/Heatmap5S'
import Parametres from './pages/Parametres' // NOUVEAU

import ImportGemba from './pages/ImportGemba'
import GembaDashboard from './pages/GembaDashboard'
import GembaPlanifieRealise from './pages/GembaPlanifieRealise'
import GembaAnalyse from './pages/GembaAnalyse'
import RapportGemba from './pages/RapportGemba'
import PlanActionGemba from './pages/PlanActionGemba'
import PilotesGemba from './pages/PilotesGemba'
import HeatmapGemba from './pages/HeatmapGemba'

import Login from './pages/Login'
import { supabase } from './supabaseClient'
import { parseFile } from './services/importExcel'
import { fetchAudits, upsertAudits } from './services/auditsApi'

export default function App() {
  const [session, setSession] = useState(null)
  const [role, setRole] = useState('user')
  const [loading, setLoading] = useState(true)
  const [audits, setAudits] = useState([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  
  const [currentView, setCurrentView] = useState('mes_actions')
  const [previewMode, setPreviewMode] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchUserRole(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) fetchUserRole(session.user.id)
      else setRole('user')
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchUserRole(userId) {
    const { data, error } = await supabase.from('profiles').select('role').eq('id', userId).single()
    if (!error && data) setRole(data.role)
    setLoading(false)
  }

  useEffect(() => {
    if (!session) return
    async function load() {
      try {
        const data = await fetchAudits()
        setAudits(data)
      } catch (err) {
        setMessage({ type: 'error', text: err.message })
      }
    }
    load()
  }, [session])

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    try {
      const parsed = await parseFile(file)
      setAudits(parsed)
      setPreviewMode(true)
      setMessage({ type: 'success', text: `${parsed.length} audits prêts à être enregistrés.` })
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setBusy(false)
      e.target.value = ''
    }
  }

  async function handleSave() {
    setBusy(true)
    try {
      const count = await upsertAudits(audits)
      setMessage({ type: 'success', text: `${count} audits enregistrés !` })
      setPreviewMode(false)
      const data = await fetchAudits()
      setAudits(data)
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div style={{ padding: 20, textAlign: 'center', marginTop: '20vh' }}>Chargement…</div>
  if (!session) return <Login />

  return (
    <div className="app-layout">
      <Sidebar currentView={currentView} setCurrentView={setCurrentView} role={role} userEmail={session.user.email} />
      
      <main className="main-content">
        {message.text && (
          <div className={`alert alert-${message.type === 'success' ? 'success' : 'error'}`}>
            {message.text}
          </div>
        )}

        {currentView === 'mes_actions' && <MesActions userEmail={session.user.email} />}
        {currentView === 'parametres' && <Parametres />}
        {currentView === 'historique' && <HistoriqueActions />}

        {/* GEMBA */}
        {currentView === 'import_gemba' && <ImportGemba />}
        {currentView === 'planifie_gemba' && <GembaPlanifieRealise />}
        {['uap_gemba', 'lignes_gemba', 'top3_gemba', 'piliers_gemba'].includes(currentView) && <GembaDashboard view={currentView} />}
        {currentView === 'analyse_gemba' && <GembaAnalyse />}
        {currentView === 'plan_action_gemba' && <PlanActionGemba />}
        {currentView === 'pilotes_gemba' && <PilotesGemba />}
        {currentView === 'rapport_gemba' && <RapportGemba />}
        {currentView === 'heatmap_gemba' && <HeatmapGemba />}

        {/* 5S */}
        {currentView === 'plan_action_5s' && <PlanAction5S />}
        {currentView === 'pilotes_5s' && <Pilotes5S />}
        {currentView === 'rapport' && !previewMode && <RapportPdf audits={audits} />}
        {currentView === 'analyse' && !previewMode && <AnalysePriorites audits={audits} />}
        {currentView === 'piliers' && !previewMode && <ResultatsPiliers audits={audits} />}
        {currentView === 'top3' && !previewMode && <Top3Lignes audits={audits} />}
        {currentView === 'tendance' && !previewMode && <TendanceLigne audits={audits} />}
        {currentView === 'lignes' && !previewMode && <ResultatsLigne audits={audits} />}
        {currentView === 'planifie' && !previewMode && <PlanifieRealise audits={audits} />}
        {currentView === 'uap' && !previewMode && <AnalysesUap audits={audits} />}
        {currentView === 'actions' && !previewMode && <PlanAction audits={audits} />}
        {currentView === 'heatmap_5s' && <Heatmap5S />}

        {/* IMPORT 5S */}
        {currentView === 'import' && (
          <div className="card">
            {!previewMode ? (
              <div className="upload-zone">
                <div style={{ fontSize: '3rem' }}>📁</div>
                <h2>Importer votre fichier 5S</h2>
                <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
                  {busy ? 'Lecture...' : 'Choisir un fichier Excel'}
                  <input type="file" accept=".xlsx, .xls" onChange={handleFile} style={{ display: 'none' }} />
                </label>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0 }}>Aperçu des données ({audits.length} lignes)</h2>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button className="btn btn-secondary" onClick={() => setPreviewMode(false)}>Annuler</button>
                  <button className="btn btn-primary" onClick={handleSave}>Enregistrer</button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
