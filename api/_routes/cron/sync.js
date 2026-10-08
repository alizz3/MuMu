// Revisión automática (Vercel Cron, 6 a. m., 12 m. y 6 p. m.): Tu Aula y Google Classroom.
// Solo entrega lo NUEVO o CAMBIADO al buzón de la app, que lo vuelve tareas la próxima vez que la abras.
import { handler, HttpError } from '../../_lib/http.js'
import { initDb, pushInbox } from '../../_lib/firebase.js'
import { runAulaSync } from '../../_lib/aula.js'
import { fetchClassroom } from '../../_lib/classroom.js'

export default handler(async (req, res) => {
  if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) throw new HttpError(401, 'No autorizado')
  const db = await initDb()
  const out = { aula: 0, classroom: 0, errores: 0 }

  for (const d of (await db.collectionGroup('aula').get()).docs) {
    const uid = d.ref.parent.parent.id
    try {
      const r = await runAulaSync(uid)
      if (r.changed.length) { await pushInbox(uid, { source: 'aula', at: Date.now(), items: r.changed }); out.aula += r.changed.length }
    } catch (e) { out.errores++; console.error(`[cron aula] ${uid.slice(0, 6)}…: ${e.message}`) }
  }

  // (se filtra aquí para no necesitar un índice especial de Firestore)
  for (const d of (await db.collectionGroup('google').get()).docs.filter((x) => (x.data().services || []).includes('classroom'))) {
    const uid = d.ref.parent.parent.id
    try {
      const { items } = await fetchClassroom(uid, d.id)
      const prev = d.data().crHashes || {}
      const changed = items.filter((i) => prev[i.externalId] !== i.hash)
      await d.ref.update({ crHashes: Object.fromEntries(items.map((i) => [i.externalId, i.hash])), crLastSync: Date.now() })
      // La primera vez solo se guarda la foto (no se inunda el buzón con todo lo viejo)
      if (changed.length && Object.keys(prev).length) { await pushInbox(uid, { source: 'classroom', at: Date.now(), items: changed }); out.classroom += changed.length }
    } catch (e) { out.errores++; console.error(`[cron classroom] ${uid.slice(0, 6)}…: ${e.message}`) }
  }
  res.json({ ok: true, ...out })
}, { methods: ['GET'], limit: 10 })
