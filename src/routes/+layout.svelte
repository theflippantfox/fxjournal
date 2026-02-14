<!-- src/routes/+layout.svelte -->
<script>
  import { onMount } from 'svelte';
  import { initializeData, isLoading } from '$lib/stores/api';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import "../app.css"

  let isMobileMenuOpen = false;

  onMount(() => {
    initializeData();
  });

  function toggleMobileMenu() {
    isMobileMenuOpen = !isMobileMenuOpen;
  }
</script>

{#if $isLoading}
  <div class="loading-screen">
    <div class="spinner"></div>
    <p>Loading your trading journal...</p>
  </div>
{:else}
  <div class="app">
    <Sidebar />
    
    <!-- Mobile Header -->
    <header class="mobile-header">
      <button class="hamburger" on:click={toggleMobileMenu} aria-label="Toggle Menu">
        <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <div class="mobile-logo">FX</div>
    </header>

    {#if isMobileMenuOpen}
      <div class="mobile-menu-overlay" on:click={toggleMobileMenu}>
        <Sidebar mobile={true} closeMobile={toggleMobileMenu} />
      </div>
    {/if}

    <main class="main">
      <slot />
    </main>
  </div>
{/if}

<style>
  .app {
    display: flex;
    min-height: 100vh;
  }

  .main {
    flex: 1;
    margin-left: 240px;
    padding: 28px;
    width: calc(100% - 240px);
  }

  .mobile-header {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 60px;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    padding: 0 16px;
    align-items: center;
    justify-content: space-between;
    z-index: 90;
  }

  .hamburger {
    background: transparent;
    border: none;
    color: var(--text);
    cursor: pointer;
    padding: 8px;
  }

  .mobile-logo {
    width: 32px;
    height: 32px;
    background: linear-gradient(135deg, var(--accent), var(--accent2));
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    color: white;
    font-weight: 800;
  }

  .mobile-menu-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    z-index: 150;
  }

  .loading-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    background: var(--bg);
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

  @media (max-width: 900px) {
    .main {
      margin-left: 0;
      width: 100%;
      padding-top: 80px;
    }

    .mobile-header {
      display: flex;
    }
  }
</style>
