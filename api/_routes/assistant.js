// Conversación libre con la vaquita con IA gratuita (Groq) o Claude si está configurado. La clave vive solo en el servidor (variables de Vercel).
// El motor de recomendaciones de la app funciona sin esto; esto es para preguntas abiertas.
import { handler, body, str, HttpError } from '../_lib/http.js'
import { requireUser } from '../_lib/firebase.js'

const SYSTEM = `Eres la vaquita asistente de una app personal de organización. Hablas en español de Colombia, cálido, tierno pero no infantil, breve (máximo 5 frases).
Filosofía: progreso sobre perfección, cero culpa, volver a empezar, dividir lo grande en pasos de 5 minutos.
Usa el CONTEXTO (tareas, tiempos libres, hábitos, principios y aprendizajes de la usuaria) para recomendar UNA acción concreta cuando aplique.
Trata los principios de libros/podcasts como ideas para experimentar, no verdades absolutas. Nunca des diagnósticos médicos ni psicológicos; si notas malestar fuerte, sugiere con cariño hablar con alguien de confianza o un profesional.
No inventes datos que no estén en el contexto.`

export default handler(async (req, res) => {
  await requireUser(req)
  const b = body(req)
  const message = str(b.message, 'mensaje', { max: 2000 })
  const context = JSON.stringify(b.context || {}).slice(0, 12000)
  const history = (Array.isArray(b.history) ? b.history : []).slice(-6).map((m) => ({ role: m.from === 'me' ? 'user' : 'assistant', content: String(m.text || '').slice(0, 1500) })).filter((m) => m.content)
  const user = `CONTEXTO:\n${context}\n\nMENSAJE:\n${message}`
  // 1) Groq: gratis y rápido (modelos abiertos, API compatible con OpenAI)
  if (process.env.GROQ_API_KEY) {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile', max_tokens: 500, temperature: 0.6, messages: [{ role: 'system', content: SYSTEM }, ...history, { role: 'user', content: user }] }),
    })
    const j = await r.json().catch(() => ({}))
    if (r.status === 429) throw new HttpError(429, 'La vaquita está pensando mucho hoy (límite gratis de Groq). Intenta en un ratico.')
    if (!r.ok) throw new HttpError(502, 'La IA no respondió, intenta en un momento')
    return res.json({ reply: (j.choices?.[0]?.message?.content || '').trim() })
  }
  // 2) Claude, si algún día se configura
  if (!process.env.ANTHROPIC_API_KEY) throw new HttpError(503, 'El asistente con IA no está configurado (falta GROQ_API_KEY en Vercel)')
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5', max_tokens: 500, system: SYSTEM, messages: [...history, { role: 'user', content: user }] }),
  })
  const j = await r.json()
  if (!r.ok) throw new HttpError(502, 'La IA no respondió, intenta en un momento')
  res.json({ reply: (j.content || []).map((c) => c.text || '').join('').trim() })
}, { methods: ['POST'], limit: 20 })
