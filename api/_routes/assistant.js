// Conversación libre con la vaquita con IA gratuita (Groq) o Claude si está configurado. La clave vive solo en el servidor (variables de Vercel).
// El motor de recomendaciones de la app funciona sin esto; esto es para preguntas abiertas.
import { handler, body, str, HttpError } from '../_lib/http.js'
import { requireUser } from '../_lib/firebase.js'

const SYSTEM = `Eres la vaquita asistente de una app personal de organización. Hablas en español de Colombia, cálido, tierno pero no infantil, breve (máximo 5 frases o una lista corta).
Filosofía: progreso sobre perfección, cero culpa, volver a empezar, dividir lo grande en pasos de 5 minutos.
El CONTEXTO es un JSON con sus datos reales: proyectos (avance, pendientes, hechas), estudios (materia: tareas), otras tareas, "detalle" (notas y subtareas de las tareas que se nombran), agenda, tiempo libre y hábitos.
Usa formato corto: **negrita** para nombres y listas con "- ". Si te pide la descripción de una tarea, usa "detalle".
Responde la pregunta EXACTA con esos datos: si pregunta por un proyecto, di su estado, avance y las tareas que le faltan (en lista corta con •). Si pregunta qué hacer, recomienda UNA acción concreta según lo que vence primero y su tiempo libre.
Si algo no está en el contexto, dilo con honestidad.
Vehículos ("garaje" en el contexto): distingue lo guardado en el historial, las sugerencias no verificadas (fuente externa, no el manual) y lo que falta. No inventes fechas, km ni costos. No diagnostiques averías como certezas ni reemplaces al manual o a un mecánico; si un síntoma puede afectar la seguridad (frenos, llantas, dirección, luces, fugas, recalentamiento), recomienda no usar el vehículo hasta que lo revise un técnico. Tú no guardas datos: para registrar algo, pide que lo diga como "registra que hoy le puse gasolina por 20 mil" o que use el Garaje.
Trata los principios de libros/podcasts como ideas para experimentar, no verdades absolutas. Nunca des diagnósticos médicos ni psicológicos; si notas malestar fuerte, sugiere con cariño hablar con alguien de confianza o un profesional.
No inventes datos que no estén en el contexto.`

// Groq retira modelos cada tanto: se pregunta cuáles hay para esta clave y se usa el mejor disponible
let goodModel = null, cache = { at: 0, list: [] }
const rested = new Map() // modelo → hasta cuándo descansa (llegó a su límite)
function waitMs(r, msg) {
  const h = Number(r.headers?.get?.('retry-after'))
  if (h > 0) return h * 1000
  const m = msg.match(/try again in (?:(\d+)h)?(?:(\d+)m)?(?:([\d.]+)s)?/i)
  return m ? ((+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0)) * 1000 : 60e3
}
const PREFER = [/gpt-oss-120b/, /llama-3\.3-70b/, /kimi-k2/, /llama-4-maverick/, /qwen3?-32b/, /llama-4-scout/, /gpt-oss-20b/, /llama-3\.1-8b/]
async function groqModels(key) {
  const out = [process.env.GROQ_MODEL, goodModel].filter(Boolean)
  if (Date.now() - cache.at > 6 * 3600e3 || !cache.list.length) {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/models', { headers: { Authorization: `Bearer ${key}` } })
      const j = await r.json()
      const ids = (j.data || []).filter((m) => m.active !== false).map((m) => m.id).filter((id) => !/whisper|guard|tts|playai|orpheus|compound|distil|prompt/i.test(id))
      const rank = (id) => { const i = PREFER.findIndex((re) => re.test(id)); return i < 0 ? 99 : i }
      cache = { at: Date.now(), list: ids.sort((a, b) => rank(a) - rank(b)) }
    } catch { /* si falla, se intenta con lo conocido */ }
  }
  const all = [...new Set([...out, ...cache.list.slice(0, 6), 'openai/gpt-oss-120b', 'llama-3.3-70b-versatile'])]
  const ok = all.filter((m) => !(rested.get(m) > Date.now()))
  return (ok.length ? ok : all).slice(0, 5)
}

export default handler(async (req, res) => {
  await requireUser(req)
  const b = body(req)
  const message = str(b.message, 'mensaje', { max: 2000 })
  const context = JSON.stringify(b.context || {}).slice(0, 14000)
  const history = (Array.isArray(b.history) ? b.history : []).slice(-4).map((m) => ({ role: m.from === 'me' ? 'user' : 'assistant', content: String(m.text || '').slice(0, 700) })).filter((m) => m.content)
  const user = `CONTEXTO:\n${context}\n\nMENSAJE:\n${message}`
  // 1) Groq: gratis y rápido (modelos abiertos, API compatible con OpenAI)
  if (process.env.GROQ_API_KEY) {
    const key = process.env.GROQ_API_KEY.trim()
    let why = []
    for (const model of await groqModels(key)) {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, ...(/gpt-oss/.test(model) ? { reasoning_effort: 'low', include_reasoning: false } : {}), max_tokens: /gpt-oss|qwen/.test(model) ? 1200 : 500, temperature: 0.4, messages: [{ role: 'system', content: SYSTEM }, ...history, { role: 'user', content: user }] }),
      }).catch((e) => ({ ok: false, status: 0, json: async () => ({ error: { message: e.message } }) }))
      const j = await r.json().catch(() => ({}))
      const reply = (j.choices?.[0]?.message?.content || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim()
      if (r.ok && reply) { goodModel = model; return res.json({ reply }) }
      if (r.ok) { why.push(`${model}: vacía`); continue }
      const msg = String(j.error?.message || '').slice(0, 140)
      console.error('groq', model, r.status, msg)
      if (r.status === 401) throw new HttpError(502, 'La clave de Groq no es válida: revisa GROQ_API_KEY en Vercel y vuelve a desplegar')
      if (goodModel === model) goodModel = null
      if (r.status === 429) { rested.set(model, Date.now() + waitMs(r, msg)); why.push('límite'); continue } // cada modelo tiene su propio límite: se prueba el siguiente
      why.push(`${model}: ${r.status}`)
    }
    if (why.length && why.every((w) => w === 'límite')) throw new HttpError(429, 'Usaste el límite gratis de Groq por ahora; vuelve en unos minutos')
    throw new HttpError(502, `Groq no respondió (${why.filter((w) => w !== 'límite').join(', ') || 'sin modelos disponibles'})`)
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
