// Conversación libre con la vaquita con IA gratuita (Groq) o Claude si está configurado. La clave vive solo en el servidor (variables de Vercel).
// El motor de recomendaciones de la app funciona sin esto; esto es para preguntas abiertas.
import { handler, body, str, HttpError } from '../_lib/http.js'
import { requireUser } from '../_lib/firebase.js'

const SYSTEM = `Eres la vaquita asistente de una app personal de organización. Hablas en español de Colombia, cálido, tierno pero no infantil, breve (máximo 5 frases o una lista corta).
Filosofía: progreso sobre perfección, cero culpa, volver a empezar, dividir lo grande en pasos de 5 minutos.
El CONTEXTO es un JSON con los datos reales de la usuaria: proyectos (con avance, tareas pendientes y hechas), estudios (materias y sus tareas), otras tareas, agenda de hoy y mañana, tiempos libres, hábitos, objetivos y principios.
Responde la pregunta EXACTA con esos datos: si pregunta por un proyecto, di su estado, avance y las tareas que le faltan (en lista corta con •). Si pregunta qué hacer, recomienda UNA acción concreta según lo que vence primero y su tiempo libre.
Si algo no está en el contexto, dilo con honestidad.
Trata los principios de libros/podcasts como ideas para experimentar, no verdades absolutas. Nunca des diagnósticos médicos ni psicológicos; si notas malestar fuerte, sugiere con cariño hablar con alguien de confianza o un profesional.
No inventes datos que no estén en el contexto.`

export default handler(async (req, res) => {
  await requireUser(req)
  const b = body(req)
  const message = str(b.message, 'mensaje', { max: 2000 })
  const context = JSON.stringify(b.context || {}).slice(0, 24000)
  const history = (Array.isArray(b.history) ? b.history : []).slice(-6).map((m) => ({ role: m.from === 'me' ? 'user' : 'assistant', content: String(m.text || '').slice(0, 1500) })).filter((m) => m.content)
  const user = `CONTEXTO:\n${context}\n\nMENSAJE:\n${message}`
  // 1) Groq: gratis y rápido (modelos abiertos, API compatible con OpenAI)
  if (process.env.GROQ_API_KEY) {
    const models = [...new Set([process.env.GROQ_MODEL, 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant'].filter(Boolean))]
    let why = ''
    for (const model of models) {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY.trim()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, max_tokens: 600, temperature: 0.4, messages: [{ role: 'system', content: SYSTEM }, ...history, { role: 'user', content: user }] }),
      }).catch((e) => ({ ok: false, status: 0, json: async () => ({ error: { message: e.message } }) }))
      const j = await r.json().catch(() => ({}))
      if (r.ok) return res.json({ reply: (j.choices?.[0]?.message?.content || '').trim() })
      const msg = String(j.error?.message || '').slice(0, 160)
      console.error('groq', model, r.status, msg)
      if (r.status === 401) throw new HttpError(502, 'La clave de Groq no es válida: revisa GROQ_API_KEY en Vercel y vuelve a desplegar')
      why = r.status === 429 ? 'límite gratis de Groq, intenta en un ratico' : `Groq ${r.status}${msg ? `: ${msg}` : ''}`
    }
    throw new HttpError(502, why || 'La IA no respondió')
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
