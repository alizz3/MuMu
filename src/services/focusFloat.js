// Compañía mientras te enfocas en otra pestaña (Classroom, Tu Aula…), sin saturar:
//  1) Ventanita flotante encima de todo:
//     - Document Picture-in-Picture (Chrome/Edge en computador): mini página con botones.
//     - Si no existe (Android Chrome / app instalada): dibujamos el reloj en un <canvas>, lo pasamos a un <video>
//       con captureStream() y pedimos el Picture-in-Picture de video. Se redibuja cada segundo.
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

const canDocPip = () => typeof window !== 'undefined' && 'documentPictureInPicture' in window
const canVideoPip = () => typeof document !== 'undefined' && !!document.pictureInPictureEnabled && typeof HTMLCanvasElement !== 'undefined' && 'captureStream' in HTMLCanvasElement.prototype
export const canFloat = () => canDocPip() || canVideoPip()
export const isFloating = () => !!pip || !!(vpip && document.pictureInPictureElement === vpip.video)

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
  closeFloat()
}
export function closeFloat() {
  if (pip) { try { pip.close() } catch { /* ya cerrada */ } pip = null }
  closeVideoPip()
}

const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark' || (!document.documentElement.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches)

export async function openFloat() {
  if (!canFloat() || !ui.focus) return false
  if (isFloating()) return true
  if (!canDocPip()) return openVideoPip()
  pip = await window.documentPictureInPicture.requestWindow({ width: 300, height: 190 })
  const dark = isDark()
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
  if (vpip && ui.focus) drawCanvas(ms)
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

// ---------- Plan B: Picture-in-Picture de video (Android Chrome / TWA) ----------
let vpip = null // { canvas, ctx, video, stream, cowImg }
const W = 480, H = 270 // 16:9, se ve nítido en la ventanita

function cowImage() {
  const img = new Image()
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">${cow('study', state.game.accessory)}</svg>`)
  return img
}

function drawCanvas(ms) {
  const f = ui.focus; if (!vpip || !f) return
  const { ctx, cowImg } = vpip
  const dark = isDark()
  const bg = ctx.createLinearGradient(0, 0, W, H)
  if (dark) { bg.addColorStop(0, '#3A2635'); bg.addColorStop(1, '#2B2540') } else { bg.addColorStop(0, '#FDE3EC'); bg.addColorStop(1, '#F4EAFB') }
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)
  // anillo de progreso
  const total = f.minutes * 60000, pct = total ? Math.min(1, Math.max(0, 1 - ms / total)) : 0
  const cx = 128, cy = H / 2, r = 98
  ctx.lineCap = 'round'; ctx.lineWidth = 14
  ctx.strokeStyle = dark ? '#41354A' : '#F3D3DF'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke()
  if (pct > 0) {
    const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r); g.addColorStop(0, '#F7B6C2'); g.addColorStop(1, dark ? '#E98AA6' : '#A84268')
    ctx.strokeStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2); ctx.stroke()
  }
  if (cowImg.complete && cowImg.naturalWidth) ctx.drawImage(cowImg, cx - 72, cy - 72, 144, 144)
  // textos
  const ink = dark ? '#F6EAF0' : '#4A3F4C', pink = dark ? '#FFB3CB' : '#A84268'
  const x = 252
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'
  ctx.fillStyle = pink; ctx.font = '600 16px Poppins, system-ui, sans-serif'
  ctx.fillText(f.paused ? 'EN PAUSA' : ms === 0 ? '¡TIEMPO!' : f.mode === 'empezar' ? 'SOLO EMPEZAR' : 'ENFOCADA', x, 92)
  ctx.fillStyle = ink; ctx.font = '700 66px Poppins, system-ui, sans-serif'
  ctx.fillText(mmss(ms), x - 3, 156)
  ctx.font = '500 18px Poppins, system-ui, sans-serif'
  let title = f.title || 'Sesión de enfoque'
  while (title.length > 3 && ctx.measureText(title).width > W - x - 16) title = title.slice(0, -2)
  if (title !== (f.title || 'Sesión de enfoque')) title = title.trimEnd() + '…'
  ctx.fillText(title, x, 190)
  ctx.fillStyle = dark ? '#A796A8' : '#75667A'; ctx.font = '400 14px Poppins, system-ui, sans-serif'
  ctx.fillText(`${Math.round(pct * 100)}% · ${f.minutes} min`, x, 216)
}

async function openVideoPip() {
  if (!vpip) {
    const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H
    const video = document.createElement('video')
    video.muted = true; video.playsInline = true; video.setAttribute('playsinline', ''); video.autoplay = true
    video.setAttribute('aria-hidden', 'true')
    Object.assign(video.style, { position: 'fixed', left: '0', bottom: '0', width: '2px', height: '2px', opacity: '0', pointerEvents: 'none', zIndex: '-1' })
    document.body.appendChild(video)
    vpip = { canvas, ctx: canvas.getContext('2d'), video, cowImg: cowImage(), stream: null }
    vpip.cowImg.onload = () => drawCanvas(left())
    drawCanvas(left())
    vpip.stream = canvas.captureStream(4)
    video.srcObject = vpip.stream
    video.addEventListener('leavepictureinpicture', () => closeVideoPip())
    // Los botones del sistema (play/pausa) de la ventanita pausan o siguen el enfoque
    try {
      navigator.mediaSession?.setActionHandler?.('pause', () => { if (ui.focus && !ui.focus.paused) togglePause() })
      navigator.mediaSession?.setActionHandler?.('play', () => { if (ui.focus?.paused) togglePause(); vpip?.video.play().catch(() => {}) })
    } catch { /* no soportado */ }
  }
  drawCanvas(left())
  try {
    await vpip.video.play()
    await vpip.video.requestPictureInPicture()
    return true
  } catch (err) {
    closeVideoPip()
    throw err
  }
}

function closeVideoPip() {
  if (!vpip) return
  const v = vpip; vpip = null
  if (document.pictureInPictureElement === v.video) document.exitPictureInPicture().catch(() => {})
  v.stream?.getTracks().forEach((t) => t.stop())
  v.video.srcObject = null; v.video.remove()
}
