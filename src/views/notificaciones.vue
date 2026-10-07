<script setup>
import { state } from '../store'
import { go } from '../store/actions'
import { Empty, Icon } from '../components/ui'
const ago = (iso) => { const m = Math.round((Date.now() - new Date(iso)) / 60000); return m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} d` }
const readAll = () => state.notifications.forEach((n) => (n.read = true))
</script>

<template>
  <div class="stack">
    <div class="row between"><span class="small muted">{{ state.notifications.filter((n) => !n.read).length }} sin leer</span><button class="link" @click="readAll">Marcar todo como leído</button></div>
    <div class="card" v-if="state.notifications.length"><div class="list">
      <button v-for="n in state.notifications" :key="n.id" class="item" style="all:unset;display:flex;gap:12px;align-items:center;padding:11px 2px;border-bottom:1px solid var(--line);cursor:pointer" @click="n.read = true; n.go && go(n.go)">
        <span class="ico" :class="{ lav: n.read }"><Icon name="bell" :size="17" /></span>
        <div class="grow"><div class="small" :class="{ b: !n.read }">{{ n.text }}</div><div class="tiny muted">{{ ago(n.at) }}</div></div>
      </button>
    </div></div>
    <Empty v-else pose="happy" text="Todo tranquilo por aquí. Te aviso cuando haya algo importante 💗" />
    <button class="btn ghost" @click="go('ajustes')">Configurar notificaciones</button>
  </div>
</template>
