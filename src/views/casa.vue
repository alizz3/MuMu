<script setup>
import { computed, ref } from 'vue'
import { state } from '../store'
import * as A from '../store/actions'
import { DECOR, scene, SLOT_BOX } from '../engine/decor'
import { petState, level } from '../engine/game'
import { cow } from '../components/art'
import { Icon, Chip, Pet } from '../components/ui'

const cats = ['Decoración', 'Muebles', 'Mascotas', 'Accesorios', 'Fondos', 'Temporadas']
const cat = ref('Decoración')
const pet = computed(() => petState())
const room = computed(() => scene(state.game.placed, { pet: { pose: pet.value.pose === 'sleep' ? 'sleep' : pet.value.pose, leo: pet.value.leo, negra: pet.value.negra }, accessory: state.game.accessory }))
const items = computed(() => DECOR.filter((d) => d.cat === cat.value))
const owned = (d) => state.game.owned.includes(d.id)
const placed = (d) => (d.slot === 'accessory' ? state.game.accessory === d.id : state.game.placed[d.slot] === d.id)
const lvl = computed(() => level())
function tap(d) { if (owned(d)) A.placeDecor(d.id); else A.buyDecor(d.id) }
const thumb = (d) => d.slot === 'accessory' ? `<g transform="translate(14 0) scale(.25)">${cow('happy', d.id)}</g>` : scene({ wall: d.slot === 'wall' ? d.id : 'wall-pink', [d.slot]: d.id, leo: ['leo', 'leoBed'].includes(d.slot) ? 'leo' : null, negra: ['negra', 'negraBed'].includes(d.slot) ? 'negra' : null, leoBed: d.slot === 'leoBed' ? d.id : null, negraBed: d.slot === 'negraBed' ? d.id : null }, { pet: { pose: 'happy' } }).replace(/<g transform="translate\(140 118\)[\s\S]*$/, '')
const box = (d) => (d.slot === 'accessory' ? '0 0 64 42' : SLOT_BOX[d.slot] || '0 0 400 260')
</script>

<template>
  <div class="stack">
    <div class="row between">
      <div><div class="b">La casita de la vaquita 🐮🏡</div><div class="tiny muted">Nivel {{ lvl.n }} · {{ lvl.into }}/{{ lvl.need }} XP</div></div>
      <span class="badge yellow" style="font-size:14px;padding:6px 12px">🪙 {{ state.game.coins }}</span>
    </div>
    <svg class="room" viewBox="0 0 400 260" role="img" :aria-label="`Casita de la vaquita con Leo y Negra. La vaquita está ${pet.pose}.`" v-html="room"></svg>
    <p class="small muted" style="text-align:center">{{ pet.msg }}</p>
    <div class="chips"><Chip v-for="c in cats" :key="c" :active="cat === c" @click="cat = c">{{ c }}</Chip></div>
    <div class="shop">
      <button v-for="d in items" :key="d.id" :class="{ owned: owned(d), placed: placed(d) }" @click="tap(d)" :aria-pressed="placed(d)">
        <svg class="thumb" :viewBox="box(d)" preserveAspectRatio="xMidYMid meet" v-html="thumb(d)" aria-hidden="true"></svg>
        <span style="line-height:1.2">{{ d.name }}</span>
        <span v-if="!owned(d)" class="badge yellow">🪙 {{ d.price }}</span>
        <span v-else class="badge" :class="placed(d) ? 'pink' : ''">{{ placed(d) ? 'Puesto ✓' : 'Poner' }}</span>
      </button>
    </div>
    <div class="card soft">
      <h3>¿Cómo gano monedas? 🪙</h3>
      <p class="small" style="margin-top:6px">Completando tareas, hábitos, sesiones de enfoque, experimentos, misiones y momentos de vida. Nada se compra con dinero real, y nada se pierde si fallas un día 💗</p>
      <div v-for="hh in state.game.history.slice(0, 6)" :key="hh.at" class="row between tiny muted" style="margin-top:6px"><span>{{ hh.reason }}</span><span>+{{ hh.coins }}</span></div>
    </div>
    <div class="card row">
      <Pet kind="leo" :pose="pet.leo" :size="70" /><div class="grow small"><b>Leo</b> representa tu descanso y tu hogar. Cuando descansas, él también 😴</div>
    </div>
    <div class="card row">
      <Pet kind="negra" :pose="pet.negra" :size="70" /><div class="grow small"><b>Negra</b> representa tu familia y la vida cotidiana. Aparece feliz cuando registras momentos con los tuyos 🐶</div>
    </div>
  </div>
</template>
