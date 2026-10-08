// GET: lee eventos (solo lectura) para calcular tu tiempo libre. POST: crea un bloque si diste ese permiso.
import { handler, body, str, HttpError } from '../../_lib/http.js'
import { requireUser } from '../../_lib/firebase.js'
import { accessToken, gget, localParts, TZ } from '../../_lib/google.js'

export default handler(async (req, res) => {
  const { uid } = await requireUser(req)
  if (req.method === 'POST') {
    const b = body(req)
    const { token } = await accessToken(uid, str(b.account, 'cuenta'), 'calendar-write')
    const date = str(b.date, 'fecha', { max: 10 }), start = str(b.start, 'inicio', { max: 5 }), end = str(b.end, 'fin', { max: 5 })
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) throw new HttpError(400, 'Fecha u hora inválidas')
    const r = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary: str(b.title, 'título', { max: 200 }), description: 'Creado desde mi sistema personal 🐮', start: { dateTime: `${date}T${start}:00`, timeZone: TZ }, end: { dateTime: `${date}T${end}:00`, timeZone: TZ } }),
    })
    if (!r.ok) throw new HttpError(502, 'Google Calendar no aceptó el evento')
    return res.json({ ok: true })
  }
  const accountId = String(req.query.account || '')
  const days = Math.min(60, Number(req.query.days) || 21)
  const { token } = await accessToken(uid, accountId, 'calendar')
  // Lista de calendarios de la cuenta (para elegir cuáles lee MuMu)
  if (req.query.list) {
    const { items = [] } = await gget(token, 'https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=100')
    return res.json({ calendars: items.map((c) => ({ id: c.id, name: c.summaryOverride || c.summary, primary: !!c.primary, color: c.backgroundColor })) })
  }
  const ids = String(req.query.calendars || 'primary').split(',').map((x) => x.trim()).filter((x) => /^[\w.@+-]{1,200}$/.test(x)).slice(0, 15)
  const p = new URLSearchParams({ timeMin: new Date(Date.now() - 86400e3).toISOString(), timeMax: new Date(Date.now() + days * 86400e3).toISOString(), singleEvents: 'true', orderBy: 'startTime', maxResults: '250' })
  const events = [], warnings = []
  for (const cal of ids) {
    const j = await gget(token, `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal)}/events?${p}`).catch((e) => { warnings.push(`No pude leer el calendario ${cal === 'primary' ? 'principal' : cal.slice(0, 18) + '…'} (${e.status === 404 ? 'no tienes acceso o no existe' : e.message})`); return { items: [] } })
    for (const e of j.items || []) {
      if (e.status === 'cancelled') continue
      const allDay = !e.start?.dateTime
      const s = allDay ? { day: e.start.date, time: '00:00' } : localParts(new Date(e.start.dateTime))
      const f = allDay ? { day: e.start.date, time: '23:59' } : localParts(new Date(e.end.dateTime))
      events.push({ id: `gc_${e.id}`, calendar: cal, calendarName: j.summary, title: e.summary || '(sin título)', date: s.day, start: s.time, end: f.day === s.day ? f.time : '23:59', allDay, url: e.htmlLink, location: (e.location || '').slice(0, 200), description: String(e.description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 600), type: /clase|class/i.test(e.summary || '') ? 'clase' : allDay ? 'recordatorio' : 'evento' })
    }
  }
  res.json({ events, warnings })
}, { methods: ['GET', 'POST'], limit: 30 })
