<script setup>
import { NAV } from '../config/nav'
import { go } from '../store/actions'
import { state } from '../store'
import { level } from '../engine/game'
import { Icon, Pet } from '../components/ui'
</script>

<template>
  <div class="stack">
    <div class="card pink row">
      <Pet pose="agenda" :size="84" />
      <div class="grow"><div class="b">{{ state.settings.appName }}</div><div class="small muted">Nivel {{ level().n }} · 🪙 {{ state.game.coins }}</div><div class="tiny muted">Todo está conectado: tareas, agenda, hábitos, aprendizaje y la casita.</div></div>
    </div>
    <template v-for="g in NAV" :key="g.group">
      <div class="sec-title"><h2>{{ g.group }}</h2></div>
      <div class="moregrid">
        <button v-for="it in g.items" :key="it.id" @click="go(it.id)"><span class="ico"><Icon :name="it.icon" /></span>{{ it.label }}</button>
      </div>
    </template>
  </div>
</template>
