// 🌟 REGROUPEMENT GEMBA (date + ligne)
export const getGembaGroupedData = (audits) => {
  const groups = {}
  audits.forEach(row => {
    const date = String(row.date).substring(0, 10)
    const ligne = row.ligne?.trim()
    if (!date || !ligne) return
    
    const isManual = row.is_manual
    const auditKey = isManual ? `manual|${row.date}|${row.ligne}|${Math.random()}` : `${date}|${ligne}`
    
    if (!groups[auditKey]) {
      groups[auditKey] = { date, ligne, uap: (row.uap || '').trim(), isManual, manualScore: isManual ? Math.round(Number(row.score_pct)) : 0, ok: 0, total: 0 }
    }
    
    if (!isManual) {
      const rep = String(row.reponse).toUpperCase()
      if (rep !== 'N/A') { groups[auditKey].total++; if (rep === 'OK') groups[auditKey].ok++ }
    }
  })
  
  return Object.values(groups).map(g => ({ 
    ...g, 
    score: g.isManual ? g.manualScore : (g.total > 0 ? Math.round((g.ok / g.total) * 100) : 0) 
  }))
}

// 🌟 REGROUPEMENT 5S (date + zone)
export const get5SGroupedData = (audits) => {
  const groups = {}
  audits.forEach(row => {
    const date = String(row.date).substring(0, 10)
    const zone = (row.zone || row.ligne)?.trim()
    if (!date || !zone) return
    
    const key = `${date}|${zone}`
    if (!groups[key]) {
      groups[key] = { date, zone, uap: row.uap, ok: 0, total: 0, score_pct: row.score_pct }
    }
    
    let checkpoints = row.checkpoints
    if (typeof checkpoints === 'string') {
      try { checkpoints = JSON.parse(checkpoints) } catch (e) { return }
    }
    if (Array.isArray(checkpoints)) {
      checkpoints.forEach(cp => {
        const s = String(cp.s || '').toUpperCase()
        if (s !== 'N/A') { groups[key].total++; if (s === 'OK') groups[key].ok++ }
      })
    } else if (row.score_pct !== undefined) {
      groups[key].total += 100
      groups[key].ok += Number(row.score_pct)
    }
  })
  
  return Object.values(groups).map(g => ({ 
    ...g, 
    computedScore: g.total > 0 ? Math.round((g.ok / g.total) * 100) : (Number(g.score_pct) || 0),
    zoneOrLigne: g.zone
  }))
}

// 🌟 CALCUL MOYENNES GEMBA
export const calculerMoyennesUAPGemba = (groupedAudits) => {
  const lineGroups = {}
  groupedAudits.forEach(row => {
    const ligne = row.ligne?.trim()
    if (!ligne) return
    if (!lineGroups[ligne]) {
      let uapName = 'UAP 2'
      const uapClean = String(row.uap || '').toUpperCase().replace(/\s+/g, '')
      if (uapClean.includes('UAP1')) uapName = 'UAP 1'
      else if (uapClean.includes('LOG')) uapName = 'Logistique'
      lineGroups[ligne] = { uapName, scores: [] }
    }
    lineGroups[ligne].scores.push(row.score)
  })

  const uaps = { 'UAP 1': [], 'UAP 2': [], 'Logistique': [] }
  Object.values(lineGroups).forEach(group => {
    if (group.scores.length === 0) return
    const avg = Math.round(group.scores.reduce((a,b)=>a+b, 0) / group.scores.length)
    if (uaps[group.uapName]) uaps[group.uapName].push(avg)
  })

  const calcAvg = (arr) => arr.length === 0 ? null : Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
  const val1 = calcAvg(uaps['UAP 1']), val2 = calcAvg(uaps['UAP 2']), val3 = calcAvg(uaps['Logistique'])
  const activeUaps = [val1, val2, val3].filter(v => v !== null)
  
  return { 
    uap1: val1, uap2: val2, logistique: val3, 
    usine: activeUaps.length > 0 ? Math.round(activeUaps.reduce((a, b) => a + b, 0) / activeUaps.length) : null 
  }
}

// 🌟 CALCUL MOYENNES 5S
export const calculerMoyennesUAP5S = (groupedAudits) => {
  const getUap5S = (zone) => {
    if (!zone) return 'UAP 2'
    const clean = String(zone).trim().toUpperCase().replace(/\s+/g, '')
    if (clean.includes('MAGASIN') || clean.includes('STOCKAGE') || clean === 'LOGISTIQUE') return 'Logistique'
    if (clean === 'UAP1' || clean === 'UAP 1') return 'UAP 1'
    if (clean === 'UAP2' || clean === 'UAP 2') return 'UAP 2'
    const uap1List = ['F01', 'F02', 'F83', 'F99', 'F86', 'F85', 'L77', 'L76']
    if (uap1List.includes(clean)) return 'UAP 1'
    return 'UAP 2'
  }

  const lineGroups = {}
  groupedAudits.forEach(row => {
    const zone = row.zoneOrLigne?.trim()
    if (!zone) return
    if (!lineGroups[zone]) {
      const uapName = getUap5S(row.uap || zone)
      lineGroups[zone] = { uapName, scores: [] }
    }
    lineGroups[zone].scores.push(row.computedScore)
  })

  const uaps = { 'UAP 1': [], 'UAP 2': [], 'Logistique': [] }
  Object.values(lineGroups).forEach(group => {
    if (group.scores.length === 0) return
    const avg = Math.round(group.scores.reduce((a,b)=>a+b, 0) / group.scores.length)
    if (uaps[group.uapName]) uaps[group.uapName].push(avg)
  })

  const calcAvg = (arr) => arr.length === 0 ? null : Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
  const val1 = calcAvg(uaps['UAP 1']), val2 = calcAvg(uaps['UAP 2']), val3 = calcAvg(uaps['Logistique'])
  const activeUaps = [val1, val2, val3].filter(v => v !== null)
  
  return { 
    uap1: val1, uap2: val2, logistique: val3, 
    usine: activeUaps.length > 0 ? Math.round(activeUaps.reduce((a, b) => a + b, 0) / activeUaps.length) : null 
  }
}
