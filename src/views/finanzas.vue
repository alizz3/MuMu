<script setup>
import { computed, ref } from 'vue'
import { state, ui } from '../store'
import { financeSummary, canUseBackend } from '../services/api'
import { toast } from '../engine/game'
import { relDay } from '../engine/time'
import { go } from '../store/actions'
import { Icon, Pet, Bar, Ring } from '../components/ui'
import { goalIcon } from '../components/iconFor'

const f = computed(() => state.finance)
const s = computed(() => f.value.summary)
const money = (n) => (n == null ? '—' : '$' + Math.round(n).toLocaleString('es-CO'))
const busy = ref(false)
async function refresh() {
  busy.value = true
  try { const r = await financeSummary(); state.finance = { connected: true, summary: r.summary, updatedAt: new Date().toISOString() } } catch (e) { toast(e.message) } finally { busy.value = false }
}
const url = computed(() => state.settings.financeAppUrl)
const g = computed(() => state.goals.find((x) => x.category === 'dinero'))
</script>

<template>
  <div class="stack">
    <div class="card pink row">
      <Pet pose="finance" :size="90" />
      <div class="grow"><h2 style="font-size:17px">Finanzas</h2>
        <p class="small">Los detalles viven en <b>{{ state.settings.financeAppName }}</b>. Aquí ves solo el resumen que necesitas para decidir tu día.</p></div>
    </div>
    <p v-if="!f.connected" class="notice"><Icon name="flask" :size="14" class="inl" /> {{ state.settings.financeAppName }} todavía no existe/está conectada. Los números de abajo son de ejemplo para mostrar el diseño.</p>

    <div v-if="s" class="card">
      <div class="row between"><h3>Resumen · {{ s.month }}</h3><span v-if="f.demo" class="badge demo">ejemplo</span></div>
      <div class="grid3" style="margin-top:10px">
        <div class="kpi"><b style="font-size:16px">{{ money(s.income) }}</b><span>Ingresos</span></div>
        <div class="kpi"><b style="font-size:16px;color:var(--pink-700)">{{ money(s.expenses) }}</b><span>Gastos</span></div>
        <div class="kpi"><b style="font-size:16px;color:var(--mint-700)">{{ money(s.balance) }}</b><span>Balance</span></div>
      </div>
      <div class="small" style="margin-top:12px">Deudas: <b>{{ money(s.debts) }}</b></div>
      <div v-if="s.goal" class="row" style="margin-top:12px"><Ring :value="s.goal.progress" :size="46" color="var(--mint-700)" /><div class="small">Meta: <b>{{ s.goal.name }}</b></div></div>
    </div>

    <div v-if="s?.nextPayments?.length" class="card">
      <h3>Próximos pagos</h3>
      <div v-for="p in s.nextPayments" :key="p.name" class="item small"><span class="grow">{{ p.name }}</span><span class="muted">{{ relDay(p.due) }}</span><b>{{ money(p.amount) }}</b>
        <button class="btn sm ghost" @click="ui.modal = { type: 'task', prefill: { title: `Pagar ${p.name}`, due: p.due, category: 'finanzas', estimate: 10 } }"><Icon name="plus" :size="14" />Tarea</button></div>
    </div>

    <div class="card stack">
      <h3>Conexión {{ state.settings.appName }} ↔ {{ state.settings.financeAppName }}</h3>
      <p class="small muted">Arquitectura lista: {{ state.settings.appName }} pide un resumen a {{ state.settings.financeAppName }} a través de <code>/api/finance/summary</code> (servidor a servidor, con una clave compartida). No se duplican tus movimientos: solo se muestra el resumen.</p>
      <div class="row" style="gap:6px">
        <a v-if="url" class="btn primary" :href="url" target="_blank" rel="noopener">Abrir {{ state.settings.financeAppName }} <Icon name="link" :size="15" /></a>
        <button v-if="canUseBackend()" class="btn lav" :disabled="busy" @click="refresh"><Icon name="refresh" :size="15" />Sincronizar</button>
        <button class="btn ghost" @click="go('ajustes')">Configurar</button>
      </div>
      <p v-if="g" class="tiny muted">Conectado con tu objetivo: <Icon :name="goalIcon(g)" :size="13" class="inl" /> {{ g.name }}</p>
    </div>
  </div>
</template>
