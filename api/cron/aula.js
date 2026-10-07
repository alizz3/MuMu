// Revisión periódica (Vercel Cron). Solo entrega lo NUEVO o CAMBIADO al buzón de la app,
// que lo convierte en tareas la próxima vez que la abras.
import { handler, HttpError } from '../_lib/http.js'
import { db, pushInbox } from '../_lib/firebase.js'
import { runAulaSync } from '../_lib/aula.js'

export default handler(async (req, res) => {
  if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) throw new HttpError(401, 'No autorizado')
  const docs = await db().collectionGroup('aula').get()
  let users = 0, changes = 0
  for (const d of docs.docs) {
    const uid = d.ref.parent.parent.id
    try {
      const r = await runAulaSync(uid)
      if (r.changed.length) { await pushInbox(uid, { source: 'aula', at: Date.now(), items: r.changed }); changes += r.changed.length }
      users++
    } catch (e) { console.error(`[cron aula] ${uid.slice(0, 6)}…: ${e.message}`) }
  }
  res.json({ ok: true, users, changes })
}, { methods: ['GET'], limit: 5 })
