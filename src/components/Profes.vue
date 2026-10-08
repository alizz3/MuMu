<script setup>
import { computed, ref } from 'vue'
import { state, ui } from '../store'
import { toast } from '../engine/game'
import { Icon, Empty } from './ui'
import Contact from './Contact.vue'

const profes = computed(() => state.subjects.filter((s) => s.teacher || s.teacherEmail || s.teacherPhone))
const UT = 'azmejiaf@ut.edu.co'
const firma = computed({ get: () => state.settings.signature || 'Aliz Zaray Mejía Flórez', set: (v) => (state.settings.signature = v) })

const firstName = (n) => String(n || '').trim().split(/\s+/)[0] || ''
const saludo = (s) => `Buenas, profe${s.teacher ? ' ' + firstName(s.teacher) : ''}. Espero que esté muy bien.`
const PLANTILLAS = [
  { k: 'duda', l: '❓ Duda sobre una tarea', asunto: (s) => `Duda sobre actividad – ${s.name}`, cuerpo: (s) => `${saludo(s)}\n\nLe escribo porque tengo una duda sobre la actividad [nombre de la actividad] de ${s.name}: [tu pregunta].\n\nMuchas gracias por su tiempo.` },
  { k: 'prorroga', l: '⏳ Pedir más tiempo', asunto: (s) => `Solicitud de prórroga – ${s.name}`, cuerpo: (s) => `${saludo(s)}\n\nLe escribo para pedirle, si es posible, unos días más para entregar [nombre de la actividad] de ${s.name}, porque [motivo]. Me comprometo a entregarla el [fecha].\n\nQuedo atenta a su respuesta. Muchas gracias.` },
  { k: 'falta', l: '📋 No pude asistir', asunto: (s) => `Inasistencia a tutoría – ${s.name}`, cuerpo: (s) => `${saludo(s)}\n\nLe informo que no pude asistir a la tutoría de ${s.name} del [fecha] porque [motivo]. ¿Me podría indicar qué temas vieron o si hay alguna actividad pendiente para ponerme al día?\n\nMuchas gracias.` },
  { k: 'entrega', l: '📎 Envío mi trabajo', asunto: (s) => `Entrega de actividad – ${s.name}`, cuerpo: (s) => `${saludo(s)}\n\nLe comparto la actividad [nombre de la actividad] de ${s.name}. Quedo atenta a cualquier comentario.\n\nMuchas gracias.` },
  { k: 'libre', l: '✍️ En blanco', asunto: (s) => s.name, cuerpo: (s) => `${saludo(s)}\n\n` },
]

const open = ref(null)
const draft = ref({ asunto: '', cuerpo: '' })
function pick(s, p) { open.value = s.id; draft.value = { k: p.k, asunto: p.asunto(s), cuerpo: p.cuerpo(s) } }
const full = () => `${draft.value.cuerpo.trim()}\n\n${firma.value}`

async function copy(text, what) {
  try { await navigator.clipboard.writeText(text); toast(`${what} copiado 📋`) } catch { toast('No pude copiar; mantén presionado el texto para copiarlo') }
}
const phone = (p) => { const d = String(p || '').replace(/\D/g, ''); return d.length === 10 ? '57' + d : d }
const gmail = (s) => `https://mail.google.com/mail/?authuser=${encodeURIComponent(UT)}&view=cm&fs=1&to=${encodeURIComponent(s.teacherEmail)}&su=${encodeURIComponent(draft.value.asunto)}&body=${encodeURIComponent(full())}`
const wa = (s) => `https://wa.me/${phone(s.teacherPhone)}?text=${encodeURIComponent(full())}`
</script>

<template>
  <div class="stack">
    <p class="tiny muted">Elige qué le quieres decir, cambia lo que está entre [corchetes] y lo mandas por correo, WhatsApp o lo copias.</p>
    <div v-for="s in profes" :key="s.id" class="card stack" style="gap:8px" :style="{ borderLeft: `5px solid ${s.color}` }">
      <div class="row">
        <div class="grow"><div class="b small">{{ s.teacher || 'Profe sin nombre' }}</div><div class="tiny muted">{{ s.name }}</div></div>
        <button class="iconbtn" :aria-label="`Editar datos de ${s.teacher || s.name}`" @click="ui.modal = { type: 'subject', id: s.id }"><Icon name="edit" :size="16" /></button>
      </div>
      <div class="row wrap" style="gap:4px 14px">
        <Contact v-if="s.teacherEmail" class="small" :value="s.teacherEmail" kind="email" :as="UT" />
        <Contact v-if="s.teacherPhone" class="small" :value="s.teacherPhone" kind="phone" />
      </div>
      <div class="chips"><button v-for="p in PLANTILLAS" :key="p.k" class="chip" :class="{ on: open === s.id && draft.k === p.k }" @click="pick(s, p)">{{ p.l }}</button></div>

      <div v-if="open === s.id" class="stack" style="gap:8px">
        <input class="input" v-model="draft.asunto" aria-label="Asunto" placeholder="Asunto" />
        <textarea class="input" v-model="draft.cuerpo" rows="7" aria-label="Mensaje"></textarea>
        <input class="input" v-model="firma" aria-label="Firma" placeholder="Tu firma" />
        <div class="row wrap" style="gap:6px">
          <a v-if="s.teacherEmail" class="btn sm primary" :href="gmail(s)" target="_blank" rel="noopener">✉️ Abrir en Gmail (UT)</a>
          <a v-if="s.teacherPhone" class="btn sm lav" :href="wa(s)" target="_blank" rel="noopener">💬 WhatsApp</a>
          <button class="btn sm ghost" @click="copy(full(), 'Mensaje')">📋 Copiar mensaje</button>
          <button class="btn sm ghost" @click="copy(draft.asunto, 'Asunto')">Copiar asunto</button>
          <button class="btn sm ghost" @click="open = null">Cerrar</button>
        </div>
      </div>
    </div>
    <Empty v-if="!profes.length" pose="happy" text="Agrega el nombre, correo o celular del profe editando cada materia ✏️" />
  </div>
</template>
