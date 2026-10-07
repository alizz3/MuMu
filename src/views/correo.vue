<script setup>
import { computed, ref } from 'vue'
import { state, ui } from '../store'
import * as A from '../store/actions'
import { relDay, dayKey } from '../engine/time'
import { syncGmail, canUseBackend } from '../services/api'
import { toast } from '../engine/game'
import { Icon, Chip, Empty } from '../components/ui'

const cat = ref('importante')
const acc = ref('todas')
const CATS = [['importante', '⭐ Importante'], ['revisar', '👀 Para revisar'], ['informativo', 'ℹ️ Informativo'], ['ignorado', '🙈 Ignorados']]
const list = computed(() => state.emails.filter((e) => (cat.value === 'ignorado' ? e.status === 'ignorado' : e.category === cat.value && e.status !== 'ignorado')).filter((e) => acc.value === 'todas' || e.account === acc.value))
const accounts = computed(() => ['todas', ...new Set(state.emails.map((e) => e.account))])
const evFor = ref(null)
const ev = ref({ date: dayKey(), start: '10:00', end: '11:00' })
const noteFor = ref(null)
const busy = ref(false)
const gmailOn = computed(() => state.integrations.google.some((a) => a.services.includes('gmail')))
async function sync() { busy.value = true; try { await syncGmail() } catch (e) { toast(e.message) } finally { busy.value = false } }
function recat(e, c) { e.category = c; e.manualCategory = true }
</script>

<template>
  <div class="stack">
    <div class="card row">
      <span class="ico"><Icon name="mail" /></span>
      <div class="grow"><div class="b small">Correos que requieren acción</div><div class="tiny muted">{{ gmailOn ? 'Gmail conectado (solo lectura)' : 'Conecta Gmail en Configuración para traer tus correos' }}</div></div>
      <button v-if="gmailOn && canUseBackend()" class="btn sm primary" :disabled="busy" @click="sync"><Icon name="refresh" :size="14" />{{ busy ? '…' : 'Revisar' }}</button>
      <button v-else class="btn sm lav" @click="A.go('ajustes')">Conectar</button>
    </div>
    <p v-if="state.emails.some((e) => e.demo)" class="notice">🧪 Los correos marcados “ejemplo” no son reales: muestran cómo se verán tus correos clasificados.</p>
    <div class="chips"><Chip v-for="c in CATS" :key="c[0]" :active="cat === c[0]" @click="cat = c[0]">{{ c[1] }} · {{ state.emails.filter((e) => c[0] === 'ignorado' ? e.status === 'ignorado' : e.category === c[0] && e.status !== 'ignorado').length }}</Chip></div>
    <div class="chips"><Chip v-for="a in accounts" :key="a" :active="acc === a" @click="acc = a">{{ a }}</Chip></div>

    <div v-for="e in list" :key="e.id" class="card">
      <div class="row between"><span class="badge" :class="{ pink: e.account === 'universidad' }">{{ e.account }}</span><span class="tiny muted">{{ relDay(e.date) }}</span></div>
      <div class="b small" style="margin-top:6px">{{ e.subject }}</div>
      <div class="tiny muted">De: {{ e.from }} <span v-if="e.demo" class="badge demo">ejemplo</span></div>
      <p class="small" style="margin-top:6px">{{ e.snippet }}</p>
      <p v-if="e.note" class="tiny" style="margin-top:6px">📝 {{ e.note }}</p>
      <div class="row wrap" style="gap:6px;margin-top:10px">
        <button v-if="!e.taskId" class="btn sm primary" @click="A.emailToTask(e.id)">→ Tarea</button>
        <button v-else class="btn sm ghost" @click="ui.modal = { type: 'task', id: e.taskId }">Ver tarea</button>
        <button class="btn sm lav" @click="evFor = evFor === e.id ? null : e.id">→ Evento</button>
        <button class="btn sm ghost" @click="A.setEmailStatus(e.id, 'revisado')">{{ e.status === 'revisado' ? 'Revisado ✓' : 'Marcar revisado' }}</button>
        <button class="btn sm ghost" @click="A.setEmailStatus(e.id, e.status === 'ignorado' ? 'nuevo' : 'ignorado')">{{ e.status === 'ignorado' ? 'Restaurar' : 'Ignorar' }}</button>
        <button class="btn sm ghost" @click="noteFor = noteFor === e.id ? null : e.id">Nota</button>
        <select class="input" style="width:auto;padding:5px 8px;font-size:12px" :value="e.category" @change="recat(e, $event.target.value)" aria-label="Cambiar categoría"><option value="importante">Importante</option><option value="revisar">Para revisar</option><option value="informativo">Informativo</option></select>
      </div>
      <div v-if="evFor === e.id" class="row" style="margin-top:8px">
        <input class="input" type="date" v-model="ev.date" aria-label="Fecha" /><input class="input" type="time" v-model="ev.start" aria-label="Inicio" /><input class="input" type="time" v-model="ev.end" aria-label="Fin" />
        <button class="btn sm primary" @click="A.emailToEvent(e.id, ev.date, ev.start, ev.end); evFor = null">OK</button>
      </div>
      <input v-if="noteFor === e.id" class="input" v-model="e.note" placeholder="Nota para ti…" style="margin-top:8px" />
    </div>
    <Empty v-if="!list.length" pose="happy" text="Nada por aquí 💌" />
  </div>
</template>
