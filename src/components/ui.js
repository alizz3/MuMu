// Componentes base pequeños (definidos con render functions para mantener todo junto)
import { h, computed } from 'vue'
import { ICONS } from './icons'
import { cow, leo, negra } from './art'
import { state } from '../store'

export const Icon = {
  props: { name: String, size: { type: [Number, String], default: 20 }, stroke: { type: Number, default: 1.9 } },
  setup(p) {
    return () => h('svg', { viewBox: '0 0 24 24', width: p.size, height: p.size, fill: 'none', stroke: 'currentColor', 'stroke-width': p.stroke, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', class: 'icon' },
      [h('path', { d: ICONS[p.name] || ICONS.sparkles })])
  },
}

export const Pet = {
  props: { kind: { type: String, default: 'cow' }, pose: { type: String, default: 'happy' }, size: { type: [Number, String], default: 120 }, label: String, bob: { type: Boolean, default: true } },
  setup(p) {
    const svg = computed(() => p.kind === 'leo' ? leo(p.pose) : p.kind === 'negra' ? negra(p.pose) : cow(p.pose, state.game.accessory))
    const alt = computed(() => p.label || (p.kind === 'leo' ? 'Leo, el gato gris y blanco' : p.kind === 'negra' ? 'Negra, la schnauzer negra' : `La vaquita (${p.pose})`))
    return () => h('svg', { viewBox: '0 0 200 200', width: p.size, height: p.size, role: 'img', 'aria-label': alt.value, class: ['pet', p.bob && 'bob'], innerHTML: svg.value })
  },
}

export const Ring = {
  props: { value: { type: Number, default: 0 }, size: { type: Number, default: 52 }, width: { type: Number, default: 6 }, color: { type: String, default: 'var(--pink-500)' }, label: String },
  setup(p, { slots }) {
    return () => {
      const r = (p.size - p.width) / 2, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, p.value || 0))
      return h('div', { class: 'ring', style: { width: p.size + 'px', height: p.size + 'px' }, role: 'img', 'aria-label': `${p.label || 'Progreso'}: ${Math.round(v)}%` }, [
        h('svg', { viewBox: `0 0 ${p.size} ${p.size}`, width: p.size, height: p.size }, [
          h('circle', { cx: p.size / 2, cy: p.size / 2, r, fill: 'none', stroke: 'var(--track)', 'stroke-width': p.width }),
          h('circle', { cx: p.size / 2, cy: p.size / 2, r, fill: 'none', stroke: p.color, 'stroke-width': p.width, 'stroke-linecap': 'round', 'stroke-dasharray': c, 'stroke-dashoffset': c * (1 - v / 100), transform: `rotate(-90 ${p.size / 2} ${p.size / 2})`, style: 'transition: stroke-dashoffset .6s ease' }),
        ]),
        h('span', { class: 'ring-label' }, slots.default ? slots.default() : `${Math.round(v)}%`),
      ])
    }
  },
}

export const Bar = {
  props: { value: Number, color: { type: String, default: 'var(--pink-500)' } },
  setup(p) { return () => h('div', { class: 'bar' }, [h('i', { style: { width: Math.max(0, Math.min(100, p.value || 0)) + '%', background: p.color } })]) },
}

export const Chip = {
  props: { active: Boolean },
  setup(p, { slots, attrs }) { return () => h('button', { class: ['chip', p.active && 'on'], type: 'button', 'aria-pressed': p.active, ...attrs }, slots.default?.()) },
}

export const Empty = {
  props: { pose: { type: String, default: 'think' }, text: String },
  setup(p, { slots }) { return () => h('div', { class: 'empty' }, [h(Pet, { pose: p.pose, size: 96 }), h('p', p.text), slots.default?.()]) },
}
