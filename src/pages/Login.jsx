import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError('Identifiants incorrects. Veuillez réessayer.')
    }
    setLoading(false)
  }

  return (
    <div className="pro-login-page">
      
      {/* Image de fond corporate (floutée) */}
      <div className="pro-bg-image"></div>
      
      <div className="pro-login-container">
        
        {/* En-tête */}
        <div className="pro-login-header">
          <div className="pro-logo-box">
            <img src="/logo.png" alt="WKW Logo" />
          </div>
          <h1 className="pro-title">WKW Gemba</h1>
          <p className="pro-subtitle">Connectez-vous à votre espace de travail</p>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleLogin} className="pro-form">
          <div className="pro-input-group">
            <label>Adresse Email</label>
            <input 
              type="email" 
              placeholder="nom@wkw-group.com" 
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError('') }}
              required
            />
          </div>

          <div className="pro-input-group">
            <label>Mot de passe</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError('') }}
              required
            />
          </div>

          <div className="pro-forgot-password">
            <a href="#reset">Mot de passe oublié ?</a>
          </div>

          {error && (
            <div className="pro-error">
              {error}
            </div>
          )}
          
          <button type="submit" className="pro-btn" disabled={loading}>
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        {/* Pied de page */}
        <div className="pro-footer">
          <p>© 2026 WKW Group. Tous droits réservés.</p>
          <p>Besoin d'aide ? Contactez votre administrateur.</p>
        </div>
      </div>
    </div>
  )
}
