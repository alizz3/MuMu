<script setup>
// Garaje: hoja de vida de cada vehículo (km, mantenimientos, plan, documentos, gastos, archivos).
// La lógica vive en src/modules/vehicles (separada de la interfaz para poder llevarla a otra app).
import { computed, ref, watch, onMounted } from 'vue'
import { state, ui } from '../store'
import * as A from '../store/actions'
import { toast, ask } from '../engine/game'
import { Icon } from '../components/ui'
import Seg from '../components/Seg.vue'
import GroupCard from '../components/GroupCard.vue'
import ListBar from '../components/ListBar.vue'
import GarageSheet from '../modules/vehicles/GarageSheet.vue'
import * as G from '../modules/vehicles/actions'
import * as L from '../modules/vehicles/logic'
import { VEHICLE_TYPES, SERVICE_STATUS, PLAN_STATUS, VERIFICATION, DOC_KINDS, EXPENSE_CATS, FILE_KINDS, SPEC_LABELS } from '../modules/vehicles/model'
import { openFile, deleteFile, saveManualCopy } from '../modules/vehicles/files'
import { canUseBackend } from '../services/api'

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
const TABS = computed(() => [['resumen', 'Resumen', 'home'], ['mant', 'Historial', 'tool', svcs.value.length || null], ['plan', 'Plan', 'calendar'], ['docs', 'Documentos', 'note'], ['gastos', 'Gastos', 'wallet'], ['km', 'Kilometraje', 'chart'], ['archivos', 'Archivos', 'clip', files.value.length || null], ['ajustes', 'Ficha', 'settings']])

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
const editExpense = (e) => { if (e.fuelId) open('fuel', g.value.fuel.find((x) => x.id === e.fuelId)); else if (e.serviceId && e.auto) open('service', g.value.services.find((x) => x.id === e.serviceId)); else open('expense', e) }

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
</script>

<template>
  <div class="stack">
    <!-- ===== Lista de vehículos ===== -->
    <template v-if="!v">
      <p v-if="vid" class="small muted">Ese vehículo ya no existe.</p>
      <ListBar :count="active.length" one="vehículo" many="vehículos"><template #end><button class="iconbtn add" aria-label="Nuevo vehículo" @click="open('vehicle')"><Icon name="plus" /></button></template></ListBar>
      <button v-for="x in active" :key="x.id" class="card row veh" @click="A.go('garaje', { id: x.id })">
        <span class="gico big" :style="{ background: 'color-mix(in srgb, #C3B3D4 40%, var(--surface))' }"><Icon :name="typeOf(x.type).icon" :size="26" /></span>
        <div class="grow" style="min-width:0">
          <div class="b">{{ x.name }}</div>
          <div class="tiny muted">{{ [x.make, x.model, x.year].filter(Boolean).join(' · ') }}{{ x.plate ? ` · ${x.plate}` : '' }}</div>
          <div class="tiny" style="margin-top:3px"><span v-if="summary(x.id).km != null">{{ L.fmtKm(summary(x.id).km) }}</span><span v-else class="muted">Km pendiente de registrar</span></div>
          <div class="row wrap" style="gap:4px;margin-top:6px"><span v-for="(a, i) in summary(x.id).alerts.slice(0, 2)" :key="i" class="badge" :class="a.level === 'red' ? 'red' : a.level === 'yellow' ? 'yellow' : 'pink'">{{ a.text }}</span><span v-if="summary(x.id).alerts.length > 2" class="badge">+{{ summary(x.id).alerts.length - 2 }}</span></div>
        </div>
        <Icon name="chev" :size="16" class="muted" />
      </button>
      <p v-if="!active.length" class="small muted" style="text-align:center">Todavía no tienes vehículos. Toca + para agregar uno.</p>

      <GroupCard title="Talleres" icon="tool" color="#BFD7F0" :count="g.shops.length || null" sub="Quién revisó tu vehículo, dónde queda y cómo llamarlo" :open="isOpen('shops')" @toggle="toggle('shops')">
        <div v-for="s in g.shops" :key="s.id" class="item">
          <div class="grow" style="min-width:0"><div class="small b">{{ s.name }}</div><div class="tiny muted">{{ [s.mechanic, s.address].filter(Boolean).join(' · ') || 'Sin detalles' }}</div></div>
          <a v-if="s.phone" class="iconbtn" :href="telUrl(s.phone)" aria-label="Llamar"><Icon name="phone" :size="16" /></a>
          <a v-if="s.phone" class="iconbtn" :href="waUrl(s.phone)" target="_blank" rel="noopener" aria-label="WhatsApp"><Icon name="chat" :size="16" /></a>
          <a v-if="mapsOf(s)" class="iconbtn" :href="mapsOf(s)" target="_blank" rel="noopener" aria-label="Ver en el mapa"><Icon name="pin" :size="16" /></a>
          <button class="iconbtn" aria-label="Editar taller" @click="open('shop', s)"><Icon name="edit" :size="16" /></button>
        </div>
        <button class="link" @click="open('shop')">+ Taller</button>
      </GroupCard>
      <GroupCard v-if="archived.length" title="Archivados" icon="folder" :count="archived.length" :open="isOpen('arch')" @toggle="toggle('arch')">
        <button v-for="x in archived" :key="x.id" class="item" style="width:100%;background:none;border-left:0;border-right:0;border-top:0;text-align:left" @click="A.go('garaje', { id: x.id })"><span class="grow small">{{ x.name }} <span class="muted">· {{ [x.make, x.model].filter(Boolean).join(' ') }}</span></span><Icon name="chev" :size="14" class="muted" /></button>
      </GroupCard>
    </template>

    <!-- ===== Ficha de un vehículo ===== -->
    <template v-else>
      <section class="card pink">
        <div class="row" style="gap:12px;align-items:flex-start">
          <span class="gico big" style="background:var(--surface)"><Icon :name="typeOf(v.type).icon" :size="28" /></span>
          <div class="grow" style="min-width:0">
            <h2 style="margin:0;font-size:20px">{{ v.name }} <span v-if="v.archived" class="badge">Archivado</span></h2>
            <div class="small muted">{{ [typeOf(v.type).label, v.make, v.model, v.year].filter(Boolean).join(' · ') }}</div>
            <div class="tiny muted">{{ v.plate ? `Placa ${v.plate}` : 'Placa sin registrar' }} · {{ v.registeredAt ? `Matrícula ${L.fmtDate(v.registeredAt)}` : 'Matrícula sin registrar' }}</div>
          </div>
        </div>
        <div class="grid2" style="margin-top:12px">
          <div class="kpi"><b>{{ km != null ? L.fmtKm(km) : '—' }}</b><span>{{ km != null ? `al ${L.fmtDate(lastPt?.date)}` : 'Km pendiente de registrar' }}</span></div>
          <div class="kpi"><b>{{ lastSvc ? L.fmtDate(lastSvc.date) : '—' }}</b><span>{{ lastSvc ? `Último mantenimiento${lastSvc.km != null ? ` · ${L.fmtKm(lastSvc.km)}` : ' · sin km'}` : 'Sin mantenimientos' }}</span></div>
        </div>
        <div class="qa">
          <button class="btn sm primary" @click="open('reading')"><Icon name="chart" :size="14" />Km</button>
          <button class="btn sm ghost" @click="open('service')"><Icon name="tool" :size="14" />Mantenimiento</button>
          <button class="btn sm ghost" @click="open('fuel')"><Icon name="drop" :size="14" />Combustible</button>
          <button class="btn sm ghost" @click="open('expense')"><Icon name="wallet" :size="14" />Gasto</button>
          <button class="btn sm ghost" @click="open('doc')"><Icon name="note" :size="14" />Documento</button>
          <button class="btn sm ghost" @click="open('file')"><Icon name="clip" :size="14" />Archivo</button>
        </div>
      </section>

      <Seg v-model="tab" :options="TABS" label="Secciones del vehículo" />

      <!-- Resumen -->
      <template v-if="tab === 'resumen'">
        <section class="card">
          <h3 class="wi"><Icon name="bell" :size="16" />Alertas</h3>
          <div v-if="al.alerts.length" class="list" style="margin-top:4px">
            <button v-for="(a, i) in al.alerts" :key="i" class="item al" @click="a.kind === 'service' ? open('confirm', { id: a.id }) : a.kind === 'doc' ? (tab = 'docs') : (tab = 'plan')">
              <span class="dot" :class="a.level"></span><span class="grow small">{{ a.text }}</span><Icon name="chev" :size="14" class="muted" />
            </button>
          </div>
          <p v-else class="small muted" style="margin-top:6px">{{ al.missing.length ? 'No hay alertas con la información que tienes. Completa lo que falta para que el seguimiento sea confiable.' : 'Sin alertas.' }}</p>
        </section>
        <GroupCard v-if="al.missing.length" title="Falta información" icon="info" color="#F6DC8B" :count="al.missing.length" sub="No son alertas: es lo que falta para hacer bien el seguimiento" :open="isOpen('miss', true)" @toggle="toggle('miss', true)">
          <button v-for="(m, i) in al.missing" :key="i" class="item al" @click="m.kind === 'km' ? open('reading') : m.kind === 'doc' ? open('doc', { kind: m.docKind }) : m.kind === 'service' ? open('service', g.services.find((s) => s.id === m.id)) : (tab = 'plan')"><span class="dot"></span><span class="grow small">{{ m.text }}</span><Icon name="plus" :size="14" class="muted" /></button>
        </GroupCard>
        <section class="card">
          <div class="row between"><h3>Documentos</h3><button class="link" @click="tab = 'docs'">Ver</button></div>
          <div class="grid2" style="margin-top:8px">
            <div v-for="d in [['SOAT', soat], ['Tecnomecánica', rtm]]" :key="d[0]" class="kpi" style="text-align:left;padding:10px 12px"><b style="font-size:15px">{{ d[0] }}</b>
              <span v-if="d[1]" class="badge" :class="L.docStatus(d[1]).badge" style="margin-top:4px">{{ L.docStatus(d[1]).label }}</span><button v-else class="link tiny" style="padding:4px 0" @click="open('doc', { kind: d[0] === 'SOAT' ? 'soat' : 'rtm' })">Sin registrar · agregar</button></div>
          </div>
        </section>
        <section class="card">
          <div class="row between"><h3>Próximos mantenimientos</h3><button class="link" @click="tab = 'plan'">Plan</button></div>
          <div v-if="activePlans.length" class="list"><div v-for="x in activePlans.slice(0, 4)" :key="x.p.id" class="item"><div class="grow small">{{ L.catName(g, x.p.component) }} · {{ L.actionLabel(x.p.action).toLowerCase() }}<div class="tiny muted">{{ planLine(x) }}</div></div><span class="badge" :class="PLAN_STATUS[x.status].badge">{{ PLAN_STATUS[x.status].label }}</span></div></div>
          <p v-else class="small muted" style="margin-top:6px">No hay planes activos. {{ suggested.length ? `Hay ${suggested.length} sugerencias por confirmar en Plan.` : 'Agrega uno en Plan.' }}</p>
        </section>
        <section class="card">
          <div class="row between"><h3>Historial reciente</h3><button class="link" @click="tab = 'mant'">Todo</button></div>
          <div class="list"><button v-for="s in svcs.slice(0, 3)" :key="s.id" class="item al" @click="s.status === 'por_confirmar' ? open('confirm', { id: s.id }) : open('service', s)"><div class="grow small">{{ svcTitle(s) }}<div class="tiny muted">{{ L.fmtDate(s.date) }}{{ s.km != null ? ` · ${L.fmtKm(s.km)}` : '' }}{{ shopOf(s.shopId) ? ` · ${shopOf(s.shopId).name}` : '' }}</div></div><span class="badge" :class="SERVICE_STATUS[s.status].badge">{{ SERVICE_STATUS[s.status].label }}</span></button></div>
          <p v-if="!svcs.length" class="small muted">Sin registros todavía.</p>
        </section>
        <section class="card">
          <div class="row between"><h3>Últimos gastos</h3><button class="link" @click="tab = 'gastos'">Ver</button></div>
          <div class="list"><div v-for="e in exps.slice(0, 3)" :key="e.id" class="item"><span class="grow small">{{ e.description || catLabel(e.category) }}<span class="tiny muted"> · {{ L.fmtDate(e.date) }}</span></span><b class="small">{{ L.fmtMoney(e.amount, e.currency) }}</b></div></div>
          <p v-if="!exps.length" class="small muted">Sin gastos registrados.</p>
        </section>
        <section class="card row" style="gap:10px">
          <span class="gico"><Icon name="book" :size="18" /></span><div class="grow small"><b>Manual del propietario</b><div class="tiny muted">{{ manuals.length ? manuals[0].name : 'Sin manual' }}</div></div>
          <button v-if="manuals.length" class="btn sm lav" :disabled="loading === manuals[0].id" @click="view(manuals[manuals.length - 1])">{{ loading === manuals[manuals.length - 1].id ? 'Abriendo…' : 'Abrir' }}</button><button v-else class="btn sm ghost" @click="open('file', { kind: 'manual' })">Subir</button>
        </section>
      </template>

      <!-- Historial de mantenimiento -->
      <template v-else-if="tab === 'mant'">
        <div class="row wrap" style="gap:6px">
          <input class="input grow" style="min-width:150px" v-model="q" placeholder="Buscar (repuesto, taller…)" aria-label="Buscar en el historial" />
          <select class="input" style="max-width:48%" v-model="fComp" aria-label="Componente"><option value="">Todos los componentes</option><option v-for="c in L.categories(g, v.type)" :key="c.id" :value="c.id">{{ c.name }}</option></select>
          <select class="input" style="max-width:48%" v-model="fStatus" aria-label="Estado"><option value="">Todos los estados</option><option v-for="(s, k) in SERVICE_STATUS" :key="k" :value="k">{{ s.label }}</option></select>
          <button class="btn sm primary" @click="open('service')"><Icon name="plus" :size="14" />Registrar</button>
        </div>
        <section v-for="s in svcFiltered" :key="s.id" class="card svc">
          <div class="row between" style="gap:8px;align-items:flex-start"><div style="min-width:0"><b class="small">{{ svcTitle(s) }}</b><div class="tiny muted">{{ s.status === 'por_confirmar' ? `Entró el ${L.fmtDate(s.intakeDate || s.date)}` : L.fmtDate(s.date) }} · {{ s.km != null ? L.fmtKm(s.km) : 'km sin registrar' }}</div></div><span class="badge" :class="SERVICE_STATUS[s.status].badge">{{ SERVICE_STATUS[s.status].label }}</span></div>
          <div class="row wrap" style="gap:4px;margin-top:6px"><span v-for="it in s.items" :key="it.id" class="chip long">{{ L.catName(g, it.component) }} · {{ L.actionLabel(it.action).toLowerCase() }}</span></div>
          <p v-if="s.expectedNote" class="tiny" style="margin-top:6px"><Icon name="clock" :size="12" class="inl" /> {{ s.expectedNote }}</p>
          <p v-if="s.parts" class="tiny muted" style="margin-top:4px;white-space:pre-line">Repuestos: {{ s.parts }}</p>
          <p v-if="shopOf(s.shopId) || s.mechanic" class="tiny muted" style="margin-top:4px">{{ shopOf(s.shopId)?.name }}{{ s.mechanic || shopOf(s.shopId)?.mechanic ? ` · ${s.mechanic || shopOf(s.shopId)?.mechanic}` : '' }}</p>
          <p v-if="L.serviceTotal(s) != null" class="tiny" style="margin-top:4px"><b>{{ L.fmtMoney(L.serviceTotal(s)) }}</b><span v-if="s.costParts != null || s.costLabor != null" class="muted"> (repuestos {{ L.fmtMoney(s.costParts) }} · mano de obra {{ L.fmtMoney(s.costLabor) }})</span></p>
          <p v-if="s.notes" class="tiny muted" style="margin-top:4px;white-space:pre-line">{{ s.notes }}</p>
          <div v-if="s.fileIds?.length" class="row wrap" style="gap:4px;margin-top:6px"><button v-for="id in s.fileIds" :key="id" class="chip" @click="fileOf(id) && view(fileOf(id))"><Icon name="clip" :size="12" />{{ fileOf(id)?.name || 'Archivo' }}</button></div>
          <div class="row" style="gap:6px;margin-top:10px"><button v-if="s.status === 'por_confirmar'" class="btn sm primary" @click="open('confirm', { id: s.id })"><Icon name="check" :size="14" />Confirmar entrega</button><button class="btn sm ghost" @click="open('service', s)"><Icon name="edit" :size="14" />Editar</button></div>
        </section>
        <p v-if="!svcFiltered.length" class="small muted" style="text-align:center">{{ svcs.length ? 'Nada coincide con el filtro.' : 'Sin mantenimientos registrados.' }}</p>
      </template>

      <!-- Plan -->
      <template v-else-if="tab === 'plan'">
        <div class="row between"><p class="tiny muted grow">Cada plan avisa por km, por tiempo o por ambos. Sin el km de un trabajo, no se calcula el siguiente por distancia.</p><button class="btn sm primary" @click="open('plan')"><Icon name="plus" :size="14" />Plan</button></div>
        <section v-for="x in activePlans.filter((y) => y.status !== 'pendiente')" :key="x.p.id" class="card">
          <div class="row between" style="gap:8px;align-items:flex-start"><div style="min-width:0"><b class="small">{{ L.catName(g, x.p.component) }} · {{ L.actionLabel(x.p.action).toLowerCase() }}</b><div class="tiny muted">{{ every(x.p) || 'Sin intervalo' }}</div></div><span class="badge" :class="PLAN_STATUS[x.status].badge">{{ PLAN_STATUS[x.status].label }}</span></div>
          <p class="tiny" style="margin-top:6px">Próxima: {{ planLine(x) }}</p>
          <p class="tiny muted">Último: {{ x.last ? `${L.fmtDate(x.last.date)}${x.last.km != null ? ` · ${L.fmtKm(x.last.km)}` : ' · sin km'}` : 'sin registro' }}</p>
          <div class="row wrap" style="gap:6px;margin-top:8px"><span class="badge" :class="VERIFICATION[x.p.verification]?.badge">{{ VERIFICATION[x.p.verification]?.label }}{{ x.p.page ? ` · ${x.p.page}` : '' }}</span><span v-if="state.tasks.some((t) => t.vref?.key === `plan:${x.p.id}` && t.status !== 'completada')" class="badge"><Icon name="check" :size="11" />Tarea creada</span></div>
          <div class="row wrap" style="gap:6px;margin-top:8px"><button class="btn sm ghost" @click="open('service', { items: [{ component: x.p.component, action: x.p.action, detail: '' }] })">Registrar hecho</button><button class="btn sm ghost" @click="wantTask(x)">Recordármelo</button><button class="btn sm ghost" @click="open('plan', x.p)"><Icon name="edit" :size="13" />Editar</button></div>
        </section>
        <p v-if="!activePlans.length" class="small muted">No hay planes activos todavía.</p>
        <GroupCard v-if="waiting.length" title="Esperan una referencia" icon="info" color="#F6DC8B" :count="waiting.length" sub="Registra el km actual y cuándo se hizo cada cosa por última vez para empezar a contar" :open="isOpen('wait')" @toggle="toggle('wait')">
          <div v-for="x in waiting" :key="x.p.id" class="item" style="align-items:flex-start">
            <div class="grow small" style="min-width:0">{{ L.catName(g, x.p.component) }} · {{ L.actionLabel(x.p.action).toLowerCase() }} <span class="muted">· {{ every(x.p) }}</span><div class="tiny muted">{{ x.p.notes }}</div><span class="badge" :class="VERIFICATION[x.p.verification]?.badge" style="margin-top:4px">{{ VERIFICATION[x.p.verification]?.label }}{{ x.p.page ? ` · ${x.p.page}` : '' }}</span></div>
            <div class="stack" style="gap:4px;flex:none"><button class="btn sm lav" @click="open('service', { items: [{ component: x.p.component, action: x.p.action, detail: '' }] })">Ya se hizo</button><button class="btn sm ghost" @click="open('plan', x.p)">Editar</button></div>
          </div>
        </GroupCard>
        <GroupCard v-if="suggested.length" title="Sugerencias por confirmar" icon="info" color="#F6DC8B" :count="suggested.length" sub="Revísalas antes de activarlas" :open="isOpen('sug')" @toggle="toggle('sug')">
          <div v-for="x in suggested" :key="x.p.id" class="item" style="align-items:flex-start">
            <div class="grow small">{{ L.catName(g, x.p.component) }} · {{ L.actionLabel(x.p.action).toLowerCase() }} <span class="muted">· {{ every(x.p) }}</span><div class="tiny muted">{{ x.p.notes }}</div><a v-if="x.p.sourceRef" class="tiny" :href="x.p.sourceRef" target="_blank" rel="noopener">Ver fuente</a></div>
            <div class="stack" style="gap:4px"><button class="btn sm lav" @click="G.setPlanActive(x.p.id, true, 'usuario'); toast('Activado')">Activar</button><button class="btn sm ghost" @click="open('plan', x.p)">Editar</button></div>
          </div>
        </GroupCard>
      </template>

      <!-- Documentos -->
      <template v-else-if="tab === 'docs'">
        <div class="row between"><p class="tiny muted grow">Escribe las fechas reales de tus documentos. MuMu te avisa antes de que venzan.</p><button class="btn sm primary" @click="open('doc')"><Icon name="plus" :size="14" />Documento</button></div>
        <section v-for="k in ['soat', 'rtm']" :key="k" v-show="!docs.some((d) => d.kind === k)" class="card soft">
          <b class="small">{{ DOC_KINDS.find((x) => x.id === k).label }}</b>
          <p class="tiny muted" style="margin-top:4px">Sin registrar.</p>
          <p v-if="k === 'rtm' && rtmHint" class="tiny" style="margin-top:4px">Guía: {{ rtmHint.rule }} Con tu matrícula, la primera sería alrededor del <b>{{ L.fmtDate(rtmHint.date) }}</b>. Confírmalo con tu certificado.</p>
          <p v-else-if="k === 'rtm'" class="tiny muted" style="margin-top:4px">Regla general (RUNT): las motos nuevas hacen la primera a los 2 años de la matrícula y luego cada año. Registra la fecha de matrícula en Ficha para orientarte.</p>
          <button class="btn sm lav" style="margin-top:8px" @click="open('doc', { kind: k })">Agregar</button>
        </section>
        <section v-for="d in docs" :key="d.id" class="card">
          <div class="row between" style="gap:8px"><b class="small">{{ d.name }}</b><span class="badge" :class="L.docStatus(d).badge">{{ L.docStatus(d).label }}</span></div>
          <p class="tiny muted" style="margin-top:4px">{{ [d.issuedAt && `Expedido ${L.fmtDate(d.issuedAt)}`, d.expiresAt && `Vence ${L.fmtDate(d.expiresAt)}`, d.number && `N.º ${d.number}`, d.issuer].filter(Boolean).join(' · ') }}</p>
          <p v-if="d.notes" class="tiny muted">{{ d.notes }}</p>
          <div class="row wrap" style="gap:6px;margin-top:8px"><button v-for="id in d.fileIds || []" :key="id" class="chip" @click="fileOf(id) && view(fileOf(id))"><Icon name="clip" :size="12" />{{ fileOf(id)?.name || 'Archivo' }}</button>
            <button class="btn sm lav" @click="open('renew', { oldId: d.id })"><Icon name="refresh" :size="13" />Renovar</button><button class="btn sm ghost" @click="open('doc', d)"><Icon name="edit" :size="13" />Editar</button></div>
        </section>
        <GroupCard v-if="oldDocs.length" title="Historial de renovaciones" icon="clock" :count="oldDocs.length" :open="isOpen('olddocs')" @toggle="toggle('olddocs')">
          <div v-for="d in oldDocs" :key="d.id" class="item"><span class="grow small">{{ d.name }} <span class="muted tiny">· {{ L.fmtDate(d.issuedAt) }} – {{ L.fmtDate(d.expiresAt) }}{{ d.number ? ` · ${d.number}` : '' }}</span></span><button class="iconbtn" aria-label="Ver" @click="open('doc', d)"><Icon name="eye" :size="15" /></button></div>
        </GroupCard>
      </template>

      <!-- Gastos -->
      <template v-else-if="tab === 'gastos'">
        <section class="card">
          <div class="grid2"><div class="kpi"><b>{{ L.fmtMoney(month.total) }}</b><span>Este mes · {{ month.n }} registro{{ month.n === 1 ? '' : 's' }}</span></div><div class="kpi"><b>{{ L.fmtMoney(allSpend.total) }}</b><span>Acumulado</span></div></div>
          <div v-if="allSpend.n" class="bars" style="margin-top:12px" aria-label="Gasto por mes">
            <div v-for="m in months" :key="m.k" class="bcol"><div class="btrack"><i :style="{ height: (m.total / maxMonth * 100) + '%' }" :title="L.fmtMoney(m.total)"></i></div><span class="tiny muted">{{ m.label }}</span></div>
          </div>
          <div v-if="allSpend.n" class="stack" style="gap:4px;margin-top:10px">
            <div v-for="(val, c) in allSpend.byCat" :key="c" class="row small between"><span>{{ catLabel(c) }}</span><span class="muted">{{ L.fmtMoney(val) }} · prom. {{ L.fmtMoney(val / exps.filter((e) => e.category === c && e.amount != null).length) }}</span></div>
          </div>
          <p v-else class="small muted" style="margin-top:8px">Sin gastos todavía.</p>
        </section>
        <section class="card">
          <h3 class="wi"><Icon name="drop" :size="16" />Consumo de combustible</h3>
          <template v-if="econ"><p class="small" style="margin-top:6px"><b>{{ econ.avg.toFixed(1) }} km por {{ econ.unit === 'gal' ? 'galón' : 'litro' }}</b> en promedio ({{ econ.segments.length }} tramo{{ econ.segments.length === 1 ? '' : 's' }}).</p>
            <p class="tiny muted">Último tramo: {{ L.fmtKm(econ.last.dist) }} con {{ econ.last.qty.toFixed(2) }} {{ econ.unit === 'gal' ? 'gal' : 'L' }}.</p></template>
          <p v-else class="small muted" style="margin-top:6px">Aún no se puede calcular.</p>
          <p class="tiny muted" style="margin-top:4px">Cómo se calcula: entre dos tanqueadas "tanque lleno" con kilometraje, distancia recorrida ÷ combustible echado desde la primera (sin contarla). Hacen falta al menos dos llenas con km.</p>
          <button class="btn sm lav" style="margin-top:8px" @click="open('fuel')"><Icon name="plus" :size="13" />Combustible</button>
        </section>
        <div class="row" style="gap:6px"><select class="input grow" v-model="fCat" aria-label="Filtrar por categoría"><option value="">Todas las categorías</option><option v-for="c in EXPENSE_CATS" :key="c.id" :value="c.id">{{ c.label }}</option></select><button class="btn sm primary" @click="open('expense')"><Icon name="plus" :size="14" />Gasto</button></div>
        <section class="card"><div class="list">
          <button v-for="e in expFiltered" :key="e.id" class="item al" @click="editExpense(e)"><div class="grow small" style="min-width:0">{{ e.description || catLabel(e.category) }}<div class="tiny muted">{{ L.fmtDate(e.date) }} · {{ catLabel(e.category) }}{{ e.km != null ? ` · ${L.fmtKm(e.km)}` : '' }}</div></div><b class="small">{{ L.fmtMoney(e.amount, e.currency) }}</b></button>
        </div><p v-if="!expFiltered.length" class="small muted">Nada por aquí.</p></section>
      </template>

      <!-- Kilometraje -->
      <template v-else-if="tab === 'km'">
        <section class="card row" style="gap:10px"><div class="grow"><b>{{ km != null ? L.fmtKm(km) : 'Pendiente de registrar' }}</b><div class="tiny muted">Kilometraje actual{{ lastPt ? ` · última lectura ${L.fmtDate(lastPt.date)} (${lastPt.src})` : '' }}</div></div><button class="btn sm primary" @click="open('reading')">Actualizar</button></section>
        <section class="card"><h3>Historial de lecturas</h3>
          <div class="list"><button v-for="r in kmRows" :key="r.id" class="item al" @click="open('reading', r)"><div class="grow small">{{ L.fmtKm(r.km) }} <span v-if="r.correction" class="badge yellow">Corrección</span><div class="tiny muted">{{ L.fmtDate(r.date) }}{{ r.reason ? ` · ${r.reason}` : '' }}{{ r.note ? ` · ${r.note}` : '' }}{{ r.correctionNote ? ` · ${r.correctionNote}` : '' }}</div></div><span class="tiny muted">{{ r.dist != null ? `+${L.fmtKm(r.dist)}${r.days ? ` en ${r.days} d` : ''}` : '' }}</span></button></div>
          <p v-if="!kmRows.length" class="small muted">Sin lecturas. Los kilometrajes de mantenimientos y tanqueadas también cuentan como referencia.</p>
        </section>
      </template>

      <!-- Archivos -->
      <template v-else-if="tab === 'archivos'">
        <div class="row between"><p class="tiny muted grow">Se guardan en privado en tu cuenta (sin enlaces públicos).</p><button class="btn sm primary" @click="open('file')"><Icon name="plus" :size="14" />Archivo</button></div>
        <GroupCard v-for="k in FILE_KINDS.filter((x) => files.some((f) => f.kind === x.id))" :key="k.id" :title="k.label" icon="clip" :count="files.filter((f) => f.kind === k.id).length" :open="isOpen(`f_${k.id}`, true)" @toggle="toggle(`f_${k.id}`, true)">
          <div v-for="fm in files.filter((f) => f.kind === k.id)" :key="fm.id" class="item" style="align-items:flex-start">
            <div class="grow small" style="min-width:0">{{ fm.name }}<div class="tiny muted">{{ fm.storage === 'link' ? 'Enlace externo' : `Guardado en MuMu · ${(fm.size / 1048576).toFixed(1)} MB` }}{{ fm.note ? ` · ${fm.note}` : '' }}</div></div>
            <div class="row" style="gap:4px;flex:none">
              <button v-if="fm.storage === 'link' && fm.kind === 'manual'" class="btn sm lav" :disabled="loading === fm.id" @click="copyManual(fm)">{{ loading === fm.id ? 'Guardando…' : 'Guardar copia' }}</button>
              <button class="iconbtn" :aria-label="`Abrir ${fm.name}`" :disabled="loading === fm.id" @click="view(fm)"><Icon name="eye" :size="16" /></button>
              <button v-if="fm.storage !== 'link'" class="iconbtn" aria-label="Descargar" @click="view(fm, true)"><Icon name="download" :size="16" /></button>
              <button class="iconbtn" aria-label="Borrar archivo" @click="delVehicleFile(fm)"><Icon name="trash" :size="16" /></button>
            </div>
          </div>
        </GroupCard>
        <p v-if="!files.length" class="small muted" style="text-align:center">Sin archivos. Sube el manual, facturas o fotos.</p>
      </template>

      <!-- Ficha -->
      <template v-else-if="tab === 'ajustes'">
        <section class="card stack small" style="gap:6px">
          <div class="row between"><h3>Ficha</h3><button class="link" @click="open('vehicle', v)">Editar</button></div>
          <div v-for="r in [['Tipo', typeOf(v.type).label], ['Marca', v.make], ['Modelo', v.model], ['Año', v.year], ['Placa', v.plate], ['Matrícula', v.registeredAt && L.fmtDate(v.registeredAt)], ['Color', v.color], ['Combustible', v.fuelType]]" :key="r[0]" class="row between"><span class="muted">{{ r[0] }}</span><span>{{ r[1] || 'Pendiente' }}</span></div>
          <p v-if="v.notes" class="tiny muted">{{ v.notes }}</p>
        </section>
        <section v-if="Object.keys(v.specs || {}).length" class="card stack small" style="gap:6px">
          <h3>Datos técnicos</h3>
          <div v-for="(val, k) in v.specs" :key="k" class="spec"><span class="muted">{{ SPEC_LABELS[k] || k }}</span><span>{{ val }}</span></div>
          <p class="tiny muted">Del manual del propietario Honda NAVI (pág. 94), salvo lo que tú cambies.</p>
        </section>
        <section class="card stack" style="gap:8px">
          <button class="btn ghost" @click="exportJson"><Icon name="download" :size="15" />Exportar hoja de vida (JSON)</button>
          <button class="btn ghost" @click="archive(!v.archived)"><Icon name="folder" :size="15" />{{ v.archived ? 'Volver a activar' : 'Archivar vehículo' }}</button>
          <p class="tiny muted">Archivar no borra nada. La exportación sirve para respaldar o llevar los datos a otra app.</p>
        </section>
      </template>
      <button class="btn ghost" style="align-self:flex-start" @click="A.go('garaje')"><Icon name="back" :size="16" />Todos los vehículos</button>
    </template>
    <GarageSheet />
  </div>
</template>

<style scoped>
.spec { display: grid; grid-template-columns: 38% 1fr; gap: 8px; }
.veh .badge { white-space: normal; text-align: left; line-height: 1.3; }
.veh { text-align: left; cursor: pointer; width: 100%; gap: 12px; align-items: flex-start; }
.gico.big { width: 52px; height: 52px; border-radius: 16px; }
.qa { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
.item.al { width: 100%; background: none; border-left: 0; border-right: 0; border-top: 0; text-align: left; cursor: pointer; color: inherit; font: inherit; }
.dot { width: 9px; height: 9px; border-radius: 50%; flex: none; background: var(--line); }
.dot.red { background: #D2465E; } .dot.yellow { background: #E5B13A; } .dot.pink { background: var(--pink-500, #E07A9B); }
.bars { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px; align-items: end; }
.bcol { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.btrack { height: 70px; width: 100%; max-width: 28px; background: var(--surface-2); border-radius: 8px; display: flex; align-items: flex-end; overflow: hidden; }
.btrack i { display: block; width: 100%; background: var(--lav-500, #A28AC4); border-radius: 8px; min-height: 2px; }
</style>
