<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { accounts, selectedAccountId, sidebarOpen, theme } from '$lib/stores';
  import type { Account } from '$lib/types';

  let accountList: Account[] = [];
  let selAccId = '';
  let sidebar = true;
  let isDark = true;

  accounts.subscribe(v => accountList = v);
  selectedAccountId.subscribe(v => selAccId = v);
  sidebarOpen.subscribe(v => sidebar = v);
  theme.subscribe(v => {
    isDark = v === 'dark';
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('light', v === 'light');
    }
  });

  onMount(async () => {
    // Restore theme
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (savedTheme) theme.set(savedTheme);

    const res = await fetch('/api/accounts');
    const data = await res.json();
    accounts.set(data);
    if (data.length > 0) {
      const saved = localStorage.getItem('selectedAccountId');
      const found = data.find((a: Account) => a.id === saved);
      selectedAccountId.set(found ? found.id : data[0].id);
    }
  });

  function toggleTheme() {
    theme.update(t => {
      const next = t === 'dark' ? 'light' : 'dark';
      localStorage.setItem('theme', next);
      return next;
    });
  }

  function selectAccount(id: string) {
    selectedAccountId.set(id);
    localStorage.setItem('selectedAccountId', id);
  }

  $: currentAccount = accountList.find(a => a.id === selAccId);
  $: path = $page.url.pathname;

  const navItems = [
    { href: '/',                  label: 'Dashboard', short: 'Home',      icon: 'dashboard' },
    { href: '/log',               label: 'Trade Log', short: 'Log',       icon: 'log' },
    { href: '/analytics',         label: 'Analytics', short: 'Analytics', icon: 'analytics' },
    { href: '/advanced-analytics',label: 'Advanced',  short: 'Advanced',  icon: 'advanced' },
    { href: '/calendar',          label: 'Calendar',  short: 'Calendar',  icon: 'calendar' },
    { href: '/settings',          label: 'Settings',  short: 'Settings',  icon: 'settings' },
  ];
</script>

<div class="flex h-dvh overflow-hidden" style="background: var(--bg)">

  <!-- ── Desktop sidebar ─────────────────────────────────────────────────── -->
  <aside class="hide-mobile flex-shrink-0 flex flex-col transition-all duration-300 {sidebar ? 'w-60' : 'w-[60px]'}"
    style="background: var(--bg2); border-right: 1px solid var(--border);">

    <!-- Logo row -->
    <div class="flex items-center gap-3 px-4 h-[60px] flex-shrink-0" style="border-bottom: 1px solid var(--border)">
      <div class="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
        style="background: linear-gradient(135deg, var(--accent), var(--accent2)); box-shadow: var(--glow-blue)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
        </svg>
      </div>
      {#if sidebar}
        <div class="flex-1 min-w-0">
          <div class="font-bold text-sm truncate" style="color: var(--text)">Trading Journal</div>
          <div class="text-xs" style="color: var(--text3)">Pro</div>
        </div>
      {/if}
      <button onclick={() => sidebarOpen.update(v => !v)}
        class="w-7 h-7 rounded-lg flex items-center justify-center transition-colors flex-shrink-0"
        style="color: var(--text3)" onmouseenter={e => (e.currentTarget.style.color = 'var(--text)')}
        onmouseleave={e => (e.currentTarget.style.color = 'var(--text3)')}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          {#if sidebar}<path d="M15 18l-6-6 6-6"/>{:else}<path d="M9 18l6-6-6-6"/>{/if}
        </svg>
      </button>
    </div>

    <!-- Account pill -->
    {#if sidebar && accountList.length > 0}
      <div class="px-3 py-2.5" style="border-bottom: 1px solid var(--border)">
        <select class="input text-xs py-1.5" onchange={e => selectAccount(e.currentTarget.value)} value={selAccId}>
          {#each accountList as acc}
            <option value={acc.id}>{acc.name}</option>
          {/each}
        </select>
        {#if currentAccount}
          <div class="flex justify-between items-center mt-1.5 px-0.5">
            <span class="text-xs" style="color: var(--text3)">{currentAccount.broker}</span>
            <span class="text-xs font-semibold font-mono {currentAccount.current_balance >= currentAccount.initial_balance ? 'pnl-positive' : 'pnl-negative'}">
              ₹{currentAccount.current_balance?.toLocaleString('en-IN', {maximumFractionDigits: 0})}
            </span>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Nav -->
    <nav class="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
      {#each navItems as item}
        <a href={item.href} class="nav-link {path === item.href ? 'active' : ''}">
          <span class="flex-shrink-0 w-5 h-5 flex items-center justify-center">
            <NavIcon name={item.icon} size={18} active={path === item.href} />
          </span>
          {#if sidebar}<span class="truncate">{item.label}</span>{/if}
        </a>
      {/each}
    </nav>

    <!-- Theme toggle + footer -->
    <div class="px-3 py-3" style="border-top: 1px solid var(--border)">
      {#if sidebar}
        <button onclick={toggleTheme}
          class="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors"
          style="color: var(--text2)"
          onmouseenter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
          onmouseleave={e => (e.currentTarget.style.background = 'transparent')}>
          <span class="text-base">{isDark ? '☀️' : '🌙'}</span>
          <span class="text-sm">{isDark ? 'Light mode' : 'Dark mode'}</span>
        </button>
      {:else}
        <button onclick={toggleTheme} class="w-full flex justify-center py-2" style="color: var(--text2)">
          {isDark ? '☀️' : '🌙'}
        </button>
      {/if}
    </div>
  </aside>

  <!-- ── Main content ─────────────────────────────────────────────────────── -->
  <div class="flex-1 flex flex-col overflow-hidden">

    <!-- Mobile top bar -->
    <header class="hide-desktop flex items-center justify-between px-4 h-14 flex-shrink-0"
      style="background: var(--bg2); border-bottom: 1px solid var(--border)">
      <div class="flex items-center gap-2.5">
        <div class="w-7 h-7 rounded-lg flex items-center justify-center"
          style="background: linear-gradient(135deg, var(--accent), var(--accent2))">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
            <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
          </svg>
        </div>
        <span class="font-bold text-sm" style="color: var(--text)">Trading Journal</span>
      </div>
      <div class="flex items-center gap-2">
        <!-- Account selector compact -->
        {#if accountList.length > 0}
          <select class="text-xs rounded-lg px-2 py-1.5 font-medium"
            style="background: var(--surface); border: 1px solid var(--border); color: var(--text); max-width: 120px"
            onchange={e => selectAccount(e.currentTarget.value)} value={selAccId}>
            {#each accountList as acc}
              <option value={acc.id}>{acc.name}</option>
            {/each}
          </select>
        {/if}
        <button onclick={toggleTheme}
          class="w-8 h-8 rounded-lg flex items-center justify-center"
          style="background: var(--surface); border: 1px solid var(--border)">
          <span class="text-sm">{isDark ? '☀️' : '🌙'}</span>
        </button>
      </div>
    </header>

    <!-- Page content -->
    <main class="flex-1 overflow-y-auto">
      <slot />
    </main>

    <!-- ── Mobile bottom nav ────────────────────────────────────────────── -->
    <nav class="hide-desktop flex-shrink-0 flex items-center"
      style="background: var(--bg2); border-top: 1px solid var(--border); height: var(--nav-h); padding: 0 0.25rem; padding-bottom: env(safe-area-inset-bottom)">
      {#each navItems as item}
        <a href={item.href} class="nav-link-bottom {path === item.href ? 'active' : ''}">
          <NavIcon name={item.icon} size={20} active={path === item.href} />
          <span>{item.short}</span>
        </a>
      {/each}
    </nav>
  </div>
</div>

<!-- SVG icon component inline -->
<script context="module">
</script>

{#snippet NavIcon({ name, size, active }: { name: string; size: number; active: boolean })}
  {@const s = size ?? 20}
  {@const c = active ? 'var(--accent)' : 'var(--text2)'}
  {#if name === 'dashboard'}
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
      <rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>
    </svg>
  {:else if name === 'log'}
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/>
    </svg>
  {:else if name === 'analytics'}
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  {:else if name === 'advanced'}
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
    </svg>
  {:else if name === 'calendar'}
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  {:else if name === 'settings'}
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
    </svg>
  {/if}
{/snippet}
