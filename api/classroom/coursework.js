// Lee cursos y tareas de Google Classroom (solo lectura) y omite lo que ya entregaste.
import { handler, HttpError } from '../_lib/http.js'
import { requireUser } from '../_lib/firebase.js'
import { accessToken, gget } from '../_lib/google.js'
import { hash } from '../_lib/crypto.js'

export default handler(async (req, res) => {
  const { uid } = await requireUser(req)
  const accountId = String(req.query.account || '')
  if (!accountId) throw new HttpError(400, 'Falta la cuenta')
  const { token } = await accessToken(uid, accountId, 'classroom')
  const base = 'https://classroom.googleapis.com/v1'
  const { courses = [] } = await gget(token, `${base}/courses?courseStates=ACTIVE&studentId=me&pageSize=30`)
  const items = []
  for (const c of courses) {
    const { courseWork = [] } = await gget(token, `${base}/courses/${c.id}/courseWork?pageSize=30&orderBy=updateTime desc`).catch(() => ({}))
    const subs = await gget(token, `${base}/courses/${c.id}/courseWork/-/studentSubmissions?userId=me&pageSize=100`).catch(() => ({ studentSubmissions: [] }))
    const turnedIn = new Set((subs.studentSubmissions || []).filter((s) => ['TURNED_IN', 'RETURNED'].includes(s.state)).map((s) => s.courseWorkId))
    for (const w of courseWork) {
      if (turnedIn.has(w.id)) continue
      const d = w.dueDate ? `${w.dueDate.year}-${String(w.dueDate.month).padStart(2, '0')}-${String(w.dueDate.day).padStart(2, '0')}` : null
      items.push({ externalId: `cr_${w.id}`, courseExternalId: `crc_${c.id}`, courseName: c.name, type: w.workType === 'MULTIPLE_CHOICE_QUESTION' || w.workType === 'SHORT_ANSWER_QUESTION' ? 'quiz' : 'assign', title: w.title, due: d, url: w.alternateLink, hash: hash(`${w.title}|${d}|${w.updateTime}`) })
    }
  }
  res.json({ items })
}, { methods: ['GET'], limit: 20 })
