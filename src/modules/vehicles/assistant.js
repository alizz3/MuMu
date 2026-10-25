// Garaje ↔ vaquita: respuestas con los datos guardados (sin IA) y acciones que SIEMPRE se
// confirman antes de guardar. Nunca inventa fechas, km ni valores: si faltan, los pregunta.
import { ui } from '../../store'
import * as G from './actions'
import * as L from './logic'
import { DOC_KINDS } from './model'

const nrm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const VEH_WORDS = /\b(moto|motos|motico|carro|vehiculo|garaje|soat|tecnomecanica|tecno|rtm|aceite|kilometraje|kilometros|km|gasolina|tanque|tanquear|tanquee|combustible|mantenimiento|taller|bujia|frenos?|llantas?|bateria|correa|filtro|sincronizacion|placa|odometro|servicio|mecanico|revision)\b/
const COMP = [
  [/aceite/, 'aceite'], [/filtro( de)? aire/, 'filtro_aire'], [/bujia/, 'bujia'], [/bateria/, 'bateria'], [/frenos?|pastillas|bandas/, 'frenos'],
  [/llantas?|neumatic|presion/, 'llantas'], [/correa/, 'correa'], [/cadena/, 'cadena'], [/transmision/, 'transmision'], [/sincroniz|ralenti/, 'sincronizacion'], [/valvula/, 'valvulas'], [/electric/, 'electrico'],
]
const SYMPTOM = /\b(ruido|suena|chilla|falla|no frena|frena mal|humo|olor|vibra|se apaga|no prende|no arranca|pierde fuerza|fuga|gotea|recalienta|calienta)\b/

const go = (route, params) => import('../../store/actions').then((A) => A.go(route, params))
const openSheet = (vehicleId, type, data = {}) => { go('garaje', { id: vehicleId }); setTimeout(() => { ui.garageSheet = { type, data: { vehicleId, ...data } } }, 250); ui.assistantOpen = false }

function pickVehicle(s, g) {
  const act = g.vehicles.filter((v) => !v.archived)
  const named = g.vehicles.find((v) => s.includes(nrm(v.name)) || (v.model && s.includes(nrm(v.model))))
  if (named) return { v: named }
  if (act.length === 1) return { v: act[0] }
  if (!act.length) return { none: true }
  return { ask: `¿De cuál vehículo? Tienes: ${act.map((v) => `**${v.name}**`).join(', ')}.` }
}
const comp = (s) => COMP.find(([re]) => re.test(s))?.[1] || null
const money = (s) => { const m = s.match(/\$?\s?(\d{1,3}(?:[.,]\d{3})+|\d+)\s*(mil|k)?\b(?!\s*(km|kilometros|litros?|l\b|galon))/); if (!m) return null; let n = Number(m[1].replace(/[.,]/g, '')); if (m[2]) n *= 1000; return n >= 1000 ? n : null }
const qty = (s) => { const m = s.match(/(\d+(?:[.,]\d+)?)\s*(litros?|lts?|l\b|galon(?:es)?|gal)\b/); return m ? { qty: Number(m[1].replace(',', '.')), unit: /gal/.test(m[2]) ? 'gal' : 'L' } : null }
const kmIn = (s) => { const m = s.match(/(\d{1,3}(?:[.,]\d{3})+|\d{3,7})\s*(km|kilometros)\b/) || s.match(/\b(?:km|kilometraje|marca)\s*(?:de|en|:)?\s*(\d{1,3}(?:[.,]\d{3})+|\d{3,7})\b/); return m ? Number(m[1].replace(/[.,]/g, '')) : null }
const when = (s) => (/\bayer\b/.test(s) ? L.addDaysK(L.today(), -1) : L.today())

// Devuelve null (no es del Garaje), { text } o { text, actions: [{ label, primary, run }] }
export function vehicleReply(text) {
  const s = nrm(text)
  const g = G.garage()
  if (!VEH_WORDS.test(s) && !g.vehicles.some((v) => s.includes(nrm(v.name)))) return null
  if (SYMPTOM.test(s)) return null // síntomas: los responde la IA con el contexto y con cuidado (no diagnostica)
  const pv = pickVehicle(s, g)
  if (pv.none) return { text: 'Todavía no tienes vehículos en el Garaje.', actions: [{ label: 'Abrir Garaje', primary: true, run: () => { go('garaje'); ui.assistantOpen = false } }] }
  if (pv.ask) return { text: pv.ask }
  const v = pv.v, id = v.id
  // Llantas: presión y medida, tal como dice la ficha (sin inventar)
  if (/llantas?|neumatic|presion/.test(s) && /\b(que|cual|cuanto|cuanta|como|presion|medida|psi|aire)\b/.test(s) && !/\b(registra|anota|cambie|cambio|recuerdame|avisame)\b/.test(s)) {
    const sp = v.specs || {}
    if (sp.presion || sp.llantas) return { text: [`**${v.name}**`, sp.presion && `Presión: ${sp.presion}.`, sp.llantas && `Medida: ${sp.llantas}.`, 'Mídela en frío, antes de rodar.'].filter(Boolean).join('\n') }
  }

  // ----- Acciones (siempre con confirmación) -----
  if (/\b(registra|anota|apunta|guarda)\b.*\b(gasolina|tanque|combustible|tanquee)|\b(le puse|eche|heche|tanquee)\b.*\b(gasolina|combustible)?/.test(s) && /gasolina|tanque|combustible|tanquee/.test(s)) {
    const amount = money(s), q = qty(s), km = kmIn(s), date = when(s)
    if (amount == null && !q) return { text: `¿Cuánto fue? Dime el valor o los litros (ej. "le puse 20 mil de gasolina, 2 litros"). También puedes llenarlo en el formulario.`, actions: [{ label: 'Abrir formulario', primary: true, run: () => openSheet(id, 'fuel', { date, km: km ?? '' }) }] }
    const line = [amount != null && L.fmtMoney(amount), q && `${q.qty} ${q.unit === 'gal' ? 'gal' : 'L'}`, km != null && L.fmtKm(km)].filter(Boolean).join(' · ')
    return { text: `¿Guardo combustible para **${v.name}** el ${L.fmtDate(date)}: ${line}?${km == null ? '\n(Sin kilometraje: no cuenta para el consumo.)' : ''}`, actions: [
      { label: 'Sí, guardar', primary: true, run: (say) => { try { const r = G.saveFuel({ vehicleId: id, date, amount, qty: q?.qty ?? null, unit: q?.unit || 'L', km, full: /lleno|full/.test(s) }); say(r.needsConfirm ? `Ese km es menor que el último (${L.fmtKm(r.prev.km)}). Revísalo en el formulario.` : 'Listo, guardado en el Garaje.') } catch (e) { say(e.message) } } },
      { label: 'Editar antes', run: () => openSheet(id, 'fuel', { date, amount: amount ?? '', qty: q?.qty ?? '', unit: q?.unit || 'L', km: km ?? '' }) },
    ] }
  }
  if (/\b(tiene|marca|actualiza|registra|va en|lleva)\b/.test(s) && kmIn(s) != null && !/gasolina|tanque/.test(s)) {
    const km = kmIn(s), date = when(s)
    return { text: `¿Registro **${L.fmtKm(km)}** en el odómetro de ${v.name} (${L.fmtDate(date)})?`, actions: [
      { label: 'Sí, registrar', primary: true, run: (say) => { try { const r = G.addReading({ vehicleId: id, date, km }); say(r.needsConfirm ? `Es menor que la lectura anterior (${L.fmtKm(r.prev.km)}). Si es una corrección, regístrala en el formulario explicando el motivo.` : 'Listo, kilometraje actualizado.') } catch (e) { say(e.message) } } },
      { label: 'No', run: (say) => say('Ok, no guardé nada.') },
    ] }
  }
  if (/recuerdame|avisame|recordar/.test(s) && comp(s)) {
    const c = comp(s), name = L.catName(g, c)
    const x = L.plans(g, id).find((y) => y.p.component === c && y.p.active) || L.plans(g, id).find((y) => y.p.component === c)
    if (!x) return { text: `No tengo un intervalo para **${name}** de ${v.name} (no lo voy a inventar). ¿Lo configuramos? Puedes ponerlo por km, por meses o con una fecha.`, actions: [{ label: 'Configurar', primary: true, run: () => openSheet(id, 'plan', { component: c, action: 'inspeccionar' }) }] }
    const every = [x.p.intervalKm && `cada ${L.fmtKm(x.p.intervalKm)}`, x.p.intervalMonths && `cada ${x.p.intervalMonths} meses`].filter(Boolean).join(' o ')
    if (!x.p.active) return { text: `Para **${name}** hay una sugerencia (${every}) que NO viene del manual de Honda Colombia: es de una fuente externa por confirmar. ¿La activo y te recuerdo cuando toque?`, actions: [
      { label: 'Activar y recordar', primary: true, run: (say) => { G.setPlanActive(x.p.id, true, 'usuario'); G.wantTask(x.p.id); say('Listo. Te aviso cuando toque (con tarea en MuMu).') } },
      { label: 'Revisar primero', run: () => openSheet(id, 'plan', x.p) },
    ] }
    return { text: `¿Te recuerdo **${name}** de ${v.name}? Próxima: ${x.nextKm != null ? `a los ${L.fmtKm(x.nextKm)}` : ''}${x.nextKm != null && x.nextDate ? ' o ' : ''}${x.nextDate ? `el ${L.fmtDate(x.nextDate)}` : ''}${x.nextKm == null && !x.nextDate ? 'todavía sin referencia (registra el último trabajo con km o fecha)' : ''}.`, actions: [
      { label: 'Sí, recordarme', primary: true, run: (say) => { G.wantTask(x.p.id); say('Listo. Aparecerá como tarea cuando toque.') } },
      { label: 'No', run: (say) => say('Ok.') },
    ] }
  }
  if (/\b(registra|anota|apunta)\b/.test(s) && /mantenimiento|cambio|cambiaron|taller|revision/.test(s)) {
    const c = comp(s)
    return { text: `Abro el formulario para registrar el mantenimiento de ${v.name}${c ? ` (${L.catName(g, c)})` : ''}. Revisa la fecha, el km y el costo antes de guardar: no los invento.`, actions: [{ label: 'Abrir formulario', primary: true, run: () => openSheet(id, 'service', { date: when(s), items: [{ component: c || '', action: 'reemplazar', detail: '' }] }) }] }
  }

  // ----- Consultas con los datos guardados -----
  if (/cuantos (km|kilometros)|kilometraje|odometro/.test(s)) {
    const km = L.currentKm(g, id), last = L.lastReading(g, id)
    return { text: km == null ? `${v.name} no tiene kilometraje registrado todavía.` : `**${v.name}** tiene **${L.fmtKm(km)}** registrados (última lectura: ${L.fmtDate(last.date)}, desde ${last.src}).` }
  }
  if (/soat|tecnomecanica|tecno|rtm|vence|vencimiento|documento/.test(s)) {
    const kinds = /soat/.test(s) ? ['soat'] : /tecno|rtm/.test(s) ? ['rtm'] : ['soat', 'rtm']
    return { text: kinds.map((k) => { const d = L.docOfKind(g, id, k), lbl = DOC_KINDS.find((x) => x.id === k).short || 'SOAT'; return d ? `**${lbl}** de ${v.name}: ${L.docStatus(d).label.toLowerCase()}${d.expiresAt ? ` (vence ${L.fmtDate(d.expiresAt)})` : ''}.` : `**${lbl}** de ${v.name}: sin registrar. Regístralo con la fecha de tu documento.` }).join('\n') }
  }
  if (/gast|plata|cuanto (he|llevo)/.test(s)) {
    const t = L.today().slice(0, 7)
    const m = /total|siempre|acumulad/.test(s) ? L.spend(g, id) : L.spend(g, id, { from: `${t}-01`, to: `${t}-31` })
    const lbl = /total|siempre|acumulad/.test(s) ? 'en total' : 'este mes'
    return { text: m.n ? `En **${v.name}** llevas **${L.fmtMoney(m.total)}** ${lbl} (${m.n} registro${m.n === 1 ? '' : 's'}):\n${Object.entries(m.byCat).map(([c, val]) => `- ${c}: ${L.fmtMoney(val)}`).join('\n')}` : `No hay gastos registrados ${lbl} para ${v.name}.` }
  }
  if (/pendiente|toca|falta|proximo mantenimiento|que mantenimiento/.test(s) && /manten|revision|toca|pendiente/.test(s)) {
    const a = L.alerts(g, id), sug = L.plans(g, id).filter((x) => !x.p.active).length
    const parts = []
    if (a.alerts.length) parts.push(`**Alertas de ${v.name}:**\n${a.alerts.map((x) => `- ${x.text}`).join('\n')}`)
    else parts.push(`${v.name} no tiene alertas con la información guardada.`)
    if (a.missing.length) parts.push(`**Falta información** (no son alertas):\n${a.missing.slice(0, 5).map((x) => `- ${x.text}`).join('\n')}`)
    if (sug) parts.push(`Hay ${sug} sugerencias de mantenimiento sin activar (fuente externa, por confirmar con el manual).`)
    return { text: parts.join('\n\n') }
  }
  if (/ultimo servicio|ultima vez (que|en el taller)|que le hicieron/.test(s)) {
    const sv = L.lastService(g, id)
    if (!sv) return { text: `No hay mantenimientos realizados registrados para ${v.name}.` }
    const shop = g.shops.find((x) => x.id === sv.shopId)
    return { text: `**Último servicio de ${v.name}** (${L.fmtDate(sv.date)}${sv.km != null ? ` · ${L.fmtKm(sv.km)}` : ' · sin km'}):\n${sv.items.map((i) => `- ${L.catName(g, i.component)}: ${L.actionLabel(i.action).toLowerCase()}${i.detail ? ` (${i.detail})` : ''}`).join('\n')}${shop ? `\nTaller: ${shop.name}${shop.mechanic ? ` · ${shop.mechanic}` : ''}` : ''}${L.serviceTotal(sv) != null ? `\nCosto: ${L.fmtMoney(L.serviceTotal(sv))}` : ''}` }
  }
  const c = comp(s)
  if (c && /ultim|cuando/.test(s)) {
    const sv = L.lastDone(g, id, c)
    const pend = L.pendingConfirm(g, id).find((x) => x.items.some((i) => i.component === c))
    return { text: sv ? `El último registro de **${L.catName(g, c)}** en ${v.name} fue el **${L.fmtDate(sv.date)}**${sv.km != null ? ` a los ${L.fmtKm(sv.km)}` : ' (sin km registrado)'}.${pend ? `\nHay otro por confirmar del ${L.fmtDate(pend.intakeDate || pend.date)}.` : ''}` : `No hay registros de **${L.catName(g, c)}** realizados en ${v.name}.${pend ? ` Hay uno por confirmar (entró al taller el ${L.fmtDate(pend.intakeDate || pend.date)}).` : ''}` }
  }
  return null
}

export const mentionsVehicle = (text) => { const s = nrm(text); return VEH_WORDS.test(s) || G.garage().vehicles.some((v) => s.includes(nrm(v.name))) }

// Resumen compacto para la IA (separando datos guardados, sugerencias y lo que falta)
export function vehicleContext() {
  const g = G.garage()
  return g.vehicles.filter((v) => !v.archived).map((v) => {
    const a = L.alerts(g, v.id)
    return {
      nombre: v.name, tipo: v.type, marca: v.make, modelo: v.model, año: v.year,
      kmActual: L.currentKm(g, v.id) ?? 'sin registrar',
      historial: L.services(g, v.id).slice(0, 6).map((s) => `${s.date} [${s.status}] ${s.items.map((i) => `${L.catName(g, i.component)} (${i.action})`).join(', ')}${s.km != null ? ` @${s.km}km` : ' sin km'}`),
      alertas: a.alerts.map((x) => x.text), faltaInformacion: a.missing.map((x) => x.text),
      planesActivos: L.plans(g, v.id).filter((x) => x.p.active).map((x) => `${L.catName(g, x.p.component)} ${x.p.action}: ${x.status} (fuente: ${x.p.verification})`),
      sugerenciasNoVerificadas: L.plans(g, v.id).filter((x) => !x.p.active).map((x) => `${L.catName(g, x.p.component)} ${x.p.action} cada ${x.p.intervalKm || '?'} km / ${x.p.intervalMonths || '?'} meses (fuente externa, no es el manual de Honda Colombia)`),
      documentos: L.documents(g, v.id).map((d) => `${d.name}: ${L.docStatus(d).label}`),
    }
  })
}
