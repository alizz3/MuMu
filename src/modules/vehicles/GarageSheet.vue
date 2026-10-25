<script setup>
// Garaje — todos los formularios en una hoja (Guardar siempre visible arriba).
// Se abre con ui.garageSheet = { type, data }.
import { computed, reactive, ref, watch } from 'vue'
import { ui } from '../../store'
import { toast, ask } from '../../engine/game'
import { Icon } from '../../components/ui'
import * as G from './actions'
import * as L from './logic'
import { VEHICLE_TYPES, ACTIONS, DOC_KINDS, EXPENSE_CATS, FILE_KINDS, VERIFICATION } from './model'
import { uploadFile, thumbUrl, deleteFile } from './files'

const g = computed(() => G.garage())
const sh = computed(() => ui.garageSheet)
const f = reactive({})
const busy = ref(false)
const err = ref('')
const progress = ref(0)
const fileInput = ref(null)
const pickedFile = ref(null)
const pickedPhotos = ref([]) // fotos nuevas por subir
const photoThumbs = ref({}) // id -> url para mostrar las que ya están
async function loadThumbs() { for (const id of f.photoIds || []) if (!photoThumbs.value[id]) { const m = g.value.files.find((x) => x.id === id); if (m) thumbUrl(m).then((u) => (photoThumbs.value = { ...photoThumbs.value, [id]: u })).catch(() => {}) } }
const removedPhotos = ref([])
function dropPhoto(id) { f.photoIds = f.photoIds.filter((x) => x !== id); removedPhotos.value.push(id) }
function movePhotoFirst(id) { f.photoIds = [id, ...f.photoIds.filter((x) => x !== id)] }
const newThumbs = computed(() => pickedPhotos.value.map((file) => URL.createObjectURL(file)))
const newCat = ref('')
const lowerKm = ref(null) // { prev } cuando la lectura es menor

const TITLES = { vehicle: 'vehículo', reading: 'kilometraje', service: 'mantenimiento', confirm: 'Confirmar entrega del taller', plan: 'plan de mantenimiento', doc: 'documento', renew: 'Renovar documento', expense: 'gasto', fuel: 'combustible', shop: 'taller', file: 'Subir archivo', part: 'repuesto o insumo' }
const title = computed(() => { const t = sh.value?.type; if (['confirm', 'renew', 'file'].includes(t)) return TITLES[t]; return `${f.id ? 'Editar' : 'Nuevo'} ${TITLES[t] || ''}`.replace('Nuevo kilometraje', 'Actualizar kilometraje') })
const veh = computed(() => L.vehicleOf(g.value, f.vehicleId))
const cats = computed(() => L.categories(g.value, veh.value?.type))
const today = L.today()

watch(sh, (s) => {
  for (const k of Object.keys(f)) delete f[k]
  err.value = ''; progress.value = 0; pickedFile.value = null; lowerKm.value = null; newCat.value = ''
  if (!s) return
  const d = JSON.parse(JSON.stringify(s.data || {}))
  const base = {
    vehicle: { type: 'moto', name: '', make: '', model: '', year: '', plate: '', registeredAt: '', color: '', fuelType: '', notes: '', driveFolder: '' },
    reading: { date: today, km: '', note: '', reason: '', correction: false, correctionNote: '' },
    service: { status: 'realizado', date: today, km: '', items: [{ component: '', action: 'reemplazar', detail: '' }], description: '', parts: '', shopId: '', mechanic: '', costParts: '', costLabor: '', costTotal: '', notes: '', followUp: '', nextKm: '', nextDate: '', expectedDate: '', expectedNote: '', fileIds: [] },
    plan: { component: '', action: 'inspeccionar', intervalKm: '', intervalMonths: '', nextKm: '', nextDate: '', leadKm: 300, leadDays: 15, notes: '', source: 'usuario', verification: 'usuario', sourceRef: '', page: '', active: true, autoTask: true },
    doc: { kind: 'soat', name: '', issuedAt: '', expiresAt: '', number: '', issuer: '', notes: '', leadDays: '', cost: '', fileIds: [], driveFileId: '' },
    renew: { issuedAt: today, expiresAt: '', number: '', issuer: '', notes: '', cost: '', fileIds: [] },
    expense: { date: today, amount: '', category: 'otros', description: '', km: '', currency: 'COP', fileIds: [] },
    fuel: { date: today, km: '', qty: '', unit: 'L', amount: '', fuelType: '', station: '', notes: '', full: true },
    part: { label: '', brand: '', ref: '', qty: '', notes: '', photoId: null },
    shop: { name: '', mechanic: '', address: '', mapsUrl: '', phone: '', notes: '', blocked: false, blockedReason: '' },
    file: { kind: 'factura', note: '' },
    confirm: {},
  }[s.type] || {}
  Object.assign(f, base, d)
  if (s.type === 'vehicle') { f.photoIds = d.photoIds?.length ? [...d.photoIds] : d.photoFileId ? [d.photoFileId] : []; pickedPhotos.value = []; removedPhotos.value = []; loadThumbs() }
  if (s.type === 'confirm') { const sv = g.value.services.find((x) => x.id === d.id); Object.assign(f, { date: today, doneIds: (sv?.items || []).map((i) => i.id), km: '', costTotal: '', shopId: sv?.shopId || '', notes: '', svc: sv }) }
  if (s.type === 'renew') { const old = g.value.documents.find((x) => x.id === d.oldId); f.old = old; if (old?.expiresAt && old.kind !== 'otro') { f.issuedAt = old.expiresAt > today ? old.expiresAt : today; f.expiresAt = L.addMonths(f.issuedAt, 12) } }
  if (s.type === 'service' && !f.items?.length) f.items = [{ component: '', action: 'reemplazar', detail: '' }]
  for (const k of ['km', 'costParts', 'costLabor', 'costTotal', 'nextKm', 'amount', 'qty', 'intervalKm', 'intervalMonths', 'year', 'cost', 'leadDays']) if (f[k] == null) f[k] = ''
  for (const k of ['date', 'nextDate', 'expectedDate', 'issuedAt', 'expiresAt', 'registeredAt']) if (f[k] == null) f[k] = ''
}, { immediate: true })

const close = () => { ui.garageSheet = null }
const total = computed(() => (f.costParts !== '' || f.costLabor !== '' ? Number(f.costParts || 0) + Number(f.costLabor || 0) : null))
function addCat() { try { const c = G.addCategory(newCat.value); newCat.value = ''; toast(`Categoría "${c.name}" lista`); return c } catch (e) { err.value = e.message } }

async function save() {
  if (busy.value) return
  busy.value = true; err.value = ''
  try {
    const t = sh.value.type
    if (t === 'vehicle') {
      const ids = [...(f.photoIds || [])]
      for (const [n, file] of pickedPhotos.value.entries()) { const ph = await uploadFile(file, { vehicleId: f.id || 'nuevo', kind: 'foto', note: 'Foto del vehículo' }, (p) => (progress.value = Math.round((n + p / 100) / pickedPhotos.value.length * 100))); ids.push(ph.id) }
      f.photoIds = ids
      const v = G.saveVehicle(f)
      for (const id of ids) { const ph = g.value.files.find((x) => x.id === id); if (ph && ph.vehicleId !== v.id) ph.vehicleId = v.id }
      for (const id of removedPhotos.value) { const m = g.value.files.find((x) => x.id === id); if (m) deleteFile(m).catch(() => {}) }
      pickedPhotos.value = []; removedPhotos.value = []
      toast('Guardado'); close(); if (!sh.value?.keep && ui.route === 'garaje' && !ui.params.id) import('../../store/actions').then((A) => A.go('garaje', { id: v.id })) }
    else if (t === 'reading') {
      const r = G.addReading({ ...f, correction: f.correction || !!lowerKm.value && f.correction })
      if (r.needsConfirm) { lowerKm.value = r.prev; err.value = `Es menor que la lectura anterior (${L.fmtKm(r.prev.km)} el ${L.fmtDate(r.prev.date)}). Si es una corrección, márcala y explica el motivo.`; return }
      toast('Kilometraje guardado'); close()
    } else if (t === 'service') { if (f.costTotal === '' && total.value != null) f.costTotal = ''; const kc = f.status === 'realizado' ? L.kmConflict(g.value, f.vehicleId, f.date, f.km === '' ? null : Number(f.km), f.id) : null; if (kc && !(await ask(`Revisa el kilometraje: ${kc} ¿Lo guardo así de todas formas?`))) { busy.value = false; return } G.saveService(f); toast('Mantenimiento guardado'); close() }
    else if (t === 'confirm') { G.confirmService(f.id, { date: f.date, doneIds: f.doneIds, km: f.km === '' ? null : Number(f.km), costTotal: f.costTotal === '' ? null : Number(f.costTotal), shopId: f.shopId || null, notes: f.notes }); toast('Entrega confirmada'); close() }
    else if (t === 'plan') { G.savePlan(f); toast('Plan guardado'); close() }
    else if (t === 'doc') { if (pickedFile.value) f.fileIds = [...(f.fileIds || []), (await uploadFile(pickedFile.value, { vehicleId: f.vehicleId, kind: 'documento' }, (p) => (progress.value = p))).id]; G.saveDocument(f); toast('Documento guardado'); close() }
    else if (t === 'renew') { if (pickedFile.value) f.fileIds = [(await uploadFile(pickedFile.value, { vehicleId: f.old.vehicleId, kind: 'documento' }, (p) => (progress.value = p))).id]; G.renewDocument(f.oldId, f); toast('Renovado: el anterior queda en el historial'); close() }
    else if (t === 'expense') { if (pickedFile.value) f.fileIds = [...(f.fileIds || []), (await uploadFile(pickedFile.value, { vehicleId: f.vehicleId, kind: 'factura' }, (p) => (progress.value = p))).id]; G.saveExpense(f); toast('Gasto guardado'); close() }
    else if (t === 'fuel') {
      const r = G.saveFuel({ ...f, forceKm: !!lowerKm.value })
      if (r.needsConfirm) { lowerKm.value = r.prev; err.value = `Ese kilometraje es menor que el último (${L.fmtKm(r.prev.km)}). Revísalo; si está bien, toca Guardar otra vez.`; return }
      toast('Combustible guardado'); close()
    } else if (t === 'part') {
      if (pickedFile.value) { const ph = await uploadFile(pickedFile.value, { vehicleId: f.vehicleId, kind: 'foto', note: f.label || 'Repuesto' }, (p) => (progress.value = p)); f.photoId = ph.id }
      G.saveConsumable(f); toast('Guardado'); close()
    } else if (t === 'shop') { const s = G.saveShop(f); toast('Taller guardado'); if (sh.value.back) { ui.garageSheet = { ...sh.value.back, data: { ...sh.value.back.data, shopId: s.id } } } else close() }
    else if (t === 'file') { if (!pickedFile.value) throw new Error('Elige un archivo'); await uploadFile(pickedFile.value, { vehicleId: f.vehicleId, kind: f.kind, note: f.note }, (p) => (progress.value = p)); toast('Archivo guardado en privado'); close() }
  } catch (e) { err.value = e.message || 'No se pudo guardar' } finally { busy.value = false }
}
async function remove() {
  const t = sh.value.type
  const what = { reading: 'esta lectura', service: 'este registro de mantenimiento', plan: 'este plan', doc: 'este documento', expense: 'este gasto', fuel: 'esta tanqueada', shop: 'este taller', part: 'este repuesto' }[t]
  if (!(await ask(`¿Borrar ${what}? No se puede deshacer.`))) return
  ;({ reading: G.deleteReading, service: G.deleteService, plan: G.deletePlan, doc: G.deleteDocument, expense: G.deleteExpense, fuel: G.deleteFuel, shop: G.deleteShop, part: G.deleteConsumable })[t](f.id)
  toast('Borrado'); close()
}
const shopOf = (id) => g.value.shops.find((s) => s.id === id)
const addShop = () => { ui.garageSheet = { type: 'shop', data: {}, back: { type: sh.value.type, data: JSON.parse(JSON.stringify(f)) } } }
</script>

<template>
  <div v-if="sh" class="scrim" @click.self="close">
    <div class="sheet" role="dialog" aria-modal="true" :aria-label="title">
      <div class="grab"></div>
      <div class="sheet-head">
        <h2 class="grow">{{ title }}</h2>
        <button type="button" class="btn sm primary" :disabled="busy" @click="save">{{ busy ? (progress ? `${Math.round(progress * 100)}%` : 'Guardando…') : sh.type === 'confirm' ? 'Confirmar' : 'Guardar' }}</button>
        <button type="button" class="iconbtn" aria-label="Cerrar" @click="close"><Icon name="x" :size="18" /></button>
      </div>
      <p v-if="err" class="small" role="alert" style="color:#A8344A;margin:-4px 0 10px">{{ err }}</p>

      <form class="stack" @submit.prevent="save">
        <!-- Vehículo -->
        <template v-if="sh.type === 'vehicle'">
          <label class="field"><span>Tipo</span><select class="input" v-model="f.type"><option v-for="t in VEHICLE_TYPES" :key="t.id" :value="t.id">{{ t.label }}</option></select></label>
          <label class="field"><span>Nombre (como le dices)</span><input class="input" v-model="f.name" placeholder="Ej. Mi chiquita" required /></label>
          <div class="grid2"><label class="field"><span>Marca</span><input class="input" v-model="f.make" /></label><label class="field"><span>Modelo</span><input class="input" v-model="f.model" /></label></div>
          <div class="grid2"><label class="field"><span>Año del modelo</span><input class="input" type="number" inputmode="numeric" v-model="f.year" /></label><label class="field"><span>Placa</span><input class="input" v-model="f.plate" placeholder="Opcional" autocapitalize="characters" /></label></div>
          <div class="grid2"><label class="field"><span>Fecha de matrícula</span><input class="input" type="date" v-model="f.registeredAt" :max="today" /></label><label class="field"><span>Color</span><input class="input" v-model="f.color" /></label></div>
          <label class="field"><span>Combustible</span><input class="input" v-model="f.fuelType" placeholder="Ej. Gasolina corriente" /></label>
          <label v-if="f.type === 'moto'" class="field"><span>Transmisión</span><input class="input" :value="f.specs?.transmision || ''" @input="f.specs = { ...(f.specs || {}), transmision: $event.target.value }" placeholder="Ej. Automática (CVT con correa) o cadena" /></label>
          <div class="field"><span>Fotos (la primera es la portada; si hay varias, se van turnando)</span>
            <div class="phgrid">
              <div v-for="(id, i) in f.photoIds || []" :key="id" class="phcell"><img v-if="photoThumbs[id]" :src="photoThumbs[id]" alt="" /><span v-if="i === 0" class="phtag">Portada</span><button v-else type="button" class="phstar" aria-label="Usar como portada" @click="movePhotoFirst(id)"><Icon name="star" :size="12" /></button><button type="button" class="phx" aria-label="Quitar foto" @click="dropPhoto(id)"><Icon name="x" :size="12" /></button></div>
              <div v-for="(u, i) in newThumbs" :key="u" class="phcell new"><img :src="u" alt="" /><button type="button" class="phx" aria-label="Quitar foto" @click="pickedPhotos.splice(i, 1)"><Icon name="x" :size="12" /></button></div>
              <label class="phcell add"><Icon name="plus" :size="18" /><span class="tiny">Agregar</span><input type="file" accept="image/*" multiple style="display:none" @change="pickedPhotos.push(...$event.target.files); $event.target.value = ''" /></label>
            </div>
          </div>
          <label class="field"><span>Carpeta de Drive con sus documentos</span><input class="input" v-model="f.driveFolder" placeholder="Pega el enlace de la carpeta" /></label>
          <label class="field"><span>Notas</span><textarea class="input" v-model="f.notes" rows="2"></textarea></label>
          <p class="tiny muted">La placa, la matrícula, la foto y los documentos son privados: solo tus cuentas los ven.</p>
        </template>

        <!-- Kilometraje -->
        <template v-else-if="sh.type === 'reading'">
          <div class="grid2"><label class="field"><span>Kilometraje en el tablero</span><input class="input" type="number" inputmode="numeric" v-model="f.km" required /></label><label class="field"><span>Fecha</span><input class="input" type="date" v-model="f.date" :max="today" /></label></div>
          <label class="field"><span>Motivo (opcional)</span><select class="input" v-model="f.reason"><option value="">—</option><option>Lectura de rutina</option><option>Antes de un mantenimiento</option><option>Tanqueada</option><option>Viaje</option></select></label>
          <label class="field"><span>Nota</span><input class="input" v-model="f.note" /></label>
          <template v-if="lowerKm || f.correction">
            <label class="row small" style="gap:8px"><input type="checkbox" v-model="f.correction" style="width:20px;height:20px" />Es una corrección justificada</label>
            <label v-if="f.correction" class="field"><span>¿Por qué se corrige?</span><input class="input" v-model="f.correctionNote" placeholder="Ej. cambio de tablero, error en la lectura anterior" /></label>
          </template>
        </template>

        <!-- Mantenimiento -->
        <template v-else-if="sh.type === 'service'">
          <label class="field"><span>Estado</span><select class="input" v-model="f.status"><option value="realizado">Realizado</option><option value="programado">Programado</option><option value="por_confirmar">Por confirmar (está en el taller)</option></select></label>
          <div class="grid2"><label class="field"><span>{{ f.status === 'realizado' ? 'Fecha en que se hizo' : 'Fecha' }}</span><input class="input" type="date" v-model="f.date" :max="f.status === 'realizado' ? today : null" /></label><label class="field"><span>Kilometraje</span><input class="input" type="number" inputmode="numeric" v-model="f.km" placeholder="Si lo sabes" /></label></div>
          <div class="field"><span class="tiny b muted">Trabajos de esta visita</span>
            <div v-for="(it, i) in f.items" :key="i" class="card tight stack" style="gap:6px;margin-top:6px">
              <div class="row" style="gap:6px"><select class="input grow" v-model="it.component" :aria-label="`Componente ${i + 1}`"><option value="">Componente…</option><option v-for="c in cats" :key="c.id" :value="c.id">{{ c.name }}</option></select>
                <select class="input" style="max-width:42%" v-model="it.action" aria-label="Acción"><option v-for="a in ACTIONS" :key="a.id" :value="a.id">{{ a.label }}</option></select>
                <button v-if="f.items.length > 1" type="button" class="iconbtn" aria-label="Quitar trabajo" @click="f.items.splice(i, 1)"><Icon name="x" :size="16" /></button></div>
              <input class="input" v-model="it.detail" placeholder="Detalle (opcional)" />
            </div>
            <div class="row wrap" style="gap:6px;margin-top:6px"><button type="button" class="btn sm ghost" @click="f.items.push({ component: '', action: 'reemplazar', detail: '' })">+ Otro trabajo</button>
              <input class="input grow" style="min-width:140px" v-model="newCat" placeholder="Nueva categoría" @keydown.enter.prevent="addCat" /><button v-if="newCat" type="button" class="btn sm lav" @click="addCat">Crear</button></div>
          </div>
          <label class="field"><span>Descripción del trabajo</span><textarea class="input" v-model="f.description" rows="2"></textarea></label>
          <label class="field"><span>Repuestos, marcas y referencias</span><textarea class="input" v-model="f.parts" rows="2" placeholder="Ej. Aceite Honda 10W-30 0,8 L"></textarea></label>
          <div class="field"><span>Taller</span><div class="row" style="gap:6px"><select class="input grow" v-model="f.shopId"><option value="">Sin taller</option><option v-for="s in g.shops" :key="s.id" :value="s.id">{{ s.name }}{{ s.mechanic ? ` · ${s.mechanic}` : '' }}{{ s.blocked ? ' (no volver)' : '' }}</option></select><button type="button" class="btn sm ghost" @click="addShop">+ Taller</button></div></div>
          <p v-if="shopOf(f.shopId)?.blocked" class="tiny" style="color:var(--danger);margin-top:-4px">Marcaste este taller como "No volver": {{ shopOf(f.shopId).blockedReason }}</p>
          <label class="field"><span>Mecánico que la revisó (si es otro)</span><input class="input" v-model="f.mechanic" :placeholder="shopOf(f.shopId)?.mechanic || 'Opcional'" /></label>
          <div class="grid3"><label class="field"><span>Repuestos $</span><input class="input" type="number" inputmode="numeric" v-model="f.costParts" /></label><label class="field"><span>Mano de obra $</span><input class="input" type="number" inputmode="numeric" v-model="f.costLabor" /></label><label class="field"><span>Total $</span><input class="input" type="number" inputmode="numeric" v-model="f.costTotal" :placeholder="total != null ? String(total) : ''" /></label></div>
          <p v-if="total != null && f.costTotal === ''" class="tiny muted">Total calculado: {{ L.fmtMoney(total) }}</p>
          <template v-if="f.status === 'realizado'">
            <div class="grid2"><label class="field"><span>Próxima revisión (km)</span><input class="input" type="number" inputmode="numeric" v-model="f.nextKm" placeholder="Opcional" /></label><label class="field"><span>Próxima revisión (fecha)</span><input class="input" type="date" v-model="f.nextDate" /></label></div>
            <p class="tiny muted">Si lo dejas vacío, se calcula con el plan de cada componente (solo si sabe el km o la fecha).</p>
          </template>
          <template v-else><label class="field"><span>Fecha estimada / nota de entrega</span><input class="input" v-model="f.expectedNote" placeholder="Ej. la entregan lunes o martes" /></label></template>
          <label class="field"><span>Notas y seguimiento</span><textarea class="input" v-model="f.notes" rows="2"></textarea></label>
        </template>

        <!-- Confirmar entrega -->
        <template v-else-if="sh.type === 'confirm'">
          <p class="small">{{ f.svc?.description }}<br /><span class="muted tiny">Entró el {{ L.fmtDate(f.svc?.intakeDate || f.svc?.date) }}{{ f.svc?.expectedNote ? ` · ${f.svc.expectedNote}` : '' }}</span></p>
          <label class="field"><span>¿Qué día te la entregaron?</span><input class="input" type="date" v-model="f.date" :max="today" /></label>
          <div class="field"><span>¿Qué se hizo de verdad?</span>
            <label v-for="it in f.svc?.items || []" :key="it.id" class="row small" style="gap:8px;padding:4px 0"><input type="checkbox" :value="it.id" v-model="f.doneIds" style="width:20px;height:20px" />{{ L.catName(g, it.component) }} · {{ L.actionLabel(it.action).toLowerCase() }}</label>
          </div>
          <div class="grid2"><label class="field"><span>Kilometraje</span><input class="input" type="number" inputmode="numeric" v-model="f.km" placeholder="Si lo sabes" /></label><label class="field"><span>Total pagado $</span><input class="input" type="number" inputmode="numeric" v-model="f.costTotal" /></label></div>
          <div class="field"><span>Taller</span><div class="row" style="gap:6px"><select class="input grow" v-model="f.shopId"><option value="">Sin taller</option><option v-for="s in g.shops" :key="s.id" :value="s.id">{{ s.name }}{{ s.blocked ? ' (no volver)' : '' }}</option></select></div></div>
          <label class="field"><span>Notas</span><textarea class="input" v-model="f.notes" rows="2"></textarea></label>
        </template>

        <!-- Plan -->
        <template v-else-if="sh.type === 'plan'">
          <div class="grid2"><label class="field"><span>Componente</span><select class="input" v-model="f.component"><option value="">Elegir…</option><option v-for="c in cats" :key="c.id" :value="c.id">{{ c.name }}</option></select></label>
            <label class="field"><span>Qué se hace</span><select class="input" v-model="f.action"><option v-for="a in ACTIONS" :key="a.id" :value="a.id">{{ a.label }}</option></select></label></div>
          <div class="grid2"><label class="field"><span>Cada (km)</span><input class="input" type="number" inputmode="numeric" v-model="f.intervalKm" /></label><label class="field"><span>Cada (meses)</span><input class="input" type="number" inputmode="numeric" v-model="f.intervalMonths" /></label></div>
          <div class="grid2"><label class="field"><span>Próxima a los (km)</span><input class="input" type="number" inputmode="numeric" v-model="f.nextKm" placeholder="Opcional" /></label><label class="field"><span>Próxima fecha</span><input class="input" type="date" v-model="f.nextDate" /></label></div>
          <div class="grid2"><label class="field"><span>Avisar antes (km)</span><input class="input" type="number" inputmode="numeric" v-model="f.leadKm" /></label><label class="field"><span>Avisar antes (días)</span><input class="input" type="number" inputmode="numeric" v-model="f.leadDays" /></label></div>
          <label class="field"><span>Fuente</span><select class="input" v-model="f.verification"><option v-for="(v, k) in VERIFICATION" :key="k" :value="k">{{ v.label }}</option></select></label>
          <div class="grid2"><label class="field"><span>Documento / enlace</span><input class="input" v-model="f.sourceRef" placeholder="Opcional" /></label><label class="field"><span>Página o sección</span><input class="input" v-model="f.page" placeholder="Opcional" /></label></div>
          <label class="field"><span>Observaciones</span><textarea class="input" v-model="f.notes" rows="2"></textarea></label>
          <label class="row small" style="gap:8px"><input type="checkbox" v-model="f.active" style="width:20px;height:20px" />Activo (genera avisos)</label>
          <label class="row small" style="gap:8px"><input type="checkbox" v-model="f.autoTask" style="width:20px;height:20px" />Crear tarea en MuMu cuando toque</label>
        </template>

        <!-- Documento -->
        <template v-else-if="sh.type === 'doc'">
          <label class="field"><span>Tipo</span><select class="input" v-model="f.kind"><option v-for="k in DOC_KINDS" :key="k.id" :value="k.id">{{ k.label }}</option></select></label>
          <label v-if="f.kind === 'otro'" class="field"><span>Nombre</span><input class="input" v-model="f.name" /></label>
          <div class="grid2"><label class="field"><span>Expedición</span><input class="input" type="date" v-model="f.issuedAt" /></label><label class="field"><span>Vencimiento</span><input class="input" type="date" v-model="f.expiresAt" /></label></div>
          <div class="grid2"><label class="field"><span>Número o referencia</span><input class="input" v-model="f.number" /></label><label class="field"><span>Entidad</span><input class="input" v-model="f.issuer" placeholder="Aseguradora, CDA…" /></label></div>
          <div class="grid2"><label class="field"><span>Avisar (días antes)</span><input class="input" type="number" inputmode="numeric" v-model="f.leadDays" :placeholder="String(DOC_KINDS.find((k) => k.id === f.kind)?.lead ?? 30)" /></label><label class="field"><span>Valor pagado $</span><input class="input" type="number" inputmode="numeric" v-model="f.cost" /></label></div>
          <label class="field"><span>Foto o PDF (opcional)</span><input ref="fileInput" class="input" type="file" accept="application/pdf,image/*" @change="pickedFile = $event.target.files[0]" /></label>
          <label class="field"><span>…o enlace del archivo en Drive</span><input class="input" v-model="f.driveFileId" placeholder="https://drive.google.com/file/d/…" /></label>
          <label class="field"><span>Notas</span><textarea class="input" v-model="f.notes" rows="2"></textarea></label>
          <p class="tiny muted">Escribe la fecha de vencimiento que dice tu documento: MuMu no la adivina.</p>
        </template>

        <!-- Renovar -->
        <template v-else-if="sh.type === 'renew'">
          <p class="small">{{ f.old?.name }} · vencía {{ L.fmtDate(f.old?.expiresAt) }}. El anterior queda guardado en el historial.</p>
          <div class="grid2"><label class="field"><span>Expedición</span><input class="input" type="date" v-model="f.issuedAt" /></label><label class="field"><span>Nuevo vencimiento</span><input class="input" type="date" v-model="f.expiresAt" /></label></div>
          <p v-if="f.old?.kind !== 'otro'" class="tiny muted">Propuse un año de vigencia: corrígelo con la fecha real de tu documento.</p>
          <div class="grid2"><label class="field"><span>Número</span><input class="input" v-model="f.number" /></label><label class="field"><span>Entidad</span><input class="input" v-model="f.issuer" /></label></div>
          <label class="field"><span>Valor pagado $</span><input class="input" type="number" inputmode="numeric" v-model="f.cost" /></label>
          <label class="field"><span>Foto o PDF</span><input class="input" type="file" accept="application/pdf,image/*" @change="pickedFile = $event.target.files[0]" /></label>
        </template>

        <!-- Gasto -->
        <template v-else-if="sh.type === 'expense'">
          <div class="grid2"><label class="field"><span>Valor $</span><input class="input" type="number" inputmode="numeric" v-model="f.amount" required /></label><label class="field"><span>Fecha</span><input class="input" type="date" v-model="f.date" :max="today" /></label></div>
          <label class="field"><span>Categoría</span><select class="input" v-model="f.category"><option v-for="c in EXPENSE_CATS.filter((x) => x.id !== 'combustible')" :key="c.id" :value="c.id">{{ c.label }}</option></select></label>
          <label class="field"><span>Descripción</span><input class="input" v-model="f.description" /></label>
          <div class="grid2"><label class="field"><span>Kilometraje</span><input class="input" type="number" inputmode="numeric" v-model="f.km" placeholder="Opcional" /></label><label class="field"><span>Moneda</span><select class="input" v-model="f.currency"><option>COP</option><option>USD</option></select></label></div>
          <label class="field"><span>Comprobante (opcional)</span><input class="input" type="file" accept="application/pdf,image/*" @change="pickedFile = $event.target.files[0]" /></label>
          <p class="tiny muted">Para gasolina usa "Combustible" (así calcula el consumo).</p>
        </template>

        <!-- Combustible -->
        <template v-else-if="sh.type === 'fuel'">
          <div class="grid2"><label class="field"><span>Fecha</span><input class="input" type="date" v-model="f.date" :max="today" /></label><label class="field"><span>Kilometraje</span><input class="input" type="number" inputmode="numeric" v-model="f.km" placeholder="Opcional" /></label></div>
          <div class="grid2"><label class="field"><span>Cantidad</span><input class="input" type="number" step="0.01" inputmode="decimal" v-model="f.qty" /></label><label class="field"><span>Unidad</span><select class="input" v-model="f.unit"><option value="L">Litros</option><option value="gal">Galones</option></select></label></div>
          <label class="field"><span>Valor $</span><input class="input" type="number" inputmode="numeric" v-model="f.amount" /></label>
          <label class="row small" style="gap:8px"><input type="checkbox" v-model="f.full" style="width:20px;height:20px" />Llené el tanque (sirve para calcular el consumo)</label>
          <div class="grid2"><label class="field"><span>Tipo</span><input class="input" v-model="f.fuelType" :placeholder="veh?.fuelType || 'Corriente'" /></label><label class="field"><span>Estación</span><input class="input" v-model="f.station" /></label></div>
          <label class="field"><span>Notas</span><input class="input" v-model="f.notes" /></label>
        </template>

        <!-- Repuesto / insumo que usa -->
        <template v-else-if="sh.type === 'part'">
          <label class="field"><span>¿Qué es?</span><input class="input" v-model="f.label" list="part-labels" placeholder="Ej. Aceite del motor" required /><datalist id="part-labels"><option>Aceite del motor</option><option>Bujía</option><option>Filtro de aire</option><option>Llanta delantera</option><option>Llanta trasera</option><option>Batería</option><option>Correa</option><option>Pastillas o bandas de freno</option><option>Bombillo</option></datalist></label>
          <label class="field"><span>Marca y tipo</span><input class="input" v-model="f.brand" placeholder="Ej. Honda Pro Honda Synthetic Blend 10W-30" /></label>
          <div class="grid2"><label class="field"><span>Referencia</span><input class="input" v-model="f.ref" placeholder="Ej. 08233-M99-K1LQD" /></label><label class="field"><span>Cantidad</span><input class="input" v-model="f.qty" placeholder="Ej. 0,8 L" /></label></div>
          <label class="field"><span>Foto (de la etiqueta o el empaque)</span><input class="input" type="file" accept="image/*" @change="pickedFile = $event.target.files[0]" /></label>
          <label class="field"><span>Notas</span><textarea class="input" v-model="f.notes" rows="2" placeholder="Dónde comprarlo, precio, recomendaciones…"></textarea></label>
        </template>

        <!-- Taller -->
        <template v-else-if="sh.type === 'shop'">
          <label class="field"><span>Nombre del taller</span><input class="input" v-model="f.name" required /></label>
          <label class="field"><span>Mecánico</span><input class="input" v-model="f.mechanic" /></label>
          <label class="field"><span>Ubicación</span><input class="input" v-model="f.address" placeholder="Dirección o barrio" /></label>
          <label class="field"><span>Enlace de Google Maps (opcional)</span><input class="input" type="url" v-model="f.mapsUrl" placeholder="https://maps.app.goo.gl/…" /></label>
          <label class="field"><span>Teléfono / WhatsApp</span><input class="input" type="tel" v-model="f.phone" /></label>
          <label class="field"><span>Notas</span><textarea class="input" v-model="f.notes" rows="2" placeholder="Horario, qué tan bien trabaja, precios…"></textarea></label>
          <label class="row small" style="gap:8px"><input type="checkbox" v-model="f.blocked" style="width:20px;height:20px" />No volver a este taller</label>
          <label v-if="f.blocked" class="field"><span>¿Por qué?</span><textarea class="input" v-model="f.blockedReason" rows="2" required placeholder="Ej. cobró cosas que no hizo, dejó la moto mal arreglada…"></textarea></label>
        </template>

        <!-- Archivo -->
        <template v-else-if="sh.type === 'file'">
          <label class="field"><span>Tipo</span><select class="input" v-model="f.kind"><option v-for="k in FILE_KINDS" :key="k.id" :value="k.id">{{ k.label }}</option></select></label>
          <label class="field"><span>Archivo (PDF o foto, hasta 25 MB)</span><input class="input" type="file" accept="application/pdf,image/*" @change="pickedFile = $event.target.files[0]" /></label>
          <label class="field"><span>Nota</span><input class="input" v-model="f.note" /></label>
          <p class="tiny muted">Se guarda en privado en tu cuenta (no queda un enlace público).</p>
        </template>

        <div v-if="busy && progress" class="bar"><i :style="{ width: progress * 100 + '%' }"></i></div>
        <button v-if="f.id && !['confirm', 'renew', 'file', 'vehicle'].includes(sh.type)" type="button" class="btn ghost sm" style="align-self:flex-start;color:#A8344A" @click="remove"><Icon name="trash" :size="14" />Borrar</button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.phgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(78px, 1fr)); gap: 8px; }
.phcell { position: relative; aspect-ratio: 1; border-radius: 12px; overflow: hidden; background: var(--surface-3); display: grid; place-items: center; }
.phcell img { width: 100%; height: 100%; object-fit: cover; }
.phcell.add { border: 1.5px dashed var(--lav-300); background: none; cursor: pointer; color: var(--lav-700); gap: 2px; align-content: center; }
.phx, .phstar { position: absolute; top: 4px; width: 22px; height: 22px; border-radius: 50%; border: 0; display: grid; place-items: center; background: rgba(30, 20, 30, .6); color: #fff; cursor: pointer; padding: 0; }
.phx { right: 4px; } .phstar { left: 4px; }
.phtag { position: absolute; left: 4px; bottom: 4px; font-size: 10px; background: var(--pink-700); color: #fff; padding: 1px 6px; border-radius: 999px; }
</style>
