// "Revisar ahora": trae todas las actividades; la app decide qué es nuevo/cambiado comparando hashes.
import { handler } from '../../_lib/http.js'
import { requireUser } from '../../_lib/firebase.js'
import { runAulaSync } from '../../_lib/aula.js'

export default handler(async (req, res) => {
  const { uid } = await requireUser(req)
  const r = await runAulaSync(uid)
  res.json({ items: r.items, changed: r.changed.length, warnings: r.warnings })
}, { methods: ['POST'], limit: 10 })
