// Una sola función serverless para toda la API (el plan Hobby de Vercel permite máximo 12).
// vercel.json reescribe /api/<ruta> → /api/router?path=<ruta> y aquí se elige el manejador.
import health from './_routes/health.js'
import me from './_routes/me.js'
import assistant from './_routes/assistant.js'
import googleStart from './_routes/google/start.js'
import googleCallback from './_routes/google/callback.js'
import googleAccounts from './_routes/google/accounts.js'
import gmailInbox from './_routes/gmail/inbox.js'
import gmailAction from './_routes/gmail/action.js'
import calendarEvents from './_routes/calendar/events.js'
import classroomCoursework from './_routes/classroom/coursework.js'
import aulaConnect from './_routes/aula/connect.js'
import aulaSync from './_routes/aula/sync.js'
import aulaStatus from './_routes/aula/status.js'
import cronSync from './_routes/cron/sync.js'
import financeSummary from './_routes/finance/summary.js'

const ROUTES = {
  health, me, assistant,
  'google/start': googleStart, 'google/callback': googleCallback, 'google/accounts': googleAccounts,
  'gmail/inbox': gmailInbox, 'gmail/action': gmailAction, 'calendar/events': calendarEvents, 'classroom/coursework': classroomCoursework,
  'aula/connect': aulaConnect, 'aula/sync': aulaSync, 'aula/status': aulaStatus, 'cron/sync': cronSync, 'cron/aula': cronSync, 'finance/summary': financeSummary,
}

export default async function router(req, res) {
  const raw = req.query?.path ?? new URL(req.url, 'http://x').pathname.replace(/^\/api\//, '')
  const path = (Array.isArray(raw) ? raw.join('/') : String(raw)).replace(/^\/+|\/+$/g, '')
  const fn = ROUTES[path]
  if (!fn) return res.status(404).json({ error: 'Ruta no encontrada' })
  if (req.query) delete req.query.path
  return fn(req, res)
}
