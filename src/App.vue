<script setup>
import { computed, onMounted, watchEffect, defineAsyncComponent } from 'vue'
import { state, ui } from './store'
import { go, back } from './store/actions'
import { NAV, BOTTOM, titleOf } from './config/nav'
import { Icon, Pet } from './components/ui'
import { tick } from './engine/notify'
import { petState, level, toast } from './engine/game'
import Sheets from './components/Sheets.vue'
import Assistant from './components/Assistant.vue'

const views = import.meta.glob('./views/*.vue')
const cache = {}
const comp = (id) => (cache[id] ||= defineAsyncComponent(views[`./views/${id}.vue`] || views['./views/home.vue']))
const View = computed(() => comp(ui.route))

const unread = computed(() => state.notifications.some((n) => !n.read))
const pet = computed(() => petState())
const lvl = computed(() => level())
const title = computed(() => ui.route === 'home' ? state.settings.appName : titleOf(ui.route))

onMounted(() => {
  const fromHash = () => {
    const m = location.hash.match(/^#\/([\w-]+)(?:\/([\w-]+))?/)
    if (m && views[`./views/${m[1]}.vue`] && (m[1] !== ui.route || (m[2] || '') !== (ui.params.id || ''))) { ui.route = m[1]; ui.params = m[2] ? { id: m[2] } : {} }
  }
  fromHash()
  window.addEventListener('hashchange', fromHash)
  const q = new URLSearchParams(location.search)
  const c = q.get('connected')
  if (c) {
    ui.route = 'ajustes'
    history.replaceState(null, '', location.pathname + '#/ajustes')
    setTimeout(() => toast(c === 'google' ? 'Cuenta de Google conectada 💗' : c === 'cancelado' ? 'Cancelaste la conexión con Google' : q.get('msg') || 'No se pudo conectar'), 600)
  }
  setTimeout(tick, 2500)
  setInterval(tick, 60 * 1000)
})

watchEffect(() => {
  const t = state.settings.theme
  if (t === 'auto') document.documentElement.removeAttribute('data-theme')
  else document.documentElement.setAttribute('data-theme', t)
  document.title = ui.route === 'home' ? state.settings.appName : `${titleOf(ui.route)} · ${state.settings.appName}`
})

const fmtLeft = computed(() => {
  const f = ui.focus; if (!f) return ''
  const el = f.elapsed + (f.paused ? 0 : ui.now - f.startedAt)
  const left = Math.max(0, f.minutes * 60000 - el)
  return `${Math.floor(left / 60000)} min`
})
</script>

<template>
  <div class="shell">
    <aside class="side" aria-label="Navegación principal">
      <div class="brand"><Pet :size="34" :bob="false" pose="happy" label="" />{{ state.settings.appName }}</div>
      <div class="card tight soft" style="margin: 0 4px 6px">
        <div class="row between small"><span class="b">Nivel {{ lvl.n }}</span><span>🪙 {{ state.game.coins }}</span></div>
        <div class="bar" style="margin-top:6px"><i :style="{ width: lvl.pct + '%', background: 'var(--pink-500)' }"></i></div>
      </div>
      <template v-for="g in NAV" :key="g.group">
        <div class="side-group">{{ g.group }}</div>
        <button v-for="it in g.items" :key="it.id" class="nav-item" :class="{ on: ui.route === it.id }" @click="go(it.id)" :aria-current="ui.route === it.id ? 'page' : null">
          <Icon :name="it.icon" :size="18" />{{ it.label }}
        </button>
      </template>
    </aside>

    <main class="main" id="contenido">
      <header class="top">
        <button v-if="ui.route === 'home'" class="iconbtn" aria-label="Ver todas las secciones" @click="go('mas')"><Icon name="menu" /></button>
        <button v-else class="iconbtn" aria-label="Volver" @click="back"><Icon name="back" /></button>
        <h1>{{ title }}<span v-if="ui.route === 'home'" aria-hidden="true">{{ '🌸' }}</span></h1>
        <button class="iconbtn" aria-label="Buscar y crear" @click="ui.modal = { type: 'search' }"><Icon name="search" /></button>
        <button class="iconbtn" aria-label="Notificaciones" @click="go('notificaciones')"><Icon name="bell" /><span v-if="unread" class="dot"></span></button>
      </header>

      <div v-if="ui.focus && ui.route !== 'enfoque'" class="card tight pink row" style="margin-bottom:12px" role="status">
        <Pet pose="study" :size="40" :bob="false" />
        <div class="grow"><div class="small b">En enfoque: {{ ui.focus.title }}</div><div class="tiny muted">Quedan {{ fmtLeft }}</div></div>
        <button class="btn sm primary" @click="go('enfoque')">Ver</button>
      </div>

      <Suspense>
        <Transition name="fade" mode="out-in">
          <component :is="View" :key="ui.route + (ui.params.id || '')" />
        </Transition>
      </Suspense>
    </main>

    <nav class="bottom" aria-label="Navegación rápida">
      <button v-for="id in BOTTOM" :key="id" :class="{ on: ui.route === id }" @click="go(id)">
        <Icon :name="{ home: 'home', agenda: 'calendar', habitos: 'heart', universidad: 'cap', mas: 'more' }[id]" :size="21" />
        {{ { home: 'Inicio', agenda: 'Agenda', habitos: 'Hábitos', universidad: 'Universidad', mas: 'Más' }[id] }}
      </button>
    </nav>

    <button class="fab-assist" aria-label="Abrir asistente" @click="ui.assistantOpen = true"><Pet :pose="pet.pose" :size="64" :bob="false" /></button>
    <Assistant />
    <Sheets />

    <div class="toasts" aria-live="polite">
      <div v-for="t in ui.toasts" :key="t.id" class="toast" :class="t.kind">
        <span class="grow">{{ t.text }}</span>
        <button v-if="t.action" class="btn sm lav" @click="go(t.action.go)">{{ t.action.label }}</button>
      </div>
    </div>

    <div v-if="ui.confirm" class="scrim" @click.self="ui.confirm.resolve(false); ui.confirm = null">
      <div class="sheet" role="alertdialog" aria-modal="true" style="text-align:center">
        <div class="grab"></div>
        <Pet pose="think" :size="90" />
        <p style="margin:10px 0 16px">{{ ui.confirm.text }}</p>
        <div class="row" style="justify-content:center;gap:8px">
          <button class="btn ghost" @click="ui.confirm.resolve(false); ui.confirm = null">Cancelar</button>
          <button class="btn primary" @click="ui.confirm.resolve(true); ui.confirm = null">Sí, continuar</button>
        </div>
      </div>
    </div>

    <div v-if="ui.celebrate" class="scrim" @click.self="ui.celebrate = null">
      <div class="sheet" style="text-align:center" role="dialog" aria-modal="true" :aria-label="ui.celebrate.title">
        <div class="grab"></div>
        <Pet :pose="ui.celebrate.pose" :size="150" />
        <h2 style="margin:6px 0">{{ ui.celebrate.title }}</h2>
        <p class="muted">{{ ui.celebrate.text }}</p>
        <div class="row" style="justify-content:center;margin-top:16px;gap:8px">
          <button class="btn lav" @click="ui.celebrate = null; go('casa')">Ir a la casita</button>
          <button class="btn primary" @click="ui.celebrate = null">¡Gracias! 💗</button>
        </div>
      </div>
    </div>
  </div>
</template>
