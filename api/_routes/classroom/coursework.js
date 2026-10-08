// Lee cursos, tareas, anuncios y materiales de Google Classroom (solo lectura) y omite lo que ya entregaste.
import { handler, HttpError } from '../../_lib/http.js'
import { requireUser } from '../../_lib/firebase.js'
import { fetchClassroom } from '../../_lib/classroom.js'

export default handler(async (req, res) => {
  const { uid } = await requireUser(req)
  const accountId = String(req.query.account || '')
  if (!accountId) throw new HttpError(400, 'Falta la cuenta')
  res.json(await fetchClassroom(uid, accountId))
}, { methods: ['GET'], limit: 20 })
