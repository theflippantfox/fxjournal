<!-- src/lib/components/Sidebar.svelte -->
<script>
  import { page } from '$app/stores';
  import { accounts, activeAccountId, activeAccount } from '$lib/stores/index.js';

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: 'grid' },
    { path: '/log',       label: 'Log Trade',  icon: 'plus' },
    { path: '/journal',   label: 'Trade Log',  icon: 'file' },
    { path: '/analytics', label: 'Analytics',  icon: 'chart' },
    { path: '/calendar',  label: 'Calendar',   icon: 'calendar' },
    { path: '/accounts',  label: 'Accounts',   icon: 'wallet' },
    { path: '/settings',  label: 'Settings',   icon: 'settings' },
  ];

  function switchAccount(id) { $activeAccountId = id; }
</script>

<aside class="sidebar">
  <div class="logo">
    <h1>FX Journal</h1>
    <p>Trading Analytics</p>
  </div>

  <!-- Account quick-switcher -->
  <div class="acct-section">
    <div class="acct-label">ACCOUNT</div>
    <div class="acct-current">
      <div class="acct-dot" style="background:{$activeAccount?.color ?? '#00d4ff'}"></div>
      <span class="acct-name">{$activeAccount?.name ?? '—'}</span>
    </div>
    {#if $accounts.length > 1}
      <div class="acct-list">
        {#each $accounts.filter(a => a.id !== $activeAccountId) as acct}
          <button class="acct-switch" on:click={() => switchAccount(acct.id)}>
            <div class="acct-dot sm" style="background:{acct.color}"></div>
            {acct.name}
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <nav>
    {#each navItems as item}
      <a href={item.path} class="nav-item" class:active={$page.url.pathname === item.path || $page.url.pathname.startsWith(item.path + '/')}>
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          {#if item.icon === 'grid'}
            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
          {:else if item.icon === 'plus'}
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          {:else if item.icon === 'file'}
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14,2 14,8 20,8"/>
          {:else if item.icon === 'chart'}
            <polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/>
          {:else if item.icon === 'calendar'}
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          {:else if item.icon === 'wallet'}
            <rect x="1" y="4" width="22" height="16" rx="2"/>
            <path d="M1 10h22"/><circle cx="17" cy="15" r="1" fill="currentColor"/>
          {:else if item.icon === 'settings'}
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          {/if}
        </svg>
        <span>{item.label}</span>
      </a>
    {/each}
  </nav>
</aside>

<style>
  .sidebar {
    width: 220px; background: var(--surface); border-right: 1px solid var(--border);
    display: flex; flex-direction: column; padding: 24px 0;
    position: fixed; top: 0; left: 0; bottom: 0; z-index: 100;
    overflow-y: auto;
  }
  .logo { padding: 0 20px 20px; border-bottom: 1px solid var(--border); margin-bottom: 0; }
  .logo h1 {
    font-size: 18px; font-weight: 700; letter-spacing: -0.5px;
    background: linear-gradient(135deg, var(--accent), var(--accent2));
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  }
  .logo p { font-size: 11px; color: var(--muted); margin-top: 2px; }

  .acct-section {
    padding: 12px 20px; border-bottom: 1px solid var(--border); margin-bottom: 8px;
  }
  .acct-label { font-size: 10px; color: var(--muted); font-weight: 700; letter-spacing: 0.8px; margin-bottom: 6px; }
  .acct-current { display: flex; align-items: center; gap: 7px; }
  .acct-name { font-size: 13px; font-weight: 600; color: var(--text); }
  .acct-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .acct-dot.sm { width: 6px; height: 6px; }
  .acct-list { margin-top: 6px; display: flex; flex-direction: column; gap: 2px; }
  .acct-switch {
    display: flex; align-items: center; gap: 6px; padding: 4px 0;
    background: none; border: none; color: var(--muted); cursor: pointer;
    font-size: 12px; text-align: left; transition: color 0.15s;
  }
  .acct-switch:hover { color: var(--text); }

  .nav-item {
    display: flex; align-items: center; gap: 10px; padding: 10px 20px;
    color: var(--muted); transition: all 0.2s; font-size: 13px;
    border-left: 3px solid transparent; text-decoration: none;
  }
  .nav-item:hover { color: var(--text); background: var(--surface2); }
  .nav-item.active { color: var(--accent); background: rgba(0,212,255,0.07); border-left-color: var(--accent); }
  .nav-item svg { width: 16px; height: 16px; flex-shrink: 0; }
</style>
