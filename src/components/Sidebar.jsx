import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Sidebar({ currentView, setCurrentView, role, userEmail }) {
  const [isOpen, setIsOpen] = useState(false)

  const handleNav = (view) => {
    setCurrentView(view)
    setIsOpen(false) // Ferme le menu sur mobile après le clic
  }

  return (
    <>
      {/* Bouton Hamburger (visible uniquement sur mobile) */}
      <button className="mobile-menu-btn" onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? '✕' : '☰'}
      </button>

      {/* Overlay sombre pour fermer le menu sur mobile */}
      {isOpen && <div className="sidebar-overlay" onClick={() => setIsOpen(false)}></div>}

      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <img src="/logo.png" alt="WKW Logo" style={{ height: '32px', objectFit: 'contain' }} />
          <span>WKW Gemba</span>
        </div>
        
        <div className="sidebar-nav">
          <div className="sidebar-section">Mon Espace</div>
          <button className={`nav-item ${currentView === 'mes_actions' ? 'active' : ''}`} onClick={() => handleNav('mes_actions')}>
            📌 Mes Actions
          </button>
          {role === 'admin' && (
            <button className={`nav-item ${currentView === 'parametres' ? 'active' : ''}`} onClick={() => handleNav('parametres')}>
              ⚙️ Paramètres
            </button>
          )}

          <div className="sidebar-section" style={{ marginTop: '1rem' }}>5S</div>
          {role === 'admin' && (
            <>
              <button className={`nav-item ${currentView === 'import' ? 'active' : ''}`} onClick={() => handleNav('import')}>📥 Importation 5S</button>
              <button className={`nav-item ${currentView === 'plan_action_5s' ? 'active' : ''}`} onClick={() => handleNav('plan_action_5s')}>📋 Plan d'Action 5S</button>
              <button className={`nav-item ${currentView === 'pilotes_5s' ? 'active' : ''}`} onClick={() => handleNav('pilotes_5s')}>👤 Suivi par Pilote</button>
              <button className={`nav-item ${currentView === 'historique' ? 'active' : ''}`} onClick={() => handleNav('historique')}>📜 Historique des Actions</button>
            </>
          )}
          <button className={`nav-item ${currentView === 'planifie' ? 'active' : ''}`} onClick={() => handleNav('planifie')}>📊 Planifié vs Réalisé</button>
          <button className={`nav-item ${currentView === 'uap' ? 'active' : ''}`} onClick={() => handleNav('uap')}>📈 Analyses UAP</button>
          <button className={`nav-item ${currentView === 'lignes' ? 'active' : ''}`} onClick={() => handleNav('lignes')}>📍 Résultats par Ligne</button>
          <button className={`nav-item ${currentView === 'top3' ? 'active' : ''}`} onClick={() => handleNav('top3')}>🏆 Top & Bottom 3</button>
          <button className={`nav-item ${currentView === 'heatmap_5s' ? 'active' : ''}`} onClick={() => handleNav('heatmap_5s')}>🔥 Heatmap 5S</button>
          <button className={`nav-item ${currentView === 'piliers' ? 'active' : ''}`} onClick={() => handleNav('piliers')}>🧭 Résultats par Axe</button>
          <button className={`nav-item ${currentView === 'analyse' ? 'active' : ''}`} onClick={() => handleNav('analyse')}>🎯 Analyse & Priorités</button>
          <button className={`nav-item ${currentView === 'rapport' ? 'active' : ''}`} onClick={() => handleNav('rapport')}>📄 Rapport d'Audit</button>

          <div className="sidebar-section">Gemba (5M)</div>
          {role === 'admin' && (
            <>
              <button className={`nav-item ${currentView === 'import_gemba' ? 'active' : ''}`} onClick={() => handleNav('import_gemba')}>🏭 Importation Gemba</button>
              <button className={`nav-item ${currentView === 'plan_action_gemba' ? 'active' : ''}`} onClick={() => handleNav('plan_action_gemba')}>📋 Plan d'Action Gemba</button>
              <button className={`nav-item ${currentView === 'pilotes_gemba' ? 'active' : ''}`} onClick={() => handleNav('pilotes_gemba')}>👤 Suivi par Pilote</button>
            </>
          )}
          <button className={`nav-item ${currentView === 'planifie_gemba' ? 'active' : ''}`} onClick={() => handleNav('planifie_gemba')}>📊 Planifié vs Réalisé</button>
          <button className={`nav-item ${currentView === 'uap_gemba' ? 'active' : ''}`} onClick={() => handleNav('uap_gemba')}>📈 Analyses UAP</button>
          <button className={`nav-item ${currentView === 'lignes_gemba' ? 'active' : ''}`} onClick={() => handleNav('lignes_gemba')}>📍 Résultats par Ligne</button>
          <button className={`nav-item ${currentView === 'top3_gemba' ? 'active' : ''}`} onClick={() => handleNav('top3_gemba')}>🏆 Top & Bottom 3</button>
          <button className={`nav-item ${currentView === 'heatmap_gemba' ? 'active' : ''}`} onClick={() => handleNav('heatmap_gemba')}>🔥 Heatmap Gemba</button>
          <button className={`nav-item ${currentView === 'piliers_gemba' ? 'active' : ''}`} onClick={() => handleNav('piliers_gemba')}>🧭 Résultats par M</button>
          <button className={`nav-item ${currentView === 'analyse_gemba' ? 'active' : ''}`} onClick={() => handleNav('analyse_gemba')}>🎯 Analyse & Priorités</button>
          <button className={`nav-item ${currentView === 'rapport_gemba' ? 'active' : ''}`} onClick={() => handleNav('rapport_gemba')}>📄 Rapport d'Audit Gemba</button>
        </div>

        <div className="sidebar-footer">
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', wordBreak: 'break-all' }}>
            Connecté : <strong>{userEmail}</strong><br/>({role})
          </div>
          <button className="btn btn-danger" onClick={() => supabase.auth.signOut()} style={{ width: '100%', padding: '0.5rem', fontSize: '0.8rem' }}>
            Déconnexion
          </button>
        </div>
      </aside>
    </>
  )
}
