// Acciones sobre correos (requiere el permiso "organizar Gmail" = gmail.modify; no puede enviar):
// papelera, etiqueta (la crea si no existe), estrella, marcar leído y marcar importante.
import { handler, body, str, HttpError } from '../../_lib/http.js'
import { requireUser } from '../../_lib/firebase.js'
import { accessToken, gget } from '../../_lib/google.js'

const BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'
async function gpost(token, url, payload) {
  const r = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: payload ? JSON.stringify(payload) : undefined })
  if (!r.ok) { const j = await r.json().catch(() => ({})); throw new HttpError(r.status === 403 ? 403 : 502, `Gmail respondió ${r.status}: ${j.error?.message || ''}`) }
  return r.status === 204 ? {} : r.json().catch(() => ({}))
}
async function labelId(token, name) {
  const { labels = [] } = await gget(token, `${BASE}/labels`)
  const found = labels.find((l) => l.name.toLowerCase() === name.toLowerCase())
  if (found) return found.id
  const made = await gpost(token, `${BASE}/labels`, { name, labelListVisibility: 'labelShow', messageListVisibility: 'show', color: { backgroundColor: '#fbc8d9', textColor: '#711a36' } }).catch(() => gpost(token, `${BASE}/labels`, { name, labelListVisibility: 'labelShow', messageListVisibility: 'show' }))
  return made.id
}

export default handler(async (req, res) => {
  const { uid } = await requireUser(req)
  const b = body(req)
  const { token } = await accessToken(uid, str(b.account, 'cuenta', { max: 40 }), 'gmail-organize')
  const ids = (Array.isArray(b.ids) ? b.ids : []).map((x) => String(x).replace(/^gm_/, '')).filter((x) => /^[a-zA-Z0-9]+$/.test(x)).slice(0, 100)
  if (!ids.length) throw new HttpError(400, 'No hay correos seleccionados')
  const action = str(b.action, 'acción', { max: 20 })
  if (action === 'trash') {
    for (const id of ids) await gpost(token, `${BASE}/messages/${id}/trash`)
  } else if (action === 'label') {
    const name = str(b.label, 'etiqueta', { max: 60 }).replace(/[^\p{L}\p{N} /_-]/gu, '')
    const lid = await labelId(token, name)
    await gpost(token, `${BASE}/messages/batchModify`, { ids, addLabelIds: [lid] })
  } else if (action === 'star' || action === 'important') {
    await gpost(token, `${BASE}/messages/batchModify`, { ids, addLabelIds: [action === 'star' ? 'STARRED' : 'IMPORTANT'] })
  } else if (action === 'read') {
    await gpost(token, `${BASE}/messages/batchModify`, { ids, removeLabelIds: ['UNREAD'] })
  } else throw new HttpError(400, 'Acción no válida')
  res.json({ ok: true, count: ids.length })
}, { methods: ['POST'], limit: 30 })
