// Lee (solo lectura) los correos recientes y los clasifica: importante / revisar / informativo.
import { handler, HttpError } from '../_lib/http.js'
import { requireUser } from '../_lib/firebase.js'
import { accessToken, gget, localParts } from '../_lib/google.js'

const KEY = /(entrega|plazo|parcial|examen|quiz|urgente|importante|fecha l[ií]mite|vence|pago|factura|reuni[oó]n|entrevista|cita|matr[ií]cula|nota|calificaci[oó]n|propuesta|cliente)/i
const INFO = /(no-?reply|newsletter|noticias|bolet[ií]n|promo|notifications?@)/i

export default handler(async (req, res) => {
  const { uid } = await requireUser(req)
  const accountId = String(req.query.account || '')
  if (!accountId) throw new HttpError(400, 'Falta la cuenta')
  const { token } = await accessToken(uid, accountId, 'gmail')
  const base = 'https://gmail.googleapis.com/gmail/v1/users/me'
  const q = encodeURIComponent('newer_than:10d -category:promotions -category:social in:inbox')
  const list = await gget(token, `${base}/messages?maxResults=30&q=${q}`)
  const msgs = await Promise.all((list.messages || []).map((m) => gget(token, `${base}/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`)))
  const uni = (process.env.UNIVERSITY_EMAIL_DOMAIN || 'ut.edu.co').toLowerCase()
  const emails = msgs.map((m) => {
    const h = Object.fromEntries((m.payload?.headers || []).map((x) => [x.name.toLowerCase(), x.value]))
    const from = h.from || '', subject = h.subject || '(sin asunto)', labels = m.labelIds || []
    let category = 'revisar'
    if (labels.includes('IMPORTANT') || labels.includes('STARRED') || KEY.test(subject) || from.toLowerCase().includes(uni)) category = 'importante'
    if (INFO.test(from) && !KEY.test(subject)) category = 'informativo'
    if (labels.includes('CATEGORY_UPDATES') || labels.includes('CATEGORY_FORUMS')) category = category === 'importante' ? 'importante' : 'informativo'
    return { id: `gm_${m.id}`, from: from.replace(/<.*>/, '').replace(/"/g, '').trim() || from, subject, snippet: m.snippet, date: localParts(new Date(Number(m.internalDate))).day, category, unread: labels.includes('UNREAD'), url: `https://mail.google.com/mail/u/0/#inbox/${m.threadId}` }
  })
  res.json({ emails })
}, { methods: ['GET'], limit: 20 })
