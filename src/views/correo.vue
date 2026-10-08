<script setup>
import { computed, ref, watch } from 'vue'
import { state, ui } from '../store'
import * as A from '../store/actions'
import { relDay, dayKey } from '../engine/time'
import { syncGmail, canUseBackend, canOrganize, gmailAction } from '../services/api'
import { toast, ask } from '../engine/game'
import { inScope } from '../engine/modoU'
import { Icon, Chip, Empty } from '../components/ui'
import Contact from '../components/Contact.vue'

const cat = ref('importante')
const acc = ref('todas')
const CATS = [['importante', '⭐ Importante'], ['revisar', '👀 Para revisar'], ['informativo', 'ℹ️ Informativo'], ['promos', '🗑️ Promos y redes'], ['ignorado', '🙈 Ignorados']]
const NAMES = { importante: 'Importante', revisar: 'Para revisar', informativo: 'Informativo', promos: 'Promos' }
const inCat = (e, c) => (c === 'ignorado' ? e.status === 'ignorado' : e.category === c && e.status !== 'ignorado')
const scoped = computed(() => state.emails.filter((e) => inScope('email', e)))
const list = computed(() => scoped.value.filter((e) => inCat(e, cat.value)).filter((e) => acc.value === 'todas' || e.account === acc.value))
const accounts = computed(() => ['todas', ...new Set(scoped.value.map((e) => e.account))])
const evFor = ref(null)
const ev = ref({ date: dayKey(), start: '10:00', end: '11:00' })
const noteFor = ref(null)
const busy = ref(false)
const gmailOn = computed(() => state.integrations.google.some((a) => a.services.includes('gmail')))
const organizeOn = computed(() => state.integrations.google.some((a) => a.services.includes('gmail-organize')))
async function sync() { busy.value = true; try { await syncGmail() } catch (e) { toast(e.message) } finally { busy.value = false } }
function recat(e, c) { e.category = c; e.manualCategory = true }

// Selección para acciones en grupo
const sel = ref([])
watch([cat, acc], () => { sel.value = [] })
const allSel = computed(() => list.value.length > 0 && sel.value.length === list.value.length)
const toggleAll = () => { sel.value = allSel.value ? [] : list.value.map((e) => e.id) }
const toggle = (id) => { sel.value = sel.value.includes(id) ? sel.value.filter((x) => x !== id) : [...sel.value, id] }
const chosen = () => state.emails.filter((e) => sel.value.includes(e.id))

async function run(action, emails = chosen(), label) {
  if (!emails.length) return
  if (action === 'trash' && !(await ask(`¿Mandar ${emails.length} correo${emails.length === 1 ? '' : 's'} a la papelera de Gmail? Puedes recuperarlos allí durante 30 días.`))) return
  busy.value = true
  try {
    const { done, skipped } = await gmailAction(emails, action, label)
    if (action === 'trash') { const ids = new Set(emails.filter((e) => canOrganize(e.accountId)).map((e) => e.id)); state.emails = state.emails.filter((e) => !ids.has(e.id)) }
    if (action === 'read') emails.forEach((e) => (e.unread = false))
    toast(`${done} listo${done === 1 ? '' : 's'} en Gmail${skipped ? ` · ${skipped} sin permiso de organizar` : ''} ✨`)
    sel.value = []
  } catch (e) { toast(e.message) } finally { busy.value = false }
}
const labelFor = () => `MuMu/${NAMES[cat.value] || 'Revisado'}`
</script>

<template>
  <div class="stack">
    <div class="card row">
      <span class="ico"><Icon name="mail" /></span>
      <div class="grow"><div class="b small">Correos que requieren acción</div><div class="tiny muted">{{ gmailOn ? (organizeOn ? 'Gmail conectado · puedes limpiar y organizar' : 'Gmail conectado (solo lectura)') : 'Conecta Gmail en Configuración para traer tus correos' }}</div></div>
      <button v-if="gmailOn && canUseBackend()" class="btn sm primary" :disabled="busy" @click="sync"><Icon name="refresh" :size="14" />{{ busy ? '…' : 'Revisar' }}</button>
      <button v-else class="btn sm lav" @click="A.go('ajustes')">Conectar</button>
    </div>
    <p v-if="gmailOn && !organizeOn" class="notice">🧹 Para mandar a la papelera y crear etiquetas en tu Gmail, dale a tu cuenta el permiso <b>"Organizar Gmail"</b> en Configuración → Cuentas.</p>
    <p v-if="state.emails.some((e) => e.demo)" class="notice">🧪 Los correos marcados “ejemplo” no son reales: muestran cómo se verán tus correos clasificados.</p>
    <div class="chips"><Chip v-for="c in CATS" :key="c[0]" :active="cat === c[0]" @click="cat = c[0]">{{ c[1] }} · {{ scoped.filter((e) => inCat(e, c[0])).length }}</Chip></div>
    <div class="chips"><Chip v-for="a in accounts" :key="a" :active="acc === a" @click="acc = a">{{ a }}</Chip></div>

    <!-- Acciones en grupo -->
    <div v-if="list.length && organizeOn" class="card tight row wrap" style="gap:8px">
      <label class="row small" style="gap:6px"><input type="checkbox" :checked="allSel" @change="toggleAll" aria-label="Seleccionar todos" /> {{ sel.length ? `${sel.length} seleccionados` : 'Seleccionar todos' }}</label>
      <span class="grow"></span>
      <button class="btn sm ghost" :disabled="!sel.length || busy" @click="run('read')">Marcar leídos</button>
      <button class="btn sm lav" :disabled="!sel.length || busy" @click="run('label', chosen(), labelFor())">Etiquetar “{{ labelFor() }}”</button>
      <button class="btn sm primary" :disabled="!sel.length || busy" @click="run('trash')"><Icon name="trash" :size="14" />Papelera</button>
    </div>

    <div v-for="e in list" :key="e.id" class="card" :style="sel.includes(e.id) ? { borderColor: 'var(--pink-300)' } : {}">
      <div class="row between">
        <div class="row" style="gap:8px">
          <input v-if="organizeOn && canOrganize(e.accountId)" type="checkbox" :checked="sel.includes(e.id)" @change="toggle(e.id)" :aria-label="`Seleccionar ${e.subject}`" />
          <span class="badge" :class="{ pink: e.account === 'universidad' }">{{ e.account }}</span>
          <span v-if="e.profe" class="badge green">👩‍🏫 {{ e.profe }}</span>
        </div>
        <span class="tiny muted">{{ relDay(e.date) }}</span>
      </div>
      <div class="b small" style="margin-top:6px">{{ e.subject }}</div>
      <div class="tiny muted row wrap" style="gap:2px 6px">De: {{ e.fromEmail ? String(e.from).replace(/<[^>]*>/, '').replace(/"/g, '').trim() || e.fromEmail : e.from }} <Contact v-if="e.fromEmail" :value="e.fromEmail" kind="email" :label="e.fromEmail" :as="state.integrations.google.find((g) => g.id === e.accountId)?.email || ''" /> <span v-if="e.demo" class="badge demo">ejemplo</span></div>
      <p class="small" style="margin-top:6px">{{ e.snippet }}</p>
      <p v-if="e.note" class="tiny" style="margin-top:6px">📝 {{ e.note }}</p>
      <div class="row wrap" style="gap:6px;margin-top:10px">
        <button v-if="!e.taskId" class="btn sm primary" @click="A.emailToTask(e.id)">→ Tarea</button>
        <button v-else class="btn sm ghost" @click="ui.modal = { type: 'task', id: e.taskId }">Ver tarea</button>
        <button class="btn sm lav" @click="evFor = evFor === e.id ? null : e.id">→ Evento</button>
        <a v-if="e.url" class="btn sm ghost" :href="e.url" target="_blank" rel="noopener">Abrir en Gmail</a>
        <button v-if="canOrganize(e.accountId)" class="btn sm ghost" :disabled="busy" @click="run('trash', [e])"><Icon name="trash" :size="14" />Papelera</button>
        <button class="btn sm ghost" @click="A.setEmailStatus(e.id, e.status === 'ignorado' ? 'nuevo' : 'ignorado')">{{ e.status === 'ignorado' ? 'Restaurar' : 'Ignorar' }}</button>
        <button class="btn sm ghost" @click="noteFor = noteFor === e.id ? null : e.id">Nota</button>
        <select class="input" style="width:auto;padding:5px 8px;font-size:12px" :value="e.category" @change="recat(e, $event.target.value)" aria-label="Cambiar categoría"><option value="importante">Importante</option><option value="revisar">Para revisar</option><option value="informativo">Informativo</option><option value="promos">Promos</option></select>
      </div>
      <div v-if="evFor === e.id" class="row" style="margin-top:8px">
        <input class="input" type="date" v-model="ev.date" aria-label="Fecha" /><input class="input" type="time" v-model="ev.start" aria-label="Inicio" /><input class="input" type="time" v-model="ev.end" aria-label="Fin" />
        <button class="btn sm primary" @click="A.emailToEvent(e.id, ev.date, ev.start, ev.end); evFor = null">OK</button>
      </div>
      <input v-if="noteFor === e.id" class="input" v-model="e.note" placeholder="Nota para ti…" style="margin-top:8px" aria-label="Nota" />
    </div>
    <Empty v-if="!list.length" pose="happy" text="Nada por aquí 💌" />
  </div>
</template>
