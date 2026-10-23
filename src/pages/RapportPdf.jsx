import { useState, useEffect, useMemo } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { fetchActions, upsertAction } from '../services/actionsApi'
import { fetchPhotosByAction, insertActionPhoto, deleteActionPhoto } from '../services/actionPhotosApi'
import { uploadActionPhoto } from '../services/storageApi'

const urlToBase64 = async (url) => {
  try {
    const response = await fetch(url)
    const blob = await response.blob()
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch (error) {
    console.error("Erreur conversion image:", error)
    return null
  }
}

export default function RapportPdf({ audits }) {
  const [selectedAuditId, setSelectedAuditId] = useState('')
  const [uploading, setUploading] = useState(false)
  const [actions, setActions] = useState([])
  const [photosByAction, setPhotosByAction] = useState({})

  const loadPhotos = async () => {
    const [actionsRes, photosMap] = await Promise.all([fetchActions(), fetchPhotosByAction()])
    setActions(actionsRes || [])
    setPhotosByAction(photosMap || {})
  }

  useEffect(() => {
    loadPhotos()
  }, [])

  const sortedAudits = useMemo(() => {
    return [...audits].sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [audits])

  const selectedAudit = useMemo(() => {
    return sortedAudits.find(a => `${a.date}|${a.zone}|${a.auditor}` === selectedAuditId)
  }, [sortedAudits, selectedAuditId])

  const getActionForCheckpoint = (audit, cp) => {
    if (!audit || !cp) return null
    return actions.find(a =>
      a.type === '5S' &&
      a.audit_date === audit.date &&
      a.ligne === audit.zone &&
      a.question === cp.q
    )
  }

  const getDbPhotosForCheckpoint = (audit, cp) => {
    const action = getActionForCheckpoint(audit, cp)
    if (!action) return []
    return photosByAction[action.id] || []
  }

  // 🌟 Synchronisation avec le plan d'action 5S
  const handlePhotoUpload = async (audit, cp, e) => {
    const files = Array.from(e.target.files)
    if (files.length === 0) return

    setUploading(true)
    let action = getActionForCheckpoint(audit, cp)
    let actionId = action?.id

    if (!actionId) {
      const newAction = {
        type: '5S',
        audit_date: audit.date,
        ligne: audit.zone,
        point_m: '',
        question: cp.q,
        action_texte: cp.a || '',
        progression: 0
      }
      const savedData = await upsertAction(newAction)
      if (savedData) {
        actionId = savedData.id
        setActions(prev => [...prev, savedData])
      } else {
        alert("Erreur lors de la création de l'action.")
        setUploading(false)
        return
      }
    }

    const key = `${audit.date}|${audit.zone}|${cp.q}`
    for (const file of files) {
      const uploaded = await uploadActionPhoto(file, key)
      if (uploaded?.url) {
        await insertActionPhoto({
          action_id: actionId,
          url: uploaded.url,
          storage_path: uploaded.path,
          uploaded_by: 'Admin'
        })
      }
    }

    const updatedPhotos = await fetchPhotosByAction()
    setPhotosByAction(updatedPhotos)
    setUploading(false)
    e.target.value = ''
  }

  const handleRemovePhoto = async (photo) => {
    if (!confirm('Supprimer cette photo du plan d\'action ?')) return
    await deleteActionPhoto(photo)
    const updatedPhotos = await fetchPhotosByAction()
    setPhotosByAction(updatedPhotos)
  }

  const generatePDF = async () => {
    if (!selectedAudit) return

    const doc = new jsPDF('p', 'mm', 'a4')
    const pageWidth = doc.internal.pageSize.width
    const pageHeight = doc.internal.pageSize.height
    const margin = 20
    const contentWidth = pageWidth - margin * 2

    const cps = selectedAudit.checkpoints || []
    const okCount = cps.filter(c => c.s === 'OK').length
    const nokCount = cps.filter(c => c.s === 'NOK').length
    const naCount = cps.filter(c => c.s === 'N/A').length
    const totalQuestions = cps.length

    // PAGE 1
    const imgLogo = new Image()
    imgLogo.src = '/logo.png'
    try { doc.addImage(imgLogo, 'PNG', pageWidth / 2 - 20, 30, 40, 40) } catch (e) {}
    doc.setFontSize(28); doc.setTextColor(15, 23, 42); doc.text("RAPPORT D'AUDIT 5S", pageWidth / 2, 90, { align: 'center' })
    doc.setFontSize(16); doc.setTextColor(100, 116, 139); doc.text(`Zone / Ligne : ${selectedAudit.zone}`, pageWidth / 2, 110, { align: 'center' })
    doc.setFontSize(14); doc.text(`Date de l'audit : ${new Date(selectedAudit.date).toLocaleDateString('fr-FR')}`, pageWidth / 2, 120, { align: 'center' })
    doc.setFontSize(10); doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, pageWidth / 2, pageHeight - 20, { align: 'center' })

    // PAGE 2
    doc.addPage(); doc.setFontSize(18); doc.setTextColor(15, 23, 42); doc.text("Synthèse de l'audit", margin, 25); doc.setDrawColor(226, 232, 240); doc.line(margin, 30, pageWidth - margin, 30)
    const cardY = 40; const cardH = 25; const cardW = (contentWidth - 15) / 4
    const drawCard = (x, label, value, color) => {
      doc.setFillColor(color[0], color[1], color[2], 0.1); doc.setDrawColor(color[0], color[1], color[2]); doc.roundedRect(x, cardY, cardW, cardH, 3, 3, 'FD')
      doc.setFontSize(9); doc.setTextColor(100, 116, 139); doc.text(label, x + cardW/2, cardY + 8, { align: 'center' })
      doc.setFontSize(18); doc.setTextColor(color[0], color[1], color[2]); doc.text(value.toString(), x + cardW/2, cardY + 18, { align: 'center' })
    }
    drawCard(margin, 'OK', okCount, [16, 185, 129]); drawCard(margin + cardW + 5, 'NOK', nokCount, [239, 68, 68]); drawCard(margin + (cardW + 5) * 2, 'N/A', naCount, [148, 163, 184]); drawCard(margin + (cardW + 5) * 3, 'TOTAL', totalQuestions, [59, 130, 246])

    const infoY = cardY + cardH + 10
    doc.setFillColor(248, 250, 252); doc.setDrawColor(226, 232, 240); doc.roundedRect(margin, infoY, contentWidth, 30, 3, 3, 'FD')
    doc.setFontSize(11); doc.setTextColor(15, 23, 42); doc.text(`Auditeur :`, margin + 5, infoY + 10); doc.setFont('helvetica', 'bold'); doc.text(`${selectedAudit.auditor || '—'}`, margin + 30, infoY + 10)
    doc.setFont('helvetica', 'normal'); doc.text(`Pilote :`, margin + 5, infoY + 20); doc.setFont('helvetica', 'bold'); doc.text(`${selectedAudit.pilot || '—'}`, margin + 25, infoY + 20)
    doc.setFont('helvetica', 'normal'); doc.text(`Score Global :`, pageWidth - margin - 60, infoY + 15); doc.setFont('helvetica', 'bold'); doc.setFontSize(16)
    doc.setTextColor(Number(selectedAudit.score_pct) >= 87 ? 16 : Number(selectedAudit.score_pct) >= 85 ? 245 : 239, Number(selectedAudit.score_pct) >= 87 ? 185 : Number(selectedAudit.score_pct) >= 85 ? 158 : 68, Number(selectedAudit.score_pct) >= 87 ? 129 : Number(selectedAudit.score_pct) >= 85 ? 11 : 68)
    doc.text(`${selectedAudit.score_pct} %`, pageWidth - margin - 10, infoY + 15, { align: 'right' })

    let currentY = infoY + 45
    doc.setFontSize(14); doc.setTextColor(15, 23, 42); doc.setFont('helvetica', 'bold'); doc.text("Scores par pilier", margin, currentY); currentY += 8
    const pillars = [{ name: '1S - Trier', range: [0, 3] }, { name: '2S - Ranger', range: [4, 8] }, { name: '3S - Nettoyer', range: [9, 14] }, { name: '4S - Standardiser', range: [15, 21] }, { name: '5S - Respecter', range: [22, 25] }]
    const pW = (contentWidth - 10) / 3; const pH = 25; doc.setFont('helvetica', 'normal')
    pillars.forEach((p, i) => {
      let ok = 0, nok = 0
      for (let j = p.range[0]; j <= p.range[1]; j++) { if (cps[j]?.s === 'OK') ok++; if (cps[j]?.s === 'NOK') nok++ }
      const score = (ok + nok) > 0 ? Math.round((ok / (ok + nok)) * 100) : 0
      const x = margin + (i % 3) * (pW + 5); const y = currentY + Math.floor(i / 3) * (pH + 5)
      doc.setFillColor(248, 250, 252); doc.setDrawColor(226, 232, 240); doc.roundedRect(x, y, pW, pH, 3, 3, 'FD')
      doc.setFontSize(9); doc.setTextColor(100, 116, 139); doc.text(p.name, x + pW/2, y + 8, { align: 'center' })
      doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.setTextColor(score >= 87 ? 16 : score >= 85 ? 245 : 239, score >= 87 ? 185 : score >= 85 ? 158 : 68, score >= 87 ? 129 : score >= 85 ? 11 : 68)
      doc.text(`${score}%`, x + pW/2, y + 18, { align: 'center' }); doc.setFont('helvetica', 'normal')
    })

    // PAGE 3
    doc.addPage(); doc.setFontSize(18); doc.setTextColor(15, 23, 42); doc.text("Détail de l'audit", margin, 25)
    const tableData = cps.map((cp, index) => {
      const dbPhotos = getDbPhotosForCheckpoint(selectedAudit, cp)
      return [index + 1, cp.q, cp.s || '—', cp.a || '—', dbPhotos.length > 0 ? `${dbPhotos.length} photo(s)` : '—']
    })
    autoTable(doc, {
      startY: 30, head: [['N°', 'Question', 'Statut', 'Action / Commentaire', 'Photos']], body: tableData, theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 10, fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 3, valign: 'middle', lineColor: [226, 232, 240] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 1: { cellWidth: 65 }, 2: { cellWidth: 15, halign: 'center', fontStyle: 'bold' }, 3: { cellWidth: 65 }, 4: { cellWidth: 25, halign: 'center' } },
      didParseCell: function (data) { if (data.section === 'body' && data.column.index === 2) { if (data.cell.raw === 'OK') data.cell.styles.textColor = [16, 185, 129]; if (data.cell.raw === 'NOK') data.cell.styles.textColor = [239, 68, 68] } }
    })

    // PAGE 4
    const nokQuestions = cps.map((cp, index) => ({ ...cp, index })).filter(cp => cp.s === 'NOK')
    if (nokQuestions.length > 0) {
      doc.addPage(); doc.setFontSize(18); doc.setTextColor(15, 23, 42); doc.text("Détail des non-conformités (NOK)", margin, 25); doc.setDrawColor(226, 232, 240); doc.line(margin, 30, pageWidth - margin, 30)
      let yPos = 40
      for (const q of nokQuestions) {
        const dbPhotos = getDbPhotosForCheckpoint(selectedAudit, q)
        const dbPhotosBase64 = await Promise.all(dbPhotos.map(p => urlToBase64(p.url)))
        const validDbPhotos = dbPhotosBase64.filter(p => p !== null)

        const estimatedHeight = 25 + (validDbPhotos.length > 0 ? Math.ceil(validDbPhotos.length / 2) * 65 : 0)
        if (yPos + estimatedHeight > pageHeight - 20) { doc.addPage(); yPos = 20 }

        doc.setFillColor(239, 68, 68); doc.roundedRect(margin, yPos, 18, 7, 1, 1, 'F')
        doc.setFontSize(9); doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.text('NOK', margin + 9, yPos + 4.5, { align: 'center' })
        doc.setFontSize(11); doc.setTextColor(15, 23, 42); doc.text(`Q${q.index + 1}`, margin + 22, yPos + 5)
        doc.setFontSize(10); doc.setFont('helvetica', 'bold')
        const splitTitle = doc.splitTextToSize(q.q, contentWidth - 30)
        doc.text(splitTitle, margin + 30, yPos + 5); yPos += splitTitle.length * 5 + 5

        if (q.a) {
          doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139)
          const splitAction = doc.splitTextToSize(`Action corrective : ${q.a}`, contentWidth - 30)
          doc.text(splitAction, margin + 30, yPos); yPos += splitAction.length * 4 + 5
        }

        if (validDbPhotos.length > 0) {
          const imgWidth = (contentWidth - 30 - 10) / 2; const imgHeight = 60
          validDbPhotos.forEach((photo, pIdx) => {
            const xPos = margin + 30 + (pIdx % 2) * (imgWidth + 10)
            if (pIdx > 0 && pIdx % 2 === 0) yPos += imgHeight + 10
            if (yPos + imgHeight > pageHeight - 20) { doc.addPage(); yPos = 20 }
            doc.setDrawColor(226, 232, 240); doc.setFillColor(248, 250, 252); doc.roundedRect(xPos - 2, yPos - 2, imgWidth + 4, imgHeight + 4, 2, 2, 'FD')
            doc.addImage(photo, 'JPEG', xPos, yPos, imgWidth, imgHeight)
          })
          yPos += imgHeight + 15
        } else { yPos += 10 }
        doc.setDrawColor(241, 245, 249); doc.line(margin, yPos - 5, pageWidth - margin, yPos - 5)
      }
    }

    const pageCount = doc.internal.getNumberOfPages()
    for (let i = 2; i <= pageCount; i++) {
      doc.setPage(i); doc.setFontSize(8); doc.setTextColor(148, 163, 184)
      doc.text(`WKW Tunisie - Rapport d'Audit 5S`, margin, pageHeight - 10)
      doc.text(`Page ${i} / ${pageCount}`, pageWidth - margin, pageHeight - 10, { align: 'right' })
    }
    doc.save(`Rapport_5S_${selectedAudit.zone}_${selectedAudit.date}.pdf`)
  }

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Rapport d'Audit 5S</h1>
      </div>

      <div className="card">
        <h2 className="card-title">Sélectionner un audit</h2>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1, minWidth: '300px' }}>
            <select className="filter-control" value={selectedAuditId} onChange={e => setSelectedAuditId(e.target.value)}>
              <option value="">-- Choisir un audit --</option>
              {sortedAudits.map(a => (<option key={`${a.date}|${a.zone}|${a.auditor}`} value={`${a.date}|${a.zone}|${a.auditor}`}>{new Date(a.date).toLocaleDateString('fr-FR')} — {a.zone} (Auditeur: {a.auditor})</option>))}
            </select>
          </div>
          <button className="btn btn-primary" onClick={generatePDF} disabled={!selectedAudit || uploading} style={{ height: '42px', padding: '0 2rem' }}>
            {uploading ? '⏳ Upload...' : '📥 Générer le rapport pro'}
          </button>
        </div>
      </div>

      {selectedAudit && (
        <div className="card" style={{ marginTop: '2rem' }}>
          <h2 className="card-title">Photos (Synchronisées avec le Plan d'Action)</h2>
          <p className="muted" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>Les photos ajoutées ici sont directement enregistrées dans le Plan d'Action 5S.</p>
          
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Question 5S</th>
                  <th>Statut</th>
                  <th>Action / Commentaire</th>
                  <th style={{ width: '300px' }}>Photos</th>
                </tr>
              </thead>
              <tbody>
                {(selectedAudit.checkpoints || []).map((cp, i) => {
                  const isNok = cp.s === 'NOK'
                  const dbPhotos = getDbPhotosForCheckpoint(selectedAudit, cp)
                  
                  return (
                    <tr key={i} style={{ background: isNok ? 'rgba(239, 68, 68, 0.05)' : 'transparent' }}>
                      <td>{i + 1}</td>
                      <td style={{ maxWidth: '300px', whiteSpace: 'normal' }}>{cp.q}</td>
                      <td><span className={`badge ${cp.s === 'OK' ? 'ok' : cp.s === 'NOK' ? 'bad' : ''}`}>{cp.s || 'N/A'}</span></td>
                      <td style={{ maxWidth: '250px', whiteSpace: 'normal', color: 'var(--text-muted)' }}>{cp.a || '—'}</td>
                      <td>
                        {isNok && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                              {dbPhotos.map((p, pIdx) => (
                                <div key={pIdx} style={{ position: 'relative' }}>
                                  <img src={p.url} alt={`Preuve ${pIdx + 1}`} style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--primary)' }} />
                                  <button onClick={() => handleRemovePhoto(p)} style={{ position: 'absolute', top: -5, right: -5, background: 'var(--danger)', color: 'white', border: 'none', borderRadius: '50%', width: '16px', height: '16px', cursor: 'pointer', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                                </div>
                              ))}
                            </div>
                            <label className="btn btn-secondary" style={{ cursor: uploading ? 'wait' : 'pointer', padding: '0.2rem 0.5rem', fontSize: '0.75rem', alignSelf: 'flex-start', opacity: uploading ? 0.5 : 1 }}>
                              📷 Ajouter au plan d'action
                              <input type="file" accept="image/*" multiple disabled={uploading} onChange={(e) => handlePhotoUpload(selectedAudit, cp, e)} style={{ display: 'none' }} />
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
