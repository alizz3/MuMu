import { handler } from './_lib/http.js'

export default handler(async (req, res) => {
  const e = process.env
  res.json({ ok: true, services: { firebase: !!e.FIREBASE_SERVICE_ACCOUNT, google: !!(e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET), ai: !!e.ANTHROPIC_API_KEY, finance: !!e.FINANCE_API_URL, crypto: !!e.TOKEN_ENC_KEY } })
})
