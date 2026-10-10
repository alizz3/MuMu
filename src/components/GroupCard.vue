<script setup>
// Tarjeta de grupo plegable, igual a las de Tareas: cuadrito de color con ícono, título, contador y flechita.
import { computed } from 'vue'
import { Icon } from './ui'
const props = defineProps({
  title: { type: String, default: '' }, sub: { type: String, default: '' }, icon: { type: String, default: 'list' }, color: { type: String, default: '#E7E1EE' },
  count: { type: [Number, String], default: null }, open: { type: Boolean, default: true }, wrap: { type: Boolean, default: false }, tight: { type: Boolean, default: false },
})
const emit = defineEmits(['toggle'])
const tint = computed(() => ({ background: `color-mix(in srgb, ${props.color} 38%, var(--surface))`, color: 'var(--ink)' }))
</script>

<template>
  <section class="card grp" :class="{ tightp: tight, wrapt: wrap }">
    <button type="button" class="grp-head" :aria-expanded="open" @click="emit('toggle')">
      <slot name="lead"><span class="gico" :style="tint"><Icon :name="icon" :size="16" /></span></slot>
      <div class="grow grp-t">
        <slot name="title"><h3>{{ title }}</h3></slot>
        <div v-if="sub || $slots.sub" class="tiny muted grp-sub"><slot name="sub">{{ sub }}</slot></div>
      </div>
      <slot name="badge"><span v-if="count != null" class="badge">{{ count }}</span></slot>
      <Icon name="chev" :size="16" class="muted chev" :class="{ on: open }" />
    </button>
    <div v-if="open" class="grp-body"><slot /></div>
  </section>
</template>

<style scoped>
.grp { padding-top: 12px; padding-bottom: 12px; }
.grp-head { display: flex; align-items: center; gap: 10px; width: 100%; border: 0; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; padding: 0; }
.grp-t { min-width: 0; }
.grp-head h3, .grp-t :deep(h3) { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wrapt .grp-head h3 { white-space: normal; overflow-wrap: anywhere; }
.grp-sub { overflow: hidden; text-overflow: ellipsis; }
.gico { width: 30px; height: 30px; border-radius: 10px; display: grid; place-items: center; flex: none; }
.chev { flex: none; transition: transform .2s; }
.chev.on { transform: rotate(90deg); }
.grp-body { margin-top: 8px; }
</style>
