// Sincronización con Firestore: users/{uid}/data/{coleccion} = { items, updatedAt }.
// Una colección por documento mantiene pocas escrituras y cabe de sobra para uso personal.
import { state, ui, onPersist, resetToSeed } from '../store'
import { getFirebase, idToken } from './firebase'
import { UNI_STEPS } from './device'
import { markVisit, applyAcademicChanges, dropSena, cleanTitles, linkHabitTasks, fixSubjects, fixUniRoutine, ensureAulaTasks, dedupeTasks } from '../store/actions'
import { syncGmail, syncAula, syncClassroom, syncGTasks, pushNewGTasks, gtAccounts } from './api'
import { watch } from 'vue'
import { initModoU } from '../engine/modoU'
import { toast } from '../engine/game'

const last = {}
let uid = null, ready = false, holdWrites = false
let unsubs = []

// Nada debe dejar la vaquita de carga pegada: todo lo de red tiene tiempo límite
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))])
export async function initSync() {
  markVisit()
  // Plan B: si en 8 s no se resolvió el inicio de sesión, se muestra la app con lo guardado en el equipo
  setTimeout(() => {
    if (ui.authReady) return
    try { const u = JSON.parse(localStorage.getItem('mumu:lastUser') || 'null'); if (u && !ui.user) ui.user = u } catch {}
    ui.authReady = true
    console.warn('sync: inicio lento, se abre con datos locales')
  }, 8000)
  if (location.protocol.startsWith('http')) fetch('/api/health').then((r) => r.ok && r.json()).then((j) => { ui.backend = !!j?.ok }).catch(() => { ui.backend = false })
  let fb = null
  try { fb = await withTimeout(getFirebase(), 10000) } catch (e) { console.warn('firebase', e.message) }
  if (!fb) { ui.authReady = true; return }
  const { doc, getDoc, setDoc } = fb.fs
  fb.authMod.onAuthStateChanged(fb.auth, async (user) => {
    ui.user = user ? { uid: user.uid, email: user.email, name: user.displayName, photo: user.photoURL } : null
    try { if (ui.user) localStorage.setItem('mumu:lastUser', JSON.stringify(ui.user)); else localStorage.removeItem('mumu:lastUser') } catch {}
    // Al cerrar sesión se borra la copia local para que nadie más vea tus datos en este equipo
    if (!user && uid) { ready = false; unsubs.forEach((u) => u()); unsubs = []; resetToSeed() }
    uid = user?.uid || null
    ready = false
    ui.synced = false
    if (!uid) { ui.authReady = true; return }
    // Solo la dueña: si el servidor dice que esta cuenta no tiene acceso, se muestra la pantalla de "casita de Alizz"
    // ¿De quién son los datos? La cuenta de la U usa los de tu Gmail: eso lo confirma el servidor.
    // Si no responde, se reintenta; si no hay forma de saberlo, NO se abre una MuMu vacía (pasó el 16 oct:
    // entraste con la de la U, el servidor tardó y se cargaron datos de ejemplo en otro espacio).
    const dkey = `mumu:dataUid:${user.uid}`, ekey = `mumu:dataUidEmail:${String(user.email).toLowerCase()}`
    const known = () => { try { return localStorage.getItem(dkey) || localStorage.getItem(ekey) } catch { return null } }
    ui.authError = null
    if (location.protocol.startsWith('http')) {
      let resolved = null
      for (let i = 0; i < 4 && !resolved; i++) {
        try {
          const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 10000)
          const r = await fetch('/api/me', { signal: ctrl.signal, headers: { Authorization: `Bearer ${await withTimeout(idToken(), 8000)}` } }).finally(() => clearTimeout(t))
          if (r.status === 403) { ui.blocked = true; ui.authReady = true; uid = null; return }
          const j = await r.json().catch(() => ({}))
          if (r.ok && j.dataUid) resolved = j.dataUid
        } catch { /* se reintenta */ }
        if (!resolved && !navigator.onLine) break
        if (!resolved && i < 3) await new Promise((ok) => setTimeout(ok, 1500 * (i + 1)))
      }
      resolved ||= known()
      if (!resolved) {
        uid = null; ui.authReady = true
        ui.authError = navigator.onLine ? 'No pude confirmar tu cuenta con el servidor. Para no mostrarte una MuMu vacía, espero a que respondas "Reintentar".' : 'Sin internet no puedo confirmar tu cuenta todavía. Conéctate y toca "Reintentar".'
        return
      }
      uid = resolved
      try { localStorage.setItem(dkey, uid); localStorage.setItem(ekey, uid) } catch {}
    }
    ui.blocked = false
    ui.demo = false
    ui.dataUid = uid
    initModoU(user.email)
    ui.authReady = true
    const keys = Object.keys(state)
    let snaps
    try { snaps = await Promise.all(keys.map((k) => getDoc(doc(fb.db, 'users', uid, 'data', k)))) } catch (e) {
      toast('No pude leer tus datos: revisa que las reglas de Firestore estén publicadas (firestore.rules).')
      console.warn('sync', e.message); ui.synced = true; return
    }
    const anyRemote = snaps.some((s) => s.exists())
    const hkey = `mumu:hadData:${uid}`
    let hadData = false; try { hadData = localStorage.getItem(hkey) === '1' } catch {}
    if (anyRemote) { try { localStorage.setItem(hkey, '1') } catch {} }
    else if (hadData) {
      // Antes había datos y ahora llegan vacíos: algo raro (caché, cuenta equivocada). No se sube nada.
      holdWrites = true; ready = true; ui.synced = true
      ui.authError = 'No encontré tus datos en este momento. No toqué nada: toca "Reintentar" en un ratico.'
      return
    }
    if (anyRemote) {
      snaps.forEach((s, i) => { if (s.exists()) { state[keys[i]] = s.data().items; last[keys[i]] = JSON.stringify(s.data().items) } })
    }
    // Si lo que se leyó es la copia guardada en el equipo (no la del servidor) y sí hay internet,
    // NO se sube nada ni se corren arreglos/sincronizaciones hasta que llegue lo del servidor:
    // así un celular con datos viejos no pisa lo que hiciste en otro lado (pasó con el curso del SENA).
    const stale = navigator.onLine && snaps.some((x) => x.metadata?.fromCache)
    holdWrites = stale
    ready = true
    ui.synced = true
    let started = false
    const start = () => {
      if (started) return
      started = true; holdWrites = false
      markVisit()
      dropSena()
      cleanTitles()
      fixSubjects()
      fixUniRoutine(UNI_STEPS)
      linkHabitTasks()
      processInbox()
      { const n = dedupeTasks(); if (n) toast(`Quité ${n} tarea${n === 1 ? '' : 's'} repetida${n === 1 ? '' : 's'}`) }
      ensureAulaTasks()
      autoSync()
      push(fb, doc, setDoc)
    }
    listen(fb, uid, stale ? start : null)
    if (!stale) start()
    else setTimeout(() => { if (!started) start() }, navigator.onLine ? 45000 : 1000)
  })
  onPersist(() => { if (ready && uid) push(fb, doc, setDoc) })
}

// En vivo: si cambias algo en otra pestaña o en el celular, esta pestaña se actualiza sola.
// Así una pestaña vieja no vuelve a subir tareas que ya borraste.
function listen(fb, id, onFresh = null) {
  unsubs.forEach((u) => u()); unsubs = []
  const { doc, onSnapshot } = fb.fs
  const keys = Object.keys(state), fresh = new Set()
  for (const k of keys) {
    unsubs.push(onSnapshot(doc(fb.db, 'users', id, 'data', k), (s) => {
      // Cuando ya llegó lo del servidor para todas las colecciones, se sigue normal
      if (onFresh && !s.metadata.fromCache) { fresh.add(k); if (fresh.size === keys.length) { onFresh(); onFresh = null } }
      if (!s.exists() || s.metadata.hasPendingWrites) return
      const json = JSON.stringify(s.data().items)
      if (json === last[k]) return
      last[k] = json
      state[k] = JSON.parse(json)
    }, () => { /* sin conexión: se reintenta solo */ }))
  }
}

async function push(fb, doc, setDoc) {
  if (holdWrites) return // esperando lo del servidor
  // Sin await: sin internet la escritura queda guardada en el equipo y Firebase la sube sola al volver
  for (const k of Object.keys(state)) {
    const json = JSON.stringify(state[k])
    if (last[k] === json) continue
    last[k] = json
    setDoc(doc(fb.db, 'users', uid, 'data', k), { items: JSON.parse(json), updatedAt: Date.now() }).catch((e) => console.warn('sync', k, e.message))
  }
}

// Lo que el cron dejó en el buzón (actividades nuevas o cambiadas de Tu Aula) se aplica al abrir la app
function processInbox() {
  const box = state.inbox || []
  if (!box.length) return
  let created = 0, updated = 0
  for (const entry of box) { const r = applyAcademicChanges(entry.items || [], entry.source || 'aula'); created += r.created; updated += r.updated }
  state.inbox = []
  if (created || updated) toast(`Universidad: ${created} nuevas, ${updated} con cambios`)
}

// Si Tu Aula está conectada y no se revisa hace más de 3 horas, se revisa al abrir
function autoSync() {
  if (!ui.backend || !navigator.onLine) return
  const old = (iso) => !iso || Date.now() - new Date(iso).getTime() > 3 * 3600e3
  const a = state.integrations.aula
  if (a?.status === 'conectado' && old(a.lastSync)) syncAula().catch(() => {})
  const cr = state.integrations.classroom
  if (state.integrations.google.some((g) => g.services.includes('classroom')) && old(cr?.lastSync)) syncClassroom().catch(() => {})
  startGTasks()
  // Correo: se revisa al abrir y cada 20 minutos (te aviso si escribe un profe o alguien que vigilas)
  const mail = () => { if (navigator.onLine && state.integrations.google.some((g) => g.services.includes('gmail')) && old2(state.integrations.gmailLast)) syncGmail({ quiet: true }).catch(() => {}) }
  const old2 = (iso) => !iso || Date.now() - new Date(iso).getTime() > 15 * 60e3
  setTimeout(mail, 5000); setInterval(mail, 20 * 60e3)
}
// Google Tasks: se revisa al abrir y cada 20 minutos con la app abierta; lo que hagas en MuMu se manda a los pocos segundos
let gtStarted = false
function startGTasks() {
  if (gtStarted) return
  gtStarted = true
  // Con varias pestañas abiertas, solo una habla con Google Tasks (evita tareas repetidas)
  if (navigator.locks?.request) { navigator.locks.request('mumu-gtasks', () => new Promise(() => runGTasks())).catch(() => {}); return }
  runGTasks()
}
function runGTasks() {
  const run = () => { if (navigator.onLine && gtAccounts().length) syncGTasks({ quiet: true }).catch(() => {}) }
  setTimeout(run, 3000)
  setInterval(run, 20 * 60e3)
  document.addEventListener('visibilitychange', () => { const l = state.integrations.gtasksLast; if (document.visibilityState === 'visible' && (!l || Date.now() - new Date(l).getTime() > 5 * 60e3)) run() })
  let timer = null
  watch(() => state.tasks.map((t) => `${t.id}:${t.status}:${t.gtask ? 1 : 0}:${t.projectId || ''}:${t.title}:${t.due}:${(t.notes || '').length}`).join('|'), () => {
    clearTimeout(timer)
    timer = setTimeout(() => { if (gtAccounts().length) pushNewGTasks().catch(() => {}) }, 4000)
  })
}
