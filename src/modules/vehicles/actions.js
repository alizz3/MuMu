// Módulo de Vehículos — operaciones de datos (crear, editar, validar) sobre state.vehicles.
// Es la única puerta de escritura del módulo: la interfaz y la vaquita usan estas funciones.
import { state } from '../../store'
import { addTask, removeTasks } from '../../store/actions'
import { emptyGarage, minaviSeed, MINAVI_ID, NAVI_MANUAL_PLANS, NAVI_SPECS, HONDA_NAVI_MANUAL, DOC_KINDS, SCHEMA } from './model'
import * as L from './logic'

const rid = (p) => `${p}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`
const now = () => Date.now()
const num = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v))
const isDay = (k) => /^\d{4}-\d{2}-\d{2}$/.test(k || '')
const clean = (s, max = 2000) => String(s ?? '').trim().slice(0, max)
export class VError extends Error {}
// Acepta el enlace de Drive o el id y guarda solo el id
export const driveId = (s) => (String(s || '').match(/(?:folders|file\/d)\/([\w-]{10,100})/) || String(s || '').match(/[?&]id=([\w-]{10,100})/) || [])[1] || (/^[\w-]{20,100}$/.test(String(s || '').trim()) ? String(s).trim() : null)

export function garage() {
  if (!state.vehicles || typeof state.vehicles !== 'object' || Array.isArray(state.vehicles)) state.vehicles = emptyGarage()
  const g = state.vehicles
  for (const [k, v] of Object.entries(emptyGarage())) if (g[k] == null) g[k] = v
  return g
}
const touch = (x) => { x.updatedAt = now(); return x }
function upsert(list, data, prefix) {
  const g = garage()
  if (data.id) { const cur = g[list].find((x) => x.id === data.id); if (cur) { Object.assign(cur, data); return touch(cur) } }
  const x = { ...data, id: data.id || rid(prefix), createdAt: now(), updatedAt: now() }
  g[list].push(x)
  return x
}

// ---------- Vehículos ----------
export function saveVehicle(d) {
  const name = clean(d.name, 60); if (!name) throw new VError('Ponle un nombre al vehículo')
  const year = num(d.year)
  if (year != null && (year < 1950 || year > new Date().getFullYear() + 1)) throw new VError('Revisa el año del modelo')
  if (d.registeredAt && !isDay(d.registeredAt)) throw new VError('Fecha de matrícula inválida')
  return upsert('vehicles', { id: d.id, type: d.type || 'moto', name, make: clean(d.make, 60), model: clean(d.model, 60), year, plate: clean(d.plate, 12).toUpperCase(), registeredAt: d.registeredAt || null, color: clean(d.color, 30), fuelType: clean(d.fuelType, 40), distanceUnit: 'km', specs: d.specs || {}, notes: clean(d.notes), ...(() => { const ids = [...new Set((d.photoIds?.length ? d.photoIds : d.photoFileId ? [d.photoFileId] : []).filter(Boolean))].slice(0, 12); return { photoIds: ids, photoFileId: ids[0] || null } })(), driveFolder: driveId(d.driveFolder), archived: !!d.archived, owner: d.owner || null }, 'veh')
}
// Lo que usa el vehículo (aceite, bujía, llantas…): con referencia, cantidad y foto, para pedirlo igual
export function saveConsumable(d) {
  const v = L.vehicleOf(garage(), d.vehicleId); if (!v) throw new VError('Elige el vehículo')
  const label = clean(d.label, 60); if (!label) throw new VError('¿Qué es? (ej. Aceite del motor)')
  const list = v.consumables || (v.consumables = [])
  const data = { label, brand: clean(d.brand, 160), ref: clean(d.ref, 80), qty: clean(d.qty, 60), notes: clean(d.notes, 300), photoId: d.photoId || null, updatedAt: now() }
  const cur = d.id && list.find((x) => x.id === d.id)
  if (cur) Object.assign(cur, data); else list.push({ id: rid('cs'), ...data })
  touch(v); return cur || list[list.length - 1]
}
export function deleteConsumable(id) { for (const v of garage().vehicles) if (v.consumables?.some((x) => x.id === id)) { v.consumables = v.consumables.filter((x) => x.id !== id); touch(v) } }
export function archiveVehicle(id, archived = true) { const v = L.vehicleOf(garage(), id); if (v) { v.archived = archived; touch(v) } }

// ---------- Odómetro ----------
// Si la lectura es menor que la anterior, devuelve { needsConfirm } y no guarda hasta que
// la confirmes como corrección justificada (cambio de tablero, error anterior…).
export function addReading({ vehicleId, date, km, note = '', reason = '', correction = false, correctionNote = '', id = null }) {
  const g = garage()
  const k = num(km)
  if (k == null || k < 0 || k > 2e6) throw new VError('Escribe un kilometraje válido')
  if (!isDay(date)) throw new VError('Fecha inválida')
  if (date > L.today()) throw new VError('La fecha no puede ser en el futuro')
  const chk = L.checkReading({ ...g, readings: g.readings.filter((r) => r.id !== id) }, vehicleId, k, date)
  if (chk.lower && !correction) return { needsConfirm: true, prev: chk.prev }
  if (correction && !clean(correctionNote)) throw new VError('Cuéntame por qué se corrige (ej. cambio de tablero)')
  const r = upsert('readings', { id, vehicleId, date, km: Math.round(k), note: clean(note, 300), reason: clean(reason, 60), correction: !!correction, correctionNote: clean(correctionNote, 300) }, 'odo')
  return { ok: true, reading: r }
}
export function deleteReading(id) { const g = garage(); g.readings = g.readings.filter((r) => r.id !== id) }

// ---------- Talleres ----------
export function saveShop(d) {
  const name = clean(d.name, 80); if (!name) throw new VError('Ponle nombre al taller')
  const phone = clean(d.phone, 30)
  if (phone && !/^[+\d\s()-]{7,}$/.test(phone)) throw new VError('Revisa el teléfono')
  const blocked = !!d.blocked
  if (blocked && !clean(d.blockedReason, 300)) throw new VError('Escribe por qué no volverías (te lo recordará después)')
  return upsert('shops', { id: d.id, name, role: clean(d.role, 40) || 'Otro', mechanic: clean(d.mechanic, 80), address: clean(d.address, 200), mapsUrl: /^https?:\/\//.test(d.mapsUrl || '') ? clean(d.mapsUrl, 500) : '', phone, notes: clean(d.notes, 500),
    blocked, blockedReason: blocked ? clean(d.blockedReason, 300) : '', blockedAt: blocked ? (d.blockedAt || L.today()) : null }, 'shop')
}
export function unblockShop(id) { const s = garage().shops.find((x) => x.id === id); if (s) { s.blocked = false; s.blockedReason = ''; s.blockedAt = null; touch(s) } }
export function deleteShop(id) { const g = garage(); g.shops = g.shops.filter((s) => s.id !== id); g.services.forEach((s) => { if (s.shopId === id) s.shopId = null }) }

// ---------- Mantenimientos ----------
export function saveService(d) {
  const g = garage()
  if (!d.vehicleId || !L.vehicleOf(g, d.vehicleId)) throw new VError('Elige el vehículo')
  if (!['realizado', 'programado', 'por_confirmar'].includes(d.status)) throw new VError('Estado inválido')
  if (d.date && !isDay(d.date)) throw new VError('Fecha inválida')
  if (d.status === 'realizado' && !d.date) throw new VError('¿Qué día se hizo?')
  if (d.status === 'realizado' && d.date > L.today()) throw new VError('Un trabajo realizado no puede tener fecha futura')
  const items = (d.items || []).filter((i) => i.component).map((i) => ({ id: i.id || rid('it'), component: i.component, action: i.action || 'otro', detail: clean(i.detail, 200) }))
  if (!items.length) throw new VError('Agrega al menos un trabajo')
  const km = num(d.km)
  if (km != null && (km < 0 || km > 2e6)) throw new VError('Kilometraje inválido')
  for (const k of ['costParts', 'costLabor', 'costTotal']) if (num(d[k]) != null && num(d[k]) < 0) throw new VError('Los costos no pueden ser negativos')
  const s = upsert('services', {
    id: d.id, vehicleId: d.vehicleId, status: d.status, date: d.date || null, intakeDate: d.intakeDate || null, km: km == null ? null : Math.round(km), items,
    description: clean(d.description, 300), parts: clean(d.parts, 1000), shopId: d.shopId || null, mechanic: clean(d.mechanic, 80),
    costParts: num(d.costParts), costLabor: num(d.costLabor), costTotal: num(d.costTotal), currency: 'COP', notes: clean(d.notes), followUp: clean(d.followUp, 500),
    fileIds: d.fileIds || [], nextKm: num(d.nextKm), nextDate: isDay(d.nextDate) ? d.nextDate : null, expectedDate: isDay(d.expectedDate) ? d.expectedDate : null, expectedNote: clean(d.expectedNote, 200),
  }, 'svc')
  // Si pusiste "próxima revisión" en el trabajo, se guarda en el plan de cada componente
  if (s.status === 'realizado' && (s.nextKm != null || s.nextDate)) for (const it of s.items) {
    const p = g.plans.find((x) => x.vehicleId === s.vehicleId && x.component === it.component && (x.action === it.action || !x.action))
    if (p) Object.assign(p, { nextKm: s.nextKm ?? p.nextKm, nextDate: s.nextDate ?? p.nextDate, active: true, updatedAt: now() })
    else upsert('plans', { vehicleId: s.vehicleId, component: it.component, action: it.action, nextKm: s.nextKm, nextDate: s.nextDate, source: 'usuario', verification: 'usuario', active: true, autoTask: true, notes: 'Creado desde el registro del trabajo' }, 'plan')
  } else if (s.status === 'realizado') {
    // Trabajo nuevo: los planes con fecha/km puestos a mano para ese componente vuelven a calcularse con el intervalo
    for (const it of s.items) for (const p of g.plans.filter((x) => x.vehicleId === s.vehicleId && x.component === it.component && (x.intervalKm || x.intervalMonths))) { p.nextKm = null; p.nextDate = null; touch(p) }
  }
  syncServiceExpense(s)
  return s
}
// Confirmar entrega del taller: fecha real, qué se hizo de verdad, km y costos
export function confirmService(id, { date, doneIds = [], km = null, costTotal = null, shopId = null, notes = '' }) {
  const g = garage(); const s = g.services.find((x) => x.id === id); if (!s) throw new VError('Ese registro ya no existe')
  if (!isDay(date)) throw new VError('¿Qué día te la entregaron?')
  if (!doneIds.length) throw new VError('Marca al menos un trabajo realizado (o borra el registro si no se hizo nada)')
  const notDone = s.items.filter((i) => !doneIds.includes(i.id))
  const done = s.items.filter((i) => doneIds.includes(i.id))
  const desc = /^Entr[oó] al taller/i.test(s.description || '') ? done.map((i) => (i.detail || L.catName(g, i.component)).replace(/\s*\(previst[oa]\)/, '')).join(' y ') : s.description
  return saveService({ ...s, description: desc.charAt(0).toUpperCase() + desc.slice(1), status: 'realizado', date, intakeDate: s.intakeDate || s.date, km, costTotal: costTotal ?? s.costTotal, shopId: shopId || s.shopId,
    items: s.items.filter((i) => doneIds.includes(i.id)).map((i) => ({ ...i, detail: (i.detail || '').replace(/\s*\(previst[oa]\)/, '') })),
    notes: [s.notes && !/^Falta confirmar/.test(s.notes) ? s.notes : '', notDone.length ? `No se hizo: ${notDone.map((i) => i.detail || L.catName(g, i.component)).join(', ')}` : '', clean(notes)].filter(Boolean).join('\n'), expectedNote: '', expectedDate: null })
}
export function deleteService(id) {
  const g = garage()
  g.services = g.services.filter((s) => s.id !== id)
  g.expenses = g.expenses.filter((e) => !(e.serviceId === id && e.auto))
  g.expenses.forEach((e) => { if (e.serviceId === id) e.serviceId = null })
}
// Un trabajo con costo genera (o actualiza) su gasto, sin duplicarlo
function syncServiceExpense(s) {
  const g = garage()
  const total = L.serviceTotal(s)
  let e = g.expenses.find((x) => x.serviceId === s.id && x.auto)
  if (total == null || s.status !== 'realizado') { if (e) g.expenses = g.expenses.filter((x) => x !== e); return }
  const cat = s.items.some((i) => i.action === 'reparar' || i.component === 'reparacion') ? 'reparaciones' : 'mantenimiento'
  const data = { vehicleId: s.vehicleId, date: s.date, amount: total, currency: 'COP', category: cat, description: s.description || s.items.map((i) => L.catName(g, i.component)).join(', '), km: s.km, serviceId: s.id, auto: true }
  if (e) Object.assign(e, data, { updatedAt: now() }); else upsert('expenses', data, 'exp')
}

// ---------- Plan de mantenimiento ----------
export function savePlan(d) {
  if (!d.component) throw new VError('Elige el componente')
  const intervalKm = num(d.intervalKm), intervalMonths = num(d.intervalMonths), nextKm = num(d.nextKm)
  if ([intervalKm, intervalMonths, nextKm, num(d.leadKm), num(d.leadDays)].some((x) => x != null && x < 0)) throw new VError('Los valores no pueden ser negativos')
  if (!intervalKm && !intervalMonths && nextKm == null && !d.nextDate) throw new VError('Pon un intervalo (km o meses) o una próxima fecha/km')
  return upsert('plans', { id: d.id, vehicleId: d.vehicleId, component: d.component, action: d.action || 'inspeccionar', intervalKm, intervalMonths, firstKm: num(d.firstKm), nextKm, nextDate: isDay(d.nextDate) ? d.nextDate : null, leadKm: num(d.leadKm) ?? 300, leadDays: num(d.leadDays) ?? 15, source: d.source || 'usuario', sourceRef: clean(d.sourceRef, 500), page: clean(d.page, 60), verification: d.verification || 'usuario', notes: clean(d.notes), active: d.active !== false, autoTask: d.autoTask !== false, key: d.key }, 'plan')
}
export function setPlanActive(id, active, verification = null) { const p = garage().plans.find((x) => x.id === id); if (p) { p.active = active; if (verification) p.verification = verification; touch(p) } }
export function deletePlan(id) { const g = garage(); g.plans = g.plans.filter((p) => p.id !== id) }

// ---------- Documentos ----------
export function saveDocument(d) {
  if (!d.kind) throw new VError('Elige el tipo de documento')
  if (d.expiresAt && !isDay(d.expiresAt)) throw new VError('Fecha de vencimiento inválida')
  if (d.issuedAt && !isDay(d.issuedAt)) throw new VError('Fecha de expedición inválida')
  if (d.issuedAt && d.expiresAt && d.expiresAt < d.issuedAt) throw new VError('El vencimiento no puede ser antes de la expedición')
  const kind = DOC_KINDS.find((k) => k.id === d.kind)
  const n = upsert('documents', { id: d.id, vehicleId: d.vehicleId, kind: d.kind, name: clean(d.name, 80) || (kind?.short || kind?.label), issuedAt: d.issuedAt || null, expiresAt: d.expiresAt || null, number: clean(d.number, 60), issuer: clean(d.issuer, 80), notes: clean(d.notes), fileIds: d.fileIds || [], driveFileId: driveId(d.driveFileId), leadDays: num(d.leadDays) ?? kind?.lead ?? 30, status: d.status || 'vigente', renewedFrom: d.renewedFrom || null, cost: num(d.cost) }, 'doc')
  syncDocExpense(n)
  return n
}
// El valor pagado de un documento queda como gasto (uno solo por documento). La fecha nunca queda en el futuro.
function syncDocExpense(doc) {
  const g = garage(); const e = g.expenses.find((x) => x.docId === doc.id && x.auto)
  if (doc.cost == null || doc.cost <= 0) { if (e) g.expenses = g.expenses.filter((x) => x !== e); return }
  const t = L.today(), date = doc.issuedAt && doc.issuedAt <= t ? doc.issuedAt : t
  const data = { vehicleId: doc.vehicleId, date, amount: doc.cost, currency: 'COP', category: 'documentos', description: doc.renewedFrom ? `${doc.name} (renovación)` : doc.name, docId: doc.id, auto: true }
  if (e) Object.assign(e, data, { updatedAt: now() }); else upsert('expenses', data, 'exp')
}
// Renovar: el anterior queda en el historial (reemplazado) y nace el nuevo periodo
export function renewDocument(oldId, d) {
  const g = garage(); const old = g.documents.find((x) => x.id === oldId); if (!old) throw new VError('Ese documento ya no existe')
  const n = saveDocument({ ...d, id: null, kind: old.kind, vehicleId: old.vehicleId, renewedFrom: old.id, status: 'vigente' })
  old.status = 'reemplazado'; old.replacedBy = n.id; touch(old)
  return n
}
export function deleteDocument(id) { const g = garage(); g.documents = g.documents.filter((d) => d.id !== id); g.expenses = g.expenses.filter((e) => !(e.auto && e.docId === id)); g.documents.forEach((d) => { if (d.replacedBy === id) { d.replacedBy = null; d.status = 'vigente' } }) }

// ---------- Gastos y combustible ----------
export function saveExpense(d) {
  const amount = num(d.amount)
  if (amount == null || amount <= 0) throw new VError('Escribe el valor')
  if (!isDay(d.date)) throw new VError('Fecha inválida')
  if (d.date > L.today()) throw new VError('La fecha no puede ser en el futuro')
  return upsert('expenses', { id: d.id, vehicleId: d.vehicleId, date: d.date, amount, currency: d.currency || 'COP', category: d.category || 'otros', description: clean(d.description, 200), km: num(d.km), serviceId: d.serviceId || null, fuelId: d.fuelId || null, fileIds: d.fileIds || [], auto: !!d.auto }, 'exp')
}
export function deleteExpense(id) { const g = garage(); const e = g.expenses.find((x) => x.id === id); g.expenses = g.expenses.filter((x) => x.id !== id); if (e?.fuelId) g.fuel = g.fuel.filter((f) => f.id !== e.fuelId) }
export function saveFuel(d) {
  const g = garage()
  if (!isDay(d.date)) throw new VError('Fecha inválida')
  if (d.date > L.today()) throw new VError('La fecha no puede ser en el futuro')
  const qty = num(d.qty), amount = num(d.amount), km = num(d.km)
  if (qty != null && qty <= 0) throw new VError('La cantidad debe ser mayor que cero')
  if (amount != null && amount <= 0) throw new VError('El valor debe ser mayor que cero')
  if (qty == null && amount == null) throw new VError('Pon al menos la cantidad o el valor')
  if (km != null) { const chk = L.checkReading(g, d.vehicleId, km, d.date); if (chk.lower && !d.forceKm) return { needsConfirm: true, prev: chk.prev } }
  const f = upsert('fuel', { id: d.id, vehicleId: d.vehicleId, date: d.date, km, qty, unit: d.unit === 'gal' ? 'gal' : 'L', amount, fuelType: clean(d.fuelType, 40), station: clean(d.station, 80), notes: clean(d.notes, 300), full: !!d.full }, 'fuel')
  let e = g.expenses.find((x) => x.fuelId === f.id)
  if (amount == null) { if (e) g.expenses = g.expenses.filter((x) => x !== e) }
  else { const data = { vehicleId: f.vehicleId, date: f.date, amount, currency: 'COP', category: 'combustible', description: `Combustible${qty ? ` · ${qty} ${f.unit === 'gal' ? 'gal' : 'L'}` : ''}${f.station ? ` · ${f.station}` : ''}`, km, fuelId: f.id, auto: true }; if (e) Object.assign(e, data, { updatedAt: now() }); else upsert('expenses', data, 'exp') }
  return { ok: true, fuel: f }
}
export function deleteFuel(id) { const g = garage(); g.fuel = g.fuel.filter((f) => f.id !== id); g.expenses = g.expenses.filter((e) => e.fuelId !== id) }

// ---------- Categorías y archivos ----------
export function addCategory(name) {
  const n = clean(name, 60); if (!n) throw new VError('Escribe el nombre')
  const g = garage(); const ex = L.categories(g).find((c) => c.name.toLowerCase() === n.toLowerCase()); if (ex) return ex
  const c = { id: rid('cat'), name: n, custom: true }; g.categories.push(c); return c
}
export function addFileMeta(d) { return upsert('files', { id: d.id, vehicleId: d.vehicleId, name: clean(d.name, 160), mime: d.mime || 'application/octet-stream', size: d.size || 0, kind: d.kind || 'otro', storage: d.storage || 'mumu', url: d.url || '', note: clean(d.note, 300), source: d.source || '' }, 'file') }
export function removeFileMeta(id) {
  const g = garage(); g.files = g.files.filter((f) => f.id !== id)
  for (const k of ['services', 'documents', 'expenses']) g[k].forEach((x) => { if (x.fileIds?.includes(id)) x.fileIds = x.fileIds.filter((f) => f !== id) })
  g.vehicles.forEach((v) => { if (v.photoIds?.includes(id)) v.photoIds = v.photoIds.filter((x) => x !== id); if (v.photoFileId === id) v.photoFileId = v.photoIds?.[0] || null })
}

// ---------- Carga inicial de Minavi (idempotente: no duplica ni pisa lo que cambiaste) ----------
export function ensureVehiclesSeed() {
  const g = garage()
  if (g.schema !== SCHEMA) g.schema = SCHEMA
  const done = new Set(g.seeded || [])
  const mark = (k) => { if (!done.has(k)) { done.add(k); g.seeded = [...done] } }
  const s = minaviSeed()
  if (!done.has('minavi')) { if (!g.vehicles.some((v) => v.id === MINAVI_ID)) g.vehicles.push({ ...s.vehicle, createdAt: now(), updatedAt: now() }); mark('minavi') }
  if (!g.vehicles.some((v) => v.id === MINAVI_ID)) return
  // Nombre elegido: "Mi chiquita" (antes Minavi). Solo una vez: si luego lo cambias, se respeta.
  if (!done.has('rename-chiquita')) { const v = g.vehicles.find((x) => x.id === MINAVI_ID); if (v && v.name === 'Minavi') v.name = 'Mi chiquita'; mark('rename-chiquita') }
  for (const sv of s.services) {
    const k = `minavi-${sv.key}`
    if (done.has(k)) continue
    if (!g.services.some((x) => x.id === sv.id)) { const { key, ...rest } = sv; g.services.push({ ...rest, vehicleId: MINAVI_ID, km: null, shopId: null, parts: '', costParts: null, costLabor: null, costTotal: null, currency: 'COP', fileIds: [], items: rest.items.map((i, n) => ({ ...i, id: `${sv.id}_i${n}` })), seedKey: k, createdAt: now(), updatedAt: now() }) }
    mark(k)
  }
  // Plan del manual oficial de Honda (verificado). Reemplaza las sugerencias externas que no tocaste.
  if (!done.has('minavi-manual-plan-v1')) {
    g.plans = g.plans.filter((p) => !(p.vehicleId === MINAVI_ID && p.source === 'externa' && p.verification === 'externa' && !p.active))
    mark('minavi-manual-plan-v1')
  }
  for (const p of NAVI_MANUAL_PLANS) {
    const k = `minavi-mplan-${p.key}`
    if (done.has(k)) continue
    if (!g.plans.some((x) => x.vehicleId === MINAVI_ID && x.key === p.key && x.source === 'manual')) g.plans.push({ ...p, id: `plan_minavi_m_${p.key}`, vehicleId: MINAVI_ID, active: true, autoTask: true, leadKm: 300, leadDays: 15, nextKm: null, nextDate: null, createdAt: now(), updatedAt: now() })
    mark(k)
  }
  if (!done.has('minavi-specs-v1')) {
    const v = g.vehicles.find((x) => x.id === MINAVI_ID)
    if (v) { v.specs = { ...NAVI_SPECS, ...(v.specs || {}) }; if (!v.fuelType || v.fuelType === 'Gasolina corriente') v.fuelType = 'Gasolina corriente (RON 91 o más)'; touch(v) }
    mark('minavi-specs-v1')
  }
  if (!done.has('minavi-specs-v2')) { // etiqueta de llantas de la moto (foto de Aliz): psi, índices y marcas originales
    const v = g.vehicles.find((x) => x.id === MINAVI_ID)
    if (v) { const s = v.specs || {}; v.specs = { ...s, llantas: NAVI_SPECS.llantas, presion: NAVI_SPECS.presion, marcasLlantas: s.marcasLlantas || NAVI_SPECS.marcasLlantas, etiquetaLlantas: s.etiquetaLlantas || NAVI_SPECS.etiquetaLlantas }; touch(v) }
    mark('minavi-specs-v2')
  }
  if (!done.has('minavi-manual')) {
    if (!g.files.some((f) => f.vehicleId === MINAVI_ID && f.kind === 'manual')) g.files.push({ id: 'file_minavi_manual_link', vehicleId: MINAVI_ID, name: 'Manual del propietario Honda Navi (enlace oficial)', mime: 'application/pdf', kind: 'manual', storage: 'link', url: HONDA_NAVI_MANUAL, source: 'Honda Colombia', note: 'Enlace al PDF oficial. Toca "Guardar copia" para tenerlo guardado en privado en MuMu.', createdAt: now(), updatedAt: now() })
    mark('minavi-manual')
  }
}

// ---------- Tareas y agenda enlazadas (sin duplicar) ----------
// Cada aviso real (mantenimiento próximo o vencido, documento por vencer, trabajo por confirmar)
// tiene UNA tarea en MuMu (vref.key). Las tareas llegan a la agenda, a Google Tasks y a los
// recordatorios del celular como cualquier tarea. Si el aviso deja de aplicar, la tarea se cierra.
export function desiredTasks() {
  const g = garage(), out = new Map()
  for (const v of g.vehicles.filter((x) => !x.archived)) {
    for (const x of L.plans(g, v.id)) {
      const p = x.p
      if (!p.active || p.autoTask === false) continue
      if (!(x.status === 'vencido' || x.status === 'proximo' || (p.taskWanted && (x.nextDate || x.nextKm != null)))) continue
      const byDate = x.nextDate && (x.dLeft != null && x.dLeft <= Number(p.leadDays ?? 15))
      const due = byDate || (p.taskWanted && x.nextDate) ? x.nextDate : x.status === 'vencido' ? L.today() : null
      const what = `${L.catName(g, p.component)} (${L.actionLabel(p.action).toLowerCase()})`
      out.set(`plan:${p.id}`, { vehicleId: v.id, kind: 'plan', id: p.id, cycle: `${x.nextKm ?? ''}|${x.nextDate ?? ''}`, title: `${v.name}: ${what}`, due, notes: `${x.nextKm != null ? `Toca a los ${L.fmtKm(x.nextKm)}. ` : ''}${x.nextDate ? `Fecha: ${L.fmtDate(x.nextDate)}. ` : ''}Ábrelo en Motos para registrarlo.` })
    }
    for (const d of L.documents(g, v.id)) {
      const st = L.docStatus(d)
      if (st.status !== 'proximo' && st.status !== 'vencido') continue
      out.set(`doc:${d.id}`, { vehicleId: v.id, kind: 'doc', id: d.id, cycle: d.expiresAt, title: `Renovar ${d.name} de ${v.name}`, due: d.expiresAt, notes: `${st.label}. Al renovarlo, regístralo en Motos (el anterior queda en el historial).` })
    }
    for (const s of L.pendingConfirm(g, v.id)) out.set(`svc:${s.id}`, { vehicleId: v.id, kind: 'service', id: s.id, cycle: s.id, title: `Confirmar trabajo de ${v.name} en el taller`, due: s.expectedDate || L.today(), notes: `${s.description}. ${s.expectedNote || ''} Confirma la entrega, lo que se hizo y el kilometraje en Motos.` })
  }
  return out
}
export function syncVehicleTasks() {
  if (!state.tasks) return
  const want = desiredTasks()
  const linked = state.tasks.filter((t) => t.vref?.key)
  const drop = []
  for (const t of linked) {
    const w = want.get(t.vref.key)
    if (!w) { if (t.status !== 'completada' && t.status !== 'cancelada') drop.push(t.id); continue }
    if (t.status === 'completada') { if (t.vref.cycle === w.cycle) want.delete(t.vref.key); continue } // ya la hiciste en este ciclo
    if (t.title !== w.title) t.title = w.title
    if ((t.due || null) !== (w.due || null)) t.due = w.due
    t.vref = { ...t.vref, cycle: w.cycle }
    want.delete(t.vref.key)
  }
  // Lo que ya no aplica (registraste el trabajo, renovaste, borraste el plan): la tarea se quita
  if (drop.length) removeTasks((t) => drop.includes(t.id))
  for (const [key, w] of want) {
    if (state.tasks.some((t) => t.vref?.key === key && t.status !== 'completada')) continue
    addTask({ title: w.title, due: w.due, notes: w.notes, category: 'personal', priority: w.kind === 'doc' || (w.due && w.due <= L.today()) ? 'alta' : 'media', estimate: 30, source: 'motos', vref: { key, vehicleId: w.vehicleId, kind: w.kind, id: w.id, cycle: w.cycle } }, { quiet: true })
  }
}
// "Recuérdame…": pide tarea para un plan aunque esté al día (en su próxima fecha)
export function wantTask(planId, on = true) { const p = garage().plans.find((x) => x.id === planId); if (p) { p.taskWanted = on; p.autoTask = true; touch(p) } }

// ---------- Importar datos del Garaje (archivo privado, no va en el código) ----------
// { garage: { vehicle: { match: 'id o nombre', ...campos, specs }, documents: [...], readings: [...], shops: [...] } }
// Idempotente: el vehículo se completa; un documento con el mismo tipo y número (o vencimiento) no se repite.
export function importGarage(data) {
  const g = garage(); ensureVehiclesSeed()
  const d = data?.garage; if (!d) return null
  const vin = d.vehicle || {}
  let v = g.vehicles.find((x) => x.id === vin.match || x.name.toLowerCase() === String(vin.match || vin.name || '').toLowerCase())
  if (!v) v = saveVehicle({ type: vin.type || 'moto', name: vin.name || 'Vehículo', make: vin.make, model: vin.model, year: vin.year })
  const keep = ['make', 'model', 'year', 'plate', 'registeredAt', 'color', 'fuelType', 'type', 'notes', 'driveFolder']
  for (const k of keep) if (vin[k] != null && vin[k] !== '') v[k] = k === 'plate' ? String(vin[k]).toUpperCase() : k === 'driveFolder' ? driveId(vin[k]) : vin[k]
  if (vin.specs) v.specs = { ...(v.specs || {}), ...vin.specs }
  for (const c of vin.consumables || []) { const cur = (v.consumables || []).find((x) => x.label.toLowerCase() === String(c.label || '').toLowerCase()); saveConsumable({ ...c, id: cur?.id, photoId: cur?.photoId || c.photoId || null, vehicleId: v.id }) }
  touch(v)
  let added = 0
  for (const doc of d.documents || []) {
    const same = g.documents.find((x) => x.vehicleId === v.id && x.kind === doc.kind && ((doc.number && x.number === doc.number) || (doc.expiresAt && x.expiresAt === doc.expiresAt)))
    if (same) { Object.assign(same, { ...doc, id: same.id, vehicleId: v.id }); touch(same); continue }
    const n = saveDocument({ ...doc, vehicleId: v.id })
    if (doc.cost && doc.kind !== 'tarjeta' && !g.expenses.some((e) => e.docId === n.id)) upsert('expenses', { vehicleId: v.id, date: doc.issuedAt || L.today(), amount: Number(doc.cost), currency: 'COP', category: 'documentos', description: n.name, docId: n.id, auto: true }, 'exp')
    added++
  }
  // Historial de renovaciones: por tipo, el que vence más tarde queda vigente y los demás encadenados
  for (const kind of new Set(g.documents.filter((x) => x.vehicleId === v.id && x.kind !== 'otro' && x.kind !== 'tarjeta').map((x) => x.kind))) {
    const list = g.documents.filter((x) => x.vehicleId === v.id && x.kind === kind && x.expiresAt).sort((a, b) => (a.expiresAt < b.expiresAt ? -1 : 1))
    list.forEach((x, i) => { const nx = list[i + 1]; if (nx) { x.status = 'reemplazado'; x.replacedBy = nx.id; nx.renewedFrom = x.id } else { x.status = 'vigente'; x.replacedBy = null } })
  }
  for (const r of d.readings || []) if (!g.readings.some((x) => x.vehicleId === v.id && x.date === r.date && x.km === r.km)) { const res = addReading({ ...r, vehicleId: v.id }); if (res.ok) added++ }
  // Talleres: se actualizan si ya existen (por nombre, o por "match" con el nombre anterior); si no, se crean
  for (const sh of d.shops || []) {
    const names = [sh.name, sh.match].filter(Boolean).map((x) => String(x).toLowerCase())
    const old = g.shops.find((x) => names.includes(x.name.toLowerCase()))
    const { match, ...rest } = sh
    saveShop({ ...(old || {}), ...rest, id: old?.id }); if (!old) added++
  }
  // Trabajos: "match" actualiza uno que ya existe (por id); si no, se crea uno nuevo sin repetir (misma fecha y descripción)
  const shopId = (name) => (name ? g.shops.find((x) => x.name.toLowerCase() === String(name).toLowerCase())?.id || null : null)
  for (const sv of d.services || []) {
    const old = g.services.find((x) => x.vehicleId === v.id && ((sv.match && x.id === sv.match) || (!sv.match && (x.date || null) === (sv.date || null) && x.description === sv.description)))
    const { match, shop, ...rest } = sv
    saveService({ ...(old || {}), ...rest, id: old?.id, vehicleId: v.id, shopId: shop ? shopId(shop) : old?.shopId || null, expectedNote: rest.expectedNote ?? '', expectedDate: rest.expectedDate ?? null })
    if (!old) added++
  }
  for (const e of d.expenses || []) if (!g.expenses.some((x) => x.vehicleId === v.id && x.date === e.date && Number(x.amount) === Number(e.amount) && x.category === e.category)) { saveExpense({ currency: 'COP', ...e, vehicleId: v.id }); added++ }
  return { vehicle: v, added }
}
