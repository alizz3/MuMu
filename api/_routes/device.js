// La app de Android habla con MuMu sin abrirla: lee el plan de alarmas/recordatorios y el widget,
// y sube el tiempo de pantalla. Se enlaza una sola vez con un token aleatorio que solo vive en tu celular;
// aquí se guarda únicamente su huella (sha256) en /secrets, que el navegador nunca puede leer.
import { createHash, randomBytes } from 'node:crypto'
import { handler, body, HttpError } from '../_lib/http.js'
import { requireUser, initDb } from '../_lib/firebase.js'
import { accountsRef, accessToken, gget } from '../_lib/google.js'

const sha = (t) => createHash('sha256').update(t).digest('hex')
const tokens = (db) => db.collection('secrets').doc('_devices').collection('t')

async function deviceUid(req) {
  const t = String(req.headers['x-mumu-device'] || '')
  if (!/^[\w-]{40,64}$/.test(t)) throw new HttpError(401, 'Celular sin enlazar')
  const db = await initDb()
  const snap = await tokens(db).doc(sha(t)).get()
  if (!snap.exists) throw new HttpError(401, 'Este celular ya no está enlazado')
  return { db, uid: snap.data().uid }
}

// POST /api/device/link (con tu sesión) → token nuevo para el celular
export const link = handler(async (req, res) => {
  const u = await requireUser(req)
  const db = await initDb()
  const t = randomBytes(32).toString('base64url')
  await tokens(db).doc(sha(t)).set({ uid: u.uid, createdAt: Date.now() })
  res.json({ token: t })
}, { methods: ['POST'], limit: 10 })

// Correos recientes de tus profes o de remitentes que vigilas → avisos para el celular
async function mailAlerts(db, uid) {
  const data = db.collection('users').doc(uid).collection('data')
  const [subj, sett] = await Promise.all([data.doc('subjects').get(), data.doc('settings').get()])
  const senders = new Set()
  for (const s of subj.exists ? subj.data().items || [] : []) for (const em of String(s.teacherEmail || '').toLowerCase().split(/[,;\s]+/)) if (em.includes('@')) senders.add(em)
  for (const em of (sett.exists ? sett.data().items?.mailWatch : []) || []) if (String(em).includes('@')) senders.add(String(em).toLowerCase())
  if (!senders.size) return []
  const q = encodeURIComponent(`newer_than:2d in:inbox from:(${[...senders].slice(0, 30).join(' OR ')})`)
  const out = []
  const accs = await accountsRef(uid).get()
  for (const doc of accs.docs) {
    if (!(doc.data().services || []).includes('gmail')) continue
    try {
      const { token } = await accessToken(uid, doc.id, 'gmail')
      const base = 'https://gmail.googleapis.com/gmail/v1/users/me'
      const list = await gget(token, `${base}/messages?maxResults=10&q=${q}`)
      const msgs = await Promise.all((list.messages || []).map((m) => gget(token, `${base}/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`)))
      for (const m of msgs) {
        const h = Object.fromEntries((m.payload?.headers || []).map((x) => [x.name.toLowerCase(), x.value]))
        const from = (h.from || '').replace(/<.*>/, '').replace(/"/g, '').trim() || h.from || ''
        out.push({ id: `gm_${m.id}`, at: Number(m.internalDate), title: `Correo de ${from}`, text: h.subject || '(sin asunto)', open: 'ir=correo' })
      }
    } catch { /* esa cuenta no respondió: se intenta en la próxima */ }
  }
  return out.sort((a, b) => b.at - a.at).slice(0, 15)
}

// GET /api/device/plan → { plan, widget, home, at, alerts }
export const plan = handler(async (req, res) => {
  const { db, uid } = await deviceUid(req)
  const snap = await db.collection('users').doc(uid).collection('data').doc('device').get()
  const out = snap.exists ? (snap.data().items || {}) : {}
  try { out.alerts = await mailAlerts(db, uid) } catch { out.alerts = [] }
  res.json(out)
}, { methods: ['GET'], limit: 30 })

// POST /api/device/uso { d: { "2026-10-09": { t, a: { paquete: min } } }, l: { paquete: nombre } }
// Se deja en el buzón y la app lo pasa a "Celular y redes" al abrir (mismo formato que #uso=).
export const uso = handler(async (req, res) => {
  const { db, uid } = await deviceUid(req)
  const b = body(req)
  if (!b || typeof b.d !== 'object') throw new HttpError(400, 'Datos inválidos')
  const json = JSON.stringify({ v: 1, permiso: true, d: b.d, l: b.l || {} })
  if (json.length > 200_000) throw new HttpError(413, 'Demasiados datos')
  await db.collection('users').doc(uid).collection('data').doc('usoCelular').set({ items: { at: Date.now(), json } })
  res.json({ ok: true })
}, { methods: ['POST'], limit: 20 })

// POST /api/device/casa { home: true|false } → la app de Android avisa si llegaste o saliste de tu casa
export const casa = handler(async (req, res) => {
  const { db, uid } = await deviceUid(req)
  const b = body(req)
  if (typeof b?.home !== 'boolean') throw new HttpError(400, 'Datos inválidos')
  await db.collection('users').doc(uid).collection('data').doc('presence').set({ items: { home: b.home, at: Date.now(), via: 'celular' }, updatedAt: Date.now() })
  res.json({ ok: true })
}, { methods: ['POST'], limit: 30 })
