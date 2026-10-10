<script setup>
// Acceso al Día de U (horarios, maleta y alarmas) desde Rutinas y Universidad
import { computed } from 'vue'
import { ui } from '../store'
import * as A from '../store/actions'
import { Icon } from './ui'
import { uniTimes, uniPlan, BAG } from '../services/device'
import { dayKey, addDays, relDay, fmt12 } from '../engine/time'

const next = computed(() => {
  void ui.now
  for (let i = 0; i < 21; i++) {
    const k = dayKey(addDays(new Date(), i)), u = uniTimes(k)
    if (u && (i > 0 || u.home > ui.now.getHours() * 60 + ui.now.getMinutes())) return { k, i, ...u, bag: BAG.filter(([id]) => uniPlan().bag[k]?.[id]).length }
  }
  return null
})
const cuando = computed(() => { const r = relDay(next.value.k); return r[0].toUpperCase() + r.slice(1) })
</script>

<template>
  <button class="card row diau" @click="A.go('plan')">
    <span class="gico" style="background:color-mix(in srgb,#C3B3D4 40%,var(--surface))"><Icon name="alarm" :size="18" /></span>
    <div class="grow">
      <b class="small">Día de U, maleta y alarmas</b>
      <div v-if="next" class="tiny muted">{{ cuando }}: sal a las {{ fmt12(next.leave) }} · levántate {{ fmt12(next.wake) }}<template v-if="next.i === 1"> · maleta {{ next.bag }}/{{ BAG.length }}</template></div>
      <div v-else class="tiny muted">Tus horarios de salida, la maleta de la noche anterior y la alarma con tu canción</div>
    </div>
    <Icon name="chev" :size="16" class="muted" />
  </button>
</template>

<style scoped>
.diau { gap: 10px; width: 100%; text-align: left; border: 0; font: inherit; color: inherit; cursor: pointer; }
</style>
