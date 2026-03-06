<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { selectedAccountId, accounts } from "$lib/stores";
  import {
    calcWinRate,
    calcProfitFactor,
    calcExpectancy,
  } from "$lib/utils/calculations";
  import type { Trade, Account } from "$lib/types";

  let trades: Trade[] = [];
  let loading = true;
  let accountId = "";
  let accountList: Account[] = [];

  // Market ticker + open trade live prices
  let ticker: Record<string, any> = {};
  let livePrices: Record<string, any> = {};
  let tickerInterval: ReturnType<typeof setInterval> | null = null;
  const TICKER_SYMBOLS = [
    "NIFTY50",
    "BANKNIFTY",
    "SENSEX",
    "RELIANCE",
    "TCS",
    "HDFCBANK",
  ];

  selectedAccountId.subscribe((id) => {
    accountId = id;
    if (id) loadTrades();
  });
  accounts.subscribe((v) => (accountList = v));

  async function loadTrades() {
    loading = true;
    const res = await fetch(`/api/trades?accountId=${accountId}`);
    trades = await res.json();
    loading = false;
    fetchOpenPrices();
  }

  async function fetchOpenPrices() {
    const openTrades = trades.filter((t) => t.status === "open");
    if (!openTrades.length) return;
    const symbols = [...new Set(openTrades.map((t) => t.symbol))];
    try {
      const res = await fetch(`/api/live-price?symbols=${symbols.join(",")}`);
      if (res.ok) livePrices = { ...livePrices, ...(await res.json()) };
    } catch {}
  }

  async function fetchTicker() {
    try {
      const res = await fetch(
        `/api/live-price?symbols=${TICKER_SYMBOLS.join(",")}`,
      );
      if (res.ok) ticker = await res.json();
    } catch {}
    fetchOpenPrices();
  }

  // Reactive floating P&L map — recomputes whenever livePrices or trades changes
  $: floatingPnLMap = (() => {
    const map: Record<string, { pnl: number; cmp: number } | null> = {};
    for (const trade of trades) {
      if (trade.status !== "open") {
        map[trade.id] = null;
        continue;
      }
      const lp = livePrices[trade.symbol];
      if (!lp?.price || !trade.entry_price) {
        map[trade.id] = null;
        continue;
      }
      const diff =
        trade.type === "long"
          ? lp.price - trade.entry_price
          : trade.entry_price - lp.price;
      map[trade.id] = {
        pnl: Math.round(
          diff * (trade.quantity ?? 1) - trade.commissions - trade.fees,
        ),
        cmp: lp.price,
      };
    }
    return map;
  })();

  $: totalFloating = open.reduce(
    (s, t) => s + (floatingPnLMap[t.id]?.pnl ?? 0),
    0,
  );

  function getFloatingPnL(trade: Trade) {
    return floatingPnLMap[trade.id] ?? null;
  }

  onMount(() => {
    if (accountId) loadTrades();
    fetchTicker();
    tickerInterval = setInterval(fetchTicker, 20000);
  });
  onDestroy(() => {
    if (tickerInterval) clearInterval(tickerInterval);
  });

  $: closed = trades.filter((t) => t.status === "closed");
  $: open = trades.filter((t) => t.status === "open");
  $: winRate = calcWinRate(trades);
  $: profitFactor = calcProfitFactor(trades);
  $: expectancy = calcExpectancy(trades);
  $: totalPnL = closed.reduce((s, t) => s + t.net_pnl, 0);
  $: avgWin = closed.filter((t) => t.outcome === "win").length
    ? closed
        .filter((t) => t.outcome === "win")
        .reduce((s, t) => s + t.net_pnl, 0) /
      closed.filter((t) => t.outcome === "win").length
    : 0;
  $: avgLoss = closed.filter((t) => t.outcome === "loss").length
    ? Math.abs(
        closed
          .filter((t) => t.outcome === "loss")
          .reduce((s, t) => s + t.net_pnl, 0) /
          closed.filter((t) => t.outcome === "loss").length,
      )
    : 0;
  $: largestWin = closed.length ? Math.max(...closed.map((t) => t.net_pnl)) : 0;
  $: largestLoss = closed.length
    ? Math.min(...closed.map((t) => t.net_pnl))
    : 0;
  $: currentAccount = accountList.find((a) => a.id === accountId);

  $: monthlyPnL = (() => {
    const months: Record<string, number> = {};
    for (const t of closed) {
      const m = t.entry_date?.slice(0, 7) ?? "Unknown";
      months[m] = (months[m] ?? 0) + t.net_pnl;
    }
    return Object.entries(months)
      .slice(-6)
      .map(([m, v]) => ({ month: m, pnl: v }));
  })();

  $: recentTrades = trades.slice(0, 8);

  function inr(n: number) {
    return (
      "₹" +
      Math.abs(n).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  }
  function signedInr(n: number) {
    return (n >= 0 ? "+" : "-") + inr(n);
  }
</script>

<div class="p-6 space-y-5">
  <!-- Market Ticker Bar -->
  <div class="card py-3 overflow-hidden">
    <div class="flex items-center gap-6 overflow-x-auto scrollbar-hide">
      <span class="text-xs text-gray-600 flex-shrink-0">🇮🇳 Live Market</span>
      {#each TICKER_SYMBOLS as sym}
        {@const t = ticker[sym]}
        <div class="flex items-center gap-2 flex-shrink-0">
          <span class="text-xs font-medium text-gray-300">{sym}</span>
          {#if t}
            <span class="text-xs font-semibold text-white"
              >₹{t.price?.toLocaleString("en-IN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}</span
            >
            <span
              class="text-xs {t.changePct >= 0
                ? 'text-emerald-400'
                : 'text-red-400'}"
            >
              {t.changePct >= 0 ? "▲" : "▼"}{Math.abs(t.changePct).toFixed(2)}%
            </span>
          {:else}
            <span class="text-xs text-gray-600">—</span>
          {/if}
        </div>
      {/each}
    </div>
  </div>

  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold text-white">Dashboard</h1>
      <p class="text-gray-500 text-sm">
        {currentAccount?.name ?? "No account selected"} · {currentAccount?.broker ??
          ""} · {currentAccount?.currency ?? "INR"}
      </p>
    </div>
    <a href="/log?new=1" class="btn-primary">+ New Trade</a>
  </div>

  {#if loading}
    <div class="text-center py-20 text-gray-500">Loading...</div>
  {:else if !accountId}
    <div class="card text-center py-12">
      <p class="text-gray-400 mb-4">
        No account selected. Create one in Settings.
      </p>
      <a href="/settings" class="btn-primary">Go to Settings</a>
    </div>
  {:else}
    <!-- Account balance -->
    {#if currentAccount}
      <div
        class="card bg-gradient-to-r from-sky-900/20 to-sky-950/20 border-sky-800/30"
      >
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm text-gray-500">Portfolio Balance</div>
            <div class="text-3xl font-bold text-white mt-1">
              ₹{currentAccount.current_balance?.toLocaleString("en-IN", {
                minimumFractionDigits: 2,
              })}
            </div>
          </div>
          <div class="text-right">
            <div class="text-sm text-gray-500">Initial Capital</div>
            <div class="text-lg text-gray-400">
              ₹{currentAccount.initial_balance?.toLocaleString("en-IN", {
                minimumFractionDigits: 2,
              })}
            </div>
            <div
              class="text-sm font-semibold mt-1 {currentAccount.current_balance -
                currentAccount.initial_balance >=
              0
                ? 'text-emerald-400'
                : 'text-red-400'}"
            >
              {currentAccount.current_balance -
                currentAccount.initial_balance >=
              0
                ? "▲"
                : "▼"}
              {Math.abs(
                ((currentAccount.current_balance -
                  currentAccount.initial_balance) /
                  currentAccount.initial_balance) *
                  100,
              ).toFixed(2)}%
            </div>
          </div>
        </div>
      </div>
    {/if}

    <!-- Floating P&L for open positions -->
    {#if open.length > 0}
      <div class="card border-sky-800/30 bg-sky-950/10">
        <div class="flex items-center gap-2 mb-3">
          <div class="w-2 h-2 rounded-full bg-sky-400 animate-pulse"></div>
          <span class="text-sky-400 font-semibold text-sm"
            >{open.length} Open Position{open.length > 1 ? "s" : ""} — Floating P&L</span
          >
          <span class="text-xs text-gray-600 ml-auto"
            >CMP via Yahoo Finance · 20s refresh</span
          >
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          {#each open as trade (trade.id)}
            {@const fp = floatingPnLMap[trade.id]}
            {@const lp = livePrices[trade.symbol]}
            <div
              class="bg-gray-900/60 rounded-xl p-3 border {fp
                ? fp.pnl >= 0
                  ? 'border-emerald-800/40'
                  : 'border-red-800/40'
                : 'border-gray-800'}"
            >
              <div class="flex justify-between items-start mb-1">
                <span class="font-bold text-white text-sm">{trade.symbol}</span>
                <span
                  class="text-xs {trade.type === 'long'
                    ? 'text-emerald-400'
                    : 'text-red-400'}">{trade.type === "long" ? "▲" : "▼"}</span
                >
              </div>
              <div class="text-xs text-gray-500 mb-1">
                Entry: {inr(trade.entry_price)}
              </div>
              {#if fp && lp}
                <div class="text-xs text-sky-300">CMP: {inr(fp.cmp)}</div>
                <div
                  class="font-bold {fp.pnl >= 0
                    ? 'text-emerald-400'
                    : 'text-red-400'} mt-1"
                >
                  {fp.pnl >= 0 ? "+" : ""}{inr(fp.pnl)}
                  <span class="text-xs font-normal text-gray-500 ml-1"
                    >floating</span
                  >
                </div>
                {#if lp.changePct !== undefined}
                  <div
                    class="text-xs {lp.changePct >= 0
                      ? 'text-emerald-600'
                      : 'text-red-600'} mt-0.5"
                  >
                    {lp.changePct >= 0 ? "▲" : "▼"}{Math.abs(
                      lp.changePct,
                    ).toFixed(2)}% today
                  </div>
                {/if}
              {:else}
                <div class="text-xs text-gray-600 italic mt-1">
                  fetching CMP...
                </div>
              {/if}
            </div>
          {/each}
        </div>
        <div
          class="border-t border-gray-800 pt-3 flex justify-between items-center"
        >
          <span class="text-sm text-gray-400">Total Floating P&L</span>
          <span
            class="text-xl font-bold {totalFloating >= 0
              ? 'text-emerald-400'
              : 'text-red-400'}"
          >
            {totalFloating >= 0 ? "+" : ""}{inr(totalFloating)}
          </span>
        </div>
      </div>
    {/if}

    <!-- Key stats -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="stat-card">
        <div class="stat-label">Total Trades</div>
        <div class="stat-value text-white">{closed.length}</div>
        <div class="text-xs text-sky-400">{open.length} open</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Win Rate</div>
        <div
          class="stat-value {winRate >= 50
            ? 'text-emerald-400'
            : 'text-red-400'}"
        >
          {winRate}%
        </div>
        <div class="text-xs text-gray-500">
          {closed.filter((t) => t.outcome === "win").length}W / {closed.filter(
            (t) => t.outcome === "loss",
          ).length}L
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total P&L</div>
        <div
          class="stat-value {totalPnL >= 0
            ? 'text-emerald-400'
            : 'text-red-400'}"
        >
          {inr(totalPnL)}
        </div>
        <div class="text-xs text-gray-500">Exp: {inr(expectancy)}/trade</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Profit Factor</div>
        <div
          class="stat-value {profitFactor >= 1.5
            ? 'text-emerald-400'
            : profitFactor >= 1
              ? 'text-yellow-400'
              : 'text-red-400'}"
        >
          {profitFactor}
        </div>
        <div class="text-xs text-gray-500">
          {profitFactor >= 1.5
            ? "Excellent"
            : profitFactor >= 1
              ? "Marginal"
              : "Losing"}
        </div>
      </div>
    </div>

    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="stat-card">
        <div class="stat-label">Avg Win</div>
        <div class="stat-value text-emerald-400">{inr(avgWin)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Avg Loss</div>
        <div class="stat-value text-red-400">-{inr(avgLoss)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Largest Win</div>
        <div class="stat-value text-emerald-400">{inr(largestWin)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Largest Loss</div>
        <div class="stat-value text-red-400">-{inr(Math.abs(largestLoss))}</div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Monthly P&L -->
      <div class="card">
        <h2 class="font-semibold text-gray-200 mb-4">Monthly Performance</h2>
        {#if monthlyPnL.length === 0}
          <p class="text-gray-500 text-sm text-center py-8">
            No closed trades yet
          </p>
        {:else}
          <div class="space-y-2">
            {#each monthlyPnL as m}
              {@const maxAbs = Math.max(
                ...monthlyPnL.map((x) => Math.abs(x.pnl)),
              )}
              <div class="flex items-center gap-3">
                <span class="text-xs text-gray-500 w-16 flex-shrink-0"
                  >{m.month}</span
                >
                <div
                  class="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden"
                >
                  <div
                    class="h-full rounded-full {m.pnl >= 0
                      ? 'bg-emerald-500'
                      : 'bg-red-500'}"
                    style="width: {maxAbs > 0
                      ? (Math.abs(m.pnl) / maxAbs) * 100
                      : 0}%"
                  ></div>
                </div>
                <span
                  class="text-xs font-semibold w-24 text-right {m.pnl >= 0
                    ? 'text-emerald-400'
                    : 'text-red-400'}">{signedInr(m.pnl)}</span
                >
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Recent trades -->
      <div class="card">
        <div class="flex items-center justify-between mb-4">
          <h2 class="font-semibold text-gray-200">Recent Trades</h2>
          <a href="/log" class="text-sm text-sky-400 hover:text-sky-300"
            >View all →</a
          >
        </div>
        {#if recentTrades.length === 0}
          <p class="text-gray-500 text-sm text-center py-8">
            No trades logged yet
          </p>
        {:else}
          <div class="space-y-2">
            {#each recentTrades as trade (trade.id)}
              {@const fp = floatingPnLMap[trade.id]}
              <div
                class="flex items-center gap-3 py-2 border-b border-gray-800 last:border-0"
              >
                <div
                  class="w-2 h-2 rounded-full flex-shrink-0 {trade.status ===
                  'open'
                    ? 'bg-sky-400 animate-pulse'
                    : trade.type === 'long'
                      ? 'bg-emerald-500'
                      : 'bg-red-500'}"
                ></div>
                <span class="text-sm font-medium text-gray-200 w-24 truncate"
                  >{trade.symbol}</span
                >
                <span class="text-xs text-gray-500 flex-1"
                  >{trade.entry_date?.slice(0, 10)}</span
                >
                {#if trade.status === "open"}
                  <span
                    class="badge bg-sky-900/40 text-sky-400 border border-sky-800/40 text-xs"
                    >open</span
                  >
                  {#if fp}
                    <span
                      class="{fp.pnl >= 0
                        ? 'pnl-positive'
                        : 'pnl-negative'} text-sm font-semibold"
                    >
                      {fp.pnl >= 0 ? "+" : ""}{inr(fp.pnl)}
                      <span class="text-xs text-gray-600 font-normal"
                        >float</span
                      >
                    </span>
                  {:else}
                    <span class="text-gray-600 text-xs">fetching...</span>
                  {/if}
                {:else}
                  <span class="badge-{trade.outcome}">{trade.outcome}</span>
                  <span
                    class="{trade.net_pnl >= 0
                      ? 'pnl-positive'
                      : 'pnl-negative'} text-sm">{inr(trade.net_pnl)}</span
                  >
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <!-- Quick links -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <a
        href="/log?new=1"
        class="card hover:border-sky-700 transition-colors cursor-pointer group"
      >
        <div class="text-2xl mb-2">📝</div>
        <div class="font-semibold text-gray-200 group-hover:text-sky-400">
          Log a Trade
        </div>
        <div class="text-sm text-gray-500">NSE, BSE, MCX, F&O, Currency</div>
      </a>
      <a
        href="/analytics"
        class="card hover:border-sky-700 transition-colors cursor-pointer group"
      >
        <div class="text-2xl mb-2">✨</div>
        <div class="font-semibold text-gray-200 group-hover:text-sky-400">
          Gemini AI Analysis
        </div>
        <div class="text-sm text-gray-500">9-module performance analysis</div>
      </a>
      <a
        href="/advanced-analytics"
        class="card hover:border-sky-700 transition-colors cursor-pointer group"
      >
        <div class="text-2xl mb-2">🔬</div>
        <div class="font-semibold text-gray-200 group-hover:text-sky-400">
          Advanced Analytics
        </div>
        <div class="text-sm text-gray-500">Sharpe · Monte Carlo · Kelly</div>
      </a>
    </div>
  {/if}
</div>
