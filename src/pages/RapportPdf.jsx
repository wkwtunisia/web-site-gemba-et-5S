import { useState, useEffect, useMemo } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { supabase } from '../supabaseClient'
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

// 🌟 FONCTION ANTI-DÉCALAGE HORAIRE (Découpage manuel du texte)
const formatDateFR = (dStr) => {
  if (!dStr) return '—';
  const str = String(dStr);
  if (str.length >= 10 && str.includes('-')) {
    const parts = str.substring(0, 10).split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return new Date(dStr).toLocaleDateString('fr-FR');
}

const COLORS = {
  primary: [15, 23, 42], accent: [37, 99, 235], success: [16, 185, 129], danger: [239, 68, 68], warning: [245, 158, 11], light: [248, 250, 252], border: [226, 232, 240], textMuted: [100, 116, 139]
}

export default function RapportPdf({ audits }) {
  const [selectedAuditId, setSelectedAuditId] = useState('')
  const [uploading, setUploading] = useState(false)
  const [actions, setActions] = useState([])
  const [photosByAction, setPhotosByAction] = useState({})
  const [isAdmin, setIsAdmin] = useState(false)

  const loadPhotos = async () => {
    const [actionsRes, photosMap] = await Promise.all([fetchActions(), fetchPhotosByAction()])
    setActions(actionsRes || [])
    setPhotosByAction(photosMap || {})
  }

  useEffect(() => {
    loadPhotos()
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.email) {
        supabase.from('profiles').select('role').eq('email', data.user.email).single().then(({ data: profile }) => {
          if (profile && profile.role === 'admin') setIsAdmin(true)
        })
      }
    })
  }, [])

  const sortedAudits = useMemo(() => {
    return [...audits].sort((a, b) => {
      const dateA = String(a.date).substring(0, 10);
      const dateB = String(b.date).substring(0, 10);
      return dateB.localeCompare(dateA);
    })
  }, [audits])

  const selectedAudit = useMemo(() => {
    return sortedAudits.find(a => `${a.date}|${a.zone}|${a.auditor}` === selectedAuditId)
  }, [sortedAudits, selectedAuditId])

  const getActionForCheckpoint = (audit, cp) => {
    if (!audit || !cp) return null
    return actions.find(a => a.type === '5S' && a.audit_date === audit.date && a.ligne === audit.zone && a.question === cp.q)
  }

  const getDbPhotosForCheckpoint = (audit, cp) => {
    const action = getActionForCheckpoint(audit, cp)
    if (!action) return []
    return photosByAction[action.id] || []
  }

  const handlePhotoUpload = async (audit, cp, e) => {
    const files = Array.from(e.target.files)
    if (files.length === 0) return
    setUploading(true)
    let action = getActionForCheckpoint(audit, cp)
    let actionId = action?.id
    if (!actionId) {
      const newAction = { type: '5S', audit_date: audit.date, ligne: audit.zone, point_m: '', question: cp.q, action_texte: cp.a || '', progression: 0 }
      const savedData = await upsertAction(newAction)
      if (savedData) { actionId = savedData.id; setActions(prev => [...prev, savedData]) }
      else { alert("Erreur création action."); setUploading(false); return }
    }
    const key = `${audit.date}|${audit.zone}|${cp.q}`
    for (const file of files) {
      const uploaded = await uploadActionPhoto(file, key)
      if (uploaded?.url) await insertActionPhoto({ action_id: actionId, url: uploaded.url, storage_path: uploaded.path, uploaded_by: 'Admin' })
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
    const displayDate = formatDateFR(selectedAudit.date);

    // --- PAGE 1 ---
    doc.setFillColor(...COLORS.primary); doc.rect(0, 0, pageWidth, pageHeight, 'F')
    const imgLogo = new Image(); imgLogo.src = '/logo.png'
    try { doc.addImage(imgLogo, 'PNG', pageWidth / 2 - 25, 40, 50, 50) } catch (e) {}
    doc.setFontSize(32); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.text("RAPPORT D'AUDIT", pageWidth / 2, 110, { align: 'center' })
    doc.setFontSize(24); doc.setTextColor(...COLORS.accent); doc.text("5S", pageWidth / 2, 122, { align: 'center' })
    doc.setDrawColor(...COLORS.accent); doc.setLineWidth(1); doc.line(pageWidth / 2 - 20, 130, pageWidth / 2 + 20, 130)
    doc.setFontSize(16); doc.setTextColor(200, 200, 200); doc.setFont('helvetica', 'normal'); doc.text(`Zone / Ligne : ${selectedAudit.zone}`, pageWidth / 2, 145, { align: 'center' }); doc.text(`Auditeur : ${selectedAudit.auditor || '—'}`, pageWidth / 2, 153, { align: 'center' })
    doc.setFontSize(14); doc.text(`Date : ${displayDate}`, pageWidth / 2, 170, { align: 'center' })
    doc.setFontSize(10); doc.setTextColor(150, 150, 150); doc.text(`Document généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, pageWidth / 2, pageHeight - 20, { align: 'center' })

    // --- PAGE 2 ---
    doc.addPage(); doc.setFillColor(...COLORS.primary); doc.rect(0, 0, pageWidth, 25, 'F')
    doc.setFontSize(12); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.text("SYNTHÈSE DE L'AUDIT", margin, 16)
    doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.text(`Zone ${selectedAudit.zone} - ${displayDate}`, pageWidth - margin, 16, { align: 'right' })
    let currentY = 45
    const cardW = (contentWidth - 15) / 4; const cardH = 30
    const drawCard = (x, label, value, color) => {
      doc.setFillColor(...COLORS.light); doc.setDrawColor(...COLORS.border); doc.roundedRect(x, currentY, cardW, cardH, 2, 2, 'FD')
      doc.setFillColor(...color); doc.roundedRect(x, currentY, 4, cardH, 2, 2, 'F')
      doc.setFontSize(9); doc.setTextColor(...COLORS.textMuted); doc.text(label, x + 10, currentY + 10)
      doc.setFontSize(20); doc.setTextColor(...color); doc.setFont('helvetica', 'bold'); doc.text(value.toString(), x + 10, currentY + 22)
      doc.setFont('helvetica', 'normal')
    }
    drawCard(margin, 'CONFORMES (OK)', okCount, COLORS.success); drawCard(margin + cardW + 5, 'NON-CONFORMES (NOK)', nokCount, COLORS.danger); drawCard(margin + (cardW + 5) * 2, 'NON APPLICABLES', naCount, COLORS.textMuted); drawCard(margin + (cardW + 5) * 3, 'TOTAL QUESTIONS', totalQuestions, COLORS.accent)
    currentY += cardH + 15
    doc.setFillColor(...COLORS.light); doc.setDrawColor(...COLORS.border); doc.roundedRect(margin, currentY, contentWidth, 25, 2, 2, 'FD')
    doc.setFontSize(11); doc.setTextColor(...COLORS.primary); doc.setFont('helvetica', 'bold'); doc.text("SCORE GLOBAL DE L'AUDIT", margin + 10, currentY + 10)
    const globalScore = Number(selectedAudit.score_pct) || 0
    doc.setFontSize(22); doc.setTextColor(...(globalScore >= 85 ? COLORS.success : COLORS.danger)); doc.text(`${globalScore} %`, margin + 10, currentY + 20)
    const barWidth = contentWidth - 80
    doc.setFillColor(...COLORS.border); doc.roundedRect(margin + 60, currentY + 12, barWidth, 6, 3, 3, 'F')
    doc.setFillColor(...(globalScore >= 85 ? COLORS.success : COLORS.danger)); doc.roundedRect(margin + 60, currentY + 12, (globalScore / 100) * barWidth, 6, 3, 3, 'F')
    doc.setFont('helvetica', 'normal')
    currentY += 40
    doc.setFillColor(...COLORS.light); doc.setDrawColor(...COLORS.border); doc.roundedRect(margin, currentY, contentWidth, 20, 2, 2, 'FD')
    doc.setFontSize(10); doc.setTextColor(...COLORS.textMuted); doc.text("Auditeur :", margin + 10, currentY + 12); doc.setFont('helvetica', 'bold'); doc.setTextColor(...COLORS.primary); doc.text(selectedAudit.auditor || '—', margin + 35, currentY + 12); doc.setFont('helvetica', 'normal')
    currentY += 35
    doc.setFontSize(12); doc.setTextColor(...COLORS.primary); doc.setFont('helvetica', 'bold'); doc.text("PERFORMANCE PAR PILIER (5S)", margin, currentY); currentY += 8
    const pillars = [{ name: '1S - Trier', range: [0, 3] }, { name: '2S - Ranger', range: [4, 8] }, { name: '3S - Nettoyer', range: [9, 14] }, { name: '4S - Standardiser', range: [15, 21] }, { name: '5S - Respecter', range: [22, 25] }]
    const pW = (contentWidth - 10) / 2; const pH = 20; doc.setFont('helvetica', 'normal')
    pillars.forEach((p, i) => {
      let ok = 0, nok = 0
      for (let j = p.range[0]; j <= p.range[1]; j++) { if (cps[j]?.s === 'OK') ok++; if (cps[j]?.s === 'NOK') nok++ }
      const score = (ok + nok) > 0 ? Math.round((ok / (ok + nok)) * 100) : 0
      const x = margin + (i % 2) * (pW + 10); const y = currentY + Math.floor(i / 2) * (pH + 8)
      doc.setFillColor(...COLORS.light); doc.setDrawColor(...COLORS.border); doc.roundedRect(x, y, pW, pH, 2, 2, 'FD')
      doc.setFontSize(9); doc.setTextColor(...COLORS.textMuted); doc.text(p.name, x + 5, y + 7)
      doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(...(score >= 85 ? COLORS.success : COLORS.danger)); doc.text(`${score}%`, x + pW - 10, y + 14, { align: 'right' })
      doc.setFillColor(...COLORS.border); doc.roundedRect(x + 5, y + 12, pW - 30, 4, 2, 2, 'F'); doc.setFillColor(...(score >= 85 ? COLORS.success : COLORS.danger)); doc.roundedRect(x + 5, y + 12, ((score / 100) * (pW - 30)), 4, 2, 2, 'F')
      doc.setFont('helvetica', 'normal')
    })

    // --- PAGE 3 ---
    doc.addPage(); doc.setFillColor(...COLORS.primary); doc.rect(0, 0, pageWidth, 25, 'F')
    doc.setFontSize(12); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.text("DÉTAIL DE L'AUDIT", margin, 16)
    const tableData = cps.map((cp, index) => {
      const dbPhotos = getDbPhotosForCheckpoint(selectedAudit, cp)
      return [index + 1, cp.q, cp.s || '—', cp.a || '—', dbPhotos.length > 0 ? `${dbPhotos.length} photo(s)` : '—']
    })
    autoTable(doc, {
      startY: 35, head: [['N°', 'Question', 'Statut', 'Action / Commentaire', 'Preuves']], body: tableData, theme: 'plain',
      headStyles: { fillColor: COLORS.primary, textColor: 255, fontSize: 9, fontStyle: 'bold', cellPadding: 4 },
      styles: { fontSize: 8, cellPadding: 4, valign: 'middle', textColor: COLORS.primary, lineColor: COLORS.border, lineWidth: 0.1 },
      alternateRowStyles: { fillColor: COLORS.light },
      columnStyles: { 0: { cellWidth: 10, halign: 'center', fontStyle: 'bold' }, 1: { cellWidth: 70, fontStyle: 'bold' }, 2: { cellWidth: 20, halign: 'center', fontStyle: 'bold' }, 3: { cellWidth: 60, textColor: COLORS.warning }, 4: { cellWidth: 20, halign: 'center' } },
      didParseCell: function (data) { if (data.section === 'body' && data.column.index === 2) { if (data.cell.raw === 'OK') data.cell.styles.textColor = COLORS.success; if (data.cell.raw === 'NOK') data.cell.styles.textColor = COLORS.danger } }
    })

    // --- PAGE 4 ---
    const nokQuestions = cps.map((cp, index) => ({ ...cp, index })).filter(cp => cp.s === 'NOK')
    if (nokQuestions.length > 0) {
      doc.addPage(); doc.setFillColor(...COLORS.danger); doc.rect(0, 0, pageWidth, 25, 'F')
      doc.setFontSize(12); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.text("ANALYSE DES NON-CONFORMITÉS", margin, 16)
      let yPos = 35
      for (const q of nokQuestions) {
        const dbPhotos = getDbPhotosForCheckpoint(selectedAudit, q)
        const dbPhotosBase64 = await Promise.all(dbPhotos.map(p => urlToBase64(p.url)))
        const validPhotos = dbPhotosBase64.filter(p => p !== null)
        const estimatedHeight = 30 + (validPhotos.length > 0 ? Math.ceil(validPhotos.length / 2) * 60 : 0)
        if (yPos + estimatedHeight > pageHeight - 25) { doc.addPage(); yPos = 25 }
        doc.setFillColor(...COLORS.light); doc.setDrawColor(...COLORS.border); doc.roundedRect(margin, yPos, contentWidth, 22, 2, 2, 'FD')
        doc.setFillColor(...COLORS.danger); doc.roundedRect(margin + 5, yPos + 5, 12, 5, 1, 1, 'F')
        doc.setFontSize(7); doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.text('NOK', margin + 11, yPos + 8.5, { align: 'center' })
        doc.setFontSize(9); doc.setTextColor(...COLORS.primary); doc.text(`Q${q.index + 1}`, margin + 22, yPos + 9)
        doc.setFont('helvetica', 'normal')
        const splitTitle = doc.splitTextToSize(q.q, contentWidth - 30); doc.text(splitTitle, margin + 30, yPos + 9)
        yPos += 25
        if (q.a) {
          doc.setFontSize(8); doc.setTextColor(...COLORS.warning); doc.setFont('helvetica', 'bold'); doc.text("ACTION CORRECTIVE :", margin + 5, yPos)
          doc.setFont('helvetica', 'normal')
          const splitAction = doc.splitTextToSize(q.a, contentWidth - 45); doc.text(splitAction, margin + 40, yPos); yPos += splitAction.length * 4 + 5
        }
        if (validPhotos.length > 0) {
          const imgWidth = (contentWidth - 10) / 2; const imgHeight = 55
          validPhotos.forEach((photo, pIdx) => {
            const xPos = margin + (pIdx % 2) * (imgWidth + 10)
            if (pIdx > 0 && pIdx % 2 === 0) yPos += imgHeight + 5
            if (yPos + imgHeight > pageHeight - 20) { doc.addPage(); yPos = 25 }
            doc.setDrawColor(...COLORS.border); doc.setFillColor(...COLORS.light); doc.roundedRect(xPos - 2, yPos - 2, imgWidth + 4, imgHeight + 4, 2, 2, 'FD')
            doc.addImage(photo, 'JPEG', xPos, yPos, imgWidth, imgHeight)
          })
          yPos += imgHeight + 10
        } else { yPos += 5 }
        doc.setDrawColor(...COLORS.border); doc.setLineWidth(0.5); doc.line(margin, yPos, pageWidth - margin, yPos); yPos += 10
      }
    }

    const pageCount = doc.internal.getNumberOfPages()
    for (let i = 2; i <= pageCount; i++) {
      doc.setPage(i); doc.setDrawColor(...COLORS.border); doc.setLineWidth(0.5); doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15)
      doc.setFontSize(8); doc.setTextColor(...COLORS.textMuted)
      doc.text(`WKW Tunisie - Rapport d'Audit 5S`, margin, pageHeight - 10)
      doc.text(`Page ${i} / ${pageCount}`, pageWidth - margin, pageHeight - 10, { align: 'right' })
    }
    
    // 🌟 Nom du fichier avec la date corrigée
    doc.save(`Rapport_5S_${selectedAudit.zone}_${String(selectedAudit.date).substring(0, 10)}.pdf`)
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
              {sortedAudits.map(a => (
                <option key={`${a.date}|${a.zone}|${a.auditor}`} value={`${a.date}|${a.zone}|${a.auditor}`}>
                  {formatDateFR(a.date)} — {a.zone} (Auditeur: {a.auditor})
                </option>
              ))}
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
              <thead><tr><th>N°</th><th>Question 5S</th><th>Statut</th><th>Action / Commentaire</th><th style={{ width: '300px' }}>Photos</th></tr></thead>
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
                                  {isAdmin && (
                                    <button onClick={() => handleRemovePhoto(p)} style={{ position: 'absolute', top: -5, right: -5, background: 'var(--danger)', color: 'white', border: 'none', borderRadius: '50%', width: '16px', height: '16px', cursor: 'pointer', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                                  )}
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
