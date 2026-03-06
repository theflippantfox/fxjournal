<script lang="ts">
  import { onMount } from "svelte";
  import { selectedAccountId } from "$lib/stores";
  import type { Trade } from "$lib/types";

  let trades: Trade[] = [];
  let loading = true;
  let accountId = "";
  let currentDate = new Date();
  let selectedDay: string | null = null;

  selectedAccountId.subscribe((id) => {
    accountId = id;
    if (id) loadTrades();
  });
  onMount(() => {
    if (accountId) loadTrades();
  });

  async function loadTrades() {
    loading = true;
    trades = await fetch(`/api/trades?accountId=${accountId}`).then((r) =>
      r.json(),
    );
    loading = false;
  }

  $: year = currentDate.getFullYear();
  $: month = currentDate.getMonth();
  $: monthName = new Date(year, month, 1).toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  $: daysInMonth = new Date(year, month + 1, 0).getDate();
  $: firstDayOfWeek = new Date(year, month, 1).getDay();

  $: dayStats = (() => {
    const map: Record<
      string,
      { trades: Trade[]; pnl: number; wins: number; total: number }
    > = {};
    for (const t of trades) {
      const date = t.entry_date?.slice(0, 10);
      if (!date) continue;
      if (!map[date]) map[date] = { trades: [], pnl: 0, wins: 0, total: 0 };
      map[date].trades.push(t);
      map[date].pnl += t.net_pnl ?? 0;
      map[date].total++;
      if (t.outcome === "win") map[date].wins++;
    }
    return map;
  })();

  $: selectedDayTrades = selectedDay
    ? (dayStats[selectedDay]?.trades ?? [])
    : [];

  function prevMonth() {
    currentDate = new Date(year, month - 1, 1);
    selectedDay = null;
  }
  function nextMonth() {
    currentDate = new Date(year, month + 1, 1);
    selectedDay = null;
  }
  function goToday() {
    currentDate = new Date();
    selectedDay = null;
  }

  function dayKey(day: number) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function dayClass(day: number) {
    const key = dayKey(day);
    const stats = dayStats[key];
    if (!stats) return "[background:var(--bg2)] [border-color:var(--border)]";
    if (stats.pnl > 0)
      return "bg-emerald-900/30 border-emerald-700/40 hover:border-emerald-500";
    if (stats.pnl < 0)
      return "bg-red-900/30 border-red-700/40 hover:border-red-500";
    return "bg-yellow-900/20 border-yellow-700/40 hover:border-yellow-500";
  }

  $: monthTotal = Object.entries(dayStats)
    .filter(([k]) =>
      k.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`),
    )
    .reduce((s, [, v]) => s + v.pnl, 0);
  $: monthTrades = Object.entries(dayStats)
    .filter(([k]) =>
      k.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`),
    )
    .reduce((s, [, v]) => s + v.total, 0);
</script>

<div class="page">
  <div class="flex items-center justify-between mb-6">
    <h1 class="text-2xl font-bold [color:var(--text)]">Calendar</h1>
    <div class="flex items-center gap-2">
      <span class="text-sm [color:var(--text2)]"
        >{monthTrades} trades ·
        <span class={monthTotal >= 0 ? "text-emerald-400" : "text-red-400"}
          >${monthTotal.toFixed(2)}</span
        ></span
      >
    </div>
  </div>

  <div class="card">
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <button class="btn-secondary btn-sm" onclick={prevMonth}>← Prev</button>
      <div class="flex items-center gap-3">
        <h2 class="font-semibold [color:var(--text)] text-lg">{monthName}</h2>
        <button class="btn-secondary btn-sm" onclick={goToday}>Today</button>
      </div>
      <button class="btn-secondary btn-sm" onclick={nextMonth}>Next →</button>
    </div>

    <!-- Day names -->
    <div class="grid grid-cols-7 mb-2">
      {#each ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as day}
        <div class="text-center text-xs font-medium [color:var(--text3)] py-2">
          {day}
        </div>
      {/each}
    </div>

    <!-- Days grid -->
    <div class="grid grid-cols-7 gap-1">
      {#each Array(firstDayOfWeek) as _}
        <div></div>
      {/each}
      {#each Array(daysInMonth) as _, i}
        {@const day = i + 1}
        {@const key = dayKey(day)}
        {@const stats = dayStats[key]}
        {@const today = new Date().toISOString().slice(0, 10) === key}
        <button
          class="relative aspect-square border rounded-lg text-left p-1.5 transition-all duration-150 {dayClass(
            day,
          )} {selectedDay === key ? 'ring-2 ring-sky-500' : ''} {today
            ? 'ring-1 ring-sky-700'
            : ''}"
          onclick={() => (selectedDay = selectedDay === key ? null : key)}
        >
          <div
            class="text-xs font-medium {today
              ? 'text-sky-400'
              : '[color:var(--text2)]'}"
          >
            {day}
          </div>
          {#if stats}
            <div
              class="text-xs font-semibold {stats.pnl >= 0
                ? 'text-emerald-400'
                : 'text-red-400'}"
            >
              ${Math.abs(stats.pnl).toFixed(0)}
            </div>
            <div class="text-xs [color:var(--text3)]">{stats.total}t</div>
          {/if}
        </button>
      {/each}
    </div>

    <!-- Legend -->
    <div class="flex gap-4 mt-4 text-xs [color:var(--text3)]">
      <div class="flex items-center gap-1">
        <div
          class="w-3 h-3 bg-emerald-900/40 border border-emerald-700/40 rounded"
        ></div>
         Profit
      </div>
      <div class="flex items-center gap-1">
        <div
          class="w-3 h-3 bg-red-900/40 border border-red-700/40 rounded"
        ></div>
         Loss
      </div>
      <div class="flex items-center gap-1">
        <div
          class="w-3 h-3 bg-yellow-900/20 border border-yellow-700/40 rounded"
        ></div>
         Breakeven
      </div>
    </div>
  </div>

  <!-- Day detail -->
  {#if selectedDay && selectedDayTrades.length > 0}
    <div class="card mt-4">
      <div class="flex items-center justify-between mb-4">
        <h2 class="font-semibold [color:var(--text)]">{selectedDay}</h2>
        <div class="text-sm">
          <span class="[color:var(--text2)]"
            >{selectedDayTrades.length} trades ·
          </span>
          <span
            class="{(dayStats[selectedDay]?.pnl ?? 0) >= 0
              ? 'text-emerald-400'
              : 'text-red-400'} font-semibold"
            >${dayStats[selectedDay]?.pnl?.toFixed(2)}</span
          >
        </div>
      </div>
      <div class="space-y-2">
        {#each selectedDayTrades as trade}
          <div
            class="flex items-center gap-3 p-3 [background:var(--surface)]/40 rounded-lg"
          >
            <div
              class="w-2 h-2 rounded-full {trade.type === 'long'
                ? 'bg-emerald-500'
                : 'bg-red-500'}"
            ></div>
            <span class="font-medium [color:var(--text)] w-20"
              >{trade.symbol}</span
            >
            <span
              class="badge {trade.type === 'long'
                ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-800/40'
                : 'bg-red-900/40 text-red-400 border border-red-800/40'}"
              >{trade.type}</span
            >
            <span class="badge-{trade.outcome}">{trade.outcome}</span>
            <span class="text-sm [color:var(--text2)] flex-1"
              >{trade.emotion}</span
            >
            <span
              class="font-semibold {trade.net_pnl >= 0
                ? 'text-emerald-400'
                : 'text-red-400'}">${trade.net_pnl?.toFixed(2)}</span
            >
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>
