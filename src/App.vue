<script setup>
import { RouterView } from 'vue-router'
</script>

<template>
  <header>
    <div class="wrapper">
      <h1>LED Wall Builder <span class="pro">PRO</span></h1>
    </div>
  </header>

  <RouterView />
</template>

<style>
/* Global Styles */
body {
  background-color: #181818;
  font-family: 'Segoe UI', sans-serif;
  margin: 0;
  padding: 20px;
}

header {
  text-align: center;
  margin-bottom: 40px;
  color: white;
}

.pro {
  background: #00e676;
  color: black;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.5em;
  vertical-align: middle;
}
</style>