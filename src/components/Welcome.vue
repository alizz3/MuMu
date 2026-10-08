<script setup>
import { ref } from 'vue'
import { state, ui } from '../store'
import { signIn, signOut } from '../services/firebase'
import { installApp } from '../services/pwa'
import { Icon, Pet } from './ui'

const busy = ref(false)
const error = ref('')
const ERR = {
  'auth/popup-closed-by-user': 'Cerraste la ventana de Google antes de terminar.',
  'auth/popup-blocked': 'El navegador bloqueó la ventana de Google. Permite ventanas emergentes para este sitio.',
  'auth/unauthorized-domain': 'Este dominio no está autorizado en Firebase.',
}
async function enter() {
  busy.value = true; error.value = ''
  try { await signIn() } catch (e) { error.value = ERR[e?.code] || 'No se pudo entrar. Intenta de nuevo.' } finally { busy.value = false }
}
async function leave() { await signOut(); ui.blocked = false }
const demo = () => { ui.demo = true }

const FEATURES = [
  { icon: 'sparkles', t: '¿Qué hago ahora?', d: 'Mira tu agenda, tus pendientes y tu energía, y te recomienda una sola cosa para empezar.' },
  { icon: 'calendar', t: 'Agenda que encuentra huecos', d: 'Une clases, eventos y bloques de estudio, y te dice cuánto tiempo libre tienes de verdad.' },
  { icon: 'cap', t: 'Universidad al día', d: 'Trae tareas, anuncios y materiales de Tu Aula y Classroom, y las vuelve pendientes con fecha.' },
  { icon: 'heart', t: 'Hábitos sin culpa', d: '“18 de los últimos 24 días” en vez de rachas que se pierden. Volver también cuenta.' },
  { icon: 'flask', t: 'Mi cerebro', d: 'Lo que aprendes de libros y podcasts se vuelve experimentos, y los experimentos, tu propio método.' },
  { icon: 'house', t: 'La casita de la vaquita', d: 'Cada avance real da monedas para decorar la casa de la vaquita, Leo y Negra.' },
]
</script>

<template>
  <div class="welcome">
    <!-- Alguien que no es la dueña -->
    <section v-if="ui.blocked" class="w-hero" style="min-height:100dvh;justify-content:center">
      <div class="w-pets"><Pet kind="negra" pose="sit" :size="90" /><Pet pose="hug" :size="150" /><Pet kind="leo" pose="sleep" :size="90" /></div>
      <h1 class="w-title">Esta es la casita de {{ state.settings.ownerName }} 🐮</h1>
      <p class="w-sub">Aquí solo entra ella. Gracias por pasar a saludar 💗</p>
      <p class="small muted">¿Te gustaría una app así para ti o tu negocio? Escríbele a <b class="sel">dev.doblezz@gmail.com</b></p>
      <div class="row" style="justify-content:center;gap:8px;margin-top:14px">
        <button class="btn ghost" @click="leave">Salir</button>
        <button class="btn lav" @click="leave().then(demo)">Ver la demo</button>
      </div>
    </section>

    <template v-else>
      <section class="w-hero">
        <div class="w-badge">Mi sistema operativo personal</div>
        <div class="w-pets"><Pet kind="negra" pose="happy" :size="96" /><Pet pose="agenda" :size="170" /><Pet kind="leo" pose="sit" :size="96" /></div>
        <h1 class="w-title">MuMu</h1>
        <p class="w-tag">Mi vida organizada, pero bonita.</p>
        <p class="w-sub">Agenda, hábitos, universidad y un segundo cerebro en un solo lugar, con una vaquita que te acompaña sin hacerte sentir culpa.</p>
        <div class="w-cta">
          <button class="btn primary big" :disabled="busy" @click="enter">
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#fff" d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z"/></svg>
            {{ busy ? 'Abriendo Google…' : 'Entrar con Google' }}
          </button>
          <button class="btn ghost" @click="demo">Ver demo con datos de ejemplo</button>
        </div>
        <p v-if="error" class="notice" style="margin-top:12px">{{ error }}</p>
        <button v-if="ui.installPrompt" class="link" style="margin-top:6px" @click="installApp">📲 Instalar MuMu en este dispositivo</button>
        <p v-else-if="ui.isIOS && !ui.installed" class="tiny muted" style="margin-top:6px">📲 En iPhone: toca Compartir → "Agregar a inicio" para tenerla como app.</p>
      </section>

      <section class="w-grid">
        <article v-for="f in FEATURES" :key="f.t" class="card">
          <span class="ico"><Icon :name="f.icon" /></span>
          <h3 style="margin-top:10px">{{ f.t }}</h3>
          <p class="small muted" style="margin-top:4px">{{ f.d }}</p>
        </article>
      </section>

      <section class="card soft w-philo">
        <Pet pose="motivate" :size="110" />
        <div>
          <h2>Progreso, no perfección</h2>
          <p class="small" style="margin-top:6px">Si un día no puedes, MuMu no te regaña: te propone 5 minuticos para volver a empezar. Tus datos de sueño, enfoque y hábitos se convierten en observaciones sobre ti, nunca en diagnósticos.</p>
        </div>
      </section>

      <footer class="w-foot">
        <span>Hecho con 💗 por Aliz Mejía · Vue · Firebase · Vercel</span>
        <span class="row" style="gap:14px"><a href="https://github.com/alizz3/MuMu" target="_blank" rel="noopener">GitHub</a><a href="/privacidad.html">Privacidad</a><a href="/terminos.html">Términos</a></span>
      </footer>
    </template>
  </div>
</template>

<style scoped>
.welcome { max-width: 980px; margin: 0 auto; padding: 0 16px 40px; display: flex; flex-direction: column; gap: 22px; }
.w-hero { display: flex; flex-direction: column; align-items: center; text-align: center; padding-top: 40px; gap: 8px; }
.w-badge { font-size: 12px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--pink-700); background: var(--pink-100); padding: 6px 14px; border-radius: 999px; }
.w-pets { display: flex; align-items: flex-end; justify-content: center; margin: 6px 0 -4px; }
.w-title { font-size: clamp(44px, 10vw, 72px); font-weight: 700; letter-spacing: -.03em; line-height: 1; background: linear-gradient(135deg, #E98AA6, #9A84BD); -webkit-background-clip: text; background-clip: text; color: transparent; }
.w-tag { font-family: var(--serif); font-style: italic; font-size: 22px; color: var(--ink); }
.w-sub { max-width: 52ch; color: var(--ink-2); text-wrap: balance; }
.w-cta { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin-top: 14px; }
.w-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; }
.w-philo { display: flex; align-items: center; gap: 16px; }
@media (max-width: 520px) { .w-philo { flex-direction: column; text-align: center; } }
.w-foot { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 10px; font-size: 13px; color: var(--muted); padding-top: 8px; border-top: 1px solid var(--line); }
.sel { user-select: all; }
</style>
