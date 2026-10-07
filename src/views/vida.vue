<script setup>
import { computed } from 'vue'
import { state, ui } from '../store'
import * as A from '../store/actions'
import { dayKey, keyPlus, fmtDur, relDay } from '../engine/time'
import { Icon, Pet, Chip } from '../components/ui'

const QUICK = [['familia', '👨‍👩‍👧 Tiempo con mis papás', 60], ['mascotas', '🐱 Jugar con Leo', 15], ['mascotas', '🐶 Paseo con Negra', 30], ['descanso', '😌 Descanso sin culpa', 30], ['música', '🎵 Música', 20], ['películas', '🎬 Película', 120], ['salir', '🌳 Salir', 60], ['social', '💬 Amigas', 60]]
const week = computed(() => state.life.filter((l) => l.date >= keyPlus(-6)))
const minutes = computed(() => week.value.reduce((a, l) => a + (l.minutes || 0), 0))
const byType = computed(() => week.value.reduce((m, l) => ((m[l.type] = (m[l.type] || 0) + (l.minutes || 0)), m), {}))
</script>

<template>
  <div class="stack">
    <div class="card pink row">
      <div class="grow"><h2 style="font-size:17px">Vida 🤍</h2><p class="small">Esto también es un buen día. Pasar tiempo con tu familia, Leo y Negra no es tiempo perdido: es la vida que estás construyendo.</p>
        <p class="tiny muted" style="margin-top:6px">Esta semana: {{ fmtDur(minutes) }} de momentos que importan</p></div>
      <Pet kind="negra" pose="happy" :size="70" /><Pet kind="leo" pose="happy" :size="70" />
    </div>
    <div class="card">
      <h3>¿Qué hiciste hoy?</h3>
      <div class="row wrap" style="gap:6px;margin-top:10px">
        <Chip v-for="q in QUICK" :key="q[1]" @click="A.addLife({ type: q[0], title: q[1].slice(3), minutes: q[2], feeling: 5 })">{{ q[1] }}</Chip>
        <Chip @click="ui.modal = { type: 'life' }">+ Otro momento</Chip>
      </div>
    </div>
    <div class="card" v-if="Object.keys(byType).length">
      <h3>Tu semana en equilibrio</h3>
      <div class="row wrap" style="gap:6px;margin-top:10px"><span v-for="(m, t) in byType" :key="t" class="badge green">{{ t }} · {{ fmtDur(m) }}</span></div>
    </div>
    <div class="card">
      <h3>Momentos</h3>
      <div class="list">
        <div v-for="l in state.life" :key="l.id" class="item">
          <span class="ico mint">{{ { familia: '👨‍👩‍👧', padres: '💞', mascotas: '🐾', descanso: '😌', música: '🎵', películas: '🎬', salir: '🌳', social: '💬' }[l.type] || '🤍' }}</span>
          <div class="grow"><div class="title-line">{{ l.title }}</div><div class="tiny muted">{{ relDay(l.date) }}{{ l.minutes ? ' · ' + fmtDur(l.minutes) : '' }} · {{ '💗'.repeat(l.feeling || 0) }}</div></div>
        </div>
      </div>
    </div>
  </div>
</template>
