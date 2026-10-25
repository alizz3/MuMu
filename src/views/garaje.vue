<script setup>
// Garaje: hoja de vida de cada vehículo (km, mantenimientos, plan, documentos, gastos, archivos).
// La lógica vive en src/modules/vehicles (separada de la interfaz para poder llevarla a otra app).
import { computed, ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { state, ui } from '../store'
import * as A from '../store/actions'
import { toast, ask } from '../engine/game'
import { Icon } from '../components/ui'
import Seg from '../components/Seg.vue'
import GroupCard from '../components/GroupCard.vue'
import ListBar from '../components/ListBar.vue'
import GarageSheet from '../modules/vehicles/GarageSheet.vue'
import VehiclePhoto from '../modules/vehicles/VehiclePhoto.vue'
import FileThumb from '../modules/vehicles/FileThumb.vue'
import DriveBrowser from '../components/DriveBrowser.vue'
import * as G from '../modules/vehicles/actions'
import * as L from '../modules/vehicles/logic'
import { VEHICLE_TYPES, SERVICE_STATUS, PLAN_STATUS, VERIFICATION, DOC_KINDS, EXPENSE_CATS, FILE_KINDS, SPEC_LABELS } from '../modules/vehicles/model'
import { openFile, deleteFile, saveManualCopy } from '../modules/vehicles/files'
import { canUseBackend, driveAccounts } from '../services/api'

const g = computed(() => G.garage())
onMounted(() => { G.ensureVehiclesSeed(); G.syncVehicleTasks() })
const vid = computed(() => ui.params.id || null)
const v = computed(() => (vid.value ? L.vehicleOf(g.value, vid.value) : null))
const open = (type, data = {}) => { ui.garageSheet = { type, data: { vehicleId: vid.value, ...data } } }
const pref = (k, d) => computed({ get: () => state.settings[k] ?? d, set: (x) => (state.settings[k] = x) })
const tab = ref(ui.params.tab || 'resumen')
watch(vid, () => { tab.value = ui.params.tab || 'resumen' })
const fold = pref('garageFold', {})
const isOpen = (k, d = false) => (fold.value[k] ?? d)
const toggle = (k, d = false) => { fold.value = { ...fold.value, [k]: !isOpen(k, d) } }

// ---------- Lista ----------
const active = computed(() => g.value.vehicles.filter((x) => !x.archived))
const archived = computed(() => g.value.vehicles.filter((x) => x.archived))
const typeOf = (t) => VEHICLE_TYPES.find((x) => x.id === t) || VEHICLE_TYPES[3]
const summary = (id) => ({ km: L.currentKm(g.value, id), ...L.alerts(g.value, id) })

// ---------- Ficha ----------
const km = computed(() => (v.value ? L.currentKm(g.value, v.value.id) : null))
const lastPt = computed(() => (v.value ? L.lastReading(g.value, v.value.id) : null))
const al = computed(() => (v.value ? L.alerts(g.value, v.value.id) : { alerts: [], missing: [] }))
const svcs = computed(() => (v.value ? L.services(g.value, v.value.id) : []))
const lastSvc = computed(() => (v.value ? L.lastService(g.value, v.value.id) : null))
const pls = computed(() => (v.value ? L.plans(g.value, v.value.id) : []))
const activePlans = computed(() => pls.value.filter((x) => x.p.active))
const suggested = computed(() => pls.value.filter((x) => !x.p.active))
const waiting = computed(() => activePlans.value.filter((x) => x.status === 'pendiente'))
const docs = computed(() => (v.value ? L.documents(g.value, v.value.id) : []))
const oldDocs = computed(() => (v.value ? L.documents(g.value, v.value.id, { all: true }).filter((d) => d.status === 'reemplazado') : []))
const soat = computed(() => docs.value.find((d) => d.kind === 'soat'))
const rtm = computed(() => docs.value.find((d) => d.kind === 'rtm'))
const rtmHint = computed(() => L.rtmHint(v.value))
const exps = computed(() => (v.value ? L.expenses(g.value, v.value.id) : []))
const files = computed(() => (v.value ? g.value.files.filter((f) => f.vehicleId === v.value.id) : []))
const manuals = computed(() => files.value.filter((f) => f.kind === 'manual'))
const shopOf = (id) => g.value.shops.find((s) => s.id === id)
const fileOf = (id) => g.value.files.find((f) => f.id === id)
const svcTitle = (s) => s.description || s.items.map((i) => L.catName(g.value, i.component)).join(' + ')
const TABS_OLD = computed(() => [['resumen', 'Resumen', 'home'], ['mant', 'Historial', 'tool', svcs.value.length || null], ['plan', 'Plan', 'calendar'], ['docs', 'Documentos', 'note'], ['gastos', 'Gastos', 'wallet'], ['km', 'Kilometraje', 'chart'], ['archivos', 'Archivos', 'clip', files.value.length || null], ['ajustes', 'Ficha', 'settings']])

// Historial: búsqueda y filtro
const q = ref(''), fComp = ref(''), fStatus = ref('')
const svcFiltered = computed(() => svcs.value.filter((s) => (!fComp.value || s.items.some((i) => i.component === fComp.value)) && (!fStatus.value || s.status === fStatus.value) && (!q.value || `${svcTitle(s)} ${s.parts} ${s.notes} ${shopOf(s.shopId)?.name || ''}`.toLowerCase().includes(q.value.toLowerCase()))))

// Gastos
const month = computed(() => { const t = L.today().slice(0, 7); return v.value ? L.spend(g.value, v.value.id, { from: `${t}-01`, to: `${t}-31` }) : { total: 0, n: 0, byCat: {} } })
const allSpend = computed(() => (v.value ? L.spend(g.value, v.value.id) : { total: 0, n: 0, byCat: {} }))
const months = computed(() => (v.value ? L.monthly(g.value, v.value.id, 6) : []))
const maxMonth = computed(() => Math.max(1, ...months.value.map((m) => m.total)))
const econ = computed(() => (v.value ? L.fuelEconomy(g.value, v.value.id) : null))
const fCat = ref('')
const expFiltered = computed(() => exps.value.filter((e) => !fCat.value || e.category === fCat.value))
const catLabel = (c) => EXPENSE_CATS.find((x) => x.id === c)?.label || c
const editExpense = (e) => { if (e.fuelId) open('fuel', g.value.fuel.find((x) => x.id === e.fuelId)); else if (e.serviceId && e.auto) open('service', g.value.services.find((x) => x.id === e.serviceId)); else if (e.docId && e.auto && g.value.documents.some((x) => x.id === e.docId)) open('doc', g.value.documents.find((x) => x.id === e.docId)); else open('expense', e) }

// Kilometraje
const kmRows = computed(() => (v.value ? L.readingsWithDistance(g.value, v.value.id) : []))

// Archivos
const loading = ref('')
async function view(fm, download = false) { loading.value = fm.id; try { await openFile(fm, { download }) } catch (e) { toast(e.message) } finally { loading.value = '' } }
async function delFile(fm) { if (!(await ask(`¿Borrar "${fm.name}"?`))) return; try { await deleteFile(fm); toast('Archivo borrado') } catch (e) { toast(e.message) } }
async function copyManual(fm) { if (!canUseBackend()) return toast('Para guardar la copia necesitas tu sesión y conexión'); loading.value = fm.id; try { await saveManualCopy({ vehicleId: fm.vehicleId, url: fm.url, name: 'Manual del propietario Honda Navi (copia guardada)' }); toast('Copia del manual guardada en privado') } catch (e) { toast(e.message) } finally { loading.value = '' } }

async function archive(on) { if (on && !(await ask(`¿Archivar ${v.value.name}? No se borra nada: queda en "Archivados".`))) return; G.archiveVehicle(v.value.id, on); toast(on ? 'Archivado' : 'Activo otra vez') }
function exportJson() { const data = L.exportVehicle(g.value, v.value.id); const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })), download: `${v.value.name.toLowerCase().replace(/\W+/g, '-')}-hoja-de-vida.json` }); a.click() }
const planLine = (x) => [x.nextKm != null ? `a los ${L.fmtKm(x.nextKm)}${x.kmLeft != null ? ` (${x.kmLeft >= 0 ? `faltan ${L.fmtKm(x.kmLeft)}` : `pasado por ${L.fmtKm(-x.kmLeft)}`})` : ''}` : '', x.nextDate ? `el ${L.fmtDate(x.nextDate)}` : ''].filter(Boolean).join(' o ') || (x.why.length ? x.why.join(', ') : 'sin próxima fecha')
const every = (p) => [p.intervalKm ? `cada ${L.fmtKm(p.intervalKm)}` : '', p.intervalMonths ? `cada ${p.intervalMonths} mes${p.intervalMonths == 1 ? '' : 'es'}` : ''].filter(Boolean).join(' o ')
const telUrl = (p) => `tel:${String(p).replace(/[^\d+]/g, '')}`
const waUrl = (p) => `https://wa.me/${String(p).replace(/\D/g, '').replace(/^(?!57)(\d{10})$/, '57$1')}`
const mapsOf = (s) => s.mapsUrl || (s.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.address)}` : '')
function wantTask(x) { G.wantTask(x.p.id, true); toast(x.nextDate || x.nextKm != null ? 'Listo: tendrás una tarea cuando toque' : 'Cuando haya fecha o km de referencia, aparecerá la tarea') }
async function delVehicleFile(fm) { return delFile(fm) }
// Documentos que están en tu Drive: se ven aquí mismo
const drivePv = ref(null)
// Talleres: lista solo con el nombre; al tocar, su ficha con datos y visitas
const shopView = ref(null)
const shopsOk = computed(() => g.value.shops.filter((s) => !s.blocked))
const shopsNo = computed(() => g.value.shops.filter((s) => s.blocked))
const shopSel = computed(() => g.value.shops.find((s) => s.id === shopView.value) || null)
const shopVisits = computed(() => (shopSel.value ? g.value.services.filter((s) => s.shopId === shopSel.value.id).sort((a, b) => ((b.date || b.intakeDate || '') > (a.date || a.intakeDate || '') ? 1 : -1)) : []))
const shopSpent = computed(() => shopVisits.value.reduce((a, s) => a + (s.status === 'realizado' ? L.serviceTotal(s) || 0 : 0), 0))
const vehName = (id) => g.value.vehicles.find((x) => x.id === id)?.name || ''
function editShop(extra = {}) { const s = shopSel.value; shopView.value = null; open('shop', { ...s, ...extra }) }
async function unblock() { if (await ask(`¿Quitar "No volver" de ${shopSel.value.name}?`)) { G.unblockShop(shopSel.value.id); toast('Listo') } }
const pvClose = ref(null)
const onKey = (e) => { if (e.key !== 'Escape') return; if (drivePv.value) drivePv.value = null; else if (picker.value) picker.value = false; else if (menu.value) menu.value = false; else if (shopView.value) shopView.value = null }
watch(drivePv, (v) => { if (v) nextTick(() => pvClose.value?.focus()) })
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
const au = () => { const a = driveAccounts('personal')[0]; return a?.email ? `?authuser=${encodeURIComponent(a.email)}` : '' }
const drivePreviewUrl = (id) => `https://drive.google.com/file/d/${id}/preview${au()}`
const driveOpenUrl = (id) => `https://drive.google.com/file/d/${id}/view${au()}`

// ===================== Rediseño =====================
const SECTIONS = { resumen: 'Resumen', mant: 'Historial', plan: 'Plan de mantenimiento', docs: 'Documentos', gastos: 'Gastos', km: 'Kilometraje', archivos: 'Archivos', ajustes: 'Ficha técnica' }
const DTABS = [['resumen', 'Resumen'], ['mant', 'Historial'], ['plan', 'Plan'], ['docs', 'Documentos'], ['gastos', 'Gastos'], ['km', 'Kilometraje'], ['archivos', 'Archivos'], ['ajustes', 'Ficha técnica']]
const SHORTCUTS = [['km', 'Km', 'timer'], ['mant', 'Mantto.', 'tool'], ['gastos', 'Gasto', 'wallet'], ['docs', 'Doc.', 'note'], ['archivos', 'Archivo', 'clip']]
const goTab = (t) => { tab.value = t; window.scrollTo({ top: 0 }) }
const menu = ref(false)
// Estado general de un vehículo: un solo chip
function vStatus(id) {
  const a = L.alerts(g.value, id).alerts
  if (a.some((x) => x.level === 'red')) return { label: 'Revisar', cls: 'red', icon: 'info' }
  if (a.some((x) => x.level === 'yellow')) return { label: 'En el taller', cls: 'yellow', icon: 'clock' }
  if (a.length) return { label: 'Próximo a revisión', cls: 'yellow', icon: 'clock' }
  return { label: 'Al día', cls: 'green', icon: 'check' }
}
const roleIco = (s) => { const r = (s.role || 'taller').toLowerCase(); return /tr[aá]mite|soat|tecno|seguro/.test(r) ? { icon: 'note', cls: 'sky' } : /gr[uú]a/.test(r) ? { icon: 'moto', cls: 'cream' } : /repuesto/.test(r) ? { icon: 'bag', cls: 'cream' } : /lava/.test(r) ? { icon: 'drop', cls: 'sky' } : { icon: 'tool', cls: 'lav' } }
const lastVisit = (shopId) => { const s = g.value.services.filter((x) => x.shopId === shopId && x.date).sort((a, b) => (a.date < b.date ? 1 : -1))[0]; return s ? s.date : null }
// "en 687 km (o 2 meses)"
function soon(x) {
  const k = x.kmLeft != null ? (x.kmLeft >= 0 ? `en ${L.fmtKm(x.kmLeft)}` : `pasado por ${L.fmtKm(-x.kmLeft)}`) : ''
  const d = x.dLeft != null ? (x.dLeft < 0 ? `venció el ${L.fmtDate(x.nextDate)}` : x.dLeft < 45 ? `en ${x.dLeft} día${x.dLeft === 1 ? '' : 's'}` : `en ${Math.round(x.dLeft / 30)} meses`) : ''
  return k && d ? `${k} (o ${d.replace(/^en /, '')})` : k || d || 'sin fecha'
}
// Lo necesario para estar pendiente: a qué km, cuánto falta y la fecha límite
function when(x) {
  const kmLine = x.nextKm != null ? `A los ${L.fmtKm(x.nextKm)}${x.kmLeft != null ? (x.kmLeft >= 0 ? ` · faltan ${L.fmtKm(x.kmLeft)}` : ` · pasado por ${L.fmtKm(-x.kmLeft)}`) : ''}` : ''
  const dateLine = x.nextDate ? `${kmLine ? 'o el' : 'El'} ${L.fmtDate(x.nextDate)}${kmLine ? ', lo que llegue primero' : x.dLeft != null ? (x.dLeft >= 0 ? ` · faltan ${x.dLeft} días` : ' · ya pasó') : ''}` : ''
  return { main: kmLine || dateLine || 'Sin fecha todavía', sub: kmLine ? dateLine : '' }
}
// Barra de avance: cuánto del intervalo ya se usó (por km o por tiempo, el que vaya más adelantado)
function progress(x) {
  const a = x.p.intervalKm && x.last?.km != null && x.km != null ? (x.km - x.last.km) / Number(x.p.intervalKm) : null
  const b = x.p.intervalMonths && x.last?.date ? (Date.now() - new Date(x.last.date)) / (Number(x.p.intervalMonths) * 30.44 * 864e5) : null
  const v = Math.max(a ?? 0, b ?? 0); return a == null && b == null ? null : Math.min(1, Math.max(0, v))
}
const planName = (x) => L.catName(g.value, x.p.component)
const ready = computed(() => activePlans.value.filter((x) => x.status !== 'pendiente').sort((a, b) => PLAN_STATUS[a.status].rank - PLAN_STATUS[b.status].rank || (a.kmLeft ?? 1e9) - (b.kmLeft ?? 1e9) || (a.dLeft ?? 1e9) - (b.dLeft ?? 1e9)))
const nextPlan = computed(() => ready.value[0] || null)
const nextDoc = computed(() => docs.value.filter((d) => d.expiresAt).sort((a, b) => (a.expiresAt < b.expiresAt ? -1 : 1))[0] || null)
const docDays = (d) => (d?.expiresAt ? Math.round((new Date(d.expiresAt) - new Date(L.today())) / 864e5) : null)
const docSoon = (d) => { const n = docDays(d); return n == null ? 'No vence' : n < 0 ? `Venció hace ${-n} días` : n === 0 ? 'Vence hoy' : n <= 60 ? `Vence en ${n} días` : `Vence el ${L.fmtDate(d.expiresAt)}` }
// Registrar algo
const picker = ref(false)
const PICK = [['reading', 'Kilometraje', 'Nueva lectura del odómetro', 'timer', '#EEE6F7'], ['service', 'Mantenimiento', 'Trabajo en el taller', 'tool', '#FCE4EC'], ['expense', 'Gasto', 'Lavado, parqueadero, accesorios…', 'wallet', '#FAECCD'], ['doc', 'Documento', 'SOAT, tecnomecánica, tarjeta', 'note', '#EEE6F7'], ['fuel', 'Tanqueada', 'Sirve para calcular el consumo', 'drop', '#FAECCD'], ['file', 'Archivo', 'Fotos, facturas, manuales', 'clip', '#E6F2EC']]
const pick = (t) => { picker.value = false; open(t) }
// Historial unificado
const hFilter = ref('todos')
const timeline = computed(() => {
  if (!v.value) return []
  const out = []
  for (const s of svcs.value) out.push({ key: s.id, type: 'mant', date: s.date || s.intakeDate || '', s })
  for (const e of exps.value) if (!(e.auto && (e.serviceId || e.docId))) out.push({ key: e.id, type: 'gasto', date: e.date, e })
  for (const d of L.documents(g.value, v.value.id, { all: true })) out.push({ key: d.id, type: 'doc', date: d.issuedAt || d.expiresAt || '', d })
  const qq = q.value.toLowerCase()
  return out.filter((x) => (hFilter.value === 'todos' || x.type === hFilter.value) && (!qq || JSON.stringify([x.s && svcTitle(x.s), x.s?.parts, x.s?.notes, x.s && shopOf(x.s.shopId)?.name, x.e?.description, x.d?.name, x.d?.issuer]).toLowerCase().includes(qq))).sort((a, b) => (a.date < b.date ? 1 : -1))
})
const openItem = (x) => (x.type === 'mant' ? (x.s.status === 'por_confirmar' ? open('confirm', { id: x.s.id }) : open('service', x.s)) : x.type === 'gasto' ? editExpense(x.e) : open('doc', x.d))
const catIcon = (c) => EXPENSE_CATS.find((x) => x.id === c)?.icon || 'wallet'
// Plan
const planMode = ref('pronto')
const pronto = computed(() => { const hot = ready.value.filter((x) => ['vencido', 'por_confirmar', 'proximo'].includes(x.status)); return hot.length ? hot : ready.value.slice(0, 3) })
const planGroups = computed(() => { const m = new Map(); for (const x of ready.value) { const k = x.p.component; if (!m.has(k)) m.set(k, []); m.get(k).push(x) } return [...m.entries()].map(([k, list]) => ({ k, name: L.catName(g.value, k), list, first: list[0] })) })
const openPlan = ref(null)
// Documentos
const docMode = ref('vigentes')
const renewable = computed(() => docs.value.filter((d) => d.kind !== 'tarjeta' && d.expiresAt).sort((a, b) => (a.expiresAt < b.expiresAt ? -1 : 1)))
const DOC_ICON = { soat: 'shield', rtm: 'calendar', tarjeta: 'note', impuesto: 'coin', otro: 'note' }
// Gastos
const yearSpend = computed(() => { const y = L.today().slice(0, 4); return v.value ? L.spend(g.value, v.value.id, { from: `${y}-01-01`, to: `${y}-12-31` }) : { total: 0, n: 0 } })
const BAR = ['#C3B3D4', '#F7B6C2', '#FAECCD', '#BFD7F0', '#F9C6A8', '#9A84BD']
const showMiss = ref(false)
watch(() => al.value.missing.some((m) => m.text.startsWith('Revisa el km')), (x) => { if (x) showMiss.value = true }, { immediate: true })
// Movimientos de gastos: filtro por tipo y periodo, agrupados por mes (más reciente arriba)
const gCat = ref(''), gPer = ref('todo')
const expCats = computed(() => [...new Set(exps.value.map((e) => e.category))])
const expView = computed(() => {
  const t = L.today(), y = t.slice(0, 4), m = t.slice(0, 7)
  const list = exps.value.filter((e) => (!gCat.value || e.category === gCat.value) && (gPer.value === 'todo' || (gPer.value === 'anio' ? e.date.startsWith(y) : gPer.value === 'mes' ? e.date.startsWith(m) : e.date >= new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10))))
  const groups = []
  for (const e of list) { const k = e.date.slice(0, 7); let gr = groups.find((x) => x.k === k); if (!gr) { gr = { k, label: (() => { const t = new Date(k + '-15T12:00').toLocaleDateString('es-CO', { month: 'long' }); return `${t.charAt(0).toUpperCase()}${t.slice(1)} ${k.slice(0, 4)}` })(), items: [], total: 0 }; groups.push(gr) } gr.items.push(e); gr.total += Number(e.amount) || 0 }
  return { groups, total: list.reduce((a, e) => a + (Number(e.amount) || 0), 0), n: list.length }
})
const future = (d) => d > L.today()
</script>

<template>
  <div class="stack gar">
    <!-- ===== Ficha de un taller ===== -->
    <template v-if="!v && shopSel">
      <div class="topbar"><button class="iconbtn" aria-label="Volver" @click="shopView = null"><Icon name="back" :size="20" /></button><h2 class="grow">{{ shopSel.name }}<span class="tiny muted" style="display:block;font-weight:400">{{ shopSel.role || 'Taller' }}</span></h2><button class="iconbtn" aria-label="Editar taller" @click="editShop()"><Icon name="edit" :size="18" /></button></div>
      <div v-if="shopSel.blocked" class="warn small"><b>No volver.</b> {{ shopSel.blockedReason }}<span v-if="shopSel.blockedAt" class="tiny muted" style="display:block;margin-top:2px">Marcado el {{ L.fmtDate(shopSel.blockedAt) }}</span></div>
      <section class="card">
        <dl class="kv small">
          <template v-if="shopSel.mechanic"><dt>{{ /taller|montallantas/i.test(shopSel.role || 'taller') ? 'Mecánico' : 'Contacto' }}</dt><dd>{{ shopSel.mechanic }}</dd></template>
          <template v-if="shopSel.address"><dt>Dirección</dt><dd>{{ shopSel.address }}</dd></template>
          <template v-if="shopSel.phone"><dt>Teléfono</dt><dd>{{ shopSel.phone }}</dd></template>
          <template v-if="shopSel.notes"><dt>Notas</dt><dd>{{ shopSel.notes }}</dd></template>
        </dl>
        <p v-if="!shopSel.mechanic && !shopSel.address && !shopSel.phone" class="small muted">Sin datos todavía. Toca el lápiz para agregarlos.</p>
        <div v-if="shopSel.phone || mapsOf(shopSel)" class="acts">
          <a v-if="shopSel.phone" class="act" :href="telUrl(shopSel.phone)"><Icon name="phone" :size="20" /><span>Llamar</span></a>
          <a v-if="shopSel.phone" class="act" :href="waUrl(shopSel.phone)" target="_blank" rel="noopener"><Icon name="chat" :size="20" /><span>WhatsApp</span></a>
          <a v-if="mapsOf(shopSel)" class="act" :href="mapsOf(shopSel)" target="_blank" rel="noopener"><Icon name="pin" :size="20" /><span>Cómo llegar</span></a>
        </div>
      </section>
      <section v-if="shopVisits.length || /taller|montallantas/i.test(shopSel.role || 'taller')" class="card">
        <div class="row between"><h3>Historial de visitas</h3><span class="tiny muted">{{ shopVisits.length }} visita{{ shopVisits.length === 1 ? '' : 's' }}<template v-if="shopSpent"> · {{ L.fmtMoney(shopSpent) }}</template></span></div>
        <button v-for="(s, i) in shopVisits" :key="s.id" class="vrow" @click="s.status === 'por_confirmar' ? open('confirm', { id: s.id, vehicleId: s.vehicleId }) : open('service', s)">
          <span class="vnum">{{ shopVisits.length - i }}</span>
          <span class="grow" style="min-width:0"><span class="small b" style="display:block">{{ svcTitle(s) }}</span><span class="tiny muted"><template v-if="s.intakeDate">La llevaste el {{ L.fmtDate(s.intakeDate) }} · </template>{{ s.status === 'realizado' ? 'te la entregaron el ' + L.fmtDate(s.date) : SERVICE_STATUS[s.status].label }}</span></span>
          <b v-if="L.serviceTotal(s) != null" class="small">{{ L.fmtMoney(L.serviceTotal(s)) }}</b>
        </button>
        <p v-if="!shopVisits.length" class="tiny muted" style="margin-top:6px">Todavía no hay trabajos registrados con este taller.</p>
      </section>
      <button v-if="!shopSel.blocked" class="btn ghost pinkline" @click="editShop({ blocked: true })"><Icon name="lock" :size="15" />No volver con este contacto</button>
      <button v-else class="btn ghost" @click="unblock">Quitar "No volver"</button>
    </template>

    <!-- ===== Lista de vehículos ===== -->
    <template v-else-if="!v">
      <p v-if="vid" class="small muted">Ese vehículo ya no existe.</p>
      <ListBar :count="active.length" one="vehículo" many="vehículos"><template #end><button class="iconbtn add" aria-label="Nuevo vehículo" @click="open('vehicle')"><Icon name="plus" /></button></template></ListBar>
      <button v-for="x in active" :key="x.id" class="card vcard" @click="A.go('garaje', { id: x.id })">
        <VehiclePhoto :vehicle="x" :size="104" :height="84" :radius="14" :icon="typeOf(x.type).icon" />
        <span class="grow" style="min-width:0">
          <span class="b" style="display:block">{{ x.name }}</span>
          <span class="tiny muted" style="display:block">{{ [x.make, x.model].filter(Boolean).join(' ') }}</span>
          <span class="tiny muted" style="display:block">{{ [x.year, x.plate && `Placa: ${x.plate}`].filter(Boolean).join(' · ') }}</span>
          <span class="chip-st" :class="vStatus(x.id).cls">{{ vStatus(x.id).label }}</span>
          <span class="b small" style="display:block;margin-top:4px">{{ summary(x.id).km != null ? L.fmtKm(summary(x.id).km) : 'Km sin registrar' }}</span>
        </span>
        <Icon name="chev" :size="16" class="muted" />
      </button>
      <div v-if="!active.length" class="card empty"><Icon name="moto" :size="30" /><b>Sin vehículos</b><span class="tiny muted">Agrega tu moto o tu carro para llevar su hoja de vida.</span><button class="btn primary sm" @click="open('vehicle')">Agregar vehículo</button></div>

      <section class="card">
        <button class="row between foldhead" :aria-expanded="isOpen('shops', true)" @click="toggle('shops', true)"><h3>Talleres y contactos</h3><Icon name="chev" :size="16" class="muted" :style="{ transform: isOpen('shops', true) ? 'rotate(90deg)' : '' }" /></button>
        <template v-if="isOpen('shops', true)">
          <button v-for="s in shopsOk" :key="s.id" class="lrow" @click="shopView = s.id"><span class="ico" :class="roleIco(s).cls"><Icon :name="roleIco(s).icon" :size="16" /></span><span class="grow" style="min-width:0"><span class="small b" style="display:block">{{ s.name }}</span><span class="tiny muted">{{ s.role || 'Taller' }}{{ lastVisit(s.id) ? ` · última visita ${L.fmtDate(lastVisit(s.id))}` : '' }}</span></span><Icon name="chev" :size="14" class="muted" /></button>
          <button v-for="s in shopsNo" :key="s.id" class="lrow no" @click="shopView = s.id"><span class="ico red"><Icon name="lock" :size="15" /></span><span class="grow small">{{ s.name }}</span><span class="badge red">No volver</span><Icon name="chev" :size="14" class="muted" /></button>
          <p v-if="!g.shops.length" class="tiny muted" style="margin:6px 0">Talleres, grúa, quien te hace los trámites… todo lo de tu vehículo.</p>
          <button class="link" style="margin-top:4px" @click="open('shop')">+ Agregar contacto</button>
        </template>
      </section>
      <section v-if="archived.length" class="card">
        <button class="row between foldhead" @click="toggle('arch')"><h3>Archivados <span class="muted">· {{ archived.length }}</span></h3><Icon name="chev" :size="16" class="muted" :style="{ transform: isOpen('arch') ? 'rotate(90deg)' : '' }" /></button>
        <template v-if="isOpen('arch')"><button v-for="x in archived" :key="x.id" class="lrow" @click="A.go('garaje', { id: x.id })"><span class="grow small">{{ x.name }} <span class="muted">· {{ [x.make, x.model].filter(Boolean).join(' ') }}</span></span><Icon name="chev" :size="14" class="muted" /></button></template>
      </section>
    </template>

    <!-- ===== Ficha de un vehículo ===== -->
    <template v-else>
      <!-- Barra superior -->
      <div class="topbar">
        <button class="iconbtn" :aria-label="tab === 'resumen' ? 'Todos los vehículos' : 'Volver a ' + v.name" @click="tab === 'resumen' ? A.go('garaje') : goTab('resumen')"><Icon name="back" :size="20" /></button>
        <h2 class="grow">{{ tab === 'resumen' ? v.name : SECTIONS[tab] }}</h2>
        <button v-if="tab === 'plan'" class="iconbtn" aria-label="Nuevo plan" @click="open('plan')"><Icon name="plus" :size="20" /></button>
        <button v-else-if="tab === 'docs'" class="iconbtn" aria-label="Nuevo documento" @click="open('doc')"><Icon name="plus" :size="20" /></button>
        <button v-else-if="tab === 'gastos'" class="iconbtn" aria-label="Nuevo gasto" @click="open('expense')"><Icon name="plus" :size="20" /></button>
        <button v-else-if="tab === 'archivos'" class="iconbtn" aria-label="Subir archivo" @click="open('file')"><Icon name="plus" :size="20" /></button>
        <button v-else-if="tab === 'mant'" class="iconbtn" aria-label="Registrar" @click="picker = true"><Icon name="plus" :size="20" /></button>
        <div class="menuw"><button class="iconbtn" aria-label="Más opciones" :aria-expanded="menu" @click="menu = !menu"><Icon name="more" :size="20" /></button>
          <div v-if="menu" class="menu" @click="menu = false">
            <button @click="open('vehicle', v)"><Icon name="edit" :size="15" />Editar vehículo</button>
            <button @click="goTab('ajustes')"><Icon name="settings" :size="15" />Ficha técnica y lo que usa</button>
            <button @click="exportJson"><Icon name="download" :size="15" />Exportar hoja de vida</button>
            <button @click="archive(!v.archived)"><Icon name="folder" :size="15" />{{ v.archived ? 'Volver a activar' : 'Archivar vehículo' }}</button>
          </div>
        </div>
      </div>
      <div class="dtabs" role="tablist" aria-label="Secciones del vehículo"><button v-for="t in DTABS" :key="t[0]" role="tab" :aria-selected="tab === t[0]" :class="{ on: tab === t[0] }" @click="goTab(t[0])">{{ t[1] }}</button></div>

      <!-- Resumen -->
      <template v-if="tab === 'resumen'">
        <div class="hero">
          <section class="card herocard">
            <button class="ph" :aria-label="v.photoFileId ? 'Cambiar foto' : 'Poner foto'" @click="open('vehicle', v)"><VehiclePhoto :vehicle="v" size="100%" :height="200" :radius="16" :icon="typeOf(v.type).icon" dots /><span v-if="!L.photosOf(v).length" class="phhint"><Icon name="image" :size="14" />Poner foto</span></button>
            <div class="hinfo"><b>{{ [v.make, v.model].filter(Boolean).join(' ') }}{{ v.year ? ` · ${v.year}` : '' }} <span v-if="v.archived" class="badge">Archivado</span></b><span class="tiny muted">{{ [v.plate && `Placa: ${v.plate}`, v.color && `Color: ${v.color}`].filter(Boolean).join(' · ') || 'Placa sin registrar' }}</span></div>
          </section>
          <div class="stats">
            <button class="card stat" @click="goTab('km')"><b class="big">{{ km != null ? L.fmtKm(km) : '—' }}</b><span class="tiny muted">{{ km != null ? 'Kilometraje actual' : 'Registra el km' }}</span></button>
            <button class="card stat" @click="goTab('mant')"><span class="tiny muted">Último mantenimiento</span><b>{{ lastSvc ? L.fmtDate(lastSvc.date) : 'Sin registros' }}</b><span v-if="lastSvc?.km != null" class="tiny muted">{{ L.fmtKm(lastSvc.km) }}</span></button>
          </div>
          <button class="btn primary big-cta" @click="picker = true"><Icon name="plus" :size="18" />Registrar algo</button>
        </div>
        <div class="shortcuts">
          <button v-for="sc in SHORTCUTS" :key="sc[0]" class="scut" @click="goTab(sc[0])"><span class="scico"><Icon :name="sc[2]" :size="20" /></span><span>{{ sc[1] }}</span></button>
        </div>
        <div class="rgrid">
          <section class="card">
            <div class="row between"><h3 class="wi"><Icon name="clock" :size="16" />Lo próximo</h3><button class="link" @click="goTab('plan')">Ver plan</button></div>
            <button v-if="nextPlan" class="nrow" @click="goTab('plan')"><span class="ico pink"><Icon name="tool" :size="16" /></span><span class="grow"><span class="small b" style="display:block">{{ planName(nextPlan) }} · {{ L.actionLabel(nextPlan.p.action).toLowerCase() }}</span><span class="small" :class="nextPlan.status === 'vencido' ? 'tred' : nextPlan.status === 'proximo' ? 'tpink' : 'tok'" style="display:block">{{ when(nextPlan).main }}</span><span v-if="when(nextPlan).sub" class="tiny muted" style="display:block">{{ when(nextPlan).sub }}</span><span v-if="progress(nextPlan) != null" class="pbar" :class="nextPlan.status"><i :style="{ width: progress(nextPlan) * 100 + '%' }"></i></span></span><Icon name="chev" :size="14" class="muted" /></button>
            <button v-if="nextDoc" class="nrow" @click="goTab('docs')"><span class="ico lav"><Icon :name="DOC_ICON[nextDoc.kind] || 'note'" :size="16" /></span><span class="grow"><span class="small b" style="display:block">{{ nextDoc.name }}</span><span class="tiny" :class="docDays(nextDoc) < 0 ? 'tred' : 'muted'">{{ docSoon(nextDoc) }}</span></span><Icon name="chev" :size="14" class="muted" /></button>
            <p v-if="!nextPlan && !nextDoc" class="small muted" style="margin-top:6px">Nada pendiente por ahora.</p>
          </section>
          <section class="card">
            <h3 class="wi"><Icon name="bell" :size="16" />Estado</h3>
            <div v-if="!al.alerts.length" class="okbox"><span class="okico"><Icon name="check" :size="18" :stroke="3" /></span><span><b class="small">Todo en orden</b><span class="tiny muted" style="display:block">No hay nada vencido ni por vencer.</span></span></div>
            <button v-for="(a, i) in al.alerts" :key="i" class="arow" @click="a.kind === 'service' ? open('confirm', { id: a.id }) : a.kind === 'doc' ? goTab('docs') : goTab('plan')"><Icon :name="a.level === 'red' ? 'info' : 'clock'" :size="15" :class="a.level === 'red' ? 'tred' : 'twarn'" /><span class="grow small">{{ a.text }}</span><Icon name="chev" :size="14" class="muted" /></button>
          </section>
          <section class="card">
            <div class="row between"><h3 class="wi"><Icon name="wallet" :size="16" />Gastos del mes</h3><button class="link" @click="goTab('gastos')">Ver</button></div>
            <b class="big" style="display:block;margin-top:6px">{{ L.fmtMoney(month.total) }}</b>
            <span class="tiny muted">{{ month.n }} registro{{ month.n === 1 ? '' : 's' }} · {{ L.fmtMoney(yearSpend.total) }} en el año</span>
          </section>
        </div>
        <button v-if="al.missing.length" class="missrow" :aria-expanded="showMiss" @click="showMiss = !showMiss"><Icon name="info" :size="14" />{{ al.missing.length }} dato{{ al.missing.length === 1 ? '' : 's' }} por completar<Icon name="chev" :size="12" :style="{ transform: showMiss ? 'rotate(90deg)' : '' }" /></button>
        <section v-if="showMiss" class="card">
          <button v-for="(m, i) in al.missing" :key="i" class="arow" @click="m.kind === 'km' ? open('reading') : m.kind === 'doc' ? open('doc', { kind: m.docKind }) : m.kind === 'service' ? open('service', g.services.find((s) => s.id === m.id)) : goTab('plan')"><Icon name="plus" :size="14" class="muted" /><span class="grow small">{{ m.text }}</span></button>
        </section>
      </template>

      <!-- Historial -->
      <template v-else-if="tab === 'mant'">
        <label class="search"><Icon name="search" :size="16" /><input v-model="q" placeholder="Buscar en el historial…" aria-label="Buscar en el historial" /></label>
        <div class="chips" role="tablist" aria-label="Filtrar historial"><button v-for="c in [['todos', 'Todos'], ['mant', 'Mantenimiento'], ['gasto', 'Gastos'], ['doc', 'Documentos']]" :key="c[0]" role="tab" :aria-selected="hFilter === c[0]" :class="{ on: hFilter === c[0] }" @click="hFilter = c[0]">{{ c[1] }}</button></div>
        <button v-for="x in timeline" :key="x.key" class="card hcard" @click="openItem(x)">
          <template v-if="x.type === 'mant'">
            <span class="ico pink"><Icon name="tool" :size="17" /></span>
            <span class="grow" style="min-width:0">
              <span class="row between" style="gap:6px"><b class="small">Mantenimiento</b><span class="chip-st" :class="SERVICE_STATUS[x.s.status].badge">{{ SERVICE_STATUS[x.s.status].label }}</span></span>
              <span class="tiny muted" style="display:block">{{ L.fmtDate(x.s.date || x.s.intakeDate) }}{{ x.s.km != null ? ` · ${L.fmtKm(x.s.km)}` : '' }}</span>
              <span class="small" style="display:block;margin-top:2px">{{ svcTitle(x.s) }}</span>
              <span class="tiny muted" style="display:block">{{ [shopOf(x.s.shopId)?.name, L.serviceTotal(x.s) != null && L.fmtMoney(L.serviceTotal(x.s))].filter(Boolean).join(' · ') }}</span>
            </span>
          </template>
          <template v-else-if="x.type === 'gasto'">
            <span class="ico cream"><Icon :name="catIcon(x.e.category)" :size="17" /></span>
            <span class="grow" style="min-width:0">
              <span class="row between" style="gap:6px"><b class="small">Gasto</b><span class="chip-st lav">{{ catLabel(x.e.category) }}</span></span>
              <span class="tiny muted" style="display:block">{{ L.fmtDate(x.e.date) }}</span>
              <span class="small" style="display:block;margin-top:2px">{{ x.e.description || catLabel(x.e.category) }} · <b>{{ L.fmtMoney(x.e.amount, x.e.currency) }}</b></span>
            </span>
          </template>
          <template v-else>
            <span class="ico lav"><Icon :name="DOC_ICON[x.d.kind] || 'note'" :size="17" /></span>
            <span class="grow" style="min-width:0">
              <span class="row between" style="gap:6px"><b class="small">Documento</b><span class="chip-st" :class="x.d.status === 'reemplazado' ? '' : L.docStatus(x.d).badge">{{ x.d.status === 'reemplazado' ? 'Renovado' : L.docStatus(x.d).label }}</span></span>
              <span class="tiny muted" style="display:block">{{ L.fmtDate(x.d.issuedAt) }}</span>
              <span class="small" style="display:block;margin-top:2px">{{ x.d.name }}{{ x.d.issuer ? ` · ${x.d.issuer}` : '' }}</span>
            </span>
          </template>
        </button>
        <div v-if="!timeline.length" class="card empty"><Icon name="tool" :size="28" /><b>{{ q || hFilter !== 'todos' ? 'Nada coincide' : 'Sin registros' }}</b><span class="tiny muted">Aquí aparecerán tus mantenimientos, gastos y documentos.</span><button class="btn primary sm" @click="picker = true">Registrar algo</button></div>
      </template>

      <!-- Plan -->
      <template v-else-if="tab === 'plan'">
        <Seg v-model="planMode" :options="[['pronto', 'Lo que toca pronto'], ['todo', 'Todo el plan']]" label="Vista del plan" />
        <template v-if="planMode === 'pronto'">
          <section v-for="x in pronto" :key="x.p.id" class="card pcard">
            <div class="row" style="gap:12px;align-items:flex-start">
              <span class="ico pink big"><Icon name="tool" :size="20" /></span>
              <div class="grow" style="min-width:0">
                <div class="row between" style="gap:6px"><b>{{ planName(x) }}</b><span class="chip-st" :class="PLAN_STATUS[x.status].badge">{{ PLAN_STATUS[x.status].label }}</span></div>
                <div class="small" :class="x.status === 'vencido' ? 'tred' : x.status === 'proximo' ? 'tpink' : 'tok'">{{ L.actionLabel(x.p.action) }} · {{ when(x).main }}</div>
                <div v-if="when(x).sub" class="tiny muted">{{ when(x).sub }}</div>
                <span v-if="progress(x) != null" class="pbar" :class="x.status"><i :style="{ width: progress(x) * 100 + '%' }"></i></span>
                <div class="tiny muted">{{ every(x.p) }}</div>
              </div>
            </div>
            <div v-if="openPlan === x.p.id" class="pdet">
              <p class="tiny muted">Último: {{ x.last ? `${L.fmtDate(x.last.date)}${x.last.km != null ? ` · ${L.fmtKm(x.last.km)}` : ''}` : 'sin registro' }} · {{ VERIFICATION[x.p.verification]?.label }}{{ x.p.page ? ` (${x.p.page})` : '' }}</p>
              <div class="row wrap" style="gap:6px"><button class="btn sm primary" @click="open('service', { items: [{ component: x.p.component, action: x.p.action, detail: '' }] })">Ya se hizo</button><button class="btn sm ghost" @click="wantTask(x)">Recordármelo</button><button class="btn sm ghost" @click="open('plan', x.p)">Editar</button></div>
            </div>
            <button class="btn sm soft" style="margin-top:10px;width:100%" @click="openPlan = openPlan === x.p.id ? null : x.p.id">{{ openPlan === x.p.id ? 'Ocultar' : 'Ver detalles' }}</button>
          </section>
          <div v-if="!pronto.length" class="card empty"><Icon name="calendar" :size="28" /><b>Nada por ahora</b><span class="tiny muted">Cuando algo esté por tocar, aparece aquí.</span></div>
        </template>
        <template v-else>
          <section v-for="gr in planGroups" :key="gr.k" class="card acc">
            <button class="acchead" :aria-expanded="openPlan === gr.k" @click="openPlan = openPlan === gr.k ? null : gr.k"><span class="ico lav"><Icon name="tool" :size="16" /></span><span class="grow" style="min-width:0"><span class="small b" style="display:block">{{ gr.name }}</span><span class="tiny" :class="gr.first.status === 'vencido' ? 'tred' : 'muted'">{{ when(gr.first).main }}</span></span><Icon name="chev" :size="14" class="muted" :style="{ transform: openPlan === gr.k ? 'rotate(90deg)' : '' }" /></button>
            <div v-if="openPlan === gr.k" class="pdet">
              <div v-for="x in gr.list" :key="x.p.id" class="pline">
                <div class="row between" style="gap:6px"><span class="small b">{{ L.actionLabel(x.p.action) }}</span><span class="chip-st" :class="PLAN_STATUS[x.status].badge">{{ PLAN_STATUS[x.status].label }}</span></div>
                <div class="tiny muted">{{ when(x).main }}{{ when(x).sub ? ` · ${when(x).sub}` : '' }}</div><div class="tiny muted">{{ every(x.p) }}</div>
                <div class="row wrap" style="gap:6px;margin-top:6px"><button class="btn sm ghost" @click="open('service', { items: [{ component: x.p.component, action: x.p.action, detail: '' }] })">Ya se hizo</button><button class="btn sm ghost" @click="wantTask(x)">Recordármelo</button><button class="btn sm ghost" @click="open('plan', x.p)">Editar</button></div>
              </div>
            </div>
          </section>
          <section v-if="waiting.length" class="card acc">
            <button class="acchead" @click="openPlan = openPlan === '_wait' ? null : '_wait'"><span class="ico cream"><Icon name="info" :size="16" /></span><span class="grow"><span class="small b" style="display:block">Esperan un dato ({{ waiting.length }})</span><span class="tiny muted">Falta saber cuándo se hizo por última vez</span></span><Icon name="chev" :size="14" class="muted" :style="{ transform: openPlan === '_wait' ? 'rotate(90deg)' : '' }" /></button>
            <div v-if="openPlan === '_wait'" class="pdet"><div v-for="x in waiting" :key="x.p.id" class="row between pline" style="gap:8px"><span class="small grow">{{ planName(x) }} · {{ L.actionLabel(x.p.action).toLowerCase() }} <span class="tiny muted">· {{ every(x.p) }}</span></span><button class="btn sm lav" @click="open('service', { items: [{ component: x.p.component, action: x.p.action, detail: '' }] })">Ya se hizo</button></div></div>
          </section>
          <section v-if="suggested.length" class="card acc">
            <button class="acchead" @click="openPlan = openPlan === '_sug' ? null : '_sug'"><span class="ico sky"><Icon name="bulb" :size="16" /></span><span class="grow"><span class="small b" style="display:block">Sugerencias ({{ suggested.length }})</span><span class="tiny muted">Revísalas antes de activarlas</span></span><Icon name="chev" :size="14" class="muted" /></button>
            <div v-if="openPlan === '_sug'" class="pdet"><div v-for="x in suggested" :key="x.p.id" class="row between pline" style="gap:8px"><span class="small grow">{{ planName(x) }} · {{ L.actionLabel(x.p.action).toLowerCase() }} <span class="tiny muted">· {{ every(x.p) }}</span></span><button class="btn sm lav" @click="G.setPlanActive(x.p.id, true, 'usuario'); toast('Activado')">Activar</button></div></div>
          </section>
        </template>
      </template>

      <!-- Documentos -->
      <template v-else-if="tab === 'docs'">
        <Seg v-model="docMode" :options="[['vigentes', 'Vigentes'], ['historial', 'Historial', null, oldDocs.length || null]]" label="Documentos" />
        <template v-if="docMode === 'vigentes'">
          <section v-for="d in docs" :key="d.id" class="card dcard" @click="open('doc', d)">
            <span class="ico lav big"><Icon :name="DOC_ICON[d.kind] || 'note'" :size="20" /></span>
            <span class="grow" style="min-width:0"><span class="row between" style="gap:6px"><b class="small">{{ d.name }}</b><span class="chip-st" :class="L.docStatus(d).badge">{{ L.docStatus(d).badge === 'green' ? 'Al día' : L.docStatus(d).label }}</span></span><span class="tiny muted" style="display:block">{{ d.expiresAt ? `Vence: ${L.fmtDate(d.expiresAt)}` : 'Sin vencimiento' }}</span></span>
            <button v-if="d.driveFileId || d.fileIds?.length" class="btn sm ghost pdfb" @click.stop="d.driveFileId ? (drivePv = { id: d.driveFileId, name: d.name }) : view(fileOf(d.fileIds[0]))"><Icon name="eye" :size="13" />Ver PDF</button>
          </section>
          <section v-for="k in ['soat', 'rtm'].filter((k) => !docs.some((d) => d.kind === k))" :key="k" class="card dcard dashed" @click="open('doc', { kind: k })">
            <span class="ico cream big"><Icon :name="DOC_ICON[k]" :size="20" /></span><span class="grow"><b class="small">{{ DOC_KINDS.find((x) => x.id === k).label }}</b><span class="tiny muted" style="display:block">Sin registrar · toca para agregar</span></span>
          </section>
          <button v-if="renewable.length" class="btn soft big-cta" @click="open('renew', { oldId: renewable[0].id })"><Icon name="refresh" :size="16" />Renovar {{ renewable[0].name }}</button>
          <button v-if="v.driveFolder" class="link small" style="align-self:center" @click="goTab('archivos')"><Icon name="folder" :size="13" class="inl" /> Ver la carpeta de Drive</button>
        </template>
        <template v-else>
          <section class="card">
            <button v-for="d in oldDocs" :key="d.id" class="lrow" @click="open('doc', d)"><span class="ico lav"><Icon :name="DOC_ICON[d.kind] || 'note'" :size="15" /></span><span class="grow" style="min-width:0"><span class="small b" style="display:block">{{ d.name }}</span><span class="tiny muted">{{ L.fmtDate(d.issuedAt) }} – {{ L.fmtDate(d.expiresAt) }}{{ d.issuer ? ` · ${d.issuer}` : '' }}{{ d.cost ? ` · ${L.fmtMoney(d.cost)}` : '' }}</span></span><button v-if="d.driveFileId" class="iconbtn" aria-label="Ver documento" @click.stop="drivePv = { id: d.driveFileId, name: `${d.name} (${L.fmtDate(d.issuedAt)})` }"><Icon name="eye" :size="15" /></button></button>
            <p v-if="!oldDocs.length" class="small muted">Las renovaciones anteriores aparecerán aquí.</p>
          </section>
        </template>
      </template>

      <!-- Gastos -->
      <template v-else-if="tab === 'gastos'">
        <div class="stats">
          <div class="card stat"><span class="tiny muted">Total mes</span><b class="big">{{ L.fmtMoney(month.total) }}</b><span class="tiny muted">{{ month.n }} registro{{ month.n === 1 ? '' : 's' }}</span></div>
          <div class="card stat"><span class="tiny muted">Acumulado</span><b class="big">{{ L.fmtMoney(yearSpend.total) }}</b><span class="tiny muted">{{ L.today().slice(0, 4) }}</span></div>
        </div>
        <section v-if="allSpend.n" class="card">
          <div class="bars2" aria-label="Gasto por mes">
            <div v-for="(m, i) in months" :key="m.k" class="bcol2"><span v-if="i === months.length - 1 && m.total" class="bval">{{ L.fmtMoney(m.total) }}</span><div class="btrack2"><i :style="{ height: Math.max(3, m.total / maxMonth * 100) + '%', background: BAR[i % BAR.length] }" :title="L.fmtMoney(m.total)"></i></div><span class="tiny muted">{{ m.label }}</span></div>
          </div>
        </section>
        <section class="card">
          <h3 class="wi"><Icon name="drop" :size="16" />Consumo de combustible</h3>
          <p v-if="econ" style="margin-top:6px"><b class="big">{{ econ.avg.toFixed(1) }} km/{{ econ.unit === 'gal' ? 'gal' : 'L' }}</b> <span class="tiny muted">· promedio de {{ econ.segments.length }} tramo{{ econ.segments.length === 1 ? '' : 's' }}</span></p>
          <p v-else class="small muted" style="margin-top:6px">Registra dos tanqueadas con tanque lleno y km para calcularlo.</p>
        </section>
        <section class="card">
          <div class="row between" style="gap:8px"><h3>Movimientos</h3>
            <select v-model="gPer" class="persel" aria-label="Periodo"><option value="todo">Todo</option><option value="mes">Este mes</option><option value="90">Últimos 3 meses</option><option value="anio">Este año</option></select></div>
          <div v-if="expCats.length > 1" class="chips" style="margin-top:10px" role="tablist" aria-label="Tipo de gasto"><button role="tab" :aria-selected="!gCat" :class="{ on: !gCat }" @click="gCat = ''">Todos</button><button v-for="c in expCats" :key="c" role="tab" :aria-selected="gCat === c" :class="{ on: gCat === c }" @click="gCat = c">{{ catLabel(c) }}</button></div>
          <p v-if="expView.n" class="tiny muted" style="margin-top:8px">{{ expView.n }} movimiento{{ expView.n === 1 ? '' : 's' }} · {{ L.fmtMoney(expView.total) }}</p>
          <div v-for="gr in expView.groups" :key="gr.k" class="mgroup">
            <div class="mhead"><span>{{ gr.label }}</span><span>{{ L.fmtMoney(gr.total) }}</span></div>
            <button v-for="e in gr.items" :key="e.id" class="lrow" @click="editExpense(e)"><span class="ico cream"><Icon :name="catIcon(e.category)" :size="15" /></span><span class="grow" style="min-width:0"><span class="small" style="display:block">{{ e.description || catLabel(e.category) }}</span><span class="tiny muted">{{ L.fmtDate(e.date) }} · {{ catLabel(e.category) }}</span><span v-if="future(e.date)" class="tiny tred" style="display:block">Fecha en el futuro: revísala</span></span><b class="small">{{ L.fmtMoney(e.amount, e.currency) }}</b></button>
          </div>
          <p v-if="!expView.n" class="small muted" style="margin-top:6px">{{ exps.length ? 'Nada en ese filtro.' : 'Sin gastos todavía.' }}</p>
        </section>
      </template>

      <!-- Kilometraje -->
      <template v-else-if="tab === 'km'">
        <section class="card row" style="gap:10px"><div class="grow"><b class="big">{{ km != null ? L.fmtKm(km) : 'Sin registrar' }}</b><div class="tiny muted">Kilometraje actual{{ lastPt ? ` · ${L.fmtDate(lastPt.date)}` : '' }}</div></div><button class="btn sm primary" @click="open('reading')">Actualizar</button></section>
        <section class="card"><h3>Lecturas</h3>
          <button v-for="r in kmRows" :key="r.id" class="lrow" @click="open('reading', r)"><span class="grow small">{{ L.fmtKm(r.km) }} <span v-if="r.correction" class="badge yellow">Corrección</span><span class="tiny muted" style="display:block">{{ L.fmtDate(r.date) }}{{ r.note ? ` · ${r.note}` : '' }}{{ r.correctionNote ? ` · ${r.correctionNote}` : '' }}</span></span><span class="tiny muted">{{ r.dist != null ? `+${L.fmtKm(r.dist)}` : '' }}</span></button>
          <p v-if="!kmRows.length" class="small muted" style="margin-top:6px">Sin lecturas propias. El km de los mantenimientos y tanqueadas también cuenta.</p>
        </section>
      </template>

      <!-- Archivos -->
      <template v-else-if="tab === 'archivos'">
        <section v-if="v.driveFolder" class="card"><DriveBrowser :root="v.driveFolder" prefer="personal" :height="380" title="Carpeta en Drive" icon="folder" /></section>
        <button v-else class="card lrow" style="width:100%" @click="open('vehicle', v)"><span class="ico sky"><Icon name="folder" :size="16" /></span><span class="grow small"><b>Conectar carpeta de Drive</b><span class="tiny muted" style="display:block">Ve tus documentos sin volver a subirlos</span></span><Icon name="plus" :size="16" class="muted" /></button>
        <section v-for="k in FILE_KINDS.filter((x) => files.some((f) => f.kind === x.id))" :key="k.id" class="card">
          <h3>{{ k.label }}</h3>
          <div v-for="fm in files.filter((f) => f.kind === k.id)" :key="fm.id" class="lrow" style="align-items:flex-start">
            <span class="ico lav"><Icon name="clip" :size="15" /></span>
            <span class="grow small" style="min-width:0">{{ fm.name }}<span class="tiny muted" style="display:block">{{ fm.storage === 'link' ? 'Enlace externo' : `Guardado en MuMu · ${(fm.size / 1048576).toFixed(1)} MB` }}</span><button v-if="fm.storage === 'link' && fm.kind === 'manual'" class="link tiny" style="padding:4px 0" :disabled="loading === fm.id" @click="copyManual(fm)">{{ loading === fm.id ? 'Guardando…' : 'Guardar una copia en MuMu' }}</button></span>
            <button class="iconbtn" :aria-label="`Abrir ${fm.name}`" :disabled="loading === fm.id" @click="view(fm)"><Icon name="eye" :size="16" /></button>
            <button class="iconbtn" aria-label="Borrar archivo" @click="delVehicleFile(fm)"><Icon name="trash" :size="16" /></button>
          </div>
        </section>
        <div v-if="!files.length" class="card empty"><Icon name="clip" :size="28" /><b>Sin archivos</b><span class="tiny muted">Guarda fotos, facturas y manuales en privado.</span><button class="btn primary sm" @click="open('file')">Subir archivo</button></div>
      </template>

      <!-- Ficha técnica -->
      <template v-else-if="tab === 'ajustes'">
        <section class="card">
          <div class="row between"><h3>Lo que usa</h3><button class="link" @click="open('part')">+ Agregar</button></div>
          <p class="tiny muted" style="margin-top:2px">Aceite, bujía, llantas… con su referencia y una foto, para pedirlo igual.</p>
          <button v-for="c in v.consumables || []" :key="c.id" class="lrow" @click="open('part', c)"><FileThumb :id="c.photoId" :size="52" icon="drop" :alt="c.label" /><span class="grow" style="min-width:0"><span class="small b" style="display:block">{{ c.label }}</span><span class="tiny" style="display:block">{{ c.brand }}</span><span class="tiny muted">{{ [c.ref && `Ref. ${c.ref}`, c.qty].filter(Boolean).join(' · ') }}</span></span><Icon name="chev" :size="14" class="muted" /></button>
        </section>
        <section class="card stack small" style="gap:6px">
          <div class="row between"><h3>Datos del vehículo</h3><button class="link" @click="open('vehicle', v)">Editar</button></div>
          <div v-for="r in [['Tipo', typeOf(v.type).label], ['Marca', v.make], ['Modelo', v.model], ['Año', v.year], ['Placa', v.plate], ['Matrícula', v.registeredAt && L.fmtDate(v.registeredAt)], ['Color', v.color], ['Combustible', v.fuelType]]" :key="r[0]" class="spec"><span class="muted">{{ r[0] }}</span><span>{{ r[1] || '—' }}</span></div>
        </section>
        <section v-if="Object.keys(v.specs || {}).length" class="card stack small" style="gap:6px">
          <h3>Datos técnicos</h3>
          <div v-for="(val, k) in v.specs" :key="k" class="spec"><span class="muted">{{ SPEC_LABELS[k] || k }}</span><span>{{ val }}</span></div>
        </section>
      </template>
    </template>

    <!-- Registrar algo -->
    <div v-if="picker" class="pv sheetb" role="dialog" aria-modal="true" aria-label="¿Qué quieres registrar?" @click.self="picker = false">
      <div class="pick">
        <div class="row between"><h2 style="margin:0">¿Qué quieres registrar?</h2><button class="iconbtn" aria-label="Cerrar" @click="picker = false"><Icon name="x" :size="18" /></button></div>
        <p class="small muted" style="margin:2px 0 10px">Elige una opción para empezar.</p>
        <button v-for="o in PICK" :key="o[0]" class="optrow" @click="pick(o[0])"><span class="ico big" :style="{ background: o[4] }"><Icon :name="o[3]" :size="20" /></span><span class="grow"><b class="small" style="display:block">{{ o[1] }}</b><span class="tiny muted">{{ o[2] }}</span></span><Icon name="chev" :size="14" class="muted" /></button>
      </div>
    </div>
    <div v-if="drivePv" class="pv" role="dialog" aria-modal="true" :aria-label="drivePv.name" @click.self="drivePv = null">
      <div class="pv-box">
        <div class="pv-top"><b class="pv-name">{{ drivePv.name }}</b><a class="btn sm lav" :href="driveOpenUrl(drivePv.id)" target="_blank" rel="noopener">Abrir en Drive ↗</a><button ref="pvClose" class="iconbtn" aria-label="Cerrar" @click="drivePv = null"><Icon name="x" :size="18" /></button></div>
        <iframe class="pv-frame" :src="drivePreviewUrl(drivePv.id)" :title="drivePv.name" allow="fullscreen" allowfullscreen></iframe>
      </div>
    </div>
    <GarageSheet />
  </div>
</template>

<style scoped>
.gar h2 { font-size: 18px; margin: 0; }
.ttl { font-size: 22px !important; }
.topbar { display: flex; align-items: center; gap: 4px; margin: -4px 0 0; }
.topbar h2 { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.menuw { position: relative; }
.menu { position: absolute; right: 0; top: 44px; z-index: 30; background: var(--surface); border: 1px solid var(--line); border-radius: 14px; box-shadow: var(--shadow-lg); padding: 6px; min-width: 210px; display: flex; flex-direction: column; }
.menu button { display: flex; gap: 10px; align-items: center; padding: 10px; border: 0; background: none; color: inherit; font: inherit; font-size: 14px; border-radius: 10px; text-align: left; cursor: pointer; }
.menu button:hover { background: var(--pink-50); }
/* Íconos en cuadrito de color */
.ico { width: 34px; height: 34px; border-radius: 11px; display: grid; place-items: center; flex: none; background: var(--lav-100); color: var(--lav-700); }
.ico.big { width: 44px; height: 44px; border-radius: 14px; }
.ico.pink { background: var(--pink-100); color: var(--pink-700); }
.ico.lav { background: var(--lav-100); color: var(--lav-700); }
.ico.cream { background: color-mix(in srgb, var(--cream) 70%, var(--surface)); color: #8A6A2A; }
.ico.sky { background: color-mix(in srgb, var(--sky) 60%, var(--surface)); color: #3F6A93; }
.ico.red { background: color-mix(in srgb, var(--danger) 15%, var(--surface)); color: var(--danger); }
:root[data-theme="dark"] .ico.cream, :root[data-theme="dark"] .ico.sky { color: var(--ink); }
/* Chips de estado */
.chip-st { display: inline-block; font-size: 11.5px; font-weight: 600; padding: 3px 10px; border-radius: 999px; background: var(--surface-3); color: var(--ink-2); white-space: nowrap; margin-top: 4px; }
.chip-st.green { background: color-mix(in srgb, var(--ok) 16%, var(--surface)); color: var(--mint-700); }
.chip-st.yellow { background: color-mix(in srgb, var(--butter) 55%, var(--surface)); color: #8A5A10; }
.chip-st.pink { background: var(--pink-100); color: var(--pink-700); }
.chip-st.red { background: color-mix(in srgb, var(--danger) 14%, var(--surface)); color: var(--danger); }
.chip-st.lav { background: var(--lav-100); color: var(--lav-700); }
:root[data-theme="dark"] .chip-st.yellow { color: #FFE29A; }
.pbar { display: block; height: 5px; border-radius: 99px; background: var(--track); margin: 6px 0 2px; overflow: hidden; }
.pbar i { display: block; height: 100%; border-radius: 99px; background: var(--ok); transition: width .6s ease; }
.pbar.proximo i, .pbar.por_confirmar i { background: var(--pink-500); } .pbar.vencido i { background: var(--danger); }
.tok { color: var(--mint-700); }
.tred { color: var(--danger); } .tpink { color: var(--pink-700); } .twarn { color: var(--warn); }
.big { font-size: 22px; font-weight: 700; letter-spacing: -.01em; }
/* Lista */
.vcard { display: flex; gap: 14px; align-items: center; width: 100%; text-align: left; cursor: pointer; color: inherit; font: inherit; border: 0; }
.foldhead { width: 100%; background: none; border: 0; padding: 0; color: inherit; font: inherit; cursor: pointer; }
.lrow { display: flex; align-items: center; gap: 12px; width: 100%; padding: 10px 0; border: 0; border-bottom: 1px solid var(--line); background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.lrow:last-of-type { border-bottom: 0; }
.lrow.no { opacity: .85; }
.empty { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 6px; padding: 24px 16px; color: var(--muted); }
.empty b { color: var(--ink); }
.empty .btn { margin-top: 6px; }
/* Ficha */
.hero { display: flex; flex-direction: column; gap: 12px; }
.herocard { padding: 10px; }
.ph { display: block; width: 100%; border: 0; padding: 0; background: none; cursor: pointer; position: relative; border-radius: 16px; }
.phhint { position: absolute; right: 10px; bottom: 10px; display: inline-flex; gap: 6px; align-items: center; background: color-mix(in srgb, var(--surface) 85%, transparent); color: var(--ink); font-size: 12px; padding: 5px 10px; border-radius: 999px; }
.hinfo { display: flex; flex-direction: column; padding: 10px 4px 2px; }
.stats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.stat { display: flex; flex-direction: column; gap: 2px; text-align: left; border: 0; color: inherit; font: inherit; cursor: pointer; padding: 14px; }
div.stat { cursor: default; }
.big-cta { width: 100%; justify-content: center; padding: 13px; font-size: 15px; border-radius: 999px; }
.btn.soft { background: var(--pink-50); color: var(--pink-700); border: 1px solid var(--pink-200); }
.pinkline { border-color: var(--pink-300); color: var(--pink-700); }
.shortcuts { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
.scut { display: flex; flex-direction: column; align-items: center; gap: 6px; border: 0; background: none; color: var(--ink-2); font: inherit; font-size: 12px; cursor: pointer; padding: 0; }
.scico { width: 100%; max-width: 60px; aspect-ratio: 1; border-radius: 16px; display: grid; place-items: center; background: var(--surface); box-shadow: var(--shadow); color: var(--pink-700); }
.rgrid { display: grid; gap: 12px; }
.nrow, .arow { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 0 2px; border: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.nrow { background: var(--pink-50); border-radius: 14px; padding: 10px; margin-top: 8px; }
.okbox { display: flex; gap: 10px; align-items: center; margin-top: 8px; padding: 10px; border-radius: 14px; background: color-mix(in srgb, var(--ok) 10%, var(--surface)); }
.okico { width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; background: var(--ok); color: #fff; flex: none; }
.missrow { align-self: center; display: inline-flex; gap: 6px; align-items: center; border: 0; background: none; color: var(--muted); font: inherit; font-size: 13px; cursor: pointer; padding: 6px 10px; }
.dtabs { display: none; }
/* Historial */
.search { display: flex; align-items: center; gap: 8px; background: var(--surface); border: 1px solid var(--line); border-radius: 999px; padding: 10px 14px; color: var(--muted); }
.search input { border: 0; outline: 0; background: none; flex: 1; font: inherit; color: var(--ink); min-width: 0; }
.chips { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; }
.chips button { flex: none; border: 1px solid var(--line); background: var(--surface); color: var(--ink-2); font: inherit; font-size: 13px; padding: 7px 14px; border-radius: 999px; cursor: pointer; }
.chips button.on { background: var(--pink-100); border-color: var(--pink-200); color: var(--pink-700); font-weight: 600; }
.hcard { display: flex; gap: 12px; align-items: flex-start; width: 100%; text-align: left; color: inherit; font: inherit; border: 0; cursor: pointer; }
.hcard .chip-st { margin-top: 0; }
/* Plan */
.pcard .chip-st, .acc .chip-st { margin-top: 0; }
.acc { padding: 12px 14px; }
.acchead { display: flex; align-items: center; gap: 12px; width: 100%; border: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; padding: 0; }
.pdet { margin-top: 10px; display: flex; flex-direction: column; gap: 8px; }
.pline { padding-top: 8px; border-top: 1px solid var(--line); }
/* Documentos */
.dcard { display: flex; gap: 12px; align-items: center; cursor: pointer; position: relative; flex-wrap: wrap; }
.dcard .chip-st { margin-top: 0; }
.dcard.dashed { border: 1.5px dashed var(--lav-300); background: transparent; box-shadow: none; }
.pdfb { margin-left: auto; }
/* Gastos */
.bars2 { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 10px; align-items: end; height: 150px; }
.bcol2 { display: flex; flex-direction: column; align-items: center; gap: 6px; height: 100%; justify-content: flex-end; position: relative; }
.btrack2 { flex: 1; width: 100%; max-width: 30px; display: flex; align-items: flex-end; }
.btrack2 i { display: block; width: 100%; border-radius: 9px; }
.bval { position: absolute; top: -4px; right: 0; font-size: 11px; font-weight: 600; background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 2px 6px; white-space: nowrap; }
.persel { border: 1px solid var(--line); background: var(--surface); color: var(--ink-2); font: inherit; font-size: 13px; padding: 6px 10px; border-radius: 999px; }
.mgroup { margin-top: 12px; }
.mhead { display: flex; justify-content: space-between; font-size: 12px; font-weight: 600; color: var(--muted); padding: 6px 0; border-bottom: 1px solid var(--line); }
/* Taller */
.warn { background: color-mix(in srgb, var(--danger) 12%, var(--surface)); border: 1px solid color-mix(in srgb, var(--danger) 35%, transparent); border-radius: 14px; padding: 10px 12px; }
.kv { display: grid; grid-template-columns: auto 1fr; gap: 6px 14px; margin: 0; }
.kv dt { color: var(--muted); } .kv dd { margin: 0; overflow-wrap: anywhere; }
.acts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 14px; }
.act { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 12px 6px; border-radius: 14px; background: var(--pink-50); color: var(--pink-700); text-decoration: none; font-size: 12.5px; font-weight: 500; }
.vrow { display: flex; gap: 12px; align-items: center; width: 100%; padding: 10px 0; border: 0; border-bottom: 1px solid var(--line); background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.vrow:last-of-type { border-bottom: 0; }
.vnum { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; background: var(--lav-100); color: var(--lav-700); font-size: 12px; font-weight: 600; flex: none; }
/* Registrar algo */
.pv { position: fixed; inset: 0; z-index: 80; background: rgba(20, 12, 24, .5); display: grid; place-items: center; padding: 12px; }
.pv.sheetb { display: flex; align-items: flex-end; justify-content: center; padding: 0; }
.pick { width: min(520px, 100%); background: var(--surface); border-radius: 22px 22px 0 0; padding: 18px 16px calc(18px + env(safe-area-inset-bottom)); max-height: 90dvh; overflow-y: auto; animation: up .22s ease; }
@keyframes up { from { transform: translateY(30px); opacity: 0; } }
.optrow { display: flex; align-items: center; gap: 12px; width: 100%; padding: 10px; margin-top: 6px; border: 1px solid var(--line); border-radius: 16px; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.optrow:hover { background: var(--pink-50); }
.pv-box { width: min(1000px, 100%); height: min(92dvh, 900px); background: var(--surface); border-radius: 18px; display: flex; flex-direction: column; overflow: hidden; }
.pv-top { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid var(--line); }
.pv-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; }
.pv-frame { flex: 1; width: 100%; border: 0; background: #fff; }
.spec { display: grid; grid-template-columns: 38% 1fr; gap: 8px; }
/* Escritorio */
@media (min-width: 900px) {
  .dtabs { display: flex; gap: 6px; flex-wrap: wrap; }
  .dtabs button { border: 1px solid var(--line); background: var(--surface); color: var(--ink-2); font: inherit; font-size: 13px; padding: 8px 16px; border-radius: 999px; cursor: pointer; }
  .dtabs button.on { border-color: var(--pink-500); color: var(--pink-700); font-weight: 600; }
  .shortcuts { display: none; }
  .hero { display: grid; grid-template-columns: 1.4fr 1fr; gap: 12px; align-items: stretch; }
  .hero .herocard { grid-row: span 2; }
  .hero .stats { grid-template-columns: 1fr 1fr; }
  .hero .big-cta { grid-column: 2; align-self: start; }
  .rgrid { grid-template-columns: repeat(3, 1fr); align-items: start; }
  .pick { border-radius: 22px; margin-bottom: 10vh; }
  .pv.sheetb { align-items: center; }
}
</style>
