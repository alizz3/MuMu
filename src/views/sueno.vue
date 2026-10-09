<script setup>
import { computed, reactive } from 'vue'
import { state } from '../store'
import * as A from '../store/actions'
import { insights, series } from '../engine/insights'
import { dayKey, fmtDur, shortDate, fmt12s, WEEKDAYS, parseDay } from '../engine/time'
import { Icon, Pet, Chip } from '../components/ui'
import { FACES, FEELINGS } from '../components/iconFor'

const today = state.sleep.find((s) => s.date === dayKey())
const f = reactive({ bed: today?.bed || '23:00', wake: today?.wake || '06:30', quality: today?.quality || 3, hardWake: today?.hardWake || 3, notes: today?.notes || '' })
const last = computed(() => [...state.sleep].sort((a, b) => (a.date > b.date ? 1 : -1)).slice(-14))
const avg = computed(() => last.value.length ? last.value.reduce((a, s) => a + s.minutes, 0) / last.value.length : 0)
const avgQ = computed(() => last.value.length ? (last.value.reduce((a, s) => a + s.quality, 0) / last.value.length).toFixed(1) : '—')
const ins = computed(() => insights().filter((i) => i.id.startsWith('sleep')))
const max = computed(() => Math.max(9 * 60, ...last.value.map((s) => s.minutes)))
</script>

<template>
  <div class="stack">
    <div class="card pink row">
      <Pet pose="sleep" :size="90" />
      <div class="grow">
        <div class="tiny b muted">ÚLTIMAS 2 SEMANAS</div>
        <div class="b">Promedio: {{ fmtDur(avg) }} · calidad {{ avgQ }}/5</div>
        <div class="tiny muted">Leo también aprueba dormir bien.</div>
      </div>
    </div>

    <form class="card stack" @submit.prevent="A.logSleep({ ...f })">
      <h3>¿Cómo dormiste anoche?</h3>
      <div class="grid2">
        <label class="field"><span>Me dormí</span><input class="input" type="time" v-model="f.bed" /></label>
        <label class="field"><span>Me desperté</span><input class="input" type="time" v-model="f.wake" /></label>
      </div>
      <div class="field"><span>Calidad percibida</span><div class="chips"><Chip v-for="n in 5" :key="n" :active="f.quality === n" :aria-label="`Calidad: ${FEELINGS[n - 1]}`" :title="FEELINGS[n - 1]" @click.prevent="f.quality = n"><Icon :name="FACES[n - 1]" :size="18" /></Chip></div></div>
      <div class="field"><span>¿Qué tan difícil fue despertar?</span><div class="chips"><Chip v-for="n in 5" :key="n" :active="f.hardWake === n" @click.prevent="f.hardWake = n">{{ ['Fácil', 'Bien', 'Normal', 'Difícil', 'Imposible'][n - 1] }}</Chip></div></div>
      <label class="field"><span>Notas</span><input class="input" v-model="f.notes" placeholder="¿Celular en la cama? ¿Café tarde?" /></label>
      <button class="btn primary" type="submit">Guardar</button>
    </form>

    <div class="card">
      <h3>Horas por noche</h3>
      <div class="spark" style="height:110px;margin-top:12px" role="img" :aria-label="`Gráfico de ${last.length} noches`">
        <i v-for="s in last" :key="s.id" :style="{ height: (s.minutes / max * 100) + '%', background: s.minutes >= 420 ? 'var(--lav-300)' : 'var(--pink-300)' }" :title="`${shortDate(s.date)}: ${fmtDur(s.minutes)}`"></i>
      </div>
      <div class="row between tiny muted" style="margin-top:4px"><span>{{ last[0] && shortDate(last[0].date) }}</span><span>■ 7h o más en lila</span><span>{{ last.at(-1) && shortDate(last.at(-1).date) }}</span></div>
    </div>

    <div class="card">
      <h3 class="wi"><Icon name="eye" :size="17" />Detecté algo</h3>
      <p v-for="i in ins" :key="i.id" class="small" style="margin-top:8px"><Icon :name="i.icon" :size="15" class="inl" /> {{ i.text }} <span class="tiny muted">({{ i.basis }})</span></p>
      <p v-if="!ins.length" class="small muted" style="margin-top:8px">Aún no hay suficientes datos para ver patrones. Sigue registrando unos días.</p>
      <p class="tiny muted" style="margin-top:10px">Son observaciones sobre tus propios datos, no un diagnóstico médico.</p>
    </div>

    <div class="card"><h3>Registro</h3>
      <div class="list"><div v-for="s in [...last].reverse()" :key="s.id" class="item small"><span class="grow">{{ WEEKDAYS[parseDay(s.date).getDay()] }} {{ shortDate(s.date) }}</span><span class="muted">{{ fmt12s(s.bed) }} → {{ fmt12s(s.wake) }}</span><b>{{ fmtDur(s.minutes) }}</b></div></div>
    </div>
  </div>
</template>
