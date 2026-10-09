<script setup>
import { computed, ref, onMounted, watchEffect, defineAsyncComponent } from 'vue'
import { state, ui } from './store'
import { go, back, setUrl, importProject } from './store/actions'
import { h } from 'vue'
import { NAV, BOTTOM, titleOf } from './config/nav'
import { Icon, Pet } from './components/ui'
import { tick } from './engine/notify'
import { petState, level, toast, ask } from './engine/game'
import Sheets from './components/Sheets.vue'
import Assistant from './components/Assistant.vue'
import Welcome from './components/Welcome.vue'
import { hasFirebase } from './services/firebase'
import { consent, trackView } from './services/analytics'
import { setModoU } from './engine/modoU'
import { startFocusCompanion, stop as stopFocusCompanion, openFloat, canFloat } from './services/focusFloat'
import { watch } from 'vue'

const views = import.meta.glob('./views/*.vue')
const cache = {}
// Si una parte de la app no carga (por ejemplo justo después de publicar una versión nueva), se reintenta y,
// si sigue fallando, se recarga una sola vez sola en vez de dejar la pantalla en blanco.
const ViewLoading = { render: () => h('div', { class: 'stack', style: 'align-items:center;padding:60px 0;opacity:.7', 'aria-busy': 'true' }, [h('div', { class: 'spin', 'aria-hidden': 'true' }), h('span', { class: 'small muted' }, 'Cargando…')]) }
const ViewError = { render: () => h('div', { class: 'card stack', style: 'align-items:center;text-align:center;margin-top:30px' }, [h('b', 'Esta parte no cargó'), h('span', { class: 'small muted' }, 'Puede que haya una versión nueva de MuMu.'), h('button', { class: 'btn primary', onClick: () => location.reload() }, 'Recargar')]) }
const isChunkError = (e) => /dynamically imported module|Importing a module script failed|Failed to fetch|Loading chunk|error loading/i.test(String(e?.message || e))
const comp = (id) => (cache[id] ||= defineAsyncComponent({
  loader: views[`./views/${id}.vue`] || views['./views/home.vue'],
  loadingComponent: ViewLoading, delay: 150, errorComponent: ViewError, timeout: 20000,
  onError(err, retry, fail, attempts) {
    if (attempts <= 2) return setTimeout(retry, 400 * attempts)
    if (isChunkError(err) && !sessionStorage.getItem('mumu-reloaded')) { try { sessionStorage.setItem('mumu-reloaded', '1') } catch {} ; location.reload(); return }
    delete cache[id]; fail()
  },
}))
// Se precargan todas las vistas cuando el navegador está libre, así cambiar de sección es inmediato
const idle = (f) => (window.requestIdleCallback ? requestIdleCallback(f, { timeout: 3000 }) : setTimeout(f, 300))
let prefetched = false
const prefetch = () => { if (prefetched) return; prefetched = true; const list = Object.values(views); const next = () => { const l = list.shift(); if (l) l().catch(() => {}).finally(() => idle(next)) }; setTimeout(() => idle(next), 4000) }
const View = computed(() => comp(ui.route))

const unread = computed(() => state.notifications.some((n) => !n.read))
const pet = computed(() => petState())
const lvl = computed(() => level())
const title = computed(() => ui.route === 'home' ? state.settings.appName : titleOf(ui.route))

onMounted(() => {
  const fromUrl = () => {
    // Las direcciones viejas con # (…/#/ajustes) siguen funcionando
    const m = (location.hash.match(/^#\/([\w-]+)(?:\/([\w-]+))?/) || location.pathname.match(/^\/([\w-]+)(?:\/([\w-]+))?\/?$/))
    const r = m && views[`./views/${m[1]}.vue`] ? m[1] : 'home'
    const id = m && r !== 'home' ? m[2] || '' : ''
    if (r !== ui.route || id !== (ui.params.id || '')) { ui.route = r; ui.params = id ? { id } : {} }
  }
  fromUrl()
  if (location.hash.startsWith('#/')) setUrl(false)
  window.addEventListener('popstate', () => { fromUrl(); ui.drawer = false })
  window.addEventListener('hashchange', () => { fromUrl(); setUrl(false) })
  setTimeout(() => { try { sessionStorage.removeItem('mumu-reloaded') } catch {} }, 15000)
  const q = new URLSearchParams(location.search)
  const c = q.get('connected')
  if (c) {
    ui.route = 'ajustes'
    history.replaceState(null, '', '/ajustes')
    setTimeout(() => toast(c === 'google' ? 'Cuenta de Google conectada' : c === 'parcial' ? q.get('msg') : c === 'cancelado' ? 'Cancelaste la conexión con Google' : q.get('msg') || 'No se pudo conectar'), 600)
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

// Botón de modo claro / oscuro (recuerda tu elección; "Automático" sigue al celular)
const sysDark = ref(window.matchMedia?.('(prefers-color-scheme: dark)').matches)
window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', (e) => { sysDark.value = e.matches })
const isDark = computed(() => state.settings.theme === 'dark' || (state.settings.theme === 'auto' && sysDark.value))
const toggleTheme = () => { state.settings.theme = isDark.value ? 'light' : 'dark' }
// Sin sesión se ve la bienvenida (o la demo si la eligen). Sin Firebase configurado, la app abre directo.
const slow = ref(false)
setTimeout(() => { slow.value = true }, 5000)
const reload = () => location.reload()
const gate = computed(() => (!hasFirebase() ? 'app' : !ui.authReady ? 'splash' : ui.blocked ? 'welcome' : ui.user || ui.demo ? 'app' : 'welcome'))
watch(() => ui.route, (r) => trackView(r))
// Aviso de "sin internet" (la app sigue funcionando con lo guardado en el equipo)
const online = ref(navigator.onLine)
window.addEventListener('offline', () => { online.value = false })
window.addEventListener('online', () => { online.value = true; toast('Volvió el internet: subiendo lo que hiciste') })
// …/proyectos#importar=<datos>: espera a que carguen tus datos y pregunta antes de agregar el proyecto
const pendingImport = (location.hash.match(/^#importar=([\w-]+)/) || [])[1]
if (pendingImport) {
  let done = false
  watch(() => gate.value === 'app' && (ui.synced || !ui.backend || ui.demo), async (ready) => {
    if (!ready || done) return
    done = true
    history.replaceState(null, '', location.pathname)
    try {
      const data = JSON.parse(decodeURIComponent(escape(atob(pendingImport.replace(/-/g, '+').replace(/_/g, '/')))))
      const parts = [data.project?.name && `el proyecto "${data.project.name}"`, data.habits?.length && `${data.habits.length} hábito${data.habits.length === 1 ? '' : 's'}`, data.tasks?.length && `${data.tasks.length} tarea${data.tasks.length === 1 ? '' : 's'}`].filter(Boolean)
      if (!(await ask(`¿Agregar ${parts.join(', ')}?`))) return
      const p = importProject(data)
      if (p) { go('proyectos', { id: p.id }); toast(`Proyecto ${p.name} agregado`) }
      else { go(data.habits?.length ? 'habitos' : 'tareas'); toast('Listo, agregado') }
    } catch (e) { toast('Ese enlace de proyecto no se pudo leer') }
  }, { immediate: true })
}
// Solo se precarga cuando ya estás dentro (los visitantes de la bienvenida no lo necesitan)
watch(gate, (g) => { if (g === 'app') prefetch() }, { immediate: true })
// El acompañante de enfoque vive aquí para seguir aunque cambies de sección
watch(() => !!ui.focus, (on) => (on ? startFocusCompanion() : stopFocusCompanion()))
const fmtLeft = computed(() => {
  const f = ui.focus; if (!f) return ''
  const el = f.elapsed + (f.paused ? 0 : ui.now - f.startedAt)
  const left = Math.max(0, f.minutes * 60000 - el)
  return `${Math.floor(left / 60000)} min`
})
</script>

<template>
  <div v-if="gate === 'splash'" style="min-height:100dvh;display:grid;place-items:center" aria-busy="true">
    <div class="stack" style="align-items:center;gap:10px"><Pet pose="happy" :size="120" />
      <template v-if="slow"><span class="small muted">Está tardando un poquito…</span><button class="btn sm ghost" @click="reload">Reintentar</button></template>
    </div>
  </div>
  <Welcome v-else-if="gate === 'welcome'" />
  <div v-else class="shell">
    <aside class="side" aria-label="Navegación principal">
      <div class="brand"><Pet :size="34" :bob="false" pose="happy" label="" />{{ state.settings.appName }}</div>
      <div class="card tight soft" style="margin: 0 4px 6px">
        <div class="row between small"><span class="b">Nivel {{ lvl.n }}</span><span class="wi"><Icon name="coin" :size="14" />{{ state.game.coins }}</span></div>
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
      <div v-if="!online" class="offline-bar" role="status"><Icon name="bolt" :size="14" /> Sin internet · todo lo que hagas se guarda aquí y se sube solito cuando vuelva la señal</div>
      <header class="top">
        <button v-if="ui.route === 'home'" class="iconbtn" aria-label="Ver todas las secciones" @click="go('mas')"><Icon name="menu" /></button>
        <button v-else class="iconbtn" aria-label="Volver" @click="back"><Icon name="back" /></button>
        <span v-if="ui.demo" class="badge demo" style="position:absolute;left:50%;top:calc(100% - 4px);transform:translateX(-50%)">demo · <button class="link" style="padding:0;font-size:11px" @click="ui.demo = false">salir</button></span>
        <h1>{{ title }}</h1>
        <button class="iconbtn" :class="{ 'is-on': ui.modoU }" :aria-pressed="ui.modoU" :aria-label="ui.modoU ? 'Salir del Modo U' : 'Activar Modo U (solo universidad)'" :title="ui.modoU ? 'Modo U activo' : 'Modo U'" @click="setModoU(!ui.modoU)"><Icon name="cap" /></button>
        <button class="iconbtn" :aria-label="isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'" @click="toggleTheme"><Icon :name="isDark ? 'sun' : 'moon'" /></button>
        <button class="iconbtn" aria-label="Buscar y crear" @click="ui.modal = { type: 'search' }"><Icon name="search" /></button>
        <button class="iconbtn" aria-label="Notificaciones" @click="go('notificaciones')"><Icon name="bell" /><span v-if="unread" class="dot"></span></button>
      </header>
      <h2 class="sr">{{ title }}</h2>

      <div v-if="ui.modoU" class="card tight row" style="margin-bottom:12px;background:var(--lav-100);border-color:transparent" role="status">
        <Icon name="cap" :size="18" /><div class="grow small"><b>Modo U</b> · solo ves lo de la universidad</div>
        <button class="btn sm ghost" @click="setModoU(false)">Ver todo</button>
      </div>
      <div v-if="ui.focus && ui.route !== 'enfoque'" class="card tight pink row" style="margin-bottom:12px" role="status">
        <Pet pose="study" :size="40" :bob="false" />
        <div class="grow"><div class="small b">En enfoque: {{ ui.focus.title }}</div><div class="tiny muted">Quedan {{ fmtLeft }} · {{ ui.focusMsg }}</div></div>
        <button v-if="canFloat()" class="btn sm lav" @click="openFloat">Flotante</button>
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
        <Icon v-if="t.kind === 'coin'" name="coin" :size="16" /><span class="grow">{{ t.text }}</span>
        <button v-if="t.action" class="btn sm lav" @click="t.action.fn ? t.action.fn() : go(t.action.go)">{{ t.action.label }}</button>
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
          <button class="btn primary" @click="ui.celebrate = null">¡Gracias!</button>
        </div>
      </div>
    </div>
  </div>
  <div v-if="ui.cookieBanner" class="card" role="dialog" aria-label="Cookies" style="position:fixed;z-index:90;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));max-width:520px;margin:0 auto;box-shadow:var(--shadow-lg)">
    <p class="small"><Icon name="cookie" :size="14" class="inl" /> MuMu usa cookies de analítica (Google Analytics) solo si las aceptas, para saber cuánta gente visita la página. Tus datos personales no se comparten. <a href="/privacidad.html">Privacidad</a></p>
    <div class="row" style="justify-content:flex-end;gap:8px;margin-top:10px"><button class="btn sm ghost" @click="consent(false)">Rechazar</button><button class="btn sm primary" @click="consent(true)">Aceptar</button></div>
  </div>
</template>
