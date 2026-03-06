<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { page } from "$app/stores";
  import { selectedAccountId } from "$lib/stores";
  import { calculatePnL, calculateRR } from "$lib/utils/calculations";
  import type { Trade, Instrument, Strategy } from "$lib/types";

  let trades: Trade[] = [];
  let instruments: Instrument[] = [];
  let strategies: Strategy[] = [];
  let loading = true;
  let accountId = "";
  let showModal = false;
  let editingTrade: Partial<Trade> | null = null;
  let analysisResult: any = null;
  let analyzing = false;

  // ── Instrument Search ────────────────────────────────────────
  let instrSearchQuery = "";
  let instrSearchResults: any[] = [];
  let instrSearchLoading = false;
  let instrSearchFocused = false;
  let instrSearchDebounce: ReturnType<typeof setTimeout> | null = null;
  let selectedInstrumentName = "";

  async function searchInstruments(q: string) {
    if (q.length < 1) {
      instrSearchResults = [];
      return;
    }
    instrSearchLoading = true;
    try {
      const res = await fetch(
        `/api/instrument-search?q=${encodeURIComponent(q)}`,
      );
      instrSearchResults = await res.json();
    } catch {
      instrSearchResults = [];
    }
    instrSearchLoading = false;
  }

  function onInstrSearchInput(e: Event) {
    instrSearchQuery = (e.target as HTMLInputElement).value;
    if (instrSearchDebounce) clearTimeout(instrSearchDebounce);
    instrSearchDebounce = setTimeout(
      () => searchInstruments(instrSearchQuery),
      250,
    );
  }

  function selectInstrumentFromSearch(result: any) {
    instrSearchQuery = result.symbol;
    selectedInstrumentName = result.name;
    instrSearchResults = [];
    instrSearchFocused = false;

    // Build a minimal instrument object so calculations work
    const instr: Partial<Instrument> = {
      id: result.yahoo_symbol, // use yahoo_symbol as stand-in id
      symbol: result.symbol,
      name: result.name,
      type: result.type,
      exchange: result.exchange,
      currency: result.currency,
      pip_value: result.currency === "INR" ? 1 : 10,
      lot_size: 1,
      contract_size: 1,
      tick_size: result.currency === "INR" ? 0.05 : 0.0001,
    };

    // Merge into editing trade — instrument_id is null for search results (not in DB)
    editingTrade = {
      ...editingTrade!,
      symbol: result.symbol,
      instrument_id: undefined,
    };

    // Store temporarily so recalculate can use it
    instrumentOverride = instr as Instrument;
    fetchLiveForSymbol(result.symbol);
    recalculate();
  }

  // Temporary instrument override when selected from search (not in DB)
  let instrumentOverride: Instrument | null = null;

  async function fetchLiveForSymbol(sym: string) {
    try {
      const res = await fetch(`/api/live-price?symbols=${sym}`);
      const data = await res.json();
      if (data[sym]) livePrices = { ...livePrices, [sym]: data[sym] };
    } catch {}
  }

  // Live prices for open trades
  let livePrices: Record<
    string,
    { price: number; change: number; changePct: number; stale?: boolean }
  > = {};
  let priceInterval: ReturnType<typeof setInterval> | null = null;
  let marketOpen = false;

  // Filters
  let filterType = "all";
  let filterOutcome = "all";
  let filterSymbol = "";
  let filterStrategy = "";
  let search = "";

  selectedAccountId.subscribe((id) => {
    accountId = id;
    if (id) loadAll();
  });

  async function loadAll() {
    loading = true;
    const [t, i, s] = await Promise.all([
      fetch(`/api/trades?accountId=${accountId}`).then((r) => r.json()),
      fetch("/api/instruments").then((r) => r.json()),
      fetch("/api/strategies").then((r) => r.json()),
    ]);
    trades = t;
    instruments = i;
    strategies = s;
    loading = false;
    startLivePrices();
  }

  // ── Live Price Feed ─────────────────────────────────────────
  function isMarketOpen(): boolean {
    const now = new Date();
    const ist = new Date(
      now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
    );
    const day = ist.getDay(); // 0=Sun, 6=Sat
    if (day === 0 || day === 6) return false;
    const h = ist.getHours(),
      m = ist.getMinutes();
    const mins = h * 60 + m;
    return mins >= 9 * 60 + 15 && mins <= 15 * 60 + 30;
  }

  async function fetchLivePrices() {
    const openTrades = trades.filter((t) => t.status === "open");
    if (!openTrades.length) return;
    const symbols = [
      ...new Set(openTrades.map((t) => t.symbol).filter(Boolean)),
    ];
    try {
      const res = await fetch(`/api/live-price?symbols=${symbols.join(",")}`);
      if (res.ok) {
        const data = await res.json();
        livePrices = { ...livePrices, ...data };
      }
      marketOpen = isMarketOpen();
    } catch {
      /* silent fail */
    }
  }

  function startLivePrices() {
    if (priceInterval) clearInterval(priceInterval);
    fetchLivePrices();
    priceInterval = setInterval(fetchLivePrices, 15000);
  }

  onMount(() => {
    if (accountId) loadAll();
    if ($page.url.searchParams.get("new")) openNew();
  });
  onDestroy(() => {
    if (priceInterval) clearInterval(priceInterval);
  });

  // Reactive map — recomputes whenever livePrices OR trades changes
  // This is the key fix: $: ensures Svelte re-renders when livePrices updates
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
      const leverage = (trade as any).leverage ?? 1;
      map[trade.id] = {
        pnl: Math.round(
          diff * (trade.quantity ?? 1) - trade.commissions - trade.fees,
        ),
        cmp: lp.price,
      };
    }
    return map;
  })();

  $: totalLivePnL = openTrades.reduce(
    (s, t) => s + (floatingPnLMap[t.id]?.pnl ?? 0),
    0,
  );

  function openNew() {
    instrumentOverride = null;
    instrSearchQuery = "";
    selectedInstrumentName = "";
    instrSearchResults = [];
    editingTrade = {
      account_id: accountId,
      type: "long",
      status: "open",
      outcome: "pending",
      quantity: 1,
      lot_size: 1,
      fees: 0,
      commissions: 0,
      slippage: 0,
      gross_pnl: 0,
      net_pnl: 0,
      expected_rr: 0,
      actual_rr: 0,
      emotion: "neutral",
      followed_plan: true,
      time_of_day: "morning",
      market_condition: "trending",
      session_quality: 3,
      tags: [],
      checklist_items: {},
      checklist_completed: false,
      leverage: 1,
      margin_used: 0,
    } as any;
    showModal = true;
    analysisResult = null;
  }

  function editTrade(trade: Trade) {
    instrumentOverride = null;
    instrSearchQuery = trade.symbol ?? "";
    selectedInstrumentName =
      instruments.find((i) => i.id === trade.instrument_id)?.name ??
      trade.symbol ??
      "";
    instrSearchResults = [];
    editingTrade = { ...trade };
    showModal = true;
    analysisResult = null;
  }

  function recalculate() {
    if (!editingTrade) return;
    const t = editingTrade as any;
    const leverage = t.leverage ?? 1;
    const qty = t.quantity ?? 1;
    const entryPrice = t.entry_price ?? 0;
    const exitPrice = t.exit_price ?? 0;
    const stopLoss = t.stop_loss ?? 0;
    const takeProfit = t.take_profit ?? 0;
    const totalCosts = (t.fees ?? 0) + (t.commissions ?? 0) + (t.slippage ?? 0);

    // Position value = qty * entry price (full notional)
    const notional = qty * entryPrice;
    // Margin used = notional / leverage
    const marginUsed = leverage > 0 ? notional / leverage : notional;

    // Gross P&L using leverage (profit on full notional, not just margin)
    let grossPnl = 0;
    if (exitPrice && entryPrice) {
      const priceDiff =
        t.type === "long" ? exitPrice - entryPrice : entryPrice - exitPrice;
      grossPnl = priceDiff * qty * leverage;
    }
    const netPnl = grossPnl - totalCosts;

    // R:R using risk = entry → stop distance
    let expectedRR = 0,
      actualRR = 0;
    if (stopLoss && entryPrice) {
      const riskPerShare = Math.abs(entryPrice - stopLoss);
      const risk = riskPerShare * qty * leverage;
      if (risk > 0) {
        if (takeProfit) {
          const rewardPerShare = Math.abs(takeProfit - entryPrice);
          expectedRR =
            Math.round(((rewardPerShare * qty * leverage) / risk) * 100) / 100;
        }
        if (exitPrice) {
          actualRR = Math.round((netPnl / risk) * 100) / 100;
        }
      }
    }

    editingTrade = {
      ...editingTrade,
      gross_pnl: Math.round(grossPnl * 100) / 100,
      net_pnl: Math.round(netPnl * 100) / 100,
      expected_rr: expectedRR,
      actual_rr: actualRR,
      ...({ margin_used: marginUsed, leverage } as any),
    } as any;
    // Store margin_used and leverage directly
    (editingTrade as any).leverage = leverage;
    (editingTrade as any).margin_used = Math.round(marginUsed * 100) / 100;
  }

  function onStrategyChange(e: Event) {
    const id = (e.target as HTMLSelectElement).value;
    const strat = strategies.find((s) => s.id === id);
    if (editingTrade) {
      editingTrade = { ...editingTrade, strategy_id: id };
      if (strat) {
        const items: Record<string, boolean> = {};
        strat.checklist_items?.forEach((ci: any) => (items[ci.id] = false));
        editingTrade = { ...editingTrade, checklist_items: items };
      }
    }
  }

  async function saveTrade() {
    if (!editingTrade) return;
    const method = editingTrade.id ? "PUT" : "POST";

    // Strip any non-UUID values from uuid columns before sending to Supabase
    const isUUID = (v: any) =>
      typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);
    const payload = {
      ...editingTrade,
      account_id: accountId,
      instrument_id: isUUID(editingTrade.instrument_id)
        ? editingTrade.instrument_id
        : null,
      strategy_id: isUUID(editingTrade.strategy_id)
        ? editingTrade.strategy_id
        : null,
    };

    const res = await fetch("/api/trades", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const saved = await res.json();
    if (editingTrade.id) {
      trades = trades.map((t) => (t.id === saved.id ? saved : t));
    } else {
      trades = [saved, ...trades];
    }
    showModal = false;
    editingTrade = null;
    fetchLivePrices();
  }

  async function deleteTrade(id: string) {
    if (!confirm("Delete this trade?")) return;
    await fetch("/api/trades", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    trades = trades.filter((t) => t.id !== id);
  }

  async function analyzeTrade(trade: Trade) {
    analyzing = true;
    analysisResult = null;
    const res = await fetch("/api/trade-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trade, accountId }),
    });
    analysisResult = await res.json();
    analyzing = false;
  }

  $: filteredTrades = trades.filter((t) => {
    if (filterType !== "all" && t.type !== filterType) return false;
    if (filterOutcome !== "all" && t.outcome !== filterOutcome) return false;
    if (filterSymbol && t.symbol !== filterSymbol) return false;
    if (filterStrategy && t.strategy_id !== filterStrategy) return false;
    if (search) {
      const q = search.toLowerCase();
      return [
        t.symbol,
        t.notes,
        t.pre_trade_notes,
        t.post_trade_notes,
        t.mistakes,
        t.lessons_learned,
      ].some((f) => f?.toLowerCase().includes(q));
    }
    return true;
  });

  $: openTrades = trades.filter((t) => t.status === "open");

  $: selectedStrategy = editingTrade?.strategy_id
    ? strategies.find((s) => s.id === editingTrade!.strategy_id)
    : null;
  $: checklistProgress = selectedStrategy
    ? Object.values(editingTrade?.checklist_items ?? {}).filter(Boolean)
        .length +
      "/" +
      selectedStrategy.checklist_items.length
    : "0/0";

  function pnlClass(n: number) {
    return n > 0 ? "pnl-positive" : n < 0 ? "pnl-negative" : "pnl-zero";
  }
  function fmtInr(n: number) {
    return (
      "₹" +
      Math.abs(n).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  }
  function fmtPrice(n: number) {
    return (
      "₹" +
      n.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  }
</script>

<div class="p-6">
  <div class="flex items-center justify-between mb-4">
    <h1 class="text-2xl font-bold [color:var(--text)]">Trade Log</h1>
    <div class="flex items-center gap-3">
      <!-- Market status -->
      <div
        class="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border {marketOpen
          ? 'bg-emerald-900/30 border-emerald-700/40 text-emerald-400'
          : 'bg-gray-800 border-gray-700 [color:var(--text3)]'}"
      >
        <div
          class="w-1.5 h-1.5 rounded-full {marketOpen
            ? 'bg-emerald-400 animate-pulse'
            : 'bg-gray-600'}"
        ></div>
        {marketOpen ? "NSE/BSE Open" : "Market Closed"}
      </div>
      <button class="btn-primary" onclick={openNew}>+ New Trade</button>
    </div>
  </div>

  <!-- Floating P&L Banner for open trades -->
  {#if openTrades.length > 0}
    <div class="card mb-4 border-sky-800/40 bg-sky-900/10">
      <div class="flex items-center gap-3 mb-2">
        <div class="w-2 h-2 rounded-full bg-sky-400 animate-pulse"></div>
        <span class="text-sky-400 font-semibold text-sm"
          >{openTrades.length} Open Position{openTrades.length > 1
            ? "s"
            : ""}</span
        >
        <span
          class="text-xs [color:var(--text3)] border border-gray-700 px-2 py-0.5 rounded-full"
          >Floating P&L · live CMP · refreshes every 15s</span
        >
        <span
          class="ml-auto text-xs {marketOpen
            ? 'text-emerald-400'
            : '[color:var(--text3)]'}"
        >
          {marketOpen ? "● Market Open" : "○ Market Closed — prices delayed"}
        </span>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        {#each openTrades as trade (trade.id)}
          {@const fp = floatingPnLMap[trade.id]}
          {@const lpr = livePrices[trade.symbol]}
          <div
            class="[background:var(--bg2)]/60 rounded-xl p-3 border {fp
              ? fp.pnl >= 0
                ? 'border-emerald-800/40'
                : 'border-red-800/40'
              : '[border-color:var(--border)]'}"
          >
            <div class="flex items-center justify-between mb-1">
              <span class="font-bold [color:var(--text)] text-sm"
                >{trade.symbol}</span
              >
              <span
                class="text-xs {trade.type === 'long'
                  ? 'text-emerald-400'
                  : 'text-red-400'}"
                >{trade.type === "long" ? "▲ Long" : "▼ Short"}</span
              >
            </div>
            <div class="text-xs [color:var(--text3)] mb-2">
              Entry: {fmtPrice(trade.entry_price)}
              {#if (trade as any).leverage > 1}<span
                  class="ml-1 text-indigo-400">{(trade as any).leverage}x</span
                >{/if}
            </div>
            {#if fp && lpr}
              <div class="flex items-end justify-between">
                <div>
                  <div class="text-xs [color:var(--text3)]">CMP</div>
                  <div class="text-sm font-semibold text-sky-300">
                    {fmtPrice(fp.cmp)}
                  </div>
                </div>
                <div class="text-right">
                  <div class="text-xs [color:var(--text3)]">Floating P&L</div>
                  <div
                    class="font-bold text-base {fp.pnl >= 0
                      ? 'text-emerald-400'
                      : 'text-red-400'}"
                  >
                    {fp.pnl >= 0 ? "+" : ""}{fmtInr(fp.pnl)}
                  </div>
                  <div
                    class="text-xs {lpr.changePct >= 0
                      ? 'text-emerald-500'
                      : 'text-red-500'}"
                  >
                    {lpr.changePct >= 0 ? "▲" : "▼"}{Math.abs(
                      lpr.changePct,
                    ).toFixed(2)}% today
                  </div>
                </div>
              </div>
            {:else}
              <div class="text-xs [color:var(--text3)] italic">
                Fetching price...
              </div>
            {/if}
          </div>
        {/each}
      </div>
      <div
        class="mt-3 pt-3 border-t [border-color:var(--border)] flex items-center justify-between"
      >
        <span class="text-sm [color:var(--text2)]">Total Floating P&L</span>
        <span
          class="text-lg font-bold {totalLivePnL >= 0
            ? 'text-emerald-400'
            : 'text-red-400'}"
        >
          {totalLivePnL >= 0 ? "+" : ""}{fmtInr(totalLivePnL)}
        </span>
      </div>
    </div>
  {/if}

  <!-- Filters -->
  <div class="card mb-4">
    <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
      <input
        class="input text-sm"
        placeholder="Search..."
        bind:value={search}
      />
      <select class="input text-sm" bind:value={filterType}>
        <option value="all">All Directions</option>
        <option value="long">Long / Buy</option>
        <option value="short">Short / Sell</option>
      </select>
      <select class="input text-sm" bind:value={filterOutcome}>
        <option value="all">All Outcomes</option>
        <option value="win">Win</option>
        <option value="loss">Loss</option>
        <option value="breakeven">Breakeven</option>
        <option value="pending">Pending</option>
      </select>
      <select class="input text-sm" bind:value={filterSymbol}>
        <option value="">All Symbols</option>
        {#each [...new Set(trades.map((t) => t.symbol))] as sym}
          <option value={sym}>{sym}</option>
        {/each}
      </select>
      <select class="input text-sm" bind:value={filterStrategy}>
        <option value="">All Strategies</option>
        {#each strategies as s}
          <option value={s.id}>{s.name}</option>
        {/each}
      </select>
    </div>
  </div>

  <!-- Table -->
  {#if loading}
    <div class="text-center py-20 [color:var(--text3)]">Loading trades...</div>
  {:else if filteredTrades.length === 0}
    <div class="card text-center py-12">
      <p class="[color:var(--text2)] mb-4">
        {trades.length === 0
          ? "No trades yet. Log your first trade!"
          : "No trades match these filters."}
      </p>
      {#if trades.length === 0}<button class="btn-primary" onclick={openNew}
          >Log First Trade</button
        >{/if}
    </div>
  {:else}
    <div class="card p-0 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-800/50 border-b [border-color:var(--border)]">
            <tr>
              <th class="table-header px-4 py-3 text-left">Symbol</th>
              <th class="table-header px-4 py-3 text-left">Dir.</th>
              <th class="table-header px-4 py-3 text-right">Entry</th>
              <th class="table-header px-4 py-3 text-right">CMP / Exit</th>
              <th class="table-header px-4 py-3 text-right">P&L</th>
              <th class="table-header px-4 py-3 text-center">R:R</th>
              <th class="table-header px-4 py-3 text-center">Outcome</th>
              <th class="table-header px-4 py-3 text-center">Emotion</th>
              <th class="table-header px-4 py-3 text-left">Date</th>
              <th class="table-header px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredTrades as trade (trade.id)}
              {@const fp = floatingPnLMap[trade.id]}
              {@const lpr = livePrices[trade.symbol]}
              {@const displayPnl = fp ? fp.pnl : trade.net_pnl}
              {@const displayCmp = fp ? fp.cmp : trade.exit_price}
              <tr
                class="border-b [border-color:var(--border)]/50 hover:bg-gray-800/20 transition-colors {trade.status ===
                'open'
                  ? 'bg-sky-950/10'
                  : ''}"
              >
                <td class="px-4 py-3">
                  <div class="font-semibold [color:var(--text)]">
                    {trade.symbol}
                  </div>
                  {#if trade.status === "open" && lpr}
                    <div
                      class="text-xs {lpr.changePct >= 0
                        ? 'text-emerald-500'
                        : 'text-red-500'}"
                    >
                      {lpr.changePct >= 0 ? "▲" : "▼"}{Math.abs(
                        lpr.changePct,
                      ).toFixed(2)}% today
                    </div>
                  {/if}
                </td>
                <td class="px-4 py-3">
                  <span
                    class="badge {trade.type === 'long'
                      ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-800/40'
                      : 'bg-red-900/40 text-red-400 border border-red-800/40'}"
                  >
                    {trade.type === "long" ? "▲ Long" : "▼ Short"}
                  </span>
                </td>
                <td class="px-4 py-3 text-right [color:var(--text2)]"
                  >{fmtPrice(trade.entry_price)}</td
                >
                <td class="px-4 py-3 text-right">
                  {#if trade.status === "open"}
                    {#if displayCmp}
                      <div class="text-sky-300 font-medium">
                        {fmtPrice(displayCmp)}
                      </div>
                      <div class="text-xs text-sky-600">CMP</div>
                    {:else}
                      <div class="[color:var(--text3)] text-xs italic">
                        fetching...
                      </div>
                    {/if}
                  {:else if trade.exit_price}
                    <div class="[color:var(--text2)]">
                      {fmtPrice(trade.exit_price)}
                    </div>
                    <div class="text-xs [color:var(--text3)]">exit</div>
                  {:else}
                    <span class="[color:var(--text3)]">—</span>
                  {/if}
                </td>
                <td class="px-4 py-3 text-right">
                  <div class="font-semibold {pnlClass(displayPnl)}">
                    {displayPnl >= 0 ? "+" : ""}{fmtInr(displayPnl)}
                  </div>
                  {#if trade.status === "open"}
                    <div class="text-xs text-sky-500 font-medium">floating</div>
                  {/if}
                </td>
                <td class="px-4 py-3 text-center [color:var(--text2)]"
                  >{trade.actual_rr?.toFixed(1) ?? "—"}</td
                >
                <td class="px-4 py-3 text-center">
                  {#if trade.status === "open"}
                    <span
                      class="badge bg-sky-900/40 text-sky-400 border border-sky-800/40"
                      >open</span
                    >
                  {:else}
                    <span class="badge-{trade.outcome}">{trade.outcome}</span>
                  {/if}
                </td>
                <td class="px-4 py-3 text-center text-xs [color:var(--text3)]"
                  >{trade.emotion}</td
                >
                <td class="px-4 py-3 [color:var(--text3)] text-xs"
                  >{trade.entry_date?.slice(0, 10)}</td
                >
                <td class="px-4 py-3">
                  <div class="flex items-center justify-center gap-2">
                    <button
                      class="[color:var(--text3)] hover:text-sky-400 transition-colors"
                      onclick={() => editTrade(trade)}
                      title="Edit">✏️</button
                    >
                    <button
                      class="[color:var(--text3)] hover:text-purple-400 transition-colors"
                      onclick={() => {
                        editTrade(trade);
                        setTimeout(() => analyzeTrade(trade), 100);
                      }}
                      title="AI Analysis">✨</button
                    >
                    <button
                      class="[color:var(--text3)] hover:text-red-400 transition-colors"
                      onclick={() => deleteTrade(trade.id)}
                      title="Delete">🗑️</button
                    >
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <div
        class="px-4 py-2 border-t [border-color:var(--border)] text-xs [color:var(--text3)] flex items-center justify-between"
      >
        <span>Showing {filteredTrades.length} of {trades.length} trades</span>
        <span class="[color:var(--text3)]"
          >Live prices via Yahoo Finance · 15s refresh</span
        >
      </div>
    </div>
  {/if}
</div>

<!-- Trade Modal -->
{#if showModal && editingTrade}
  <div
    class="modal-backdrop"
    onclick={(e) => e.target === e.currentTarget && (showModal = false)}
  >
    <div class="modal max-w-4xl">
      <div
        class="flex items-center justify-between px-6 py-4 border-b [border-color:var(--border)]"
      >
        <h2 class="text-lg font-semibold [color:var(--text)]">
          {editingTrade.id ? "Edit Trade" : "New Trade"}
        </h2>
        <button
          class="[color:var(--text3)] hover:[color:var(--text2)] text-xl"
          onclick={() => (showModal = false)}>✕</button
        >
      </div>
      <div class="p-6 space-y-5">
        <!-- Instrument Live Search -->
        <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div class="md:col-span-2">
            <label class="label">Symbol / Instrument *</label>
            <div class="relative">
              <!-- Search input -->
              <div class="relative">
                <span
                  class="absolute left-3 top-1/2 -translate-y-1/2 [color:var(--text3)] text-sm"
                  >🔍</span
                >
                <input
                  class="input pl-8 pr-8"
                  placeholder="Search symbol or company... e.g. RELIANCE, NIFTY, TCS"
                  value={instrSearchQuery}
                  oninput={onInstrSearchInput}
                  onfocus={() => {
                    instrSearchFocused = true;
                    if (instrSearchQuery.length > 0)
                      searchInstruments(instrSearchQuery);
                  }}
                  onblur={() =>
                    setTimeout(() => {
                      instrSearchFocused = false;
                    }, 200)}
                  autocomplete="off"
                  spellcheck="false"
                />
                {#if instrSearchLoading}
                  <span
                    class="absolute right-3 top-1/2 -translate-y-1/2 [color:var(--text3)] text-xs animate-pulse"
                    >...</span
                  >
                {:else if instrSearchQuery}
                  <button
                    class="absolute right-3 top-1/2 -translate-y-1/2 [color:var(--text3)] hover:[color:var(--text2)] text-sm"
                    onclick={() => {
                      instrSearchQuery = "";
                      instrSearchResults = [];
                      editingTrade = {
                        ...editingTrade!,
                        symbol: "",
                        instrument_id: undefined,
                      };
                      selectedInstrumentName = "";
                      instrumentOverride = null;
                    }}>✕</button
                  >
                {/if}
              </div>

              <!-- Dropdown results -->
              {#if instrSearchFocused && instrSearchResults.length > 0}
                <div
                  class="absolute z-50 top-full left-0 right-0 mt-1 [background:var(--bg2)] border border-gray-700 rounded-xl shadow-2xl overflow-hidden"
                >
                  {#each instrSearchResults as result}
                    <button
                      class="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-800 transition-colors text-left border-b [border-color:var(--border)] last:border-0"
                      onclick={() => selectInstrumentFromSearch(result)}
                    >
                      <!-- Exchange badge -->
                      <span
                        class="flex-shrink-0 text-xs font-bold px-1.5 py-0.5 rounded
                        {result.exchange === 'NSE'
                          ? 'bg-blue-900/60 text-blue-300'
                          : result.exchange === 'BSE'
                            ? 'bg-orange-900/60 text-orange-300'
                            : result.exchange === 'MCX'
                              ? 'bg-yellow-900/60 text-yellow-300'
                              : result.exchange === 'Crypto'
                                ? 'bg-purple-900/60 text-purple-300'
                                : 'bg-gray-800 [color:var(--text2)]'}"
                      >
                        {result.exchange}
                      </span>
                      <!-- Symbol + name -->
                      <div class="flex-1 min-w-0">
                        <div class="font-semibold [color:var(--text)] text-sm">
                          {result.symbol}
                        </div>
                        <div class="text-xs [color:var(--text2)] truncate">
                          {result.name}
                        </div>
                      </div>
                      <!-- Type + currency -->
                      <div class="flex-shrink-0 text-right">
                        <div class="text-xs [color:var(--text3)]">
                          {result.type}
                        </div>
                        <div
                          class="text-xs font-medium {result.currency === 'INR'
                            ? 'text-orange-400'
                            : '[color:var(--text2)]'}"
                        >
                          {result.currency === "INR"
                            ? "₹ INR"
                            : result.currency}
                        </div>
                      </div>
                    </button>
                  {/each}
                </div>
              {/if}

              <!-- No results hint -->
              {#if instrSearchFocused && instrSearchQuery.length >= 2 && !instrSearchLoading && instrSearchResults.length === 0}
                <div
                  class="absolute z-50 top-full left-0 right-0 mt-1 [background:var(--bg2)] border border-gray-700 rounded-xl px-4 py-3 text-sm [color:var(--text3)] shadow-2xl"
                >
                  No results for "{instrSearchQuery}" — try a different symbol
                  or company name
                </div>
              {/if}
            </div>

            <!-- Selected instrument chip -->
            {#if editingTrade.symbol && selectedInstrumentName}
              <div class="mt-2 flex items-center gap-2 text-xs">
                <span
                  class="bg-sky-900/30 border border-sky-800/40 text-sky-300 px-2 py-1 rounded-lg font-medium"
                  >{editingTrade.symbol}</span
                >
                <span class="[color:var(--text3)]"
                  >{selectedInstrumentName}</span
                >
              </div>
            {/if}

            <!-- Live CMP after selection -->
            {#if editingTrade.symbol && livePrices[editingTrade.symbol]}
              {@const lpr = livePrices[editingTrade.symbol]}
              <div class="mt-1.5 flex items-center gap-3 text-xs">
                <span class="[color:var(--text3)]">Live CMP:</span>
                <span class="text-sky-400 font-semibold"
                  >{fmtPrice(lpr.price)}</span
                >
                <span
                  class={lpr.changePct >= 0
                    ? "text-emerald-400"
                    : "text-red-400"}
                >
                  {lpr.changePct >= 0 ? "▲" : "▼"}
                  {lpr.change >= 0 ? "+" : ""}{fmtInr(Math.abs(lpr.change))} ({lpr.changePct >=
                  0
                    ? "+"
                    : ""}{lpr.changePct}%)
                </span>
              </div>
            {/if}
          </div>

          <div>
            <label class="label">Direction *</label>
            <select class="input" bind:value={editingTrade.type}>
              <option value="long">▲ Long / Buy</option>
              <option value="short">▼ Short / Sell</option>
            </select>
          </div>
        </div>

        <!-- Price levels + Leverage -->
        <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label class="label">Status</label>
            <select class="input" bind:value={editingTrade.status}>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
              <option value="partial">Partial</option>
            </select>
          </div>
          <div>
            <label class="label">Entry Price (₹) *</label>
            <input
              class="input"
              type="number"
              step="any"
              bind:value={editingTrade.entry_price}
              oninput={recalculate}
            />
          </div>
          <div>
            <label class="label">Exit Price (₹)</label>
            <input
              class="input"
              type="number"
              step="any"
              bind:value={editingTrade.exit_price}
              oninput={recalculate}
            />
          </div>
          <div>
            <label class="label">Stop Loss (₹) *</label>
            <input
              class="input"
              type="number"
              step="any"
              bind:value={editingTrade.stop_loss}
              oninput={recalculate}
            />
          </div>
          <div>
            <label class="label">Target / Take Profit (₹)</label>
            <input
              class="input"
              type="number"
              step="any"
              bind:value={editingTrade.take_profit}
              oninput={recalculate}
            />
          </div>
          <div>
            <label class="label">Quantity (shares)</label>
            <input
              class="input"
              type="number"
              step="any"
              bind:value={editingTrade.quantity}
              oninput={recalculate}
            />
          </div>
        </div>

        <!-- Leverage Section -->
        <div
          class="bg-indigo-950/30 border border-indigo-800/30 rounded-xl p-4"
        >
          <div class="flex items-center gap-2 mb-3">
            <span class="text-indigo-400 font-semibold text-sm"
              >⚡ Leverage & Margin</span
            >
            <span class="text-xs [color:var(--text3)]"
              >(Indian brokers: up to 5x on stocks, higher on F&O)</span
            >
          </div>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label class="label">Leverage</label>
              <div class="flex gap-1">
                {#each [1, 2, 3, 4, 5] as lv}
                  <button
                    class="flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors
                      {(editingTrade as any).leverage === lv
                      ? 'bg-indigo-700 border-indigo-500 [color:var(--text)]'
                      : 'bg-gray-800 border-gray-700 [color:var(--text2)] hover:border-indigo-600'}"
                    onclick={() => {
                      (editingTrade as any).leverage = lv;
                      recalculate();
                    }}>{lv}x</button
                  >
                {/each}
              </div>
            </div>
            <div>
              <label class="label">Custom Leverage</label>
              <input
                class="input"
                type="number"
                min="1"
                max="100"
                step="0.5"
                value={(editingTrade as any).leverage ?? 1}
                oninput={(e) => {
                  (editingTrade as any).leverage =
                    parseFloat((e.target as HTMLInputElement).value) || 1;
                  recalculate();
                }}
                placeholder="e.g. 4.5"
              />
            </div>
            <div>
              <label class="label">Position Value (Notional)</label>
              <div
                class="input bg-gray-800/50 [color:var(--text2)] font-medium"
              >
                {fmtInr(
                  (editingTrade.quantity ?? 0) *
                    (editingTrade.entry_price ?? 0),
                )}
              </div>
            </div>
            <div>
              <label class="label">Margin Required</label>
              <div
                class="input bg-indigo-900/20 text-indigo-300 font-semibold border-indigo-800/40"
              >
                {fmtInr(
                  (editingTrade as any).margin_used ??
                    ((editingTrade.quantity ?? 0) *
                      (editingTrade.entry_price ?? 0)) /
                      ((editingTrade as any).leverage ?? 1),
                )}
              </div>
            </div>
          </div>
          <!-- Leverage risk warning -->
          {#if ((editingTrade as any).leverage ?? 1) >= 4}
            <div
              class="mt-3 flex items-center gap-2 text-xs text-yellow-400 bg-yellow-900/20 border border-yellow-800/30 rounded-lg px-3 py-2"
            >
              ⚠️ High leverage ({(editingTrade as any).leverage}x) — a {(
                (1 / (editingTrade as any).leverage) *
                100
              ).toFixed(0)}% adverse move wipes your margin. Use strict stop
              loss.
            </div>
          {/if}
        </div>

        <!-- Costs -->
        <div>
          <h3 class="font-medium [color:var(--text2)] text-sm mb-2">
            Charges (₹)
          </h3>
          <div class="grid grid-cols-3 gap-4">
            <div>
              <label class="label">Brokerage</label><input
                class="input"
                type="number"
                step="any"
                bind:value={editingTrade.fees}
                oninput={recalculate}
              />
            </div>
            <div>
              <label class="label">STT / Taxes</label><input
                class="input"
                type="number"
                step="any"
                bind:value={editingTrade.commissions}
                oninput={recalculate}
              />
            </div>
            <div>
              <label class="label">Slippage</label><input
                class="input"
                type="number"
                step="any"
                bind:value={editingTrade.slippage}
                oninput={recalculate}
              />
            </div>
          </div>
        </div>

        <!-- Auto-calculated P&L -->
        <div
          class="bg-gray-800/40 rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm"
        >
          <div>
            <div class="[color:var(--text3)] text-xs mb-1">Gross P&L</div>
            <div
              class="font-semibold {(editingTrade.gross_pnl ?? 0) >= 0
                ? 'text-emerald-400'
                : 'text-red-400'}"
            >
              {(editingTrade.gross_pnl ?? 0) >= 0 ? "+" : ""}{fmtInr(
                editingTrade.gross_pnl ?? 0,
              )}
            </div>
          </div>
          <div>
            <div class="[color:var(--text3)] text-xs mb-1">Net P&L</div>
            <div
              class="font-semibold {(editingTrade.net_pnl ?? 0) >= 0
                ? 'text-emerald-400'
                : 'text-red-400'}"
            >
              {(editingTrade.net_pnl ?? 0) >= 0 ? "+" : ""}{fmtInr(
                editingTrade.net_pnl ?? 0,
              )}
            </div>
          </div>
          <div>
            <div class="[color:var(--text3)] text-xs mb-1">Expected R:R</div>
            <div class="font-semibold text-sky-400">
              {editingTrade.expected_rr?.toFixed(2) ?? "0"}
            </div>
          </div>
          <div>
            <div class="[color:var(--text3)] text-xs mb-1">Actual R:R</div>
            <div class="font-semibold text-sky-400">
              {editingTrade.actual_rr?.toFixed(2) ?? "0"}
            </div>
          </div>
          {#if ((editingTrade as any).leverage ?? 1) > 1}
            <div>
              <div class="[color:var(--text3)] text-xs mb-1">
                Return on Margin
              </div>
              <div
                class="font-semibold {(editingTrade.net_pnl ?? 0) >= 0
                  ? 'text-emerald-400'
                  : 'text-red-400'}"
              >
                {#if (editingTrade as any).margin_used > 0}
                  {(
                    ((editingTrade.net_pnl ?? 0) /
                      (editingTrade as any).margin_used) *
                    100
                  ).toFixed(2)}%
                {:else}—{/if}
              </div>
            </div>
            <div>
              <div class="[color:var(--text3)] text-xs mb-1">Leverage Used</div>
              <div class="font-semibold text-indigo-400">
                {(editingTrade as any).leverage}x
              </div>
            </div>
          {/if}
        </div>

        <!-- Context -->
        <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label class="label">Entry Date & Time</label>
            <input
              class="input"
              type="datetime-local"
              bind:value={editingTrade.entry_date}
            />
          </div>
          <div>
            <label class="label">Exit Date & Time</label>
            <input
              class="input"
              type="datetime-local"
              bind:value={editingTrade.exit_date}
            />
          </div>
          <div>
            <label class="label">Strategy</label>
            <select
              class="input"
              onchange={onStrategyChange}
              value={editingTrade.strategy_id ?? ""}
            >
              <option value="">No strategy</option>
              {#each strategies as s}<option value={s.id}>{s.name}</option
                >{/each}
            </select>
          </div>
          <div>
            <label class="label">Emotion</label>
            <select class="input" bind:value={editingTrade.emotion}>
              <option value="disciplined">Disciplined</option>
              <option value="confident">Confident</option>
              <option value="neutral">Neutral</option>
              <option value="fearful">Fearful</option>
              <option value="greedy">Greedy</option>
              <option value="revenge">Revenge</option>
              <option value="fomo">FOMO</option>
            </select>
          </div>
          <div>
            <label class="label">Market Condition</label>
            <select class="input" bind:value={editingTrade.market_condition}>
              <option value="trending">Trending</option>
              <option value="ranging">Ranging / Sideways</option>
              <option value="volatile">Volatile</option>
              <option value="quiet">Quiet</option>
            </select>
          </div>
          <div>
            <label class="label">Session Quality (1–5)</label>
            <input
              class="input"
              type="number"
              min="1"
              max="5"
              bind:value={editingTrade.session_quality}
            />
          </div>
        </div>

        <!-- Followed plan -->
        <label class="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            class="w-4 h-4 rounded"
            bind:checked={editingTrade.followed_plan}
          />
          <span class="[color:var(--text2)] font-medium"
            >Followed Trading Plan</span
          >
        </label>

        <!-- Checklist -->
        {#if selectedStrategy?.checklist_items?.length}
          <div>
            <h3 class="font-medium [color:var(--text2)] mb-3">
              Checklist <span class="text-sky-400 text-sm"
                >{checklistProgress}</span
              >
            </h3>
            <div class="space-y-2">
              {#each selectedStrategy.checklist_items as item}
                <label
                  class="flex items-start gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-800/40"
                >
                  <input
                    type="checkbox"
                    class="mt-0.5 w-4 h-4"
                    checked={editingTrade.checklist_items?.[item.id] ?? false}
                    onchange={(e) =>
                      (editingTrade = {
                        ...editingTrade!,
                        checklist_items: {
                          ...editingTrade!.checklist_items,
                          [item.id]: e.currentTarget.checked,
                        },
                      })}
                  />
                  <div>
                    <span class="[color:var(--text2)] text-sm">{item.text}</span
                    >
                    <span
                      class="ml-2 badge {item.category === 'pre-trade'
                        ? 'bg-blue-900/40 text-blue-400'
                        : item.category === 'during-trade'
                          ? 'bg-yellow-900/40 text-yellow-400'
                          : 'bg-gray-800 [color:var(--text2)]'}"
                      >{item.category}</span
                    >
                    {#if item.required}<span class="text-red-400 text-xs ml-1"
                        >*required</span
                      >{/if}
                  </div>
                </label>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Notes -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="label">Pre-Trade Notes (Thesis)</label><textarea
              class="input min-h-[70px]"
              placeholder="Why are you taking this trade?"
              bind:value={editingTrade.pre_trade_notes}
            ></textarea>
          </div>
          <div>
            <label class="label">Post-Trade Notes</label><textarea
              class="input min-h-[70px]"
              placeholder="What happened?"
              bind:value={editingTrade.post_trade_notes}
            ></textarea>
          </div>
          <div>
            <label class="label">Mistakes</label><textarea
              class="input min-h-[60px]"
              placeholder="What went wrong?"
              bind:value={editingTrade.mistakes}
            ></textarea>
          </div>
          <div>
            <label class="label">Lessons Learned</label><textarea
              class="input min-h-[60px]"
              placeholder="Key takeaway?"
              bind:value={editingTrade.lessons_learned}
            ></textarea>
          </div>
        </div>

        <!-- AI Deep Analysis Panel -->
        {#if analyzing}
          <div
            class="bg-gray-800/60 rounded-xl p-6 border border-purple-800/30 text-center"
          >
            <div class="text-2xl mb-2 animate-pulse">🧠</div>
            <div class="text-sm [color:var(--text2)] font-medium">
              Gemini is analysing this trade...
            </div>
            <div class="text-xs [color:var(--text3)] mt-1">
              Reading strategy rules, checklist, risk management, and your
              trading history
            </div>
          </div>
        {:else if analysisResult}
          <div
            class="[background:var(--bg2)]/80 rounded-xl border border-purple-800/30 overflow-hidden"
          >
            <!-- Header: Score + Summary -->
            <div
              class="bg-gradient-to-r from-purple-900/30 to-indigo-900/20 px-5 py-4 border-b border-purple-800/20"
            >
              <div class="flex items-start gap-4">
                <div class="text-center flex-shrink-0">
                  <div
                    class="text-4xl font-black {analysisResult.score >= 80
                      ? 'text-emerald-400'
                      : analysisResult.score >= 65
                        ? 'text-sky-400'
                        : analysisResult.score >= 50
                          ? 'text-yellow-400'
                          : 'text-red-400'}"
                  >
                    {analysisResult.score}
                  </div>
                  <div class="text-lg font-bold [color:var(--text2)]">
                    {analysisResult.grade ?? ""}
                  </div>
                </div>
                <div class="flex-1">
                  <div class="text-xs font-semibold text-purple-400 mb-1">
                    🧠 AI DEEP ANALYSIS
                  </div>
                  <p class="text-sm [color:var(--text)] leading-relaxed">
                    {analysisResult.summary}
                  </p>
                </div>
              </div>
            </div>

            <!-- Section scores -->
            <div
              class="grid grid-cols-5 divide-x divide-gray-800 border-b [border-color:var(--border)]"
            >
              {#each [{ label: "Strategy", key: "strategy_compliance" }, { label: "Checklist", key: "checklist_analysis" }, { label: "Risk", key: "risk_management" }, { label: "Execution", key: "execution" }, { label: "Psychology", key: "psychology" }] as section}
                {@const s = analysisResult[section.key]?.score ?? 0}
                <div class="px-3 py-2 text-center">
                  <div class="text-xs [color:var(--text3)] mb-1">
                    {section.label}
                  </div>
                  <div
                    class="text-base font-bold {s >= 75
                      ? 'text-emerald-400'
                      : s >= 55
                        ? 'text-yellow-400'
                        : 'text-red-400'}"
                  >
                    {s}
                  </div>
                </div>
              {/each}
            </div>

            <div class="p-4 space-y-4">
              <!-- Strategy Compliance -->
              {#if analysisResult.strategy_compliance}
                {@const sc = analysisResult.strategy_compliance}
                <div>
                  <div class="text-xs font-semibold [color:var(--text2)] mb-2">
                    📋 STRATEGY COMPLIANCE
                  </div>
                  <p class="text-xs [color:var(--text2)] mb-2 italic">
                    {sc.verdict}
                  </p>
                  {#if sc.followed?.length}
                    <div class="space-y-1 mb-2">
                      {#each sc.followed as r}
                        <div class="flex gap-2 text-xs">
                          <span class="text-emerald-400 flex-shrink-0">✓</span
                          ><span class="[color:var(--text2)]">{r}</span>
                        </div>
                      {/each}
                    </div>
                  {/if}
                  {#if sc.violated?.length}
                    <div class="space-y-1">
                      {#each sc.violated as r}
                        <div class="flex gap-2 text-xs">
                          <span class="text-red-400 flex-shrink-0">✗</span><span
                            class="[color:var(--text2)]">{r}</span
                          >
                        </div>
                      {/each}
                    </div>
                  {/if}
                </div>
              {/if}

              <!-- Risk Management -->
              {#if analysisResult.risk_management}
                {@const rm = analysisResult.risk_management}
                <div class="bg-gray-800/40 rounded-lg p-3">
                  <div class="text-xs font-semibold [color:var(--text2)] mb-2">
                    ⚖️ RISK MANAGEMENT
                  </div>
                  <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div>
                      <span class="[color:var(--text3)]">Stop: </span><span
                        class="[color:var(--text2)]">{rm.stop_quality}</span
                      >
                    </div>
                    <div>
                      <span class="[color:var(--text3)]">Leverage: </span><span
                        class="[color:var(--text2)]">{rm.leverage_verdict}</span
                      >
                    </div>
                    <div>
                      <span class="[color:var(--text3)]">Sizing: </span><span
                        class="[color:var(--text2)]">{rm.sizing_verdict}</span
                      >
                    </div>
                    <div>
                      <span class="[color:var(--text3)]">R:R: </span><span
                        class="[color:var(--text2)]">{rm.rr_verdict}</span
                      >
                    </div>
                  </div>
                </div>
              {/if}

              <!-- Checklist misses -->
              {#if analysisResult.checklist_analysis?.critical_misses?.length}
                <div>
                  <div class="text-xs font-semibold [color:var(--text2)] mb-2">
                    ⚠️ CHECKLIST — CRITICAL MISSES
                  </div>
                  <div class="space-y-1">
                    {#each analysisResult.checklist_analysis.critical_misses as miss}
                      <div
                        class="flex gap-2 text-xs bg-red-900/10 border border-red-800/20 rounded px-2 py-1"
                      >
                        <span class="text-red-400 flex-shrink-0">✗</span>
                        <span class="[color:var(--text2)]">{miss}</span>
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}

              <!-- Psychology -->
              {#if analysisResult.psychology}
                {@const ps = analysisResult.psychology}
                <div
                  class="bg-indigo-900/10 border border-indigo-800/20 rounded-lg p-3"
                >
                  <div class="text-xs font-semibold text-indigo-400 mb-1">
                    🧠 PSYCHOLOGY — {ps.overall}
                  </div>
                  <p class="text-xs [color:var(--text2)]">{ps.state_impact}</p>
                  {#if ps.pattern_match && ps.pattern_match !== "none"}
                    <p class="text-xs [color:var(--text3)] mt-1 italic">
                      Pattern: {ps.pattern_match}
                    </p>
                  {/if}
                </div>
              {/if}

              <!-- Open Position Guidance (only for open trades with CMP) -->
              {#if analysisResult.open_position_guidance}
                {@const opg = analysisResult.open_position_guidance}
                <div
                  class="bg-sky-900/20 border border-sky-700/40 rounded-lg p-3"
                >
                  <div class="text-xs font-semibold text-sky-400 mb-2">
                    📡 LIVE POSITION GUIDANCE
                  </div>
                  <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-2">
                    <div>
                      <span class="[color:var(--text3)]">Status: </span><span
                        class="[color:var(--text)] font-medium"
                        >{opg.current_status}</span
                      >
                    </div>
                    <div>
                      <span class="[color:var(--text3)]"
                        >Risk if held:
                      </span><span class="text-red-400">{opg.risk_if_held}</span
                      >
                    </div>
                  </div>
                  <div class="bg-sky-900/30 rounded px-2 py-1.5">
                    <span class="text-xs font-semibold text-sky-300"
                      >Action: {opg.action}</span
                    >
                    <p class="text-xs [color:var(--text2)] mt-0.5">
                      {opg.reasoning}
                    </p>
                  </div>
                </div>
              {/if}

              <!-- Insights -->
              {#if analysisResult.insights?.length}
                <div>
                  <div class="text-xs font-semibold [color:var(--text2)] mb-2">
                    💡 INSIGHTS
                  </div>
                  <div class="space-y-2">
                    {#each analysisResult.insights as ins}
                      <div
                        class="flex gap-3 p-2.5 rounded-lg {ins.severity ===
                        'success'
                          ? 'bg-emerald-900/15 border border-emerald-800/20'
                          : ins.severity === 'warning'
                            ? 'bg-yellow-900/15 border border-yellow-800/20'
                            : 'bg-red-900/15 border border-red-800/20'}"
                      >
                        <span class="flex-shrink-0 text-sm"
                          >{ins.severity === "success"
                            ? "✅"
                            : ins.severity === "warning"
                              ? "⚠️"
                              : "🚨"}</span
                        >
                        <div class="min-w-0">
                          <div
                            class="text-xs font-semibold [color:var(--text2)]"
                          >
                            {ins.title}
                            <span class="[color:var(--text3)] font-normal"
                              >[{ins.category}]</span
                            >
                          </div>
                          <p class="text-xs [color:var(--text2)] mt-0.5">
                            {ins.detail}
                          </p>
                          <p class="text-xs text-purple-400 mt-1">
                            → {ins.action}
                          </p>
                        </div>
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
          </div>
        {/if}
      </div>

      <div
        class="flex items-center justify-between px-6 py-4 border-t [border-color:var(--border)]"
      >
        <div>
          {#if editingTrade.id}
            <button
              class="btn-secondary btn-sm"
              onclick={() => analyzeTrade(editingTrade as Trade)}
              disabled={analyzing}
            >
              {analyzing ? "⏳ Analyzing..." : "✨ AI Analysis"}
            </button>
          {/if}
        </div>
        <div class="flex gap-3">
          <button class="btn-secondary" onclick={() => (showModal = false)}
            >Cancel</button
          >
          <button class="btn-primary" onclick={saveTrade}>Save Trade</button>
        </div>
      </div>
    </div>
  </div>
{/if}
