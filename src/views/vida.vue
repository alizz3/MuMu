<script setup>
import { computed } from 'vue'
import { state, ui } from '../store'
import * as A from '../store/actions'
import { keyPlus, fmtDur, relDay, fmt12s } from '../engine/time'
import { Icon, Pet } from '../components/ui'
import ListBar from '../components/ListBar.vue'
import GroupCard from '../components/GroupCard.vue'

// Cada tipo de momento con su ícono y color, del mismo estilo que el resto de MuMu
const TYPES = {
  familia: { icon: 'users', color: '#F7B6C2' }, padres: { icon: 'heart', color: '#F7B6C2' }, mascotas: { icon: 'paw', color: '#D9D5E0' },
  descanso: { icon: 'moon', color: '#C3B3D4' }, música: { icon: 'music', color: '#BFD7F0' }, películas: { icon: 'film', color: '#C3B3D4' },
  salir: { icon: 'leaf', color: '#B9DCCB' }, ocio: { icon: 'sparkles', color: '#FFE29A' }, social: { icon: 'chat', color: '#BFD7F0' }, 'momento importante': { icon: 'star', color: '#FFE29A' },
}
const T = (t) => TYPES[t] || { icon: 'heart', color: '#B9DCCB' }
const tint = (c) => ({ background: `color-mix(in srgb, ${c} 40%, var(--surface))`, color: 'var(--ink)' })
const QUICK = [['familia', 'Tiempo con mis papás', 60], ['mascotas', 'Jugar con Leo', 15], ['mascotas', 'Paseo con Negra', 30], ['descanso', 'Descanso sin culpa', 30], ['música', 'Música', 20], ['películas', 'Película', 90], ['salir', 'Salir a caminar', 30], ['social', 'Hablar con alguien', 20]]
const week = computed(() => state.life.filter((l) => l.date >= keyPlus(-6)))
const minutes = computed(() => week.value.reduce((a, l) => a + (l.minutes || 0), 0))
const byType = computed(() => week.value.reduce((m, l) => ((m[l.type] = (m[l.type] || 0) + (l.minutes || 0)), m), {}))
// Momentos agrupados por época, plegables como en Tareas
const PERIODS = [{ key: 'semana', label: 'Esta semana', icon: 'sun', color: '#FFE29A', from: () => keyPlus(-6) }, { key: 'mes', label: 'Este mes', icon: 'calendar', color: '#C3B3D4', from: () => keyPlus(-30) }, { key: 'antes', label: 'Antes', icon: 'clock', color: '#B9DCCB', from: () => '' }]
const lFold = computed(() => (state.settings.lifeFolded ||= {}))
const lifeGroups = computed(() => {
  const g = PERIODS.map((p) => ({ ...p, v: [] }))
  state.life.forEach((l) => g.find((p) => (l.date || '') >= p.from()).v.push(l))
  return g.filter((p) => p.v.length)
})
const allFolded = computed(() => lifeGroups.value.length > 0 && lifeGroups.value.every((g) => lFold.value[g.key]))
const foldAll = () => { const v = !allFolded.value; lifeGroups.value.forEach((g) => (lFold.value[g.key] = v)) }
const when = (l) => [relDay(l.date), l.start && l.end ? `${fmt12s(l.start)} – ${fmt12s(l.end)}` : '', l.minutes ? fmtDur(l.minutes) : ''].filter(Boolean).join(' · ')
</script>

<template>
  <div class="stack">
    <div class="card pink row">
      <div class="grow"><h2 style="font-size:17px">Vida</h2><p class="small">Esto también es un buen día. Pasar tiempo con tu familia, Leo y Negra no es tiempo perdido: es la vida que estás construyendo.</p>
        <p class="tiny muted" style="margin-top:6px">Esta semana: {{ fmtDur(minutes) }} de momentos que importan</p></div>
      <Pet kind="negra" pose="happy" :size="70" /><Pet kind="leo" pose="happy" :size="70" />
    </div>

    <div class="card">
      <div class="row between"><h3>¿Qué hiciste hoy?</h3><button class="link" @click="ui.modal = { type: 'life' }">+ Otro momento</button></div>
      <div class="quick">
        <button v-for="q in QUICK" :key="q[1]" class="qbtn" @click="A.addLife({ type: q[0], title: q[1], minutes: q[2], feeling: 5 })">
          <span class="gico" :style="tint(T(q[0]).color)"><Icon :name="T(q[0]).icon" :size="15" /></span>{{ q[1] }}
        </button>
      </div>
    </div>

    <div class="card" v-if="Object.keys(byType).length">
      <h3>Tu semana en equilibrio</h3>
      <div class="row wrap" style="gap:6px;margin-top:10px">
        <span v-for="(m, t) in byType" :key="t" class="pill"><span class="dot" :style="{ background: T(t).color }"></span><span class="cap">{{ t }}</span> · {{ fmtDur(m) }}</span>
      </div>
    </div>

    <ListBar :count="state.life.length" one="momento" :foldable="lifeGroups.length > 1" :all-folded="allFolded" @fold="foldAll" />
    <GroupCard v-for="g in lifeGroups" :key="g.key" :title="g.label" :icon="g.icon" :color="g.color" :count="g.v.length" :open="!lFold[g.key]" @toggle="lFold[g.key] = !lFold[g.key]">
      <div class="list">
        <button v-for="l in g.v" :key="l.id" class="item mom" @click="ui.modal = { type: 'life', id: l.id }">
          <span class="gico big" :style="tint(T(l.type).color)"><Icon :name="T(l.type).icon" :size="18" /></span>
          <div class="grow" style="min-width:0">
            <div class="title-line">{{ l.title }}</div>
            <div class="tiny muted">{{ when(l) }}</div>
            <div v-if="l.feeling" class="hearts" :aria-label="`Te sentiste ${l.feeling} de 5`"><Icon v-for="i in 5" :key="i" name="heart" :size="12" :class="{ on: i <= l.feeling }" /></div>
            <p v-if="l.note" class="tiny" style="margin-top:4px;white-space:pre-line">{{ l.note }}</p>
          </div>
          <a v-if="l.photos" class="btn sm lav" :href="l.photos" target="_blank" rel="noopener" @click.stop><Icon name="image" :size="14" />Fotos</a>
        </button>
      </div>
    </GroupCard>
    <p v-if="!state.life.length" class="tiny muted" style="text-align:center">Aún no hay momentos. Toca uno de arriba cuando pase algo bonito.</p>
  </div>
</template>

<style scoped>
.quick { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; margin-top: 10px; }
.qbtn { display: flex; align-items: center; gap: 8px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); border-radius: 12px; padding: 7px 10px; font: inherit; font-size: 13px; text-align: left; cursor: pointer; }
.qbtn:hover { border-color: var(--pink-300); }
.gico { width: 28px; height: 28px; border-radius: 9px; display: grid; place-items: center; flex: none; }
.gico.big { width: 38px; height: 38px; border-radius: 12px; }
.pill { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; padding: 5px 10px; border-radius: 999px; background: var(--surface-3); }
.cap { text-transform: capitalize; }
.dot { width: 8px; height: 8px; border-radius: 50%; }
.mom { all: unset; display: flex; gap: 12px; align-items: flex-start; padding: 11px 2px; border-bottom: 1px solid var(--line); cursor: pointer; width: 100%; box-sizing: border-box; }
.mom:last-child { border-bottom: 0; }
.hearts { display: flex; gap: 2px; margin-top: 4px; color: var(--line); }
.hearts .on { color: var(--pink-300); fill: var(--pink-300); }
</style>
