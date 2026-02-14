<!-- src/lib/components/Sidebar.svelte -->
<script>
  import { page } from '$app/state';
  import { activeAccount } from '$lib/stores/api';
  
  export let mobile = false;
  export let closeMobile = () => {};

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { href: '/journal', label: 'Journal', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
    { href: '/log', label: 'Log Trade', icon: 'M12 4v16m8-8H4' },
    { href: '/calendar', label: 'Calendar', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { href: '/analytics', label: 'Analytics', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
    { href: '/accounts', label: 'Accounts', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
    { href: '/settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
  ];
</script>

<aside class="sidebar" class:mobile>
  <div class="logo">
    <div class="logo-icon">FX</div>
    <span>TradeJournal</span>
  </div>

  <nav>
    {#each navItems as item}
      <a href={item.href} class="nav-item" class:active={page.url.pathname === item.href} on:click={closeMobile}>
        <svg class="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={item.icon} />
        </svg>
        <span>{item.label}</span>
      </a>
    {/each}
  </nav>

  <div class="account-info">
    <div class="account-dot" style="background: {$activeAccount?.color || 'var(--accent)'}"></div>
    <div class="account-details">
      <div class="account-name">{$activeAccount?.name || 'Loading...'}</div>
      <div class="account-balance">{$activeAccount?.currency || 'USD'} {$activeAccount?.balance?.toLocaleString() || '0'}</div>
    </div>
  </div>
</aside>

<style>
  .sidebar {
    width: 240px;
    background: var(--surface);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    height: 100vh;
    position: fixed;
    left: 0;
    top: 0;
    z-index: 100;
  }

  .sidebar.mobile {
    width: 280px;
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    box-shadow: 10px 0 30px rgba(0,0,0,0.5);
  }

  .logo {
    padding: 30px 24px;
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 18px;
    font-weight: 800;
    background: linear-gradient(to bottom, rgba(0,212,255,0.05), transparent);
  }

  .logo-icon {
    width: 32px;
    height: 32px;
    background: linear-gradient(135deg, var(--accent), var(--accent2));
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    color: white;
  }

  nav {
    flex: 1;
    padding: 0 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-radius: 10px;
    color: var(--muted);
    text-decoration: none;
    font-weight: 500;
    transition: all 0.2s;
  }

  .nav-item:hover {
    background: var(--surface2);
    color: var(--text);
  }

  .nav-item.active {
    background: rgba(0, 212, 255, 0.1);
    color: var(--accent);
  }

  .icon {
    width: 20px;
    height: 20px;
  }

  .account-info {
    margin: 20px 12px;
    padding: 16px;
    background: var(--surface2);
    border-radius: 12px;
    display: flex;
    align-items: center;
    gap: 12px;
    border: 1px solid var(--border);
  }

  .account-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    box-shadow: 0 0 10px currentColor;
  }

  .account-details {
    overflow: hidden;
  }

  .account-name {
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
  }

  .account-balance {
    font-size: 11px;
    color: var(--muted);
    margin-top: 2px;
  }

  @media (max-width: 900px) {
    .sidebar:not(.mobile) {
      display: none;
    }
  }
</style>
