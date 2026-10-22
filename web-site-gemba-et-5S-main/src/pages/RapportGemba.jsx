import { useState, useEffect, useMemo } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { supabase } from '../supabaseClient'

export default function RapportGemba() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedAuditId, setSelectedAuditId] = useState('')
  const [questionPhotos, setQuestionPhotos] = useState({})

  useEffect(() => {
    supabase.from('gemba_audits').select('*').order('date', { ascending: false }).then(({ data, error }) => {
      if (!error) setData(data || [])
      setLoading(false)
    })
  }, [])

  const auditsGrouped = useMemo(() => {
    const groups = {}
    data.forEach(row => {
      const key = `${row.date}|${row.ligne}`
      if (!groups[key]) {
        groups[key] = { id: key, date: row.date, ligne: row.ligne, uap: row.uap, rows: [], seenQuestions: new Set() }
      }
      const qText = String(row.question).trim().toLowerCase()
      if (groups[key].seenQuestions.has(qText)) return
      groups[key].seenQuestions.add(qText)
      groups[key].rows.push(row)
    })
    return Object.values(groups)
  }, [data])

  const selectedAudit = auditsGrouped.find(a => a.id === selectedAuditId)

  const handlePhotoUpload = (index, e) => {
    const files = Array.from(e.target.files)
    if (files.length === 0) return
    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = (event) => {
        setQuestionPhotos(prev => ({
          ...prev,
          [index]: [...(prev[index] || []), event.target.result]
        }))
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  const removePhoto = (index, photoIndex) => {
    setQuestionPhotos(prev => {
      const copy = { ...prev }
      copy[index] = copy[index].filter((_, i) => i !== photoIndex)
      if (copy[index].length === 0) delete copy[index]
      return copy
    })
  }

  const generatePDF = () => {
    if (!selectedAudit) return

    const doc = new jsPDF('p', 'mm', 'a4')
    const pageWidth = doc.internal.pageSize.width
    const pageHeight = doc.internal.pageSize.height
    const margin = 20
    const contentWidth = pageWidth - margin * 2

    const rows = selectedAudit.rows || []
    const okCount = rows.filter(r => r.reponse === 'OK').length
    const nokCount = rows.filter(r => r.reponse === 'NOK').length
    const naCount = rows.filter(r => r.reponse === 'N/A').length
    const totalQuestions = rows.length

    // Trouver les auditeurs uniques
    const uniqueAuditors = [...new Set(rows.map(r => r.auditeur).filter(Boolean))].join(', ')

    const globalOk = rows.filter(r => r.reponse === 'OK').length
    const globalTotal = rows.filter(r => r.reponse === 'OK' || r.reponse === 'NOK').length
    const globalScore = globalTotal > 0 ? Math.round((globalOk / globalTotal) * 100) : 0

    // ==========================================
    // PAGE 1 : PAGE DE GARDE
    // ==========================================
    const imgLogo = new Image()
    imgLogo.src = '/logo.png'
    try { doc.addImage(imgLogo, 'PNG', pageWidth / 2 - 20, 30, 40, 40) } catch (e) {}

    doc.setFontSize(28)
    doc.setTextColor(15, 23, 42)
    doc.text("RAPPORT D'AUDIT GEMBA", pageWidth / 2, 90, { align: 'center' })

    doc.setFontSize(16)
    doc.setTextColor(100, 116, 139)
    doc.text(`Ligne : ${selectedAudit.ligne}`, pageWidth / 2, 110, { align: 'center' })
    doc.text(`UAP : ${selectedAudit.uap}`, pageWidth / 2, 118, { align: 'center' })
    
    doc.setFontSize(14)
    doc.text(`Date de l'audit : ${new Date(selectedAudit.date).toLocaleDateString('fr-FR')}`, pageWidth / 2, 130, { align: 'center' })

    doc.setFontSize(10)
    doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, pageWidth / 2, pageHeight - 20, { align: 'center' })

    // ==========================================
    // PAGE 2 : SYNTHÈSE
    // ==========================================
    doc.addPage()
    
    doc.setFontSize(18)
    doc.setTextColor(15, 23, 42)
    doc.text("Synthèse de l'audit", margin, 25)
    
    doc.setDrawColor(226, 232, 240)
    doc.line(margin, 30, pageWidth - margin, 30)

    // Cartes KPI
    const cardY = 40
    const cardH = 25
    const cardW = (contentWidth - 15) / 4

    const drawCard = (x, label, value, color) => {
      doc.setFillColor(color[0], color[1], color[2], 0.1)
      doc.setDrawColor(color[0], color[1], color[2])
      doc.roundedRect(x, cardY, cardW, cardH, 3, 3, 'FD')
      
      doc.setFontSize(9)
      doc.setTextColor(100, 116, 139)
      doc.text(label, x + cardW/2, cardY + 8, { align: 'center' })
      
      doc.setFontSize(18)
      doc.setTextColor(color[0], color[1], color[2])
      doc.text(value.toString(), x + cardW/2, cardY + 18, { align: 'center' })
    }

    drawCard(margin, 'OK', okCount, [16, 185, 129])
    drawCard(margin + cardW + 5, 'NOK', nokCount, [239, 68, 68])
    drawCard(margin + (cardW + 5) * 2, 'N/A', naCount, [148, 163, 184])
    drawCard(margin + (cardW + 5) * 3, 'TOTAL', totalQuestions, [59, 130, 246])

    // Infos générales
    const infoY = cardY + cardH + 10
    doc.setFillColor(248, 250, 252)
    doc.setDrawColor(226, 232, 240)
    doc.roundedRect(margin, infoY, contentWidth, 35, 3, 3, 'FD')

    doc.setFontSize(10)
    doc.setTextColor(15, 23, 42)
    doc.text(`Auditeurs :`, margin + 5, infoY + 10)
    doc.setFont('helvetica', 'bold')
    const splitAuditors = doc.splitTextToSize(uniqueAuditors || '—', contentWidth - 40)
    doc.text(splitAuditors, margin + 30, infoY + 10)
    
    doc.setFont('helvetica', 'normal')
    doc.text(`Score Global :`, pageWidth - margin - 60, infoY + 25)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(globalScore >= 87 ? 16 : globalScore >= 85 ? 245 : 239, 
                     globalScore >= 87 ? 185 : globalScore >= 85 ? 158 : 68, 
                     globalScore >= 87 ? 129 : globalScore >= 85 ? 11 : 68)
    doc.text(`${globalScore} %`, pageWidth - margin - 10, infoY + 25, { align: 'right' })

    // Scores par pilier (5M)
    let currentY = infoY + 45
    doc.setFontSize(14)
    doc.setTextColor(15, 23, 42)
    doc.setFont('helvetica', 'bold')
    doc.text("Scores par pilier (5M)", margin, currentY)
    currentY += 8

    const mScores = {}
    rows.forEach(r => {
      const m = r.point_m
      if (!mScores[m]) mScores[m] = { ok: 0, nok: 0 }
      if (r.reponse === 'OK') mScores[m].ok++
      if (r.reponse === 'NOK') mScores[m].nok++
    })

    const pillars = Object.entries(mScores).map(([name, s]) => ({
      name,
      ok: s.ok,
      nok: s.nok,
      score: (s.ok + s.nok) > 0 ? Math.round((s.ok / (s.ok + s.nok)) * 100) : 0
    }))

    const pW = (contentWidth - 10) / 3
    const pH = 25

    doc.setFont('helvetica', 'normal')
    pillars.forEach((p, i) => {
      const x = margin + (i % 3) * (pW + 5)
      const y = currentY + Math.floor(i / 3) * (pH + 5)

      doc.setFillColor(248, 250, 252)
      doc.setDrawColor(226, 232, 240)
      doc.roundedRect(x, y, pW, pH, 3, 3, 'FD')

      doc.setFontSize(9)
      doc.setTextColor(100, 116, 139)
      doc.text(p.name.substring(0, 25), x + pW/2, y + 8, { align: 'center' })

      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(p.score >= 87 ? 16 : p.score >= 85 ? 245 : 239, p.score >= 87 ? 185 : p.score >= 85 ? 158 : 68, p.score >= 87 ? 129 : p.score >= 85 ? 11 : 68)
      doc.text(`${p.score}%`, x + pW/2, y + 18, { align: 'center' })
      doc.setFont('helvetica', 'normal')
    })

    // ==========================================
    // PAGE 3 : DÉTAIL DES QUESTIONS
    // ==========================================
    doc.addPage()
    doc.setFontSize(18)
    doc.setTextColor(15, 23, 42)
    doc.text("Détail de l'audit", margin, 25)

    const tableData = rows.map((r, index) => {
      return [
        index + 1,
        r.point_m,
        r.question,
        r.reponse,
        r.action !== '-' ? r.action : '',
        questionPhotos[index] ? `${questionPhotos[index].length} photo(s)` : '—'
      ]
    })

    autoTable(doc, {
      startY: 30,
      head: [['N°', 'Point M', 'Question', 'Statut', 'Action', 'Photos']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 9, fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 3, valign: 'middle', lineColor: [226, 232, 240] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 25 },
        2: { cellWidth: 60 },
        3: { cellWidth: 15, halign: 'center', fontStyle: 'bold' },
        4: { cellWidth: 45 },
        5: { cellWidth: 20, halign: 'center' }
      },
      didParseCell: function (data) {
        if (data.section === 'body' && data.column.index === 3) {
          if (data.cell.raw === 'OK') data.cell.styles.textColor = [16, 185, 129]
          if (data.cell.raw === 'NOK') data.cell.styles.textColor = [239, 68, 68]
        }
      }
    })

    // ==========================================
    // PAGE 4 (et +) : DÉTAIL DES NON-CONFORMITÉS
    // ==========================================
    const nokQuestions = rows.map((r, index) => ({ ...r, index })).filter(r => r.reponse === 'NOK')

    if (nokQuestions.length > 0) {
      doc.addPage()
      doc.setFontSize(18)
      doc.setTextColor(15, 23, 42)
      doc.text("Détail des non-conformités (NOK)", margin, 25)
      doc.setDrawColor(226, 232, 240)
      doc.line(margin, 30, pageWidth - margin, 30)

      let yPos = 40

      nokQuestions.forEach((q) => {
        const photos = questionPhotos[q.index] || []
        
        const estimatedHeight = 25 + (photos.length > 0 ? Math.ceil(photos.length / 2) * 65 : 0)
        if (yPos + estimatedHeight > pageHeight - 20) {
          doc.addPage()
          yPos = 20
        }

        // En-tête de la question
        doc.setFillColor(239, 68, 68)
        doc.roundedRect(margin, yPos, 18, 7, 1, 1, 'F')
        doc.setFontSize(9)
        doc.setTextColor(255)
        doc.setFont('helvetica', 'bold')
        doc.text('NOK', margin + 9, yPos + 4.5, { align: 'center' })

        doc.setFontSize(11)
        doc.setTextColor(15, 23, 42)
        doc.text(`Q${q.index + 1}`, margin + 22, yPos + 5)
        
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        const title = `[${q.point_m}] ${q.question}`
        const splitTitle = doc.splitTextToSize(title, contentWidth - 30)
        doc.text(splitTitle, margin + 30, yPos + 5)
        
        yPos += splitTitle.length * 5 + 5

        // Action
        if (q.action && q.action !== '-') {
          doc.setFontSize(9)
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(100, 116, 139)
          const splitAction = doc.splitTextToSize(`Action corrective : ${q.action}`, contentWidth - 30)
          doc.text(splitAction, margin + 30, yPos)
          yPos += splitAction.length * 4 + 5
        }

        // Photos (2 par ligne)
        if (photos.length > 0) {
          const imgWidth = (contentWidth - 30 - 10) / 2
          const imgHeight = 60

          photos.forEach((photo, pIdx) => {
            const xPos = margin + 30 + (pIdx % 2) * (imgWidth + 10)
            
            if (pIdx > 0 && pIdx % 2 === 0) {
              yPos += imgHeight + 10
            }

            if (yPos + imgHeight > pageHeight - 20) {
              doc.addPage()
              yPos = 20
            }

            doc.setDrawColor(226, 232, 240)
            doc.setFillColor(248, 250, 252)
            doc.roundedRect(xPos - 2, yPos - 2, imgWidth + 4, imgHeight + 4, 2, 2, 'FD')
            
            doc.addImage(photo, 'JPEG', xPos, yPos, imgWidth, imgHeight)
          })
          yPos += imgHeight + 15
        } else {
          yPos += 10
        }
        
        doc.setDrawColor(241, 245, 249)
        doc.line(margin, yPos - 5, pageWidth - margin, yPos - 5)
      })
    }

    // --- PIED DE PAGE GLOBAL ---
    const pageCount = doc.internal.getNumberOfPages()
    for (let i = 2; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(148, 163, 184)
      doc.text(`WKW Tunisie - Rapport d'Audit Gemba`, margin, pageHeight - 10)
      doc.text(`Page ${i} / ${pageCount}`, pageWidth - margin, pageHeight - 10, { align: 'right' })
    }

    doc.save(`Rapport_Gemba_${selectedAudit.ligne}_${selectedAudit.date}.pdf`)
    setQuestionPhotos({})
  }

  if (loading) return <p className="muted" style={{ padding: '2rem' }}>Chargement…</p>

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Rapport d'Audit Gemba</h1>
      </div>

      <div className="card">
        <h2 className="card-title">Sélectionner un audit</h2>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1, minWidth: '300px' }}>
            <select className="filter-control" value={selectedAuditId} onChange={e => { setSelectedAuditId(e.target.value); setQuestionPhotos({}); }}>
              <option value="">-- Choisir un audit --</option>
              {auditsGrouped.map(a => (
                <option key={a.id} value={a.id}>
                  {new Date(a.date).toLocaleDateString('fr-FR')} — {a.ligne} ({a.uap})
                </option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary" onClick={generatePDF} disabled={!selectedAudit} style={{ height: '42px', padding: '0 2rem' }}>
            📥 Générer le rapport pro
          </button>
        </div>
      </div>

      {selectedAudit && (
        <div className="card" style={{ marginTop: '2rem' }}>
          <h2 className="card-title">Ajouter des photos aux problèmes (NOK)</h2>
          <p className="muted" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>Les photos seront ajoutées à la fin du rapport.</p>
          
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Point M</th>
                  <th>Question</th>
                  <th>Statut</th>
                  <th>Action / Commentaire</th>
                  <th style={{ width: '250px' }}>Photos</th>
                </tr>
              </thead>
              <tbody>
                {selectedAudit.rows.map((r, i) => {
                  const isNok = String(r.reponse).toUpperCase() === 'NOK'
                  const photos = questionPhotos[i] || []
                  return (
                    <tr key={i} style={{ background: isNok ? 'rgba(239, 68, 68, 0.05)' : 'transparent' }}>
                      <td style={{ color: 'var(--text-muted)' }}>{r.point_m}</td>
                      <td style={{ whiteSpace: 'normal', maxWidth: '300px' }}>{r.question}</td>
                      <td>
                        <span className={`badge ${r.reponse === 'OK' ? 'ok' : r.reponse === 'NOK' ? 'bad' : ''}`}>
                          {r.reponse}
                        </span>
                      </td>
                      <td style={{ whiteSpace: 'normal', maxWidth: '250px', color: 'var(--warning)' }}>{r.action}</td>
                      <td>
                        {isNok && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                              {photos.map((photo, pIdx) => (
                                <div key={pIdx} style={{ position: 'relative' }}>
                                  <img src={photo} alt={`Preuve ${pIdx + 1}`} style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '4px' }} />
                                  <button onClick={() => removePhoto(i, pIdx)} style={{ position: 'absolute', top: -5, right: -5, background: 'var(--danger)', color: 'white', border: 'none', borderRadius: '50%', width: '16px', height: '16px', cursor: 'pointer', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                                </div>
                              ))}
                            </div>
                            <label className="btn btn-secondary" style={{ cursor: 'pointer', padding: '0.2rem 0.5rem', fontSize: '0.75rem', alignSelf: 'flex-start' }}>
                              📷 Ajouter photo(s)
                              <input type="file" accept="image/*" multiple onChange={(e) => handlePhotoUpload(i, e)} style={{ display: 'none' }} />
                            </label>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
