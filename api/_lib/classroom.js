// Lectura de Classroom compartida entre "Revisar ahora" y las revisiones automáticas (cron).
import { accessToken, gget, localParts } from './google.js'
import { hash } from './crypto.js'

export async function fetchClassroom(uid, accountId) {
  const { token } = await accessToken(uid, accountId, 'classroom')
  const base = 'https://classroom.googleapis.com/v1'
  const { courses = [] } = await gget(token, `${base}/courses?courseStates=ACTIVE&studentId=me&pageSize=30`)
  const items = []
  let noWork = false
  for (const c of courses) {
    const { courseWork = [] } = await gget(token, `${base}/courses/${c.id}/courseWork?pageSize=30&orderBy=updateTime desc`).catch((e) => { if (e.status === 403) noWork = true; return {} })
    const subs = await gget(token, `${base}/courses/${c.id}/courseWork/-/studentSubmissions?userId=me&pageSize=100`).catch(() => ({ studentSubmissions: [] }))
    const turnedIn = new Set((subs.studentSubmissions || []).filter((s) => ['TURNED_IN', 'RETURNED'].includes(s.state)).map((s) => s.courseWorkId))
    for (const w of courseWork) {
      if (turnedIn.has(w.id)) continue
      // Classroom guarda fecha y hora en UTC: se pasan a hora de Colombia (23:59 de aquí es 04:59 del día siguiente allá)
      let d = w.dueDate ? `${w.dueDate.year}-${String(w.dueDate.month).padStart(2, '0')}-${String(w.dueDate.day).padStart(2, '0')}` : null, dt = null
      if (w.dueDate && w.dueTime && w.dueTime.hours != null) { const lp = localParts(new Date(Date.UTC(w.dueDate.year, w.dueDate.month - 1, w.dueDate.day, w.dueTime.hours || 0, w.dueTime.minutes || 0))); d = lp.day; dt = lp.time }
      items.push({ externalId: `cr_${w.id}`, courseExternalId: `crc_${c.id}`, courseName: c.name, type: w.workType === 'MULTIPLE_CHOICE_QUESTION' || w.workType === 'SHORT_ANSWER_QUESTION' ? 'quiz' : 'assign', title: w.title, due: d, dueTime: dt, url: w.alternateLink, hash: hash(`${w.title}|${d}|${w.updateTime}`) })
    }
    // Anuncios y materiales de las últimas 3 semanas (como avisos, no como tareas)
    const since = Date.now() - 21 * 864e5
    const { announcements = [] } = await gget(token, `${base}/courses/${c.id}/announcements?pageSize=20`).catch(() => ({}))
    for (const a of announcements) if (new Date(a.updateTime || a.creationTime) > since) {
      const txt = (a.text || 'Nuevo anuncio').replace(/\s+/g, ' ')
      items.push({ externalId: `cra_${a.id}`, courseExternalId: `crc_${c.id}`, courseName: c.name, type: 'forum', title: txt.length > 90 ? txt.slice(0, 87) + '…' : txt, due: null, url: a.alternateLink, hash: hash(`${a.text}|${a.updateTime}`) })
    }
    const { courseWorkMaterial = [] } = await gget(token, `${base}/courses/${c.id}/courseWorkMaterials?pageSize=20`).catch(() => ({}))
    for (const m of courseWorkMaterial) if (new Date(m.updateTime || m.creationTime) > since) {
      items.push({ externalId: `crm_${m.id}`, courseExternalId: `crc_${c.id}`, courseName: c.name, type: 'material', title: m.title || 'Material nuevo', due: null, url: m.alternateLink, hash: hash(`${m.title}|${m.updateTime}`) })
    }
  }
  return { items, courses: courses.length, warnings: noWork ? ['Google no dio permiso para ver tus tareas de Classroom: desconecta la cuenta y vuelve a agregarla marcando todas las casillas.'] : [] }
}
