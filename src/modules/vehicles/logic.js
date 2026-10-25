// Módulo de Vehículos — lógica de negocio pura (no toca la interfaz ni Firestore).
// Recibe el "garaje" (state.vehicles) y devuelve cálculos. Nunca inventa datos: si falta
// información, lo dice (null / 'pendiente') en vez de suponer.
import { BASE_CATEGORIES, PLAN_STATUS, DOC_KINDS, ACTIONS } from './model'

const DAY = 864e5
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const pd = (k) => { const [y, m, d] = String(k).split('-').map(Number); return new Date(y, m - 1, d) }
export const daysTo = (k) => (k ? Math.round((pd(k) - pd(today())) / DAY) : null)
export function addMonths(k, n) { const d = pd(k); const day = d.getDate(); d.setMonth(d.getMonth() + n); if (d.getDate() < day) d.setDate(0); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
export const addDaysK = (k, n) => { const d = pd(k); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

// ---------- Formatos (Colombia) ----------
export const fmtKm = (n) => (n == null ? '—' : `${Math.round(n).toLocaleString('es-CO')} km`)
export const fmtMoney = (n, cur = 'COP') => (n == null || n === '' ? '—' : new Intl.NumberFormat('es-CO', { style: 'currency', currency: cur || 'COP', maximumFractionDigits: cur === 'COP' ? 0 : 2 }).format(n))
export const fmtDate = (k) => (k ? pd(k).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
export const actionLabel = (a) => ACTIONS.find((x) => x.id === a)?.label || a || ''

export function categories(g, type = null) {
  return [...BASE_CATEGORIES.filter((c) => !type || !c.types || c.types.includes(type)), ...(g.categories || [])]
}
export const catName = (g, id) => categories(g).find((c) => c.id === id)?.name || id || 'Otro'

const of = (list, vid) => (list || []).filter((x) => x.vehicleId === vid)
export const vehicleOf = (g, vid) => (g.vehicles || []).find((v) => v.id === vid) || null

// ---------- Odómetro ----------
// Lecturas en orden cronológico (fecha y luego hora de registro)
export function readings(g, vid) {
  return of(g.readings, vid).slice().sort((a, b) => (a.date === b.date ? (a.createdAt || 0) - (b.createdAt || 0) : a.date < b.date ? -1 : 1))
}
// Kilometraje actual: la última lectura conocida, también la de un mantenimiento o tanqueada con km.
export function kmPoints(g, vid) {
  const pts = readings(g, vid).map((r) => ({ date: r.date, km: r.km, at: r.createdAt || 0, src: 'lectura', id: r.id, correction: r.correction }))
  for (const s of of(g.services, vid)) if (s.km != null && s.status === 'realizado') pts.push({ date: s.date, km: s.km, at: s.updatedAt || 0, src: 'mantenimiento', id: s.id })
  for (const f of of(g.fuel, vid)) if (f.km != null) pts.push({ date: f.date, km: f.km, at: f.createdAt || 0, src: 'combustible', id: f.id })
  return pts.sort((a, b) => (a.date === b.date ? a.at - b.at : a.date < b.date ? -1 : 1))
}
export function currentKm(g, vid) {
  const pts = kmPoints(g, vid)
  if (!pts.length) return null
  // La última corrección justificada manda; si no, el máximo registrado
  const lastCorr = [...pts].reverse().find((p) => p.correction)
  const after = lastCorr ? pts.filter((p) => p.date > lastCorr.date || (p.date === lastCorr.date && p.at >= lastCorr.at)) : pts
  return after.reduce((m, p) => Math.max(m, p.km), -Infinity)
}
export function lastReading(g, vid) { const pts = kmPoints(g, vid); return pts[pts.length - 1] || null }
// Distancia entre lecturas consecutivas (solo si ambas son válidas y no hay corrección en medio)
export function readingsWithDistance(g, vid) {
  const rs = readings(g, vid)
  return rs.map((r, i) => {
    const prev = rs[i - 1]
    const dist = prev && !r.correction && r.km >= prev.km ? r.km - prev.km : null
    return { ...r, dist, days: prev ? Math.round((pd(r.date) - pd(prev.date)) / DAY) : null }
  }).reverse()
}
// ¿La lectura nueva es menor que la anterior en la línea de tiempo? (pide confirmación)
export function checkReading(g, vid, km, date) {
  const before = kmPoints(g, vid).filter((p) => p.date <= date && !p.correction)
  const prev = before.reduce((m, p) => (m == null || p.km > m.km ? p : m), null)
  if (prev && km < prev.km) return { lower: true, prev }
  return { lower: false, prev }
}

// ---------- Mantenimientos ----------
export function services(g, vid) {
  return of(g.services, vid).slice().sort((a, b) => ((b.date || '') < (a.date || '') ? -1 : (b.date || '') > (a.date || '') ? 1 : (b.createdAt || 0) - (a.createdAt || 0)))
}
export const serviceTotal = (s) => (s.costTotal != null && s.costTotal !== '' ? Number(s.costTotal) : (s.costParts != null && s.costParts !== '') || (s.costLabor != null && s.costLabor !== '') ? Number(s.costParts || 0) + Number(s.costLabor || 0) : null)
// Último trabajo REALIZADO de un componente (y acción, si se pide)
export function lastDone(g, vid, component, action = null) {
  return services(g, vid).find((s) => s.status === 'realizado' && (s.items || []).some((i) => i.component === component && (!action || i.action === action || (action === 'inspeccionar' && i.action !== 'otro')))) || null
}
export const lastService = (g, vid) => services(g, vid).find((s) => s.status === 'realizado') || null
export const pendingConfirm = (g, vid) => services(g, vid).filter((s) => s.status === 'por_confirmar')

// ---------- Plan de mantenimiento ----------
// Calcula la próxima revisión de un plan: lo que pusiste a mano manda; si no, sale del último
// trabajo realizado + el intervalo. Sin km del trabajo, NO se calcula por distancia.
export function planNext(g, p) {
  const last = lastDone(g, p.vehicleId, p.component, p.action)
  let nextKm = p.nextKm ?? null, nextDate = p.nextDate ?? null, why = []
  if (nextKm == null && p.intervalKm) {
    const cur = currentKm(g, p.vehicleId)
    if (last?.km != null) nextKm = last.km + Number(p.intervalKm)
    // El "primer servicio" (ej. a los 1.000 km) solo aplica si la moto aún no llega a ese km
    else if (!last && p.firstKm && cur != null && cur < Number(p.firstKm)) nextKm = Number(p.firstKm)
    else if (last) why.push('falta el km del último trabajo')
    else why.push('falta un primer registro con km')
  }
  if (nextDate == null && p.intervalMonths && last?.date) nextDate = addMonths(last.date, Number(p.intervalMonths))
  if (!last && !p.intervalKm && !p.nextDate) why.push('falta un primer registro')
  return { last, nextKm, nextDate, why }
}
export function planStatus(g, p) {
  const vid = p.vehicleId
  if (!p.active) return { ...planNext(g, p), status: 'inactivo' }
  const n = planNext(g, p)
  const km = currentKm(g, vid)
  const conf = pendingConfirm(g, vid).some((s) => (s.items || []).some((i) => i.component === p.component))
  if (conf) return { ...n, km, status: 'por_confirmar' }
  const leadKm = Number(p.leadKm ?? 300), leadDays = Number(p.leadDays ?? 15)
  const kmLeft = n.nextKm != null && km != null ? n.nextKm - km : null
  const dLeft = n.nextDate ? daysTo(n.nextDate) : null
  let status
  if ((kmLeft != null && kmLeft <= 0) || (dLeft != null && dLeft < 0)) status = 'vencido'
  else if ((kmLeft != null && kmLeft <= leadKm) || (dLeft != null && dLeft <= leadDays)) status = 'proximo'
  else if ((n.nextKm != null && km == null) || (n.nextKm == null && n.nextDate == null)) status = 'pendiente'
  else status = 'al_dia'
  return { ...n, km, kmLeft, dLeft, status }
}
export function plans(g, vid) {
  return of(g.plans, vid).map((p) => ({ p, ...planStatus(g, p) })).sort((a, b) => PLAN_STATUS[a.status].rank - PLAN_STATUS[b.status].rank)
}

// ---------- Documentos ----------
export function documents(g, vid, { all = false } = {}) {
  return of(g.documents, vid).filter((d) => all || d.status !== 'reemplazado').sort((a, b) => (a.expiresAt || '9999') < (b.expiresAt || '9999') ? -1 : 1)
}
export function docStatus(d) {
  if (!d.expiresAt && d.kind === 'tarjeta') return { status: 'vigente', label: 'No vence', badge: 'green' }
  if (!d.expiresAt) return { status: 'pendiente', label: 'Sin fecha de vencimiento', badge: 'yellow' }
  const n = daysTo(d.expiresAt), lead = Number(d.leadDays ?? DOC_KINDS.find((k) => k.id === d.kind)?.lead ?? 30)
  if (n < 0) return { status: 'vencido', label: `Venció hace ${-n} día${n === -1 ? '' : 's'}`, badge: 'red', n }
  if (n <= lead) return { status: 'proximo', label: n === 0 ? 'Vence hoy' : `Vence en ${n} día${n === 1 ? '' : 's'}`, badge: 'pink', n }
  return { status: 'vigente', label: `Vigente hasta ${fmtDate(d.expiresAt)}`, badge: 'green', n }
}
export const docOfKind = (g, vid, kind) => documents(g, vid).find((d) => d.kind === kind) || null
// Regla general verificada (RUNT, Ley 769 de 2002 y sus cambios): una moto nueva hace la primera
// revisión técnico-mecánica a los 2 años de la matrícula y luego cada año. Solo es una guía:
// la fecha real es la de tu certificado.
export function rtmHint(v) {
  if (!v?.registeredAt) return null
  const years = v.type === 'moto' ? 2 : v.type === 'carro' || v.type === 'camioneta' ? 5 : null
  if (!years) return null
  return { date: addMonths(v.registeredAt, years * 12), years, rule: v.type === 'moto' ? 'Motos nuevas: primera revisión a los 2 años de la matrícula y luego cada año (RUNT).' : 'Vehículos particulares nuevos: primera revisión a los 5 años de la matrícula y luego cada año (RUNT). Confírmalo para tu caso.' }
}

// ---------- Gastos y combustible ----------
export function expenses(g, vid) { return of(g.expenses, vid).slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.createdAt || 0) - (a.createdAt || 0))) }
export function spend(g, vid, { from = null, to = null } = {}) {
  const ex = expenses(g, vid).filter((e) => e.amount != null && (!from || e.date >= from) && (!to || e.date <= to) && (e.currency || 'COP') === 'COP')
  const total = ex.reduce((a, e) => a + Number(e.amount), 0)
  const byCat = {}
  for (const e of ex) byCat[e.category] = (byCat[e.category] || 0) + Number(e.amount)
  return { total, n: ex.length, byCat }
}
export function monthly(g, vid, months = 6) {
  const out = []
  const d = new Date(); d.setDate(1)
  for (let i = months - 1; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1)
    const k = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`
    const s = spend(g, vid, { from: `${k}-01`, to: `${k}-31` })
    out.push({ k, label: x.toLocaleDateString('es-CO', { month: 'short' }), total: s.total, n: s.n })
  }
  return out
}
// Consumo: solo entre tanqueadas "a tanque lleno" con km. Se suma lo que echaste desde el
// lleno anterior (sin contar ese) y se divide la distancia. Unidad: km por litro o por galón.
export function fuelEconomy(g, vid) {
  const fs = of(g.fuel, vid).filter((f) => f.km != null && f.qty > 0).sort((a, b) => (a.km - b.km))
  const res = []
  for (let i = 0; i < fs.length; i++) {
    if (!fs[i].full) continue
    const prevIdx = fs.slice(0, i).map((f, j) => (f.full ? j : -1)).filter((j) => j >= 0).pop()
    if (prevIdx == null) continue
    const segment = fs.slice(prevIdx + 1, i + 1)
    if (segment.some((f) => f.unit !== fs[i].unit)) continue
    const qty = segment.reduce((a, f) => a + Number(f.qty), 0)
    const dist = fs[i].km - fs[prevIdx].km
    if (dist > 0 && qty > 0) res.push({ to: fs[i], dist, qty, unit: fs[i].unit, value: dist / qty })
  }
  if (!res.length) return null
  const unit = res[res.length - 1].unit
  const same = res.filter((r) => r.unit === unit)
  const avg = same.reduce((a, r) => a + r.dist, 0) / same.reduce((a, r) => a + r.qty, 0)
  return { segments: res, avg, unit, last: res[res.length - 1] }
}

// ---------- Alertas del vehículo (solo las reales; lo que falta va aparte) ----------
export function alerts(g, vid) {
  const out = [], missing = [], pend = []
  for (const x of plans(g, vid)) {
    const name = `${catName(g, x.p.component)} · ${actionLabel(x.p.action).toLowerCase()}`
    if (x.status === 'vencido') out.push({ level: 'red', kind: 'plan', id: x.p.id, text: `${name}: vencido${x.kmLeft != null && x.kmLeft <= 0 ? ` hace ${fmtKm(-x.kmLeft)}` : x.dLeft != null && x.dLeft < 0 ? ` desde ${fmtDate(x.nextDate)}` : ''}` })
    else if (x.status === 'proximo') out.push({ level: 'pink', kind: 'plan', id: x.p.id, text: `${name}: ${x.kmLeft != null && x.kmLeft <= Number(x.p.leadKm ?? 300) ? `en ${fmtKm(x.kmLeft)}` : `el ${fmtDate(x.nextDate)}`}` })
    else if (x.status === 'pendiente') pend.push(name)
  }
  if (pend.length === 1) missing.push({ kind: 'plan', text: `${pend[0]}: falta un registro de referencia` })
  else if (pend.length) missing.push({ kind: 'plan', text: `${pend.length} mantenimientos del plan esperan una referencia (el km actual y cuándo se hizo por última vez)` })
  for (const s of pendingConfirm(g, vid)) out.push({ level: 'yellow', kind: 'service', id: s.id, text: `Por confirmar: ${s.description || 'trabajo en el taller'}${s.expectedNote ? ` (${s.expectedNote.replace(/^Entrega estimada: /, 'entrega estimada ')})` : ''}` })
  for (const d of documents(g, vid)) { const st = docStatus(d); if (st.status === 'vencido' || st.status === 'proximo') out.push({ level: st.status === 'vencido' ? 'red' : 'pink', kind: 'doc', id: d.id, text: `${d.name || DOC_KINDS.find((k) => k.id === d.kind)?.short || DOC_KINDS.find((k) => k.id === d.kind)?.label}: ${st.label.toLowerCase()}` }) }
  const v = vehicleOf(g, vid)
  if (currentKm(g, vid) == null) missing.unshift({ kind: 'km', text: 'Kilometraje pendiente de registrar' })
  for (const k of ['soat', 'rtm']) if (!docOfKind(g, vid, k) && !(k === 'rtm' && v?.type === 'otro')) missing.push({ kind: 'doc', docKind: k, text: `${k === 'soat' ? 'SOAT' : 'Tecnomecánica'}: sin registrar` })
  for (const s of services(g, vid)) if (s.status === 'realizado' && s.km != null && kmConflict(g, vid, s.date, s.km, s.id)) missing.unshift({ kind: 'service', id: s.id, text: `Revisa el km de "${s.description || catName(g, s.items?.[0]?.component)}" (${fmtKm(s.km)}): no cuadra con los demás registros` })
  for (const s of services(g, vid)) if (s.status === 'realizado' && s.km == null) { missing.push({ kind: 'service', id: s.id, text: `Sin km: ${s.description || catName(g, s.items?.[0]?.component)} (${fmtDate(s.date)})` }) }
  const rank = { red: 0, yellow: 1, pink: 2 }
  return { alerts: out.sort((a, b) => rank[a.level] - rank[b.level]), missing }
}

// ---------- Exportación (para migrar a una app propia) ----------
const LISTS = ['readings', 'services', 'plans', 'documents', 'expenses', 'fuel', 'files']
export function exportVehicle(g, vid) {
  const v = vehicleOf(g, vid); if (!v) return null
  const shopIds = new Set(of(g.services, vid).map((s) => s.shopId).filter(Boolean))
  return { format: 'mumu.vehicles', schema: g.schema || 1, exportedAt: new Date().toISOString(), vehicle: v, ...Object.fromEntries(LISTS.map((k) => [k, of(g[k], vid)])), shops: (g.shops || []).filter((s) => shopIds.has(s.id)), categories: g.categories || [] }
}

// Fotos del vehículo (la primera es la portada)
export const photosOf = (v) => (v?.photoIds?.length ? v.photoIds : v?.photoFileId ? [v.photoFileId] : [])

// ¿El km de un trabajo choca con otros registros? (el odómetro no baja)
export function kmConflict(g, vid, date, km, ignoreId = null) {
  if (km == null || km === '' || !date) return null
  const pts = kmPoints(g, vid).filter((p) => p.id !== ignoreId && !p.correction)
  const before = pts.filter((p) => p.date <= date && p.km > Number(km)).sort((a, b) => b.km - a.km)[0]
  if (before) return `El ${fmtDate(before.date)} ya tenía ${fmtKm(before.km)}, y ${fmtKm(Number(km))} es menos.`
  const after = pts.filter((p) => p.date >= date && p.km < Number(km)).sort((a, b) => a.km - b.km)[0]
  if (after) return `El ${fmtDate(after.date)} tenía ${fmtKm(after.km)}, y ${fmtKm(Number(km))} es más (sería antes de esa fecha).`
  // Saltos imposibles: más de 1.500 km por día entre este registro y el más cercano
  const days = (a, b) => Math.abs(Math.round((new Date(a) - new Date(b)) / 864e5)) + 1
  for (const p of pts) { const d = days(p.date, date), diff = Math.abs(p.km - Number(km)); if (diff / d > 1500) return `${fmtKm(Number(km))} el ${fmtDate(date)} y ${fmtKm(p.km)} el ${fmtDate(p.date)} serían ${fmtKm(diff)} en ${d} día${d === 1 ? '' : 's'}. ¿Le falta un número?` }
  return null
}
