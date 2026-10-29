import { useState } from 'react'
import { supabase } from '../supabaseClient'
import * as XLSX from 'xlsx'

// 🌟 FONCTION DE CONVERSION : 30/09/2026 devient 2026-09-30
const formatDateForDb = (val) => {
  if (!val) return null;
  // Cas 1 : Excel renvoie un objet Date natif
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  // Cas 2 : C'est du texte (ex: "30/09/2026")
  const str = String(val).trim();
  if (/^\d{2}\/\d{2}\/\d{4}/.test(str)) {
    const parts = str.substring(0, 10).split('/');
    // On inverse : Année - Mois - Jour
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  // Cas 3 : C'est déjà au bon format
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.substring(0, 10);
  }
  return null;
};

// 🌟 FONCTION POUR TROUVER LA COLONNE EXACTE
const getVal = (row, key) => {
  const actualKey = Object.keys(row).find(k => 
    k.trim().toLowerCase() === key.toLowerCase()
  );
  return actualKey ? row[actualKey] : null;
};

export default function ImportGemba() {
  const [rows, setRows] = useState([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    setMessage('')
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array', cellDates: true })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json(ws, { defval: null })
      
      if (data.length === 0) throw new Error('Fichier vide')
      
      const parsed = data.map(row => {
        const dateStr = formatDateForDb(getVal(row, 'Date'));
        const actionText = getVal(row, 'Action Corrective') || getVal(row, 'Action corrective') || getVal(row, 'Action');
        
        return {
          date: dateStr,
          ligne: getVal(row, 'Ligne'),
          uap: getVal(row, 'UAP'),
          semaine: getVal(row, 'Semaine'),
          point_m: getVal(row, 'Point M'),
          question: getVal(row, 'Question'),
          reponse: String(getVal(row, 'Réponse') || getVal(row, 'Reponse') || '').toUpperCase().trim(),
          auditeur: getVal(row, 'Auditeur'),
          action_texte: actionText,
          pilote: getVal(row, 'Pilote'),
          date_action: formatDateForDb(getVal(row, 'Date Action'))
        };
      }).filter(r => r.date && r.ligne && r.question)

      // Affichage de test pour vérifier la conversion
      console.log("Première ligne convertie :", parsed[0]);

      setRows(parsed)
      setMessage(`✅ ${parsed.length} lignes lues avec succès. Cliquez sur Enregistrer.`)
    } catch (err) {
      setMessage(`❌ Erreur : ${err.message}`)
    } finally {
      setBusy(false)
      e.target.value = ''
    }
  }

  async function handleSave() {
    if (rows.length === 0) return
    setBusy(true); setMessage('Enregistrement dans Supabase...')
    
    try {
      const seen = new Set();
      const uniqueRows = [];
      rows.forEach(r => {
        const key = `${r.date}|${r.ligne}|${r.question}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueRows.push(r);
        }
      });

      const { error } = await supabase.from('gemba_audits').upsert(uniqueRows, { onConflict: 'date, ligne, question' })
      if (error) throw error
      
      setMessage(`✅ ${uniqueRows.length} lignes enregistrées avec succès !`)
      setRows([])
    } catch (err) {
      setMessage('❌ Erreur : ' + err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleClear = async () => {
    if (!window.confirm("⚠️ ATTENTION : Voulez-vous vraiment supprimer TOUS les audits Gemba ?")) return;
    setBusy(true);
    try {
      const { error } = await supabase.from('gemba_audits').delete().neq('date', '1900-01-01');
      if (error) throw error;
      alert("✅ Tous les audits Gemba ont été supprimés.");
      window.location.reload();
    } catch (err) {
      alert("Erreur : " + err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Importation Gemba (5M)</h1>
      
      {message && <div className={`alert ${message.includes('❌') ? 'alert-error' : 'alert-success'}`}>{message}</div>}

      {rows.length === 0 ? (
        <div className="card">
          <div className="upload-zone">
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏭</div>
            <h2 style={{ marginBottom: '1rem' }}>Importer votre fichier Gemba</h2>
            <label className="btn btn-primary" style={{ cursor: busy ? 'not-allowed' : 'pointer' }}>
              {busy ? 'Lecture...' : 'Choisir un fichier Excel'}
              <input type="file" accept=".xlsx, .xls" onChange={handleFile} disabled={busy} style={{ display: 'none' }} />
            </label>
          </div>
          
          <div style={{ marginTop: '1.5rem', textAlign: 'center', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
            <button className="btn btn-danger" style={{ background: 'var(--danger)', color: 'white', border: 'none', padding: '0.5rem 1rem', cursor: 'pointer', width: '100%', maxWidth: '300px' }} onClick={handleClear} disabled={busy}>
              🗑️ Vider toute la base Gemba
            </button>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="flex-between" style={{ marginBottom: '1rem' }}>
            <h2 className="card-title" style={{ margin: 0 }}>Aperçu ({rows.length} lignes)</h2>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="btn btn-secondary" onClick={() => setRows([])} disabled={busy}>Annuler</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={busy}>
                {busy ? 'Enregistrement...' : 'Enregistrer dans Supabase'}
              </button>
            </div>
          </div>
          <p className="muted">Les dates <strong>30/09/2026</strong> sont automatiquement converties en <strong>2026-09-30</strong> pour la base de données.</p>
        </div>
      )}
    </div>
  )
}
