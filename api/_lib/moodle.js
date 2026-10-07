// Integración con Tu Aula (Moodle) por dos vías reales y documentadas por Moodle:
//  1) Servicio web móvil (login/token.php + webservice/rest/server.php): el mismo que usa la app oficial.
//     Solo funciona si la universidad lo tiene habilitado y si inicias sesión con usuario/contraseña de Moodle
//     (no con "Entrar con Google"/SSO).
//  2) Exportación de calendario iCal (calendar/export_execute.php con authtoken): no requiere contraseña.
// No hay scraping de HTML: si ninguna vía está disponible, la app lo dice claramente.
import { HttpError } from './http.js'
import { hash } from './crypto.js'
import { localParts } from './google.js'

const UA = 'MuMu/1.0 (+uso personal)'

export async function getToken(site, username, password) {
  const r = await fetch(`${site}/login/token.php`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
    body: new URLSearchParams({ username, password, service: 'moodle_mobile_app' }),
  })
  const text = await r.text()
  let j
  try { j = JSON.parse(text) } catch { throw new HttpError(502, 'Tu Aula no respondió como Moodle. Revisa la dirección (debe ser la página principal de Tu Aula).') }
  if (j.token) return j.token
  const code = j.errorcode || ''
  if (/enablewsdescription|servicenotavailable|webservicesnotenabled/i.test(code + j.error)) throw new HttpError(409, 'Tu Aula no tiene habilitado el servicio para apps. Usa el método “Enlace de calendario”.')
  if (/invalidlogin/i.test(code)) throw new HttpError(401, 'Usuario o contraseña incorrectos. Si entras a Tu Aula con Google, usa el método “Enlace de calendario”.')
  throw new HttpError(400, `Moodle respondió: ${j.error || 'error desconocido'}`)
}

async function ws(site, token, fn, params = {}) {
  const p = new URLSearchParams({ wstoken: token, moodlewsrestformat: 'json', wsfunction: fn })
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) v.forEach((x, i) => p.append(`${k}[${i}]`, x))
    else p.append(k, v)
  }
  const r = await fetch(`${site}/webservice/rest/server.php`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA }, body: p })
  const j = await r.json()
  if (j && j.exception) { const e = new Error(`${fn}: ${j.errorcode}`); e.moodle = j.errorcode; throw e }
  return j
}

export const siteInfo = (site, token) => ws(site, token, 'core_webservice_get_site_info')

const day = (sec) => (sec ? localParts(new Date(sec * 1000)).day : null)

export async function fetchWebservice(site, token) {
  const info = await siteInfo(site, token)
  const allowed = new Set((info.functions || []).map((f) => f.name))
  const can = (f) => !allowed.size || allowed.has(f)
  const warnings = []
  const items = []
  const courses = can('core_enrol_get_users_courses') ? await ws(site, token, 'core_enrol_get_users_courses', { userid: info.userid }) : []
  const cname = Object.fromEntries(courses.map((c) => [c.id, c.fullname]))
  const ids = courses.filter((c) => !c.hidden).map((c) => c.id)

  if (ids.length && can('mod_assign_get_assignments')) {
    try {
      const a = await ws(site, token, 'mod_assign_get_assignments', { courseids: ids })
      for (const c of a.courses || []) for (const x of c.assignments || []) {
        items.push({ externalId: `mdl_assign_${x.id}`, courseExternalId: `mdl_c_${c.id}`, courseName: c.fullname, type: 'assign', title: x.name, due: day(x.duedate), url: `${site}/mod/assign/view.php?id=${x.cmid}`, hash: hash(`${x.name}|${x.duedate}|${x.timemodified}`) })
      }
    } catch (e) { warnings.push(e.message) }
  }
  if (can('core_calendar_get_action_events_by_timesort')) {
    try {
      const ev = await ws(site, token, 'core_calendar_get_action_events_by_timesort', { timesortfrom: Math.floor(Date.now() / 1000) - 7 * 86400, limitnum: 50 })
      for (const x of ev.events || []) {
        const id = `mdl_${x.modulename || 'ev'}_${x.instance || x.id}`
        if (items.some((i) => i.externalId === id)) continue
        items.push({ externalId: id, courseExternalId: `mdl_c_${x.course?.id}`, courseName: x.course?.fullname || cname[x.course?.id], type: x.modulename === 'quiz' ? 'quiz' : x.modulename === 'forum' ? 'forum' : 'assign', title: x.activityname || x.name, due: day(x.timesort), url: x.url, hash: hash(`${x.name}|${x.timesort}`) })
      }
    } catch (e) { warnings.push(e.message) }
  }
  // Anuncios (foro de "Avisos"/news) de los últimos 14 días
  if (ids.length && can('mod_forum_get_forums_by_courses')) {
    try {
      const forums = (await ws(site, token, 'mod_forum_get_forums_by_courses', { courseids: ids })).filter((f) => f.type === 'news')
      const since = Date.now() / 1000 - 14 * 86400
      const fn = can('mod_forum_get_forum_discussions') ? 'mod_forum_get_forum_discussions' : 'mod_forum_get_forum_discussions_paginated'
      for (const f of forums.slice(0, 12)) {
        const d = await ws(site, token, fn, { forumid: f.id, perpage: 5, page: 0 }).catch(() => ({ discussions: [] }))
        for (const x of d.discussions || []) if ((x.timemodified || x.created) > since) {
          items.push({ externalId: `mdl_news_${x.discussion || x.id}`, courseExternalId: `mdl_c_${f.course}`, courseName: cname[f.course], type: 'forum', title: x.name || x.subject, due: null, url: `${site}/mod/forum/discuss.php?d=${x.discussion || x.id}`, hash: hash(`${x.name}|${x.timemodified}`) })
        }
      }
    } catch (e) { warnings.push(e.message) }
  }
  return { items, courses: courses.map((c) => ({ externalId: `mdl_c_${c.id}`, name: c.fullname })), warnings, siteName: info.sitename }
}

// ---------- iCal ----------
function unfold(text) { return text.replace(/\r?\n[ \t]/g, '') }
function parseDate(v) {
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/)
  if (!m) return null
  if (!m[4]) return `${m[1]}-${m[2]}-${m[3]}`
  const d = m[7] ? new Date(Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6])) : new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6])
  return localParts(d).day
}
export async function fetchIcal(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA } })
  const text = await r.text()
  if (!text.includes('BEGIN:VCALENDAR')) throw new HttpError(400, 'Ese enlace no devolvió un calendario. Cópialo de nuevo desde Tu Aula → Calendario → Exportar.')
  const items = []
  for (const block of unfold(text).split('BEGIN:VEVENT').slice(1)) {
    const get = (k) => { const m = block.match(new RegExp(`^${k}(?:;[^:]*)?:(.*)$`, 'm')); return m ? m[1].trim().replace(/\\,/g, ',').replace(/\\n/g, ' ') : '' }
    const summary = get('SUMMARY'), uid = get('UID'), dt = get('DTSTART'), cat = get('CATEGORIES'), mod = get('LAST-MODIFIED')
    if (!summary) continue
    items.push({ externalId: `ical_${hash(uid || summary)}`, courseExternalId: `ical_c_${hash(cat || 'general')}`, courseName: cat || 'Tu Aula', type: /quiz|cuestionario|examen/i.test(summary) ? 'quiz' : 'assign', title: summary.replace(/\s*(is due|vence|fecha de entrega)\s*$/i, ''), due: parseDate(dt), url: null, hash: hash(`${summary}|${dt}|${mod}`) })
  }
  return { items, warnings: [] }
}
