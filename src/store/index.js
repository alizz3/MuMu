import { reactive, watch } from 'vue'
import { seed, SCHEMA_VERSION } from './seed'

const KEY = 'mumu:data:v1'

function safeGet() { try { return localStorage.getItem(KEY) } catch { return null } }
function safeSet(v) { try { localStorage.setItem(KEY, v) } catch { /* modo privado o vista previa */ } }

function load() {
  const raw = safeGet()
  if (raw) {
    try {
      const data = JSON.parse(raw)
      if (data.v === SCHEMA_VERSION) return { ...seed(), ...data }
    } catch { /* datos dañados: se vuelve a la semilla */ }
  }
  return seed()
}

export const state = reactive(load())

// Estado de interfaz (no se guarda)
export const ui = reactive({
  route: 'home', params: {}, history: [],
  toasts: [], modal: null, assistantOpen: false, drawer: false,
  focus: null, // sesión de enfoque activa
  now: new Date(),
  user: null, // usuario de Firebase cuando hay login
  backend: false, // hay backend /api disponible
  celebrate: null,
  confirm: null,
  synced: false,
  authReady: false, // ya se sabe si hay sesión
  demo: false, // explorando con datos de ejemplo sin sesión
  blocked: false,
  installPrompt: null, installed: false, isIOS: false, // app instalable
  cookieBanner: false,
  focusMsg: '', // mensajito del acompañante de enfoque
  modoU: false, // filtro universitario
  dataUid: null, // de quién son los datos (la cuenta dueña)
  aulaStatus: null, // { online, ms, checkedAt } de Tu Aula // entró una cuenta sin acceso // ya se cargaron los datos de Firestore
})

setInterval(() => { ui.now = new Date() }, 30 * 1000)

// Persistencia local + gancho para sincronización remota (services/sync.js)
const listeners = []
export const onPersist = (fn) => listeners.push(fn)
let timer
watch(state, () => {
  clearTimeout(timer)
  timer = setTimeout(() => {
    const json = JSON.stringify(state)
    safeSet(json)
    listeners.forEach((fn) => fn(state))
  }, 400)
}, { deep: true })

export function replaceState(data) {
  Object.keys(state).forEach((k) => delete state[k])
  Object.assign(state, seed(), data)
}

export function resetToSeed() { replaceState(seed()) }

// Borra todo lo de ejemplo pero conserva estructura, hábitos, objetivos, rutinas y principios
export function startClean() {
  const s = seed()
  const keepIds = (arr) => arr.filter((x) => !x.demo)
  replaceState({
    ...s,
    tasks: [], events: [], emails: [], aula: [], sleep: [], screen: [], intentions: [], focus: [],
    life: [], notes: [], experiments: s.experiments.filter((x) => x.status === 'activo').map((x) => ({ ...x, start: s.profile.lastVisit, logs: {} })),
    habitLogs: Object.fromEntries(s.habits.map((h) => [h.id, {}])),
    god: { entries: {} },
    courses: keepIds(s.courses).map((c) => ({ ...c, sessions: [] })),
    finance: { connected: false, summary: null },
    game: { ...s.game, coins: 50, xp: 0, history: [] },
    settings: { ...state.settings, demo: false },
    integrations: state.integrations,
  })
}

export function exportJSON() { return JSON.stringify(state, null, 2) }
