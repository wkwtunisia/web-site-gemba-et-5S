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

const COLORS = {
  primary: [15, 23, 42],
  accent: [37, 99, 235],
  success: [16, 185, 129],
  danger: [239, 68, 68],
  warning: [245, 158, 11],
  light: [248, 250, 252],
  border: [226, 232, 240],
  textMuted: [100, 116, 139]
}

export default function RapportGemba() {
  const [data, setData] = useState([])
  const [actions, setActions] = useState([])
  const [photosByAction, setPhotosByAction] = useState({})
  const [loading, setLoading] = useState(true)
  const [selectedAuditId, setSelectedAuditId] = useState('')
  const [uploading, setUploading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false) // 🌟 Détection Admin

  const loadData = async () => {
    const [auditsRes, actionsRes, photosMap] = await Promise.all([
      supabase.from('gemba_audits').select('*').order('date', { ascending: false }),
      fetchActions(),
      fetchPhotosByAction()
    ])
    if (!auditsRes.error) setData(auditsRes.data || [])
    setActions(actionsRes || [])
    setPhotosByAction(photosMap || {})
    setLoading(false)
  }

  useEffect(() => {
    loadData()
    // 🌟 Vérification du rôle
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.email) {
        supabase.from('profiles').select('role').eq('email', data.user.email).single().then(({ data: profile }) => {
          if (profile && profile.role === 'admin') setIsAdmin(true)
        })
      }
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

  const getActionForRow = (row) => {
    if (!row) return null
    return actions.find(a => a.type === 'GEMBA' && a.audit_date === row.date && a.ligne === row.ligne && a.question === row.question)
  }

  const getDbPhotosForRow = (row) => {
    const action = getActionForRow(row)
    if (!action) return []
    return photosByAction[action.id] || []
  }

  const handlePhotoUpload = async (row, e) => {
    const files = Array.from(e.target.files)
    if (files.length === 0) return
    setUploading(true)
    let action = getActionForRow(row)
    let actionId = action?.id
    if (!actionId) {
      const newAction = { type: 'GEMBA', audit_date: row.date, ligne: row.ligne, point_m: row.point_m, question: row.question, action_texte: row.action !== '-' ? row.action : '', progression: 0 }
      const savedData = await upsertAction(newAction)
      if (savedData) { actionId = savedData.id; setActions(prev => [...prev, savedData]) }
      else { alert("Erreur création action."); setUploading(false); return }
    }
    const key = `${row.date}|${row.ligne}|${row.question}`
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

    const rows = selectedAudit.rows || []
    const okCount = rows.filter(r => r.reponse === 'OK').length
    const nokCount = rows.filter(r => r.reponse === 'NOK').length
    const naCount = rows.filter(r => r.reponse === 'N/A').length
    const totalQuestions = rows.length
    const uniqueAuditors = [...new Set(rows.map(r => r.auditeur).filter(Boolean))].join(', ')
    const globalOk = rows.filter(r => r.reponse === 'OK').length
    const globalTotal = rows.filter(r => r.reponse === 'OK' || r.reponse === 'NOK').length
    const globalScore = globalTotal > 0 ? Math.round((globalOk / globalTotal) * 100) : 0

    // --- PAGE 1 : COUVERTURE ---
    doc.setFillColor(...COLORS.primary)
    doc.rect(0, 0, pageWidth, pageHeight, 'F')
    
    const imgLogo = new Image()
    imgLogo.src = '/logo.png'
    try { doc.addImage(imgLogo, 'PNG', pageWidth / 2 - 25, 40, 50, 50) } catch (e) {}

    doc.setFontSize(32); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold')
    doc.text("RAPPORT D'AUDIT", pageWidth / 2, 110, { align: 'center' })
    doc.setFontSize(24); doc.setTextColor(...COLORS.accent)
    doc.text("GEMBA", pageWidth / 2, 122, { align: 'center' })

    doc.setDrawColor(...COLORS.accent); doc.setLineWidth(1)
    doc.line(pageWidth / 2 - 20, 130, pageWidth / 2 + 20, 130)

    doc.setFontSize(16); doc.setTextColor(200, 200, 200); doc.setFont('helvetica', 'normal')
    doc.text(`Ligne : ${selectedAudit.ligne}`, pageWidth / 2, 145, { align: 'center' })
    doc.text(`UAP : ${selectedAudit.uap}`, pageWidth / 2, 153, { align: 'center' })
    doc.setFontSize(14); doc.text(`Date : ${new Date(selectedAudit.date).toLocaleDateString('fr-FR')}`, pageWidth / 2, 170, { align: 'center' })

    doc.setFontSize(10); doc.setTextColor(150, 150, 150)
    doc.text(`Document généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, pageWidth / 2, pageHeight - 20, { align: 'center' })

    // --- PAGE 2 : SYNTHÈSE ---
    doc.addPage()
    doc.setFillColor(...COLORS.primary)
    doc.rect(0, 0, pageWidth, 25, 'F')
    doc.setFontSize(12); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold')
    doc.text("SYNTHÈSE DE L'AUDIT", margin, 16)
    doc.setFontSize(10); doc.setFont('helvetica', 'normal')
    doc.text(`Ligne ${selectedAudit.ligne} - ${new Date(selectedAudit.date).toLocaleDateString('fr-FR')}`, pageWidth - margin, 16, { align: 'right' })

    let currentY = 45
    const cardW = (contentWidth - 15) / 4
    const cardH = 30
    const drawCard = (x, label, value, color) => {
      doc.setFillColor(...COLORS.light); doc.setDrawColor(...COLORS.border); doc.roundedRect(x, currentY, cardW, cardH, 2, 2, 'FD')
      doc.setFillColor(...color); doc.roundedRect(x, currentY, 4, cardH, 2, 2, 'F')
      doc.setFontSize(9); doc.setTextColor(...COLORS.textMuted); doc.text(label, x + 10, currentY + 10)
      doc.setFontSize(20); doc.setTextColor(...color); doc.setFont('helvetica', 'bold'); doc.text(value.toString(), x + 10, currentY + 22)
      doc.setFont('helvetica', 'normal')
    }
    drawCard(margin, 'CONFORMES (OK)', okCount, COLORS.success)
    drawCard(margin + cardW + 5, 'NON-CONFORMES (NOK)', nokCount, COLORS.danger)
    drawCard(margin + (cardW + 5) * 2, 'NON APPLICABLES', naCount, COLORS.textMuted)
    drawCard(margin + (cardW + 5) * 3, 'TOTAL QUESTIONS', totalQuestions, COLORS.accent)

    currentY += cardH + 15
    doc.setFillColor(...COLORS.light); doc.setDrawColor(...COLORS.border); doc.roundedRect(margin, currentY, contentWidth, 25, 2, 2, 'FD')
    doc.setFontSize(11); doc.setTextColor(...COLORS.primary); doc.setFont('helvetica', 'bold')
    doc.text("SCORE GLOBAL DE L'AUDIT", margin + 10, currentY + 10)
    doc.setFontSize(22); doc.setTextColor(...(globalScore >= 85 ? COLORS.success : COLORS.danger))
    doc.text(`${globalScore} %`, margin + 10, currentY + 20)
    const barWidth = contentWidth - 80
    doc.setFillColor(...COLORS.border); doc.roundedRect(margin + 60, currentY + 12, barWidth, 6, 3, 3, 'F')
    doc.setFillColor(...(globalScore >= 85 ? COLORS.success : COLORS.danger)); doc.roundedRect(margin + 60, currentY + 12, (globalScore / 100) * barWidth, 6, 3, 3, 'F')
    doc.setFont('helvetica', 'normal')

    currentY += 40
    doc.setFillColor(...COLORS.light); doc.setDrawColor(...COLORS.border); doc.roundedRect(margin, currentY, contentWidth, 20, 2, 2, 'FD')
    doc.setFontSize(10); doc.setTextColor(...COLORS.textMuted)
    doc.text("Auditeurs :", margin + 10, currentY + 12)
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...COLORS.primary)
    doc.text(uniqueAuditors || '—', margin + 35, currentY + 12)
    doc.setFont('helvetica', 'normal')

    currentY += 35
    doc.setFontSize(12); doc.setTextColor(...COLORS.primary); doc.setFont('helvetica', 'bold')
    doc.text("PERFORMANCE PAR PILIER (5M)", margin, currentY)
    currentY += 8

    const mScores = {}
    rows.forEach(r => { const m = r.point_m; if (!mScores[m]) mScores[m] = { ok: 0, nok: 0 }; if (r.reponse === 'OK') mScores[m].ok++; if (r.reponse === 'NOK') mScores[m].nok++ })
    const pillars = Object.entries(mScores).map(([name, s]) => ({ name, ok: s.ok, nok: s.nok, score: (s.ok + s.nok) > 0 ? Math.round((s.ok / (s.ok + s.nok)) * 100) : 0 }))
    const pW = (contentWidth - 10) / 2; const pH = 20
    doc.setFont('helvetica', 'normal')
    pillars.forEach((p, i) => {
      const x = margin + (i % 2) * (pW + 10); const y = currentY + Math.floor(i / 2) * (pH + 8)
      doc.setFillColor(...COLORS.light); doc.setDrawColor(...COLORS.border); doc.roundedRect(x, y, pW, pH, 2, 2, 'FD')
      doc.setFontSize(9); doc.setTextColor(...COLORS.textMuted); doc.text(p.name, x + 5, y + 7)
      doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(...(p.score >= 85 ? COLORS.success : COLORS.danger))
      doc.text(`${p.score}%`, x + pW - 10, y + 14, { align: 'right' })
      doc.setFillColor(...COLORS.border); doc.roundedRect(x + 5, y + 12, pW - 30, 4, 2, 2, 'F')
      doc.setFillColor(...(p.score >= 85 ? COLORS.success : COLORS.danger)); doc.roundedRect(x + 5, y + 12, ((p.score / 100) * (pW - 30)), 4, 2, 2, 'F')
      doc.setFont('helvetica', 'normal')
    })

    // --- PAGE 3 : DÉTAIL ---
    doc.addPage()
    doc.setFillColor(...COLORS.primary); doc.rect(0, 0, pageWidth, 25, 'F')
    doc.setFontSize(12); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.text("DÉTAIL DE L'AUDIT", margin, 16)

    const tableData = rows.map((r, index) => {
      const dbPhotos = getDbPhotosForRow(r)
      return [index + 1, r.point_m, r.question, r.reponse, r.action !== '-' ? r.action : '', dbPhotos.length > 0 ? `${dbPhotos.length} photo(s)` : '—']
    })
    
    autoTable(doc, {
      startY: 35, head: [['N°', 'Point M', 'Question', 'Statut', 'Action Corrective', 'Preuves']], body: tableData, theme: 'plain',
      headStyles: { fillColor: COLORS.primary, textColor: 255, fontSize: 9, fontStyle: 'bold', cellPadding: 4 },
      styles: { fontSize: 8, cellPadding: 4, valign: 'middle', textColor: COLORS.primary, lineColor: COLORS.border, lineWidth: 0.1 },
      alternateRowStyles: { fillColor: COLORS.light },
      columnStyles: { 0: { cellWidth: 10, halign: 'center', fontStyle: 'bold' }, 1: { cellWidth: 25 }, 2: { cellWidth: 65, fontStyle: 'bold' }, 3: { cellWidth: 20, halign: 'center', fontStyle: 'bold' }, 4: { cellWidth: 40, textColor: COLORS.warning }, 5: { cellWidth: 20, halign: 'center' } },
      didParseCell: function (data) { if (data.section === 'body' && data.column.index === 3) { if (data.cell.raw === 'OK') data.cell.styles.textColor = COLORS.success; if (data.cell.raw === 'NOK') data.cell.styles.textColor = COLORS.danger } }
    })

    // --- PAGE 4 : NOK ---
    const nokQuestions = rows.map((r, index) => ({ ...r, index })).filter(r => r.reponse === 'NOK')
    if (nokQuestions.length > 0) {
      doc.addPage()
      doc.setFillColor(...COLORS.danger); doc.rect(0, 0, pageWidth, 25, 'F')
      doc.setFontSize(12); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.text("ANALYSE DES NON-CONFORMITÉS", margin, 16)
      let yPos = 35
      for (const q of nokQuestions) {
        const dbPhotos = getDbPhotosForRow(q)
        const dbPhotosBase64 = await Promise.all(dbPhotos.map(p => urlToBase64(p.url)))
        const validPhotos = dbPhotosBase64.filter(p => p !== null)
        const estimatedHeight = 30 + (validPhotos.length > 0 ? Math.ceil(validPhotos.length / 2) * 60 : 0)
        if (yPos + estimatedHeight > pageHeight - 25) { doc.addPage(); yPos = 25 }

        doc.setFillColor(...COLORS.light); doc.setDrawColor(...COLORS.border); doc.roundedRect(margin, yPos, contentWidth, 22, 2, 2, 'FD')
        doc.setFillColor(...COLORS.danger); doc.roundedRect(margin + 5, yPos + 5, 12, 5, 1, 1, 'F')
        doc.setFontSize(7); doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.text('NOK', margin + 11, yPos + 8.5, { align: 'center' })
        doc.setFontSize(9); doc.setTextColor(...COLORS.primary); doc.text(`Q${q.index + 1} - [${q.point_m}]`, margin + 22, yPos + 9)
        doc.setFont('helvetica', 'normal')
        const splitTitle = doc.splitTextToSize(q.question, contentWidth - 30)
        doc.text(splitTitle, margin + 22, yPos + 14)
        yPos += 25

        if (q.action && q.action !== '-') {
          doc.setFontSize(8); doc.setTextColor(...COLORS.warning); doc.setFont('helvetica', 'bold')
          doc.text("ACTION CORRECTIVE :", margin + 5, yPos)
          doc.setFont('helvetica', 'normal')
          const splitAction = doc.splitTextToSize(q.action, contentWidth - 45)
          doc.text(splitAction, margin + 40, yPos)
          yPos += splitAction.length * 4 + 5
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
        doc.setDrawColor(...COLORS.border); doc.setLineWidth(0.5); doc.line(margin, yPos, pageWidth - margin, yPos)
        yPos += 10
      }
    }

    const pageCount = doc.internal.getNumberOfPages()
    for (let i = 2; i <= pageCount; i++) {
      doc.setPage(i); doc.setDrawColor(...COLORS.border); doc.setLineWidth(0.5); doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15)
      doc.setFontSize(8); doc.setTextColor(...COLORS.textMuted)
      doc.text(`WKW Tunisie - Rapport d'Audit Gemba`, margin, pageHeight - 10)
      doc.text(`Page ${i} / ${pageCount}`, pageWidth - margin, pageHeight - 10, { align: 'right' })
    }
    doc.save(`Rapport_Gemba_${selectedAudit.ligne}_${selectedAudit.date}.pdf`)
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
            <select className="filter-control" value={selectedAuditId} onChange={e => setSelectedAuditId(e.target.value)}>
              <option value="">-- Choisir un audit --</option>
              {auditsGrouped.map(a => (<option key={a.id} value={a.id}>{new Date(a.date).toLocaleDateString('fr-FR')} — {a.ligne} ({a.uap})</option>))}
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
          <p className="muted" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>Les photos ajoutées ici sont directement enregistrées dans le Plan d'Action Gemba.</p>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr><th>Point M</th><th>Question</th><th>Statut</th><th>Action / Commentaire</th><th style={{ width: '300px' }}>Photos</th></tr>
              </thead>
              <tbody>
                {selectedAudit.rows.map((r, i) => {
                  const isNok = String(r.reponse).toUpperCase() === 'NOK'
                  const dbPhotos = getDbPhotosForRow(r)
                  return (
                    <tr key={i} style={{ background: isNok ? 'rgba(239, 68, 68, 0.05)' : 'transparent' }}>
                      <td style={{ color: 'var(--text-muted)' }}>{r.point_m}</td>
                      <td style={{ whiteSpace: 'normal', maxWidth: '300px' }}>{r.question}</td>
                      <td><span className={`badge ${r.reponse === 'OK' ? 'ok' : r.reponse === 'NOK' ? 'bad' : ''}`}>{r.reponse}</span></td>
                      <td style={{ whiteSpace: 'normal', maxWidth: '250px', color: 'var(--warning)' }}>{r.action}</td>
                      <td>
                        {isNok && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                              {dbPhotos.map((p, pIdx) => (
                                <div key={pIdx} style={{ position: 'relative' }}>
                                  <img src={p.url} alt={`Preuve ${pIdx + 1}`} style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--primary)' }} />
                                  {/* 🌟 Bouton supprimer uniquement pour l'admin */}
                                  {isAdmin && (
                                    <button onClick={() => handleRemovePhoto(p)} style={{ position: 'absolute', top: -5, right: -5, background: 'var(--danger)', color: 'white', border: 'none', borderRadius: '50%', width: '16px', height: '16px', cursor: 'pointer', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                                  )}
                                </div>
                              ))}
                            </div>
                            <label className="btn btn-secondary" style={{ cursor: uploading ? 'wait' : 'pointer', padding: '0.2rem 0.5rem', fontSize: '0.75rem', alignSelf: 'flex-start', opacity: uploading ? 0.5 : 1 }}>
                              📷 Ajouter au plan d'action
                              <input type="file" accept="image/*" multiple disabled={uploading} onChange={(e) => handlePhotoUpload(r, e)} style={{ display: 'none' }} />
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
