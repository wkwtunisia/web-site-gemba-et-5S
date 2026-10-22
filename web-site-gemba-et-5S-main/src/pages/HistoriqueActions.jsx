import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export default function HistoriqueActions() {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('action_history').select('*').order('modified_at', { ascending: false }).limit(500).then(({ data, error }) => {
      if (!error) setHistory(data || [])
      setLoading(false)
    })
  }, [])

  const generatePDF = () => {
    const doc = new jsPDF('landscape') // Paysage pour avoir plus de place
    
    // En-tête
    const imgLogo = new Image()
    imgLogo.src = '/logo.png'
    try { doc.addImage(imgLogo, 'PNG', 14, 10, 15, 15) } catch (e) {}

    doc.setFontSize(18)
    doc.setTextColor(15, 23, 42)
    doc.text("Historique des Actions (5S & Gemba)", 35, 20)

    doc.setFontSize(10)
    doc.setTextColor(100, 116, 139)
    doc.text(`Exporté le ${new Date().toLocaleString('fr-FR')} — Total : ${history.length} modifications`, 35, 28)

    // Tableau
    const tableData = history.map(h => [
      new Date(h.modified_at).toLocaleString('fr-FR'),
      h.modified_by,
      h.old_progression !== h.new_progression ? `${h.old_progression}% ➔ ${h.new_progression}%` : '—',
      h.old_action || '—',
      h.new_action || '—',
      h.date_realisation ? new Date(h.date_realisation).toLocaleDateString('fr-FR') : '—'
    ])

    autoTable(doc, {
      startY: 35,
      head: [['Date', 'Modifié par', 'Progression', 'Ancienne Action', 'Nouvelle Action', 'Date Réalisée']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: 255 },
      styles: { fontSize: 8, cellPadding: 2, valign: 'middle' },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 45 },
        2: { cellWidth: 25, halign: 'center' },
        3: { cellWidth: 70 },
        4: { cellWidth: 70 },
        5: { cellWidth: 25, halign: 'center' }
      }
    })

    // Pied de page
    const pageCount = doc.internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(150)
      doc.text(`WKW Tunisie - Historique des Actions - Page ${i} / ${pageCount}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' })
    }

    doc.save(`Historique_Actions_${new Date().toISOString().split('T')[0]}.pdf`)
  }

  if (loading) return <p className="muted" style={{ padding: '2rem' }}>Chargement…</p>

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Historique des Actions</h1>
        <button className="btn btn-primary" onClick={generatePDF}>
          📥 Télécharger le PDF
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date de modification</th>
                <th>Modifié par</th>
                <th>Changement de progression</th>
                <th>Ancienne action</th>
                <th>Nouvelle action</th>
                <th>Date réalisée</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h, i) => (
                <tr key={i}>
                  <td>{new Date(h.modified_at).toLocaleString('fr-FR')}</td>
                  <td style={{ fontWeight: 'bold' }}>{h.modified_by}</td>
                  <td>
                    {h.old_progression !== h.new_progression ? (
                      <span style={{ color: h.new_progression === 100 ? 'var(--success)' : 'var(--warning)' }}>
                        {h.old_progression}% ➔ {h.new_progression}%
                      </span>
                    ) : <span className="muted">—</span>}
                  </td>
                  <td style={{ whiteSpace: 'normal', maxWidth: '200px', color: 'var(--text-muted)' }}>{h.old_action || '—'}</td>
                  <td style={{ whiteSpace: 'normal', maxWidth: '200px' }}>{h.new_action || '—'}</td>
                  <td>
                    {h.date_realisation ? (
                      <span style={{ color: 'var(--success)' }}>{new Date(h.date_realisation).toLocaleDateString('fr-FR')}</span>
                    ) : <span className="muted">—</span>}
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
