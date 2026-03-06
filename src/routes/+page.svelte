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
        pnl:
          Math.round(
            diff * (trade.quantity ?? 1) * ((trade as any).leverage ?? 1) -
              trade.commissions -
              trade.fees,
          ) / 100,
        cmp: lp.price,
      };
    }
    return map;
  })();

  $: totalFloating = open.reduce(
    (s, t) => s + (floatingPnLMap[t.id]?.pnl ?? 0),
    0,
  );

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
  $: currentAccount = accountList.find((a) => a.id === accountId);
  $: balanceChange = currentAccount
    ? currentAccount.current_balance - currentAccount.initial_balance
    : 0;
  $: balancePct = currentAccount?.initial_balance
    ? (balanceChange / currentAccount.initial_balance) * 100
    : 0;

  $: monthlyPnL = (() => {
    const months: Record<string, number> = {};
    for (const t of closed) {
      const m = t.entry_date?.slice(0, 7) ?? "Unknown";
      months[m] = (months[m] ?? 0) + t.net_pnl;
    }
    return Object.entries(months)
      .slice(-6)
      .map(([month, pnl]) => ({ month, pnl }));
  })();

  $: recentTrades = trades.slice(0, 6);

  function inr(n: number) {
    return (
      "₹" + Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })
    );
  }
</script>

<div class="page space-y-4 animate-fade-up">
  <!-- Ticker bar -->
  <div class="overflow-x-auto -mx-4 px-4">
    <div class="flex items-center gap-1 w-max">
      <span class="section-title mr-2 flex-shrink-0">🇮🇳 Live</span>
      {#each TICKER_SYMBOLS as sym}
        {@const t = ticker[sym]}
        <div class="ticker-pill">
          <span class="font-semibold" style="color: var(--text)">{sym}</span>
          {#if t}
            <span class="font-mono" style="color: var(--text2)"
              >₹{t.price?.toLocaleString("en-IN", {
                maximumFractionDigits: 0,
              })}</span
            >
            <span
              class="font-semibold"
              style="color: {t.changePct >= 0 ? 'var(--green)' : 'var(--red)'}"
            >
              {t.changePct >= 0 ? "▲" : "▼"}{Math.abs(t.changePct).toFixed(2)}%
            </span>
          {:else}
            <span style="color: var(--text3)">—</span>
          {/if}
        </div>
      {/each}
    </div>
  </div>

  <!-- Page header -->
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-xl font-bold" style="color: var(--text)">Dashboard</h1>
      <p class="text-xs mt-0.5" style="color: var(--text3)">
        {currentAccount?.name ?? "No account"} · {currentAccount?.broker ?? ""}
      </p>
    </div>
    <a href="/log" class="btn-primary btn-sm">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        ><line x1="12" y1="5" x2="12" y2="19" /><line
          x1="5"
          y1="12"
          x2="19"
          y2="12"
        /></svg
      >
      New Trade
    </a>
  </div>

  {#if loading}
    <div
      class="flex items-center justify-center py-20"
      style="color: var(--text3)"
    >
      <svg
        class="animate-spin mr-2"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        ><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity=".25" /><path
          d="M21 12a9 9 0 00-9-9"
        /></svg
      >
      Loading...
    </div>
  {:else if !accountId}
    <div class="card text-center py-12">
      <p class="mb-4" style="color: var(--text2)">
        No account selected. Create one in Settings.
      </p>
      <a href="/settings" class="btn-primary">Go to Settings</a>
    </div>
  {:else}
    <!-- Balance hero card -->
    {#if currentAccount}
      <div
        class="card-glass p-5 relative overflow-hidden"
        style="background: linear-gradient(135deg, rgba(59,130,246,0.12) 0%, rgba(99,102,241,0.08) 100%); border-color: rgba(59,130,246,0.2)"
      >
        <!-- Decorative glow -->
        <div
          class="absolute top-0 right-0 w-48 h-48 rounded-full pointer-events-none"
          style="background: radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%); transform: translate(30%, -30%)"
        ></div>
        <div class="relative">
          <div
            class="text-xs font-medium mb-1"
            style="color: var(--text3); text-transform: uppercase; letter-spacing: 0.08em"
          >
            Portfolio Balance
          </div>
          <div
            class="text-3xl font-bold tracking-tight"
            style="color: var(--text)"
          >
            ₹{currentAccount.current_balance?.toLocaleString("en-IN", {
              maximumFractionDigits: 0,
            })}
          </div>
          <div class="flex items-center gap-3 mt-2">
            <span
              class="text-xs font-semibold px-2 py-0.5 rounded-full {balanceChange >=
              0
                ? 'pnl-positive'
                : 'pnl-negative'}"
              style="background: {balanceChange >= 0
                ? 'rgba(16,185,129,0.1)'
                : 'rgba(244,63,94,0.1)'}"
            >
              {balanceChange >= 0 ? "+" : ""}{inr(balanceChange)} ({balancePct >=
              0
                ? "+"
                : ""}{balancePct.toFixed(2)}%)
            </span>
            <span class="text-xs" style="color: var(--text3)"
              >from ₹{currentAccount.initial_balance?.toLocaleString("en-IN", {
                maximumFractionDigits: 0,
              })}</span
            >
          </div>
        </div>
      </div>
    {/if}

    <!-- Floating P&L -->
    {#if open.length > 0}
      <div
        class="card-glass"
        style="border-color: rgba(6,182,212,0.2); background: rgba(6,182,212,0.04)"
      >
        <div class="flex items-center gap-2 mb-3">
          <div class="live-dot"></div>
          <span class="text-xs font-semibold" style="color: var(--cyan)"
            >{open.length} Open Position{open.length > 1 ? "s" : ""}</span
          >
          <span class="text-xs ml-auto" style="color: var(--text3)"
            >20s refresh</span
          >
        </div>
        <div class="grid grid-cols-2 gap-2 mb-3">
          {#each open as trade (trade.id)}
            {@const fp = floatingPnLMap[trade.id]}
            {@const lp = livePrices[trade.symbol]}
            <div
              class="rounded-xl p-3"
              style="background: var(--surface); border: 1px solid {fp
                ? fp.pnl >= 0
                  ? 'rgba(16,185,129,0.2)'
                  : 'rgba(244,63,94,0.2)'
                : 'var(--border)'}"
            >
              <div class="flex justify-between items-start mb-1">
                <span class="font-bold text-sm" style="color: var(--text)"
                  >{trade.symbol}</span
                >
                <span
                  class="text-xs font-semibold"
                  style="color: {trade.type === 'long'
                    ? 'var(--green)'
                    : 'var(--red)'}"
                >
                  {trade.type === "long" ? "▲" : "▼"}
                  {trade.type}
                </span>
              </div>
              <div class="text-xs mb-1.5" style="color: var(--text3)">
                Entry {inr(trade.entry_price)}
              </div>
              {#if fp && lp}
                <div
                  class="text-xs font-mono mb-0.5"
                  style="color: var(--cyan)"
                >
                  CMP {inr(fp.cmp)}
                </div>
                <div
                  class="font-bold text-sm {fp.pnl >= 0
                    ? 'pnl-positive'
                    : 'pnl-negative'}"
                >
                  {fp.pnl >= 0 ? "+" : ""}{inr(fp.pnl)}
                </div>
              {:else}
                <div class="text-xs" style="color: var(--text3)">fetching…</div>
              {/if}
            </div>
          {/each}
        </div>
        <div
          class="flex justify-between items-center pt-2"
          style="border-top: 1px solid var(--border)"
        >
          <span class="text-xs" style="color: var(--text2)"
            >Total Floating P&L</span
          >
          <span
            class="text-base font-bold {totalFloating >= 0
              ? 'pnl-positive'
              : 'pnl-negative'}"
          >
            {totalFloating >= 0 ? "+" : ""}{inr(totalFloating)}
          </span>
        </div>
      </div>
    {/if}

    <!-- Key stats grid -->
    <div class="grid grid-cols-2 gap-3 animate-fade-up delay-1">
      <div class="stat-card">
        <div class="stat-label">Win Rate</div>
        <div
          class="stat-value {winRate >= 50 ? 'pnl-positive' : 'pnl-negative'}"
        >
          {winRate}%
        </div>
        <div class="text-xs mt-1" style="color: var(--text3)">
          {closed.filter((t) => t.outcome === "win").length}W · {closed.filter(
            (t) => t.outcome === "loss",
          ).length}L
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Net P&L</div>
        <div
          class="stat-value {totalPnL >= 0 ? 'pnl-positive' : 'pnl-negative'}"
        >
          {inr(totalPnL)}
        </div>
        <div class="text-xs mt-1" style="color: var(--text3)">
          {closed.length} closed trades
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Profit Factor</div>
        <div
          class="stat-value {profitFactor >= 1.5
            ? 'pnl-positive'
            : profitFactor >= 1
              ? ''
              : 'pnl-negative'}"
          style={profitFactor >= 1 && profitFactor < 1.5
            ? "color: var(--yellow)"
            : ""}
        >
          {profitFactor}
        </div>
        <div class="text-xs mt-1" style="color: var(--text3)">
          {profitFactor >= 1.5
            ? "✓ Strong edge"
            : profitFactor >= 1
              ? "Marginal"
              : "Losing system"}
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Expectancy</div>
        <div
          class="stat-value {expectancy >= 0 ? 'pnl-positive' : 'pnl-negative'}"
        >
          {inr(expectancy)}
        </div>
        <div class="text-xs mt-1" style="color: var(--text3)">
          per trade avg
        </div>
      </div>
    </div>

    <!-- Avg win / loss row -->
    <div class="grid grid-cols-2 gap-3 animate-fade-up delay-2">
      <div class="card p-4">
        <div class="section-title mb-2">Avg Win</div>
        <div class="text-xl font-bold pnl-positive">+{inr(avgWin)}</div>
      </div>
      <div class="card p-4">
        <div class="section-title mb-2">Avg Loss</div>
        <div class="text-xl font-bold pnl-negative">-{inr(avgLoss)}</div>
      </div>
    </div>

    <!-- Monthly chart + Recent trades side by side on desktop, stacked mobile -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-up delay-3">
      <!-- Monthly P&L -->
      <div class="card">
        <div class="section-title mb-3">Monthly Performance</div>
        {#if monthlyPnL.length === 0}
          <p class="text-sm text-center py-8" style="color: var(--text3)">
            No closed trades yet
          </p>
        {:else}
          <div class="space-y-2">
            {#each monthlyPnL as m}
              {@const maxAbs = Math.max(
                ...monthlyPnL.map((x) => Math.abs(x.pnl)),
              )}
              <div class="flex items-center gap-2">
                <span
                  class="text-xs w-14 flex-shrink-0 font-mono"
                  style="color: var(--text3)"
                  >{m.month.slice(5)}/{m.month.slice(2, 4)}</span
                >
                <div class="flex-1 progress-bar">
                  <div
                    class="progress-fill"
                    style="width: {maxAbs > 0
                      ? (Math.abs(m.pnl) / maxAbs) * 100
                      : 0}%; background: {m.pnl >= 0
                      ? 'var(--green)'
                      : 'var(--red)'}"
                  ></div>
                </div>
                <span
                  class="text-xs font-semibold font-mono w-20 text-right {m.pnl >=
                  0
                    ? 'pnl-positive'
                    : 'pnl-negative'}">{m.pnl >= 0 ? "+" : ""}{inr(m.pnl)}</span
                >
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Recent trades -->
      <div class="card">
        <div class="flex items-center justify-between mb-3">
          <div class="section-title">Recent Trades</div>
          <a
            href="/log"
            class="text-xs font-medium"
            style="color: var(--accent)">View all →</a
          >
        </div>
        {#if recentTrades.length === 0}
          <p class="text-sm text-center py-8" style="color: var(--text3)">
            No trades logged yet
          </p>
        {:else}
          <div class="space-y-0">
            {#each recentTrades as trade (trade.id)}
              {@const fp = floatingPnLMap[trade.id]}
              <div
                class="flex items-center gap-2.5 py-2.5"
                style="border-bottom: 1px solid var(--border)"
              >
                <div
                  class="w-1.5 h-1.5 rounded-full flex-shrink-0 {trade.status ===
                  'open'
                    ? 'live-dot'
                    : ''}"
                  style={trade.status !== "open"
                    ? "background: " +
                      (trade.type === "long" ? "var(--green)" : "var(--red)")
                    : ""}
                ></div>
                <span
                  class="text-sm font-semibold w-20 truncate"
                  style="color: var(--text)">{trade.symbol}</span
                >
                <span class="text-xs flex-1" style="color: var(--text3)"
                  >{trade.entry_date?.slice(5, 10)}</span
                >
                {#if trade.status === "open"}
                  <span class="badge badge-open">open</span>
                  {#if fp}
                    <span
                      class="text-xs font-semibold font-mono {fp.pnl >= 0
                        ? 'pnl-positive'
                        : 'pnl-negative'}"
                      >{fp.pnl >= 0 ? "+" : ""}{inr(fp.pnl)}</span
                    >
                  {:else}
                    <span class="text-xs" style="color: var(--text3)">—</span>
                  {/if}
                {:else}
                  <span class="badge badge-{trade.outcome}"
                    >{trade.outcome}</span
                  >
                  <span
                    class="text-xs font-semibold font-mono {trade.net_pnl >= 0
                      ? 'pnl-positive'
                      : 'pnl-negative'}"
                    >{trade.net_pnl >= 0 ? "+" : ""}{inr(trade.net_pnl)}</span
                  >
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <!-- Quick actions -->
    <div class="grid grid-cols-3 gap-3 animate-fade-up delay-4">
      {#each [{ href: "/log", emoji: "📝", label: "Log Trade", sub: "NSE · BSE · MCX" }, { href: "/analytics", emoji: "🧠", label: "AI Coach", sub: "Gemma 3 27B" }, { href: "/advanced-analytics", emoji: "🔬", label: "Advanced", sub: "Sharpe · Kelly" }] as q}
        <a
          href={q.href}
          class="card p-3 flex flex-col gap-1 transition-all duration-150 cursor-pointer"
          style="text-decoration: none"
          onmouseenter={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor =
              "rgba(59,130,246,0.3)";
          }}
          onmouseleave={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor =
              "var(--border)";
          }}
        >
          <span class="text-xl">{q.emoji}</span>
          <span class="text-xs font-semibold" style="color: var(--text)"
            >{q.label}</span
          >
          <span class="text-xs" style="color: var(--text3)">{q.sub}</span>
        </a>
      {/each}
    </div>
  {/if}
</div>
