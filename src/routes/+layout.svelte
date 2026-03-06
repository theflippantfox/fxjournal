<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { accounts, selectedAccountId, sidebarOpen } from '$lib/stores';
  import type { Account } from '$lib/types';

  let accountList: Account[] = [];
  let selAccId = '';
  let sidebar = true;

  accounts.subscribe(v => accountList = v);
  selectedAccountId.subscribe(v => selAccId = v);
  sidebarOpen.subscribe(v => sidebar = v);

  onMount(async () => {
    const res = await fetch('/api/accounts');
    const data = await res.json();
    accounts.set(data);
    if (data.length > 0) {
      const saved = localStorage.getItem('selectedAccountId');
      const found = data.find((a: Account) => a.id === saved);
      selectedAccountId.set(found ? found.id : data[0].id);
    }
  });

  const navItems = [
    { href: '/', label: 'Dashboard', icon: '📊' },
    { href: '/log', label: 'Trade Log', icon: '📋' },
    { href: '/analytics', label: 'Analytics', icon: '📈' },
    { href: '/advanced-analytics', label: 'Advanced', icon: '🔬' },
    { href: '/calendar', label: 'Calendar', icon: '📅' },
    { href: '/settings', label: 'Settings', icon: '⚙️' }
  ];

  function selectAccount(id: string) {
    selectedAccountId.set(id);
    localStorage.setItem('selectedAccountId', id);
  }

  $: currentAccount = accountList.find(a => a.id === selAccId);
</script>

<div class="flex h-screen overflow-hidden bg-gray-950">
  <!-- Sidebar -->
  <aside class="flex flex-col bg-gray-900 border-r border-gray-800 transition-all duration-300 {sidebar ? 'w-64' : 'w-16'} flex-shrink-0">
    <!-- Logo -->
    <div class="flex items-center gap-3 px-4 py-5 border-b border-gray-800">
      <div class="w-8 h-8 bg-sky-600 rounded-lg flex items-center justify-center text-lg flex-shrink-0">📊</div>
      {#if sidebar}
        <div>
          <div class="font-bold text-white text-sm">Trading Journal</div>
          <div class="text-xs text-gray-500">Pro</div>
        </div>
      {/if}
      <button class="ml-auto text-gray-500 hover:text-gray-300" onclick={() => sidebarOpen.update(v => !v)}>
        {sidebar ? '◀' : '▶'}
      </button>
    </div>

    <!-- Account selector -->
    {#if sidebar && accountList.length > 0}
      <div class="px-4 py-3 border-b border-gray-800">
        <label class="label text-xs">Active Account</label>
        <select class="input text-sm py-1.5" onchange={(e) => selectAccount(e.currentTarget.value)} value={selAccId}>
          {#each accountList as acc}
            <option value={acc.id}>{acc.name}</option>
          {/each}
        </select>
        {#if currentAccount}
          <div class="flex justify-between mt-2 text-xs text-gray-500">
            <span>{currentAccount.broker}</span>
            <span class="{currentAccount.current_balance >= currentAccount.initial_balance ? 'text-emerald-400' : 'text-red-400'}">
              ${currentAccount.current_balance?.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </span>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Nav -->
    <nav class="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
      {#each navItems as item}
        <a href={item.href} class="nav-link {$page.url.pathname === item.href ? 'active' : ''}">
          <span class="text-lg flex-shrink-0">{item.icon}</span>
          {#if sidebar}<span>{item.label}</span>{/if}
        </a>
      {/each}
    </nav>

    <!-- Footer -->
    {#if sidebar}
      <div class="px-4 py-3 border-t border-gray-800 text-xs text-gray-600">
        Powered by Gemini AI + Supabase
      </div>
    {/if}
  </aside>

  <!-- Main content -->
  <main class="flex-1 overflow-y-auto">
    <slot />
  </main>
</div>
