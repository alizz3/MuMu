// Compañía mientras te enfocas en otra pestaña (Classroom, Tu Aula…), sin saturar:
//  1) Ventanita flotante encima de todo (Document Picture-in-Picture, Chrome/Edge en computador).
//  2) Cuenta regresiva en el título de la pestaña.
//  3) Mensajitos suaves cada ~8 minutos como notificación del navegador si estás en otra pestaña.
import { ui, state } from '../store'
import { endFocus } from '../store/actions'
import { cow } from '../components/art'

const MSGS = [
  (t) => `Sigues en “${t}”. Lo estás haciendo bien.`,
  () => 'Hombros abajo, respira hondo.',
  (t, m) => `Ya casi: quedan ${m} minutos.`,
  () => 'Si te distrajiste, no pasa nada: vuelve suavecito.',
  () => 'Un sorbito de agua y seguimos.',
]
let pip = null, timer = null, lastMsg = 0, msgIdx = 0, ended = false

export const canFloat = () => typeof window !== 'undefined' && 'documentPictureInPicture' in window

function left() {
  const f = ui.focus; if (!f) return 0
  return Math.max(0, f.minutes * 60000 - (f.elapsed + (f.paused ? 0 : Date.now() - f.startedAt)))
}
const mmss = (ms) => { const s = Math.ceil(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` }

function notify(text) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted' || !document.hidden) return
  try { new Notification('MuMu', { body: text, icon: '/icons/icon-192.png', silent: true, tag: 'mumu-focus' }) } catch { /* móvil sin SW */ }
}

function tick() {
  const f = ui.focus
  if (!f) { stop(); return }
  const ms = left()
  document.title = `${f.paused ? 'En pausa · ' : ''}${mmss(ms)} · ${f.title}`
  const mins = Math.ceil(ms / 60000)
  // un mensajito cada ~8 minutos (no antes de 3 min de empezar)
  if (!f.paused && Date.now() - lastMsg > 8 * 60000 && f.elapsed + (Date.now() - f.startedAt) > 3 * 60000 && ms > 60000) {
    lastMsg = Date.now()
    const text = MSGS[msgIdx++ % MSGS.length](f.title, mins)
    ui.focusMsg = text
    notify(text)
  }
  if (ms === 0 && !ended) { ended = true; ui.focusMsg = '¡Tiempo! Lo lograste. Descansa 5 minutos.'; notify(ui.focusMsg) }
  renderPip(ms)
}

export function startFocusCompanion() {
  if (timer) return
  lastMsg = Date.now(); msgIdx = 0; ended = false
  ui.focusMsg = 'Empezamos. Yo te acompaño desde aquí.'
  timer = setInterval(tick, 1000)
  tick()
}
export function stop() {
  clearInterval(timer); timer = null
  document.title = state.settings.appName
  if (pip) { try { pip.close() } catch { /* ya cerrada */ } pip = null }
}

export async function openFloat() {
  if (!canFloat()) return false
  if (pip) return true
  pip = await window.documentPictureInPicture.requestWindow({ width: 300, height: 190 })
  const dark = document.documentElement.getAttribute('data-theme') === 'dark' || (!document.documentElement.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches)
  pip.document.head.innerHTML = `<title>MuMu · enfoque</title><style>
    body{margin:0;font-family:Poppins,system-ui,sans-serif;background:${dark ? '#2A222E' : '#FFF6F9'};color:${dark ? '#F6EAF0' : '#4A3F4C'};display:flex;gap:10px;align-items:center;padding:12px;box-sizing:border-box;height:100vh}
    .t{font-size:30px;font-weight:700;font-variant-numeric:tabular-nums;line-height:1}.n{font-size:12px;font-weight:600;margin:4px 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:170px}
    .m{font-size:11px;opacity:.85;line-height:1.3}button{font:inherit;font-size:11px;border:0;border-radius:10px;padding:5px 9px;margin:6px 4px 0 0;cursor:pointer;background:${dark ? '#3A3150' : '#EEE6F7'};color:inherit}
    button.p{background:#A84268;color:#fff}</style>`
  pip.document.body.innerHTML = `<svg viewBox="0 0 200 200" width="80" height="80" aria-hidden="true">${cow('study', state.game.accessory)}</svg><div><div class="t" id="t"></div><div class="n" id="n"></div><div class="m" id="m"></div><div><button id="pa"></button><button id="m5">+5</button><button class="p" id="fi">Terminé</button></div></div>`
  pip.document.getElementById('pa').onclick = () => togglePause()
  pip.document.getElementById('m5').onclick = () => { if (ui.focus) ui.focus.minutes += 5 }
  pip.document.getElementById('fi').onclick = () => { endFocus('logrado'); stop() }
  pip.addEventListener('pagehide', () => { pip = null })
  renderPip(left())
  return true
}

function renderPip(ms) {
  if (!pip || !ui.focus) return
  const d = pip.document
  d.getElementById('t').textContent = mmss(ms)
  d.getElementById('n').textContent = ui.focus.title
  d.getElementById('m').textContent = ui.focusMsg || ''
  d.getElementById('pa').textContent = ui.focus.paused ? 'Seguir' : 'Pausa'
}

export function togglePause() {
  const x = ui.focus; if (!x) return
  if (x.paused) { x.startedAt = Date.now(); x.paused = false } else { x.elapsed += Date.now() - x.startedAt; x.paused = true }
  tick()
}
