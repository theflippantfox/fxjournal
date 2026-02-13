<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import Sidebar from '$lib/components/Sidebar.svelte';
  import Toast from '$lib/components/Toast.svelte';
  import "app.css";
</script>

<div class="app">
  <Sidebar />
  <main class="main">
    <slot />
  </main>
  <Toast />
</div>

<style>
</style>
