// Conversación libre con la vaquita usando la API de Claude. La clave vive solo en el servidor.
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
  if (!process.env.ANTHROPIC_API_KEY) throw new HttpError(503, 'El asistente con IA no está configurado (ANTHROPIC_API_KEY)')
  const b = body(req)
  const message = str(b.message, 'mensaje', { max: 2000 })
  const context = JSON.stringify(b.context || {}).slice(0, 12000)
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5', max_tokens: 500, system: SYSTEM, messages: [{ role: 'user', content: `CONTEXTO:\n${context}\n\nMENSAJE:\n${message}` }] }),
  })
  const j = await r.json()
  if (!r.ok) throw new HttpError(502, 'La IA no respondió, intenta en un momento')
  res.json({ reply: (j.content || []).map((c) => c.text || '').join('').trim() })
}, { methods: ['POST'], limit: 20 })
