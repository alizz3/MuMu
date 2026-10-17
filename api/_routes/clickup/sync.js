// ClickUp: leer las listas y tareas de un espacio (ej. "Acriz") y marcarlas hechas o pendientes.
// GET                      → { space: { id, name }, lists: [{ id, name, tasks: [...] }] }
// PATCH { id, done }       → cambia el estado de la tarea al "cerrado" (o al primero abierto) de su lista
// El token personal de ClickUp vive solo en Vercel (CLICKUP_TOKEN); el navegador nunca lo ve.
import { handler, body, str, HttpError } from '../../_lib/http.js'
import { requireUser } from '../../_lib/firebase.js'

const API = 'https://api.clickup.com/api/v2'
const ID = /^[\w-]{1,40}$/
const TZ = process.env.APP_TIMEZONE || 'America/Bogota'

function conf() {
  const token = process.env.CLICKUP_TOKEN, space = process.env.CLICKUP_SPACE_ID
  if (!token || !space) throw new HttpError(501, 'ClickUp aún no está conectado')
  return { token, space }
}
async function cu(token, path, { method = 'GET', payload } = {}) {
  const r = await fetch(`${API}${path}`, { method, headers: { Authorization: token, 'Content-Type': 'application/json' }, body: payload ? JSON.stringify(payload) : undefined })
  const j = await r.json().catch(() => ({}))
  if (r.status === 401) throw new HttpError(502, 'ClickUp rechazó el token: revisa CLICKUP_TOKEN en Vercel')
  if (!r.ok) throw new HttpError(502, `ClickUp respondió ${r.status}: ${j.err || 'sin detalle'}`)
  return j
}
// ClickUp da las fechas en milisegundos; MuMu usa "AAAA-MM-DD" en tu zona horaria
const day = (ms) => (ms ? new Date(Number(ms)).toLocaleDateString('en-CA', { timeZone: TZ }) : null)
const isDone = (st) => ['closed', 'done'].includes(st?.type)
const shape = (t, list) => ({
  id: t.id, title: t.name || '', notes: (t.text_content || '').slice(0, 4000), due: day(t.due_date),
  done: isDone(t.status), status: t.status?.status || '', priority: t.priority?.priority || null,
  assignees: (t.assignees || []).map((a) => ({ name: a.username || a.email, email: a.email || null })),
  url: t.url || null, updated: t.date_updated || null, list: list.id, listName: list.name, parent: t.parent || null,
})

export default handler(async (req, res) => {
  await requireUser(req)
  const { token, space } = conf()
  if (req.method === 'GET') {
    const sp = await cu(token, `/space/${encodeURIComponent(space)}`)
    // Listas sueltas del espacio + las que estén dentro de carpetas
    const { lists: loose = [] } = await cu(token, `/space/${encodeURIComponent(space)}/list?archived=false`)
    const { folders = [] } = await cu(token, `/space/${encodeURIComponent(space)}/folder?archived=false`)
    const all = [...loose, ...folders.flatMap((f) => f.lists || [])].slice(0, 40)
    const out = []
    for (const l of all) {
      const tasks = []
      for (let page = 0; page < 5; page++) {
        const p = new URLSearchParams({ include_closed: 'true', subtasks: 'false', page: String(page) })
        const j = await cu(token, `/list/${encodeURIComponent(l.id)}/task?${p}`)
        ;(j.tasks || []).forEach((t) => tasks.push(shape(t, l)))
        if (j.last_page !== false || !(j.tasks || []).length) break
      }
      out.push({ id: l.id, name: l.name, tasks })
    }
    // Para el enlace "abrir en ClickUp" hace falta el workspace (ClickUp lo llama "team")
    const { teams = [] } = await cu(token, '/team').catch(() => ({}))
    const team = teams.length === 1 ? teams[0].id : (teams.find((x) => (x.spaces || []).some((s) => String(s.id) === String(space)))?.id || teams[0]?.id || '')
    return res.json({ space: { id: sp.id, name: sp.name, url: team ? `https://app.clickup.com/${team}/v/s/${sp.id}` : 'https://app.clickup.com' }, lists: out })
  }
  const b = body(req)
  const id = str(b.id, 'tarea', { max: 40 })
  if (!ID.test(id) || typeof b.done !== 'boolean') throw new HttpError(400, 'Datos inválidos')
  const t = await cu(token, `/task/${encodeURIComponent(id)}`)
  if (String(t.space?.id) !== String(space)) throw new HttpError(403, 'Esa tarea no es del espacio conectado')
  const list = await cu(token, `/list/${encodeURIComponent(t.list.id)}`)
  const sts = list.statuses || []
  const target = b.done ? (sts.find((s) => s.type === 'closed') || sts.find((s) => s.type === 'done')) : (sts.find((s) => s.type === 'open') || sts[0])
  if (!target) throw new HttpError(502, 'La lista de ClickUp no tiene un estado para eso')
  const u = await cu(token, `/task/${encodeURIComponent(id)}`, { method: 'PUT', payload: { status: target.status } })
  res.json({ task: shape(u, { id: t.list.id, name: t.list.name }) })
}, { methods: ['GET', 'PATCH'], limit: 30 })
