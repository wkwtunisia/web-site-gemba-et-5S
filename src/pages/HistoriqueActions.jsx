import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export default function HistoriqueActions({ userEmail, role }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchHistory() {
      let query = supabase.from('action_history').select('*').order('modified_at', { ascending: false }).limit(500)
      if (role !== 'admin') {
        query = query.or(`modified_by.eq."${userEmail}",target_pilot.eq."${userEmail}"`)
      }
      const { data, error } = await query
      if (!error) setHistory(data || [])
      setLoading(false)
    }
    if (userEmail) fetchHistory()
  }, [userEmail, role])

  // 🌟 Fonction pour générer une phrase précise
  const generateDetails = (h) => {
    const modifier = h.modified_by || 'Quelqu\'un'
    const target = h.target_pilot || 'Personne'
    const ligne = h.audit_ligne ? `sur la zone ${h.audit_ligne}` : 'sur une action'
    const type = h.action_type ? ` (${h.action_type})` : ''
    const question = h.audit_question ? `: "${h.audit_question.substring(0, 30)}..."` : ''

    // Cas 1 : Transfert
    if (h.target_pilot && h.target_pilot !== h.modified_by) {
      return `${modifier} a transféré ${ligne}${type}${question} à ${target}.`
    }

    // Cas 2 : Validation
    if (h.new_progression === 100 && h.old_progression !== 100) {
      return `${modifier} a validé ${ligne}${type}${question}.`
    }

    // Cas 3 : Progression
    if (h.old_progression !== h.new_progression) {
      return `${modifier} a changé la progression de ${ligne}${type}${question} de ${h.old_progression}% à ${h.new_progression}%.`
    }

    // Cas 4 : Modification du texte
    if (h.old_action !== h.new_action) {
      return `${modifier} a modifié l'action corrective ${ligne}${type}.`
    }

    return `${modifier} a mis à jour ${ligne}${type}.`
  }

  const generatePDF = () => {
    const doc = new jsPDF('landscape')
    const imgLogo = new Image()
    imgLogo.src = '/logo.png'
    try { doc.addImage(imgLogo, 'PNG', 14, 10, 15, 15) } catch (e) {}

    doc.setFontSize(18)
    doc.setTextColor(15, 23, 42)
    doc.text("Historique des Actions", 35, 20)

    doc.setFontSize(10)
    doc.setTextColor(100, 116, 139)
    doc.text(`Exporté le ${new Date().toLocaleString('fr-FR')} — Total : ${history.length} modifications`, 35, 28)

    const tableData = history.map(h => [
      new Date(h.modified_at).toLocaleString('fr-FR'),
      generateDetails(h)
    ])

    autoTable(doc, {
      startY: 35,
      head: [['Date', 'Détail de ce qui s\'est passé']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: 255 },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 'auto' }
      }
    })

    doc.save(`Historique_Actions_${new Date().toISOString().split('T')[0]}.pdf`)
  }

  if (loading) return <p className="muted" style={{ padding: '2rem' }}>Chargement…</p>

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>
          {role === 'admin' ? 'Historique Global des Actions' : 'Mon Historique'}
        </h1>
        <button className="btn btn-primary" onClick={generatePDF} disabled={history.length === 0}>
          📥 Télécharger le PDF
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '180px' }}>Date</th>
                <th>Qui a fait quoi</th>
                <th>Progression</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr><td colSpan="3" className="muted" style={{ textAlign: 'center', padding: '2rem' }}>Aucun historique pour le moment.</td></tr>
              ) : history.map((h, i) => (
                <tr key={i}>
                  <td>{new Date(h.modified_at).toLocaleString('fr-FR')}</td>
                  <td style={{ fontWeight: 500, color: 'var(--text-main)' }}>
                    {generateDetails(h)}
                  </td>
                  <td>
                    {h.new_progression === 100 ? (
                      <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>Terminé (100%)</span>
                    ) : (
                      <span style={{ color: 'var(--warning)' }}>{h.new_progression}%</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
