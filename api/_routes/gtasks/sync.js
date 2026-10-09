// Google Tasks: leer tus listas y tareas, crear tareas y marcarlas hechas.
// GET  ?account=ID            → { lists: [{ id, title, tasks: [...] }] }
// POST { account, list, title, notes?, due? }          → crea una tarea (list "@default" = Mis tareas)
// PATCH { account, list, id, done?, title?, due? }     → actualiza
// DELETE { account, list, id }                         → borra
import { handler, body, str, HttpError } from '../../_lib/http.js'
import { requireUser } from '../../_lib/firebase.js'
import { accessToken, gget } from '../../_lib/google.js'

const API = 'https://tasks.googleapis.com/tasks/v1'
const ID = /^[\w@.-]{1,200}$/
const day = (v) => (v ? String(v).slice(0, 10) : null)
const isoDue = (d) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T00:00:00.000Z` : undefined)

async function send(token, method, url, payload) {
  const r = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new HttpError(r.status === 403 ? 403 : 502, r.status === 403 ? 'Google Tasks no dio permiso. Activa la API de Google Tasks en Google Cloud o reconecta la cuenta con el permiso de Tareas.' : `Google Tasks respondió ${r.status}: ${j.error?.message || 'sin detalle'}`)
  return j
}
const shape = (t) => ({ id: t.id, title: t.title || '', notes: t.notes || '', due: day(t.due), done: t.status === 'completed', completed: t.completed || null, updated: t.updated, url: t.webViewLink || null, parent: t.parent || null })

export default handler(async (req, res) => {
  const { uid } = await requireUser(req)
  if (req.method === 'GET') {
    const accountId = str(String(req.query.account || ''), 'cuenta', { max: 100 })
    const { token } = await accessToken(uid, accountId, 'tasks')
    const { items: lists = [] } = await gget(token, `${API}/users/@me/lists?maxResults=100`)
    const out = []
    // Las completadas de hace más de 30 días no hacen falta
    const since = new Date(Date.now() - 30 * 86400e3).toISOString()
    for (const l of lists.slice(0, 30)) {
      const tasks = []
      let page = ''
      for (let i = 0; i < 5; i++) {
        const p = new URLSearchParams({ showCompleted: 'true', showHidden: 'true', maxResults: '100', updatedMin: since })
        if (page) p.set('pageToken', page)
        const j = await gget(token, `${API}/lists/${encodeURIComponent(l.id)}/tasks?${p}`)
        ;(j.items || []).filter((t) => !t.deleted && t.title).forEach((t) => tasks.push(shape(t)))
        if (!(page = j.nextPageToken)) break
      }
      // Las pendientes viejas (sin cambios en 30 días) también se traen
      const p2 = new URLSearchParams({ showCompleted: 'false', maxResults: '100' })
      const old = await gget(token, `${API}/lists/${encodeURIComponent(l.id)}/tasks?${p2}`)
      ;(old.items || []).filter((t) => t.title && !tasks.some((x) => x.id === t.id)).forEach((t) => tasks.push(shape(t)))
      out.push({ id: l.id, title: l.title, tasks })
    }
    return res.json({ lists: out })
  }
  const b = body(req)
  const { token } = await accessToken(uid, str(b.account, 'cuenta', { max: 100 }), 'tasks')
  const list = str(b.list || '@default', 'lista', { max: 200 })
  if (!ID.test(list)) throw new HttpError(400, 'Lista inválida')
  if (req.method === 'POST') {
    const t = await send(token, 'POST', `${API}/lists/${encodeURIComponent(list)}/tasks`, { title: str(b.title, 'título', { max: 300 }), notes: str(b.notes, 'notas', { max: 4000, required: false }) || undefined, due: isoDue(b.due) })
    return res.json({ task: shape(t), list })
  }
  const id = str(b.id, 'tarea', { max: 200 })
  if (!ID.test(id)) throw new HttpError(400, 'Tarea inválida')
  if (req.method === 'DELETE') {
    const r = await fetch(`${API}/lists/${encodeURIComponent(list)}/tasks/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    if (!r.ok && r.status !== 404 && r.status !== 410) throw new HttpError(502, `Google Tasks respondió ${r.status} al borrar`)
    return res.json({ ok: true })
  }
  const patch = {}
  if (typeof b.done === 'boolean') Object.assign(patch, b.done ? { status: 'completed' } : { status: 'needsAction', completed: null })
  if (b.title) patch.title = str(b.title, 'título', { max: 300 })
  if (typeof b.notes === 'string') patch.notes = str(b.notes, 'notas', { max: 4000, required: false })
  if (b.due !== undefined) patch.due = isoDue(b.due) ?? null
  const t = await send(token, 'PATCH', `${API}/lists/${encodeURIComponent(list)}/tasks/${encodeURIComponent(id)}`, patch)
  res.json({ task: shape(t) })
}, { methods: ['GET', 'POST', 'PATCH', 'DELETE'], limit: 60 })
