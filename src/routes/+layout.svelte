<!-- src/routes/+layout.svelte -->
<script>
  import { onMount } from 'svelte';
  import { initializeData, isLoading } from '$lib/stores/api';
  import '../app.css';

  onMount(() => {
    initializeData();
  });
</script>

{#if $isLoading}
  <div class="loading-screen">
    <div class="spinner"></div>
    <p>Loading your trading journal...</p>
  </div>
{:else}
  <slot />
{/if}

<style>
  .loading-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    background: var(--background);
  }
  
  .spinner {
    width: 48px;
    height: 48px;
    border: 4px solid var(--surface2);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .loading-screen p {
    margin-top: 16px;
    color: var(--muted);
    font-size: 14px;
  }
</style>
