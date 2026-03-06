<script lang="ts">
  import { onMount } from "svelte";
  import { accounts, selectedAccountId } from "$lib/stores";
  import type { Account, Strategy } from "$lib/types";

  let accountList: Account[] = [];
  let strategies: Strategy[] = [];
  let showAccountModal = false;
  let showStrategyModal = false;
  let editingAccount: Partial<Account> | null = null;
  let editingStrategy: Partial<Strategy> | null = null;
  let activeTab = "accounts";
  let newChecklistItem = { text: "", category: "pre-trade", required: false };

  accounts.subscribe((v) => (accountList = v));

  onMount(async () => {
    const s = await fetch("/api/strategies").then((r) => r.json());
    strategies = s;
  });

  const indianBrokers = [
    "Zerodha",
    "Upstox",
    "Angel One",
    "Groww",
    "ICICI Direct",
    "HDFC Securities",
    "5paisa",
    "Kotak Securities",
    "Sharekhan",
    "Motilal Oswal",
    "Dhan",
    "Fyers",
    "Paytm Money",
    "Edelweiss",
    "Other",
  ];

  const marketSegments = [
    { value: "NSE-EQ", label: "NSE — Equity (Cash)" },
    { value: "BSE-EQ", label: "BSE — Equity (Cash)" },
    { value: "NFO", label: "NSE — F&O (Futures & Options)" },
    { value: "BFO", label: "BSE — F&O" },
    { value: "MCX", label: "MCX — Commodities" },
    { value: "NSE-CDS", label: "NSE — Currency Derivatives" },
    { value: "MULTI", label: "Multi-segment" },
  ];

  function openNewAccount() {
    editingAccount = {
      type: "live",
      currency: "INR",
      active: true,
      initial_balance: 100000,
    };
    showAccountModal = true;
  }

  function editAccount(acc: Account) {
    editingAccount = { ...acc };
    showAccountModal = true;
  }

  async function saveAccount() {
    const method = editingAccount!.id ? "PUT" : "POST";
    const body = { ...editingAccount };
    if (!body.id) body.current_balance = body.initial_balance;
    const res = await fetch("/api/accounts", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const saved = await res.json();
    if (editingAccount!.id) {
      accounts.update((list) =>
        list.map((a) => (a.id === saved.id ? saved : a)),
      );
    } else {
      accounts.update((list) => [...list, saved]);
    }
    showAccountModal = false;
  }

  async function deleteAccount(id: string) {
    if (!confirm("Delete this account and all its trades?")) return;
    await fetch("/api/accounts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    accounts.update((list) => list.filter((a) => a.id !== id));
  }

  function openNewStrategy() {
    editingStrategy = {
      active: true,
      target_rr: 2,
      timeframes: [],
      markets: [],
      checklist_items: [],
    };
    showStrategyModal = true;
  }

  function editStrategy(s: Strategy) {
    editingStrategy = {
      ...s,
      checklist_items: JSON.parse(JSON.stringify(s.checklist_items || [])),
    };
    showStrategyModal = true;
  }

  async function saveStrategy() {
    const method = editingStrategy!.id ? "PUT" : "POST";
    const res = await fetch("/api/strategies", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editingStrategy),
    });
    const saved = await res.json();
    if (editingStrategy!.id) {
      strategies = strategies.map((s) => (s.id === saved.id ? saved : s));
    } else {
      strategies = [...strategies, saved];
    }
    showStrategyModal = false;
  }

  async function deleteStrategy(id: string) {
    if (!confirm("Delete this strategy?")) return;
    await fetch("/api/strategies", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    strategies = strategies.filter((s) => s.id !== id);
  }

  function addChecklistItem() {
    if (!newChecklistItem.text.trim()) return;
    editingStrategy = {
      ...editingStrategy!,
      checklist_items: [
        ...(editingStrategy!.checklist_items ?? []),
        { ...newChecklistItem, id: crypto.randomUUID() },
      ],
    };
    newChecklistItem = { text: "", category: "pre-trade", required: false };
  }

  function fmtBalance(amount: number, currency: string) {
    if (currency === "INR") {
      return (
        "₹" +
        amount?.toLocaleString("en-IN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      );
    }
    const symbols: Record<string, string> = {
      USD: "$",
      EUR: "€",
      GBP: "£",
      JPY: "¥",
    };
    return (symbols[currency] ?? currency + " ") + amount?.toLocaleString();
  }

  function brokerPlaceholder(currency: string) {
    return currency === "INR"
      ? "e.g. Zerodha, Upstox, Angel One"
      : "e.g. IC Markets, IBKR";
  }
</script>

<div class="p-6 space-y-6">
  <h1 class="text-2xl font-bold text-white">Settings</h1>

  <!-- Tabs -->
  <div class="flex gap-2 border-b border-gray-800">
    <button
      class="px-4 py-2 text-sm font-medium transition-colors {activeTab ===
      'accounts'
        ? 'text-sky-400 border-b-2 border-sky-400'
        : 'text-gray-500 hover:text-gray-300'}"
      onclick={() => (activeTab = "accounts")}>Accounts</button
    >
    <button
      class="px-4 py-2 text-sm font-medium transition-colors {activeTab ===
      'strategies'
        ? 'text-sky-400 border-b-2 border-sky-400'
        : 'text-gray-500 hover:text-gray-300'}"
      onclick={() => (activeTab = "strategies")}>Strategies</button
    >
  </div>

  <!-- Accounts tab -->
  {#if activeTab === "accounts"}
    <div class="flex justify-end">
      <button class="btn-primary btn-sm" onclick={openNewAccount}
        >+ New Account</button
      >
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      {#each accountList as acc}
        {@const growth =
          (acc.current_balance ?? acc.initial_balance) - acc.initial_balance}
        {@const growthPct =
          acc.initial_balance > 0 ? (growth / acc.initial_balance) * 100 : 0}
        <div class="card">
          <div class="flex items-start justify-between mb-3">
            <div>
              <h3 class="font-semibold text-white">{acc.name}</h3>
              <p class="text-sm text-gray-500">
                {acc.broker} · {acc.account_number}
              </p>
            </div>
            <div class="flex items-center gap-2">
              {#if acc.currency === "INR"}
                <span
                  class="badge bg-orange-900/40 text-orange-400 border border-orange-800/40"
                  >🇮🇳 INR</span
                >
              {/if}
              <span
                class="badge {acc.type === 'live'
                  ? 'bg-red-900/50 text-red-400 border border-red-800/40'
                  : acc.type === 'demo'
                    ? 'bg-sky-900/50 text-sky-400 border border-sky-800/40'
                    : 'bg-gray-800 text-gray-400 border border-gray-700'}"
                >{acc.type}</span
              >
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2 text-sm mb-3">
            <div>
              <span class="text-gray-500 text-xs block mb-0.5"
                >Initial Capital</span
              >
              <span class="text-gray-300 font-medium"
                >{fmtBalance(acc.initial_balance, acc.currency)}</span
              >
            </div>
            <div>
              <span class="text-gray-500 text-xs block mb-0.5"
                >Current Balance</span
              >
              <span
                class="{growth >= 0
                  ? 'text-emerald-400'
                  : 'text-red-400'} font-semibold"
                >{fmtBalance(acc.current_balance, acc.currency)}</span
              >
            </div>
          </div>
          <div
            class="mb-3 text-xs {growth >= 0
              ? 'text-emerald-400'
              : 'text-red-400'}"
          >
            {growth >= 0 ? "▲" : "▼"}
            {Math.abs(growthPct).toFixed(2)}% ({growth >= 0
              ? "+"
              : ""}{fmtBalance(growth, acc.currency)})
          </div>
          <div class="flex gap-2">
            <button
              class="btn-secondary btn-sm"
              onclick={() => editAccount(acc)}>Edit</button
            >
            <button
              class="btn-danger btn-sm"
              onclick={() => deleteAccount(acc.id)}>Delete</button
            >
          </div>
        </div>
      {/each}
      {#if accountList.length === 0}
        <div class="card col-span-2 text-center py-12">
          <p class="text-gray-400 mb-4">
            No accounts yet. Create your first account to start logging trades.
          </p>
          <button class="btn-primary" onclick={openNewAccount}
            >Create Account</button
          >
        </div>
      {/if}
    </div>
  {/if}

  <!-- Strategies tab -->
  {#if activeTab === "strategies"}
    <div class="flex justify-end">
      <button class="btn-primary btn-sm" onclick={openNewStrategy}
        >+ New Strategy</button
      >
    </div>
    <div class="space-y-3">
      {#each strategies as strat}
        <div class="card">
          <div class="flex items-start justify-between mb-2">
            <div>
              <h3 class="font-semibold text-white">{strat.name}</h3>
              <p class="text-sm text-gray-500">{strat.description}</p>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-sm text-sky-400"
                >Target R:R {strat.target_rr}</span
              >
              <span
                class="badge {strat.active
                  ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-800/40'
                  : 'bg-gray-800 text-gray-500 border border-gray-700'}"
                >{strat.active ? "Active" : "Inactive"}</span
              >
            </div>
          </div>
          <div class="text-xs text-gray-500 mb-3">
            {strat.checklist_items?.length ?? 0} checklist items
          </div>
          <div class="flex gap-2">
            <button
              class="btn-secondary btn-sm"
              onclick={() => editStrategy(strat)}>Edit</button
            >
            <button
              class="btn-danger btn-sm"
              onclick={() => deleteStrategy(strat.id)}>Delete</button
            >
          </div>
        </div>
      {/each}
      {#if strategies.length === 0}
        <div class="card text-center py-12">
          <p class="text-gray-400 mb-4">
            No strategies yet. Define your trading strategies with checklists.
          </p>
          <button class="btn-primary" onclick={openNewStrategy}
            >Create Strategy</button
          >
        </div>
      {/if}
    </div>
  {/if}
</div>

<!-- Account Modal -->
{#if showAccountModal && editingAccount}
  <div
    class="modal-backdrop"
    onclick={(e) => e.target === e.currentTarget && (showAccountModal = false)}
  >
    <div class="modal max-w-lg">
      <div
        class="flex items-center justify-between px-6 py-4 border-b border-gray-800"
      >
        <h2 class="text-lg font-semibold text-white">
          {editingAccount.id ? "Edit Account" : "New Account"}
        </h2>
        <button
          class="text-gray-500 hover:text-gray-300"
          onclick={() => (showAccountModal = false)}>✕</button
        >
      </div>
      <div class="p-6 space-y-4">
        <!-- Currency toggle at top — most important choice -->
        <div>
          <label class="label">Base Currency *</label>
          <div class="grid grid-cols-2 gap-2">
            <button
              class="flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-all
                {editingAccount.currency === 'INR'
                ? 'bg-orange-900/30 border-orange-600 text-orange-300'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'}"
              onclick={() =>
                (editingAccount = {
                  ...editingAccount!,
                  currency: "INR",
                  initial_balance: editingAccount!.initial_balance ?? 100000,
                })}
            >
              🇮🇳 Indian Rupee (₹ INR)
            </button>
            <button
              class="flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-all
                {editingAccount.currency !== 'INR'
                ? 'bg-sky-900/30 border-sky-600 text-sky-300'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'}"
              onclick={() =>
                (editingAccount = {
                  ...editingAccount!,
                  currency: "USD",
                  initial_balance: editingAccount!.initial_balance ?? 10000,
                })}
            >
              🌍 Other Currency
            </button>
          </div>
          {#if editingAccount.currency !== "INR"}
            <select
              class="input mt-2 text-sm"
              bind:value={editingAccount.currency}
            >
              <option value="USD">🇺🇸 USD — US Dollar</option>
              <option value="EUR">🇪🇺 EUR — Euro</option>
              <option value="GBP">🇬🇧 GBP — British Pound</option>
              <option value="JPY">🇯🇵 JPY — Japanese Yen</option>
              <option value="SGD">🇸🇬 SGD — Singapore Dollar</option>
              <option value="AUD">🇦🇺 AUD — Australian Dollar</option>
            </select>
          {/if}
        </div>

        <!-- Account name -->
        <div>
          <label class="label">Account Name *</label>
          <input
            class="input"
            placeholder={editingAccount.currency === "INR"
              ? "e.g. Zerodha Trading, Upstox F&O"
              : "e.g. Live Forex Account"}
            bind:value={editingAccount.name}
          />
        </div>

        <!-- Broker -->
        <div>
          <label class="label">Broker / Platform</label>
          {#if editingAccount.currency === "INR"}
            <select class="input" bind:value={editingAccount.broker}>
              <option value="">Select broker</option>
              {#each indianBrokers as b}<option value={b}>{b}</option>{/each}
            </select>
          {:else}
            <input
              class="input"
              placeholder="e.g. IC Markets, Interactive Brokers"
              bind:value={editingAccount.broker}
            />
          {/if}
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="label">Account / Client ID</label>
            <input
              class="input"
              placeholder={editingAccount.currency === "INR"
                ? "e.g. ZY1234"
                : "Account number"}
              bind:value={editingAccount.account_number}
            />
          </div>
          <div>
            <label class="label">Account Type</label>
            <select class="input" bind:value={editingAccount.type}>
              <option value="live">🔴 Live / Real Money</option>
              <option value="demo">🔵 Demo / Virtual</option>
              <option value="paper">📄 Paper Trading</option>
            </select>
          </div>
        </div>

        <!-- Market segment (India only) -->
        {#if editingAccount.currency === "INR"}
          <div>
            <label class="label">Market Segment</label>
            <select class="input" bind:value={(editingAccount as any).segment}>
              <option value="">Select segment</option>
              {#each marketSegments as seg}
                <option value={seg.value}>{seg.label}</option>
              {/each}
            </select>
          </div>
        {/if}

        <!-- Initial balance -->
        <div>
          <label class="label">
            Initial Capital ({editingAccount.currency === "INR"
              ? "₹"
              : editingAccount.currency}) *
          </label>
          <div class="relative">
            <span
              class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium"
            >
              {editingAccount.currency === "INR"
                ? "₹"
                : editingAccount.currency}
            </span>
            <input
              class="input pl-10"
              type="number"
              step="any"
              placeholder={editingAccount.currency === "INR"
                ? "1,00,000"
                : "10,000"}
              bind:value={editingAccount.initial_balance}
            />
          </div>
          {#if editingAccount.currency === "INR" && editingAccount.initial_balance}
            <p class="text-xs text-gray-500 mt-1">
              = ₹{Number(editingAccount.initial_balance).toLocaleString(
                "en-IN",
              )}
            </p>
          {/if}
        </div>

        <!-- Quick amount buttons for INR -->
        {#if editingAccount.currency === "INR"}
          <div>
            <label class="label text-xs">Quick amounts</label>
            <div class="flex flex-wrap gap-2">
              {#each [25000, 50000, 100000, 200000, 500000, 1000000] as amt}
                <button
                  class="text-xs px-3 py-1.5 rounded-lg border transition-colors
                    {editingAccount.initial_balance === amt
                    ? 'bg-sky-900/40 border-sky-600 text-sky-300'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'}"
                  onclick={() =>
                    (editingAccount = {
                      ...editingAccount!,
                      initial_balance: amt,
                    })}
                >
                  ₹{amt >= 100000 ? amt / 100000 + "L" : amt / 1000 + "K"}
                </button>
              {/each}
            </div>
          </div>
        {/if}
      </div>
      <div class="flex justify-end gap-3 px-6 py-4 border-t border-gray-800">
        <button class="btn-secondary" onclick={() => (showAccountModal = false)}
          >Cancel</button
        >
        <button class="btn-primary" onclick={saveAccount}>Save Account</button>
      </div>
    </div>
  </div>
{/if}

<!-- Strategy Modal -->
{#if showStrategyModal && editingStrategy}
  <div
    class="modal-backdrop"
    onclick={(e) => e.target === e.currentTarget && (showStrategyModal = false)}
  >
    <div class="modal max-w-2xl">
      <div
        class="flex items-center justify-between px-6 py-4 border-b border-gray-800"
      >
        <h2 class="text-lg font-semibold text-white">
          {editingStrategy.id ? "Edit Strategy" : "New Strategy"}
        </h2>
        <button
          class="text-gray-500 hover:text-gray-300"
          onclick={() => (showStrategyModal = false)}>✕</button
        >
      </div>
      <div class="p-6 space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="label">Strategy Name *</label>
            <input
              class="input"
              placeholder="e.g. London Breakout"
              bind:value={editingStrategy.name}
            />
          </div>
          <div>
            <label class="label">Target R:R</label>
            <input
              class="input"
              type="number"
              step="0.1"
              bind:value={editingStrategy.target_rr}
            />
          </div>
        </div>
        <div>
          <label class="label">Description</label>
          <input
            class="input"
            placeholder="Brief overview"
            bind:value={editingStrategy.description}
          />
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="label">Setup (when is it valid?)</label>
            <textarea
              class="input min-h-[70px]"
              bind:value={editingStrategy.setup}
            ></textarea>
          </div>
          <div>
            <label class="label">Entry Rules</label>
            <textarea
              class="input min-h-[70px]"
              bind:value={editingStrategy.entry}
            ></textarea>
          </div>
          <div>
            <label class="label">Exit Rules</label>
            <textarea
              class="input min-h-[70px]"
              bind:value={editingStrategy.exit}
            ></textarea>
          </div>
          <div>
            <label class="label">Stop Loss Rules</label>
            <textarea
              class="input min-h-[70px]"
              bind:value={editingStrategy.stop_loss}
            ></textarea>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="label">Timeframes (comma-separated)</label>
            <input
              class="input"
              placeholder="1m, 5m, 15m, 1h, Daily"
              value={editingStrategy.timeframes?.join(", ")}
              oninput={(e) =>
                (editingStrategy = {
                  ...editingStrategy!,
                  timeframes: e.currentTarget.value
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean),
                })}
            />
          </div>
          <div>
            <label class="label">Markets / Instruments</label>
            <input
              class="input"
              placeholder="NIFTY50, BANKNIFTY, RELIANCE, TCS"
              value={editingStrategy.markets?.join(", ")}
              oninput={(e) =>
                (editingStrategy = {
                  ...editingStrategy!,
                  markets: e.currentTarget.value
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean),
                })}
            />
          </div>
        </div>

        <!-- Checklist items -->
        <div>
          <label class="label">Checklist Items</label>
          <div class="space-y-2 mb-3">
            {#each editingStrategy.checklist_items ?? [] as item}
              <div
                class="flex items-center gap-3 p-2 bg-gray-800/40 rounded-lg"
              >
                <span class="text-sm text-gray-300 flex-1">{item.text}</span>
                <span
                  class="badge text-xs {item.category === 'pre-trade'
                    ? 'bg-blue-900/40 text-blue-400'
                    : item.category === 'during-trade'
                      ? 'bg-yellow-900/40 text-yellow-400'
                      : 'bg-gray-800 text-gray-400'}">{item.category}</span
                >
                {#if item.required}<span class="text-red-400 text-xs">*req</span
                  >{/if}
                <button
                  class="text-gray-600 hover:text-red-400"
                  onclick={() => removeChecklistItem(item.id)}>✕</button
                >
              </div>
            {/each}
          </div>
          <div class="flex gap-2 items-end">
            <div class="flex-1">
              <input
                class="input text-sm"
                placeholder="e.g. Confirm trend on HTF"
                bind:value={newChecklistItem.text}
              />
            </div>
            <select
              class="input w-36 text-sm"
              bind:value={newChecklistItem.category}
            >
              <option value="pre-trade">Pre-trade</option>
              <option value="during-trade">During</option>
              <option value="post-trade">Post-trade</option>
            </select>
            <label
              class="flex items-center gap-1 text-sm text-gray-400 cursor-pointer"
            >
              <input type="checkbox" bind:checked={newChecklistItem.required} />
              Req.
            </label>
            <button
              class="btn-secondary btn-sm flex-shrink-0"
              onclick={addChecklistItem}>+ Add</button
            >
          </div>
        </div>

        <label class="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" bind:checked={editingStrategy.active} />
          <span class="text-gray-300">Active strategy</span>
        </label>
      </div>
      <div class="flex justify-end gap-3 px-6 py-4 border-t border-gray-800">
        <button
          class="btn-secondary"
          onclick={() => (showStrategyModal = false)}>Cancel</button
        >
        <button class="btn-primary" onclick={saveStrategy}>Save Strategy</button
        >
      </div>
    </div>
  </div>
{/if}
