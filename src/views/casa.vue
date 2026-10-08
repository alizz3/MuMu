<script setup>
import { computed, ref, onBeforeUnmount } from 'vue'
import { state } from '../store'
import * as A from '../store/actions'
import { DECOR, scene, SLOT_BOX } from '../engine/decor'
import { ROOMS, roomScene, ROOM_SLOT_BOX, petSvg, careOf, careAction, SOUNDS } from '../engine/rooms'
import { petState, level, awardOnce, toast } from '../engine/game'
import { dayKey } from '../engine/time'
import { cow } from '../components/art'
import { Icon, Chip, Pet } from '../components/ui'

// ---------- Cuartos: pestañas arriba, flechas y deslizar de lado ----------
const roomId = ref(state.game.lastRoom || 'dormitorio')
const idx = computed(() => ROOMS.findIndex((r) => r.id === roomId.value))
const cur = computed(() => ROOMS[idx.value])
const unlocked = (r) => r.id === 'dormitorio' || A.roomOf(r.id).unlocked
function goRoom(id) { roomId.value = id; state.game.lastRoom = id; cat.value = firstCat() }
const step = (n) => goRoom(ROOMS[(idx.value + n + ROOMS.length) % ROOMS.length].id)
let x0 = null
const onDown = (e) => { x0 = e.clientX ?? e.touches?.[0]?.clientX }
function onUp(e) {
  const x1 = e.clientX ?? e.changedTouches?.[0]?.clientX
  if (x0 != null && x1 != null && Math.abs(x1 - x0) > 50) step(x1 < x0 ? 1 : -1)
  x0 = null
}

// ---------- Escena ----------
const pet = computed(() => petState())
const care = computed(() => ({ leo: careOf(state.game, 'leo'), negra: careOf(state.game, 'negra'), t: tick.value }))
const tick = ref(0)
const timer = setInterval(() => tick.value++, 60e3)
onBeforeUnmount(() => clearInterval(timer))
const poseOf = (k) => (pet.value[k] === 'sleep' ? 'sleep' : care.value[k].animo >= 70 ? 'happy' : 'sit')
const fx = ref(null)
const bubble = ref(null)
const opts = computed(() => ({ pet: { pose: pet.value.pose, leo: poseOf('leo'), negra: poseOf('negra') }, accessory: state.game.accessory, wear: state.game.wear || {}, fx: fx.value }))
const svg = computed(() => (roomId.value === 'dormitorio' ? scene(state.game.placed, opts.value) : roomScene(roomId.value, A.roomOf(roomId.value).placed, opts.value)))

// ---------- Cuidarlos ----------
const NAMES = { leo: 'Leo', negra: 'Negra' }
const ACTIONS = [['comida', '🍗', 'Comer'], ['baño', '🛁', 'Bañar'], ['juego', '🎾', 'Jugar']]
let fxTimer = null
const wrap = ref(null)
function show(kind, what, text) {
  fx.value = { pet: kind, kind: what }
  bubble.value = { pet: kind, text }
  clearTimeout(fxTimer)
  fxTimer = setTimeout(() => { fx.value = null; bubble.value = null }, 1800)
}
function doCare(kind, what) {
  if (pet.value[kind] === 'sleep' && what !== 'cariño') return toast(`${NAMES[kind]} está dormid${kind === 'leo' ? 'o' : 'a'} 😴 Déjal${kind === 'leo' ? 'o' : 'a'} descansar`)
  // Cada cuidado pasa en su cuarto: comer en la cocina, bañarse en el baño, jugar en el patio
  const where = { comida: 'cocina', baño: 'bano', juego: 'patio' }[what]
  if (where && where !== roomId.value) {
    const r = ROOMS.find((x) => x.id === where)
    if (unlocked(r)) goRoom(where)
    else toast(`Desbloquea ${r.id === 'bano' ? 'el' : 'la'} ${r.name.toLowerCase()} para hacerlo allá ${r.emoji}`)
  }
  wrap.value?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
  careAction(state.game, kind, what)
  const s = SOUNDS[kind]
  show(kind, what, what === 'comida' ? (kind === 'leo' ? '¡Ñam ñam! 🐟' : '¡Ñam! 🦴') : what === 'baño' ? 'Blub blub… ✨' : s[Math.floor(Math.random() * s.length)])
  if (what !== 'cariño') awardOnce(`care:${kind}:${what}:${dayKey()}`, 2, 3, `Cuidaste a ${NAMES[kind]} 💗`)
}
// Tocar a Leo o a Negra en el dibujo = cariñitos
function onSceneClick(e) {
  const g = e.target.closest?.('.petg')
  if (g) doCare(g.dataset.pet, 'cariño')
}
const bubblePos = (k) => (roomId.value === 'dormitorio' ? (k === 'leo' ? 78 : 22) : { cocina: { leo: 80, negra: 18 }, patio: { leo: 80, negra: 14 }, bano: { leo: 14, negra: 80 }, estudio: { leo: 13, negra: 82 } }[roomId.value][k])
const careMsg = (k) => { const c = care.value[k]; const low = Object.entries({ comida: 'tiene hambre', limpio: 'necesita un bañito', juego: 'quiere jugar' }).find(([x]) => c[x] < 35); return low ? `${NAMES[k]} ${low[1]}` : c.animo >= 70 ? `${NAMES[k]} está feliz 💗` : `${NAMES[k]} está tranqui` }

// ---------- Tienda del cuarto ----------
const catsOf = (r) => (r === 'dormitorio' ? ['Decoración', 'Muebles', 'Mascotas', 'Accesorios', 'Fondos', 'Temporadas', 'Ropita'] : ['Muebles', 'Decoración', 'Leo y Negra', 'Fondos', 'Ropita'])
const firstCat = () => catsOf(roomId.value)[0]
const cat = ref(firstCat())
const items = computed(() => DECOR.filter((d) => d.cat === cat.value && (cat.value === 'Ropita' || (d.room || 'dormitorio') === roomId.value)))
const owned = (d) => state.game.owned.includes(d.id)
const placed = (d) => (d.slot === 'accessory' ? state.game.accessory === d.id : d.pet ? state.game.wear?.[d.pet] === d.wear : d.room && d.room !== 'dormitorio' ? A.roomOf(d.room).placed[d.slot] === d.id : state.game.placed[d.slot] === d.id)
function tap(d) { if (owned(d)) A.placeDecor(d.id); else A.buyDecor(d.id) }
const thumb = (d) => {
  if (d.slot === 'accessory') return `<g transform="translate(14 0) scale(.25)">${cow('happy', d.id)}</g>`
  if (d.pet) return petSvg(d.pet, 'sit', d.wear)
  if (d.room && d.room !== 'dormitorio') { const base = DECOR.find((x) => x.room === d.room && x.slot === 'wall' && x.price === 0); return roomScene(d.room, { wall: d.slot === 'wall' ? d.id : base.id, [d.slot]: d.id }, { bare: true }) }
  return scene({ wall: d.slot === 'wall' ? d.id : 'wall-pink', [d.slot]: d.id, leo: ['leo', 'leoBed'].includes(d.slot) ? 'leo' : null, negra: ['negra', 'negraBed'].includes(d.slot) ? 'negra' : null, leoBed: d.slot === 'leoBed' ? d.id : null, negraBed: d.slot === 'negraBed' ? d.id : null }, { pet: { pose: 'happy' } }).replace(/<g transform="translate\(140 118\)[\s\S]*$/, '')
}
const box = (d) => (d.slot === 'accessory' ? '0 0 64 42' : d.pet ? '20 0 160 200' : d.slot === 'wall' ? '0 0 400 260' : (d.room && d.room !== 'dormitorio' ? ROOM_SLOT_BOX[d.slot] : SLOT_BOX[d.slot]) || '0 0 400 260')
const lvl = computed(() => level())
const lockedPreview = computed(() => !unlocked(cur.value))
</script>

<template>
  <div class="stack">
    <div class="row between">
      <div><div class="b">La casita de la vaquita 🐮🏡</div><div class="tiny muted">Nivel {{ lvl.n }} · {{ lvl.into }}/{{ lvl.need }} XP</div></div>
      <span class="badge yellow" style="font-size:14px;padding:6px 12px">🪙 {{ state.game.coins }}</span>
    </div>

    <div class="chips" role="tablist" aria-label="Cuartos">
      <Chip v-for="r in ROOMS" :key="r.id" :active="roomId === r.id" role="tab" :aria-selected="roomId === r.id" @click="goRoom(r.id)">{{ r.emoji }} {{ r.name }}{{ unlocked(r) ? '' : ' 🔒' }}</Chip>
    </div>

    <div ref="wrap" class="room-wrap" @pointerdown="onDown" @pointerup="onUp" @touchstart.passive="onDown" @touchend="onUp">
      <svg class="room" :class="{ locked: lockedPreview }" viewBox="0 0 400 260" role="img" :aria-label="`${cur.name} de la casita con la vaquita, Leo y Negra`" v-html="svg" @click="onSceneClick"></svg>
      <button class="nav l" aria-label="Cuarto anterior" @click.stop="step(-1)"><Icon name="back" :size="18" /></button>
      <button class="nav r" aria-label="Cuarto siguiente" @click.stop="step(1)"><Icon name="chev" :size="18" /></button>
      <div v-if="bubble" class="bubble" :style="{ left: bubblePos(bubble.pet) + '%' }">{{ bubble.text }}</div>
      <div v-if="lockedPreview" class="lock">
        <div class="lock-card">
          <div style="font-size:30px">{{ cur.emoji }}</div>
          <b>{{ cur.name }}</b>
          <span class="small muted">Desbloquéala y decórala a tu gusto</span>
          <button class="btn primary sm" @click.stop="A.unlockRoom(cur.id)">Desbloquear · 🪙 {{ cur.price }}</button>
        </div>
      </div>
    </div>
    <p class="small muted" style="text-align:center">{{ pet.msg }} <span class="tiny">· Toca a Leo o a Negra para darles cariñito</span></p>

    <!-- Cuidar a Leo y Negra -->
    <div class="care-grid">
      <div v-for="k in ['leo', 'negra']" :key="k" class="card tight stack" style="gap:8px">
        <div class="row" style="gap:8px">
          <svg viewBox="20 10 160 190" width="46" height="54" aria-hidden="true" v-html="petSvg(k, poseOf(k), state.game.wear?.[k])"></svg>
          <div class="grow"><b class="small">{{ NAMES[k] }}</b><div class="tiny muted">{{ careMsg(k) }}</div></div>
        </div>
        <div v-for="[key, lab] in [['comida', 'Comida'], ['limpio', 'Limpio'], ['juego', 'Juego']]" :key="key" class="bar-row">
          <span class="tiny">{{ lab }}</span>
          <div class="bar"><i :style="{ width: care[k][key] + '%', background: care[k][key] < 35 ? 'var(--pink-300)' : 'var(--mint)' }"></i></div>
        </div>
        <div class="row" style="gap:6px">
          <button v-for="[w, e, l] in ACTIONS" :key="w" class="btn sm ghost grow" :aria-label="`${l} a ${NAMES[k]}`" @click="doCare(k, w)">{{ e }} <span class="hide-xs">{{ l }}</span></button>
        </div>
      </div>
    </div>

    <!-- Tienda -->
    <div class="chips"><Chip v-for="c in catsOf(roomId)" :key="c" :active="cat === c" @click="cat = c">{{ c === 'Ropita' ? '👕 Ropita' : c }}</Chip></div>
    <p v-if="lockedPreview && cat !== 'Ropita'" class="notice">🔒 Desbloquea la {{ cur.name.toLowerCase() }} para comprar sus cosas.</p>
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
      <p class="small" style="margin-top:6px">Completando tareas, hábitos, sesiones de enfoque, experimentos, misiones y momentos de vida. Cuidar a Leo y a Negra también da un poquito cada día. Nada se compra con dinero real, y nada se pierde si fallas un día 💗</p>
      <div v-for="hh in state.game.history.slice(0, 6)" :key="hh.at" class="row between tiny muted" style="margin-top:6px"><span>{{ hh.reason }}</span><span>+{{ hh.coins }}</span></div>
    </div>
  </div>
</template>

<style scoped>
.room-wrap { position: relative; user-select: none; touch-action: pan-y; }
.room-wrap .room { display: block; width: 100%; }
.room.locked { filter: grayscale(.85) blur(1.5px); opacity: .6; }
.nav { position: absolute; z-index: 2; top: 50%; transform: translateY(-50%); width: 34px; height: 34px; border-radius: 50%; border: 0; background: color-mix(in srgb, var(--surface) 85%, transparent); color: var(--ink); display: grid; place-items: center; cursor: pointer; box-shadow: 0 2px 8px rgba(0, 0, 0, .12); }
.nav.l { left: 8px; } .nav.r { right: 8px; }
.lock { position: absolute; inset: 0; display: grid; place-items: center; }
.lock-card { background: var(--surface); border-radius: 18px; padding: 14px 18px; display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; box-shadow: 0 8px 30px rgba(0, 0, 0, .15); }
.bubble { position: absolute; top: 34%; transform: translate(-50%, -100%); background: var(--surface); color: var(--ink); border-radius: 14px; padding: 6px 10px; font-size: 13px; font-weight: 600; box-shadow: 0 4px 14px rgba(0, 0, 0, .15); white-space: nowrap; animation: pop .25s ease-out; pointer-events: none; }
.care-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px; }
.bar-row { display: grid; grid-template-columns: 56px 1fr; align-items: center; gap: 8px; }
.bar { height: 8px; border-radius: 99px; background: var(--line); overflow: hidden; }
.bar i { display: block; height: 100%; border-radius: 99px; transition: width .4s; }
:deep(.petg) { cursor: pointer; }
:deep(.fx) { animation: floatUp 1.6s ease-out forwards; }
@keyframes floatUp { from { opacity: 0; transform: translateY(20px); } 20% { opacity: 1; } to { opacity: 0; transform: translateY(-40px); } }
@media (max-width: 380px) { .hide-xs { display: none; } }
@media (prefers-reduced-motion: reduce) { :deep(.fx), .bubble { animation: none; } }
</style>
