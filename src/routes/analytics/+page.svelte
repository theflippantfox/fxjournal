<script lang="ts">
  import { onMount } from "svelte";
  import { selectedAccountId } from "$lib/stores";
  import {
    calcWinRate,
    calcProfitFactor,
    calcExpectancy,
  } from "$lib/utils/calculations";
  import type { Trade, Strategy } from "$lib/types";

  let trades: Trade[] = [];
  let strategies: Strategy[] = [];
  let memory: any = null;
  let loading = true;
  let analyzing = false;
  let aiResult: any = null;
  let accountId = "";
  let activeTab: "overview" | "ai" | "breakdown" = "overview";

  selectedAccountId.subscribe((id) => {
    accountId = id;
    if (id) loadData();
  });

  async function loadData() {
    loading = true;
    const [t, s, m] = await Promise.all([
      fetch(`/api/trades?accountId=${accountId}`).then((r) => r.json()),
      fetch("/api/strategies").then((r) => r.json()),
      fetch(`/api/trader-memory?accountId=${accountId}`)
        .then((r) => r.json())
        .catch(() => null),
    ]);
    trades = t;
    strategies = s;
    memory = m;
    loading = false;
  }

  onMount(() => {
    if (accountId) loadData();
  });

  async function runAnalysis() {
    analyzing = true;
    activeTab = "ai";
    const res = await fetch("/api/ai-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId }),
    });
    aiResult = await res.json();
    // Reload memory after analysis
    memory = await fetch(`/api/trader-memory?accountId=${accountId}`)
      .then((r) => r.json())
      .catch(() => null);
    analyzing = false;
  }

  $: closed = trades.filter((t) => t.status === "closed");
  $: winRate = calcWinRate(trades);
  $: profitFactor = calcProfitFactor(trades);
  $: expectancy = calcExpectancy(trades);
  $: totalPnL = closed.reduce((s, t) => s + (t.net_pnl ?? 0), 0);

  $: bySymbol = (() => {
    const m: Record<string, { pnl: number; count: number; wins: number }> = {};
    for (const t of closed) {
      if (!m[t.symbol]) m[t.symbol] = { pnl: 0, count: 0, wins: 0 };
      m[t.symbol].pnl += t.net_pnl ?? 0;
      m[t.symbol].count++;
      if (t.outcome === "win") m[t.symbol].wins++;
    }
    return Object.entries(m)
      .map(([sym, v]) => ({
        sym,
        ...v,
        wr: v.count ? ((v.wins / v.count) * 100).toFixed(0) : "0",
      }))
      .sort((a, b) => b.pnl - a.pnl);
  })();

  $: byEmotion = [
    "disciplined",
    "confident",
    "neutral",
    "fearful",
    "greedy",
    "revenge",
    "fomo",
  ]
    .map((em) => {
      const emT = closed.filter((t) => t.emotion === em);
      const wins = emT.filter((t) => t.outcome === "win").length;
      return {
        em,
        count: emT.length,
        wr: emT.length ? ((wins / emT.length) * 100).toFixed(0) : "0",
        pnl: emT.reduce((s, t) => s + (t.net_pnl ?? 0), 0),
      };
    })
    .filter((e) => e.count > 0);

  $: byCondition = ["trending", "ranging", "volatile", "quiet"]
    .map((cond) => {
      const ct = closed.filter((t) => t.market_condition === cond);
      const wins = ct.filter((t) => t.outcome === "win").length;
      return {
        cond,
        count: ct.length,
        wr: ct.length ? ((wins / ct.length) * 100).toFixed(0) : "0",
        pnl: ct.reduce((s, t) => s + (t.net_pnl ?? 0), 0),
      };
    })
    .filter((c) => c.count > 0);

  $: byStrategy = strategies
    .map((strat) => {
      const st = closed.filter((t) => t.strategy_id === strat.id);
      const wins = st.filter((t) => t.outcome === "win").length;
      return {
        ...strat,
        count: st.length,
        wr: st.length ? ((wins / st.length) * 100).toFixed(0) : "0",
        pnl: st.reduce((s, t) => s + (t.net_pnl ?? 0), 0),
      };
    })
    .filter((s) => s.count > 0);

  $: planStats = (() => {
    const f = closed.filter((t) => t.followed_plan);
    const nf = closed.filter((t) => !t.followed_plan);
    return {
      f: {
        count: f.length,
        wr: f.length
          ? (
              (f.filter((t) => t.outcome === "win").length / f.length) *
              100
            ).toFixed(0)
          : "0",
        pnl: f.reduce((s, t) => s + (t.net_pnl ?? 0), 0),
      },
      nf: {
        count: nf.length,
        wr: nf.length
          ? (
              (nf.filter((t) => t.outcome === "win").length / nf.length) *
              100
            ).toFixed(0)
          : "0",
        pnl: nf.reduce((s, t) => s + (t.net_pnl ?? 0), 0),
      },
    };
  })();

  function scoreColor(s: number) {
    return s >= 80
      ? "text-emerald-400"
      : s >= 65
        ? "text-sky-400"
        : s >= 50
          ? "text-yellow-400"
          : "text-red-400";
  }
  function scoreBar(s: number) {
    return s >= 80
      ? "bg-emerald-500"
      : s >= 65
        ? "bg-sky-500"
        : s >= 50
          ? "bg-yellow-500"
          : "bg-red-500";
  }
  function inr(n: number) {
    return (
      "₹" + Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })
    );
  }
</script>

<div class="p-6 space-y-6">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold text-white">Analytics</h1>
      {#if memory?.last_analyzed_at}
        <p class="text-xs text-gray-500 mt-0.5">
          AI memory: {memory.analysis_count} sessions · Last analysed {new Date(
            memory.last_analyzed_at,
          ).toLocaleDateString("en-IN")}
        </p>
      {/if}
    </div>
    <button
      class="btn-primary flex items-center gap-2"
      onclick={runAnalysis}
      disabled={analyzing || !closed.length}
    >
      {#if analyzing}
        <span class="animate-spin">⏳</span> Analysing with Gemini Pro...
      {:else}
        🧠 {memory?.analysis_count ? "Re-analyse" : "Run AI Analysis"}
      {/if}
    </button>
  </div>

  {#if loading}
    <div class="text-center py-20 text-gray-500">Loading...</div>
  {:else if !accountId}
    <div class="card text-center py-12">
      <p class="text-gray-400">No account selected.</p>
    </div>
  {:else}
    <!-- Tabs -->
    <div class="flex gap-1 bg-gray-800/50 p-1 rounded-xl w-fit">
      {#each [["overview", "📊 Overview"], ["ai", "🧠 AI Analysis"], ["breakdown", "📈 Breakdown"]] as [tab, label]}
        <button
          class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {activeTab ===
          tab
            ? 'bg-gray-700 text-white'
            : 'text-gray-400 hover:text-gray-200'}"
          onclick={() => (activeTab = tab as any)}>{label}</button
        >
      {/each}
    </div>

    <!-- ── OVERVIEW TAB ── -->
    {#if activeTab === "overview"}
      <!-- Key metrics -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="stat-card">
          <div class="stat-label">Win Rate</div>
          <div
            class="stat-value {winRate >= 50
              ? 'text-emerald-400'
              : 'text-red-400'}"
          >
            {winRate}%
          </div>
          <div class="text-xs text-gray-500">{closed.length} closed trades</div>
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
          <div class="text-xs text-gray-500">>1.5 = good</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Expectancy</div>
          <div
            class="stat-value {expectancy >= 0
              ? 'text-emerald-400'
              : 'text-red-400'}"
          >
            ₹{expectancy.toFixed(0)}
          </div>
          <div class="text-xs text-gray-500">per trade</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total P&L</div>
          <div
            class="stat-value {totalPnL >= 0
              ? 'text-emerald-400'
              : 'text-red-400'}"
          >
            {totalPnL >= 0 ? "+" : ""}{inr(totalPnL)}
          </div>
        </div>
      </div>

      <!-- Plan adherence -->
      <div class="card">
        <h2 class="font-semibold text-gray-200 mb-4">
          📋 Plan Adherence Impact
        </h2>
        <div class="grid grid-cols-2 gap-4">
          <div
            class="bg-emerald-900/20 border border-emerald-800/30 rounded-xl p-4"
          >
            <div class="text-emerald-400 font-semibold mb-1">
              ✓ Followed Plan
            </div>
            <div class="text-2xl font-bold text-emerald-400">
              {planStats.f.wr}%
            </div>
            <div class="text-sm text-gray-400 mt-1">
              {planStats.f.count} trades · {planStats.f.pnl >= 0
                ? "+"
                : ""}{inr(planStats.f.pnl)}
            </div>
          </div>
          <div class="bg-red-900/20 border border-red-800/30 rounded-xl p-4">
            <div class="text-red-400 font-semibold mb-1">
              ✗ Deviated from Plan
            </div>
            <div class="text-2xl font-bold text-red-400">
              {planStats.nf.wr}%
            </div>
            <div class="text-sm text-gray-400 mt-1">
              {planStats.nf.count} trades · {planStats.nf.pnl >= 0
                ? "+"
                : ""}{inr(planStats.nf.pnl)}
            </div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- By Symbol -->
        <div class="card">
          <h2 class="font-semibold text-gray-200 mb-4">📊 By Symbol</h2>
          {#if bySymbol.length === 0}
            <p class="text-gray-500 text-sm">No data yet</p>
          {:else}
            <table class="w-full text-sm">
              <thead
                ><tr class="border-b border-gray-800"
                  ><th class="table-header py-2 text-left">Symbol</th><th
                    class="table-header py-2 text-center">Trades</th
                  ><th class="table-header py-2 text-center">WR%</th><th
                    class="table-header py-2 text-right">P&L</th
                  ></tr
                ></thead
              >
              <tbody>
                {#each bySymbol as row}
                  <tr class="border-b border-gray-800/30">
                    <td class="py-2 font-medium text-gray-200">{row.sym}</td>
                    <td class="py-2 text-center text-gray-400">{row.count}</td>
                    <td
                      class="py-2 text-center {Number(row.wr) >= 50
                        ? 'text-emerald-400'
                        : 'text-red-400'}">{row.wr}%</td
                    >
                    <td
                      class="py-2 text-right {row.pnl >= 0
                        ? 'pnl-positive'
                        : 'pnl-negative'}"
                      >{row.pnl >= 0 ? "+" : ""}{inr(row.pnl)}</td
                    >
                  </tr>
                {/each}
              </tbody>
            </table>
          {/if}
        </div>

        <!-- By Strategy -->
        <div class="card">
          <h2 class="font-semibold text-gray-200 mb-4">🎯 By Strategy</h2>
          {#if byStrategy.length === 0}
            <p class="text-gray-500 text-sm">No strategy data</p>
          {:else}
            <table class="w-full text-sm">
              <thead
                ><tr class="border-b border-gray-800"
                  ><th class="table-header py-2 text-left">Strategy</th><th
                    class="table-header py-2 text-center">Trades</th
                  ><th class="table-header py-2 text-center">WR%</th><th
                    class="table-header py-2 text-right">P&L</th
                  ></tr
                ></thead
              >
              <tbody>
                {#each byStrategy as row}
                  <tr class="border-b border-gray-800/30">
                    <td class="py-2 font-medium text-gray-200">{row.name}</td>
                    <td class="py-2 text-center text-gray-400">{row.count}</td>
                    <td
                      class="py-2 text-center {Number(row.wr) >= 50
                        ? 'text-emerald-400'
                        : 'text-red-400'}">{row.wr}%</td
                    >
                    <td
                      class="py-2 text-right {row.pnl >= 0
                        ? 'pnl-positive'
                        : 'pnl-negative'}"
                      >{row.pnl >= 0 ? "+" : ""}{inr(row.pnl)}</td
                    >
                  </tr>
                {/each}
              </tbody>
            </table>
          {/if}
        </div>

        <!-- By Emotion -->
        <div class="card">
          <h2 class="font-semibold text-gray-200 mb-4">🧠 Emotional State</h2>
          {#if byEmotion.length === 0}
            <p class="text-gray-500 text-sm">No data yet</p>
          {:else}
            <div class="space-y-2">
              {#each byEmotion.sort((a, b) => Number(b.wr) - Number(a.wr)) as e}
                <div class="flex items-center gap-3">
                  <span class="text-sm text-gray-400 w-20 capitalize"
                    >{e.em}</span
                  >
                  <div class="flex-1 bg-gray-800 rounded-full h-1.5">
                    <div
                      class="h-1.5 rounded-full {Number(e.wr) >= 55
                        ? 'bg-emerald-500'
                        : Number(e.wr) >= 40
                          ? 'bg-yellow-500'
                          : 'bg-red-500'}"
                      style="width: {e.wr}%"
                    ></div>
                  </div>
                  <span class="text-xs text-gray-400 w-10 text-right"
                    >{e.wr}%</span
                  >
                  <span
                    class="text-xs {e.pnl >= 0
                      ? 'text-emerald-400'
                      : 'text-red-400'} w-20 text-right"
                    >{e.pnl >= 0 ? "+" : ""}{inr(e.pnl)}</span
                  >
                  <span class="text-xs text-gray-600 w-8">{e.count}x</span>
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <!-- By Market Condition -->
        <div class="card">
          <h2 class="font-semibold text-gray-200 mb-4">🌊 Market Conditions</h2>
          {#if byCondition.length === 0}
            <p class="text-gray-500 text-sm">No data yet</p>
          {:else}
            <div class="space-y-3">
              {#each byCondition as c}
                <div
                  class="flex items-center justify-between p-3 bg-gray-800/40 rounded-lg"
                >
                  <span class="font-medium text-gray-300 capitalize"
                    >{c.cond}</span
                  >
                  <div class="flex items-center gap-4">
                    <span class="text-sm text-gray-400">{c.count} trades</span>
                    <span
                      class="text-sm {Number(c.wr) >= 50
                        ? 'text-emerald-400'
                        : 'text-red-400'}">{c.wr}% WR</span
                    >
                    <span
                      class="text-sm font-semibold {c.pnl >= 0
                        ? 'text-emerald-400'
                        : 'text-red-400'}"
                      >{c.pnl >= 0 ? "+" : ""}{inr(c.pnl)}</span
                    >
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    {/if}

    <!-- ── AI ANALYSIS TAB ── -->
    {#if activeTab === "ai"}
      {#if analyzing}
        <div class="card text-center py-16">
          <div class="text-4xl mb-4 animate-pulse">🧠</div>
          <div class="text-white font-semibold text-lg mb-2">
            Gemini Pro is analysing your trading...
          </div>
          <div class="text-gray-400 text-sm max-w-md mx-auto">
            Reading all {closed.length} trades, your strategy rules, checklists,
            leverage patterns, and {memory
              ? "your full trading history"
              : "building your profile from scratch"}.
          </div>
          <div class="mt-4 text-xs text-gray-600">
            This takes 15-30 seconds for a thorough analysis
          </div>
        </div>
      {:else if !aiResult}
        <div class="card text-center py-16">
          <div class="text-4xl mb-4">🧠</div>
          <div class="text-white font-semibold text-lg mb-2">
            AI Coach Analysis
          </div>
          {#if memory?.coach_notes}
            <div
              class="max-w-lg mx-auto mb-6 bg-purple-900/20 border border-purple-800/30 rounded-xl p-4 text-left"
            >
              <div class="text-xs font-semibold text-purple-400 mb-2">
                COACH MEMORY ({memory.analysis_count} sessions)
              </div>
              <p class="text-sm text-gray-300 italic">"{memory.coach_notes}"</p>
              {#if memory.most_common_mistake}
                <p class="text-xs text-gray-500 mt-2">
                  Most common mistake: {memory.most_common_mistake}
                </p>
              {/if}
            </div>
          {:else}
            <p class="text-gray-400 text-sm mb-6">
              Run your first AI analysis to get a deep, personalised breakdown
              of your trading patterns, strategy compliance, risk management,
              and a 30-day improvement plan.
            </p>
          {/if}
          <button
            class="btn-primary"
            onclick={runAnalysis}
            disabled={!closed.length}
          >
            🧠 {memory?.analysis_count
              ? "Run New Analysis"
              : "Run First Analysis"}
          </button>
          {#if !closed.length}<p class="text-gray-600 text-xs mt-2">
              Log some closed trades first
            </p>{/if}
        </div>
      {:else}
        <!-- Score header -->
        <div
          class="card bg-gradient-to-r from-purple-900/20 to-indigo-900/20 border-purple-800/30"
        >
          <div class="flex items-start gap-6">
            <div class="text-center">
              <div class="text-6xl font-black {scoreColor(aiResult.score)}">
                {aiResult.score}
              </div>
              <div class="text-2xl font-bold text-gray-300">
                {aiResult.grade}
              </div>
              <div class="text-xs text-gray-500 mt-1">Overall Score</div>
            </div>
            <div class="flex-1">
              <p class="text-gray-200 text-sm leading-relaxed mb-3">
                {aiResult.summary}
              </p>
              {#if aiResult.edge_analysis}
                <div
                  class="bg-sky-900/20 border border-sky-800/30 rounded-lg p-3 mb-2"
                >
                  <div class="text-xs font-semibold text-sky-400 mb-1">
                    ⚡ YOUR EDGE
                  </div>
                  <p class="text-xs text-gray-300">{aiResult.edge_analysis}</p>
                </div>
              {/if}
              {#if aiResult.biggest_leak}
                <div
                  class="bg-red-900/20 border border-red-800/30 rounded-lg p-3"
                >
                  <div class="text-xs font-semibold text-red-400 mb-1">
                    🚨 BIGGEST LEAK
                  </div>
                  <p class="text-xs text-gray-300">{aiResult.biggest_leak}</p>
                </div>
              {/if}
            </div>
          </div>
        </div>

        <!-- Module scores -->
        {#if aiResult.module_scores}
          <div class="card">
            <h2 class="font-semibold text-gray-200 mb-4">📊 Module Scores</h2>
            <div class="grid grid-cols-3 gap-3">
              {#each Object.entries(aiResult.module_scores) as [mod, score]}
                <div class="bg-gray-800/40 rounded-xl p-3">
                  <div class="flex items-center justify-between mb-2">
                    <div class="text-xs text-gray-400">{mod}</div>
                    <span class="text-sm font-bold {scoreColor(Number(score))}"
                      >{score}</span
                    >
                  </div>
                  <div class="bg-gray-700 rounded-full h-1.5">
                    <div
                      class="h-1.5 rounded-full {scoreBar(Number(score))}"
                      style="width: {score}%"
                    ></div>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Strengths & Weaknesses -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          {#if aiResult.strengths?.length}
            <div class="card border-emerald-800/20">
              <h2 class="font-semibold text-emerald-400 mb-4">✅ Strengths</h2>
              <div class="space-y-3">
                {#each aiResult.strengths as s}
                  <div class="bg-emerald-900/10 rounded-lg p-3">
                    <div class="font-medium text-gray-200 text-sm">
                      {s.title ?? s}
                    </div>
                    {#if s.evidence}<div class="text-xs text-gray-400 mt-1">
                        {s.evidence}
                      </div>{/if}
                  </div>
                {/each}
              </div>
            </div>
          {/if}
          {#if aiResult.weaknesses?.length}
            <div class="card border-red-800/20">
              <h2 class="font-semibold text-red-400 mb-4">⚠️ Weaknesses</h2>
              <div class="space-y-3">
                {#each aiResult.weaknesses as w}
                  <div class="bg-red-900/10 rounded-lg p-3">
                    <div class="flex items-start justify-between">
                      <div class="font-medium text-gray-200 text-sm">
                        {w.title ?? w}
                      </div>
                      {#if w.cost}<div
                          class="text-xs text-red-400 font-semibold ml-2 flex-shrink-0"
                        >
                          {w.cost}
                        </div>{/if}
                    </div>
                    {#if w.evidence}<div class="text-xs text-gray-400 mt-1">
                        {w.evidence}
                      </div>{/if}
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </div>

        <!-- Strategy Report -->
        {#if aiResult.strategy_report?.length}
          <div class="card">
            <h2 class="font-semibold text-gray-200 mb-4">
              🎯 Strategy Assessment
            </h2>
            <div class="space-y-3">
              {#each aiResult.strategy_report as s}
                <div
                  class="bg-gray-800/40 rounded-xl p-4 border {s.working
                    ? 'border-emerald-800/30'
                    : 'border-red-800/30'}"
                >
                  <div class="flex items-center gap-3 mb-2">
                    <span>{s.working ? "✅" : "❌"}</span>
                    <span class="font-semibold text-white">{s.name}</span>
                    <span
                      class="text-xs {s.working
                        ? 'text-emerald-400'
                        : 'text-red-400'} border {s.working
                        ? 'border-emerald-800/40'
                        : 'border-red-800/40'} px-2 py-0.5 rounded-full"
                      >{s.working ? "Working" : "Not working"}</span
                    >
                  </div>
                  <div
                    class="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-gray-400"
                  >
                    <div>
                      <span class="text-gray-500"
                        >Compliance:
                      </span>{s.compliance}
                    </div>
                    <div>
                      <span class="text-gray-500"
                        >When followed:
                      </span>{s.when_followed_result}
                    </div>
                    <div class="text-purple-400">→ {s.recommendation}</div>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Psychology + Leverage -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          {#if aiResult.psychology_profile}
            {@const pp = aiResult.psychology_profile}
            <div class="card border-indigo-800/20">
              <h2 class="font-semibold text-indigo-400 mb-4">
                🧠 Psychology Profile
              </h2>
              <div class="space-y-2 text-sm">
                <div class="flex gap-2">
                  <span class="text-gray-500 w-24 flex-shrink-0"
                    >Peak state:</span
                  ><span class="text-emerald-400">{pp.peak_state}</span>
                </div>
                <div class="flex gap-2">
                  <span class="text-gray-500 w-24 flex-shrink-0"
                    >Danger state:</span
                  ><span class="text-red-400">{pp.danger_state}</span>
                </div>
                <div class="flex gap-2">
                  <span class="text-gray-500 w-24 flex-shrink-0"
                    >Key pattern:</span
                  ><span class="text-gray-300">{pp.key_pattern}</span>
                </div>
                <div class="mt-3 bg-indigo-900/20 rounded-lg p-3">
                  <div class="text-xs font-semibold text-indigo-400 mb-1">
                    INTERVENTION
                  </div>
                  <p class="text-xs text-gray-300">{pp.intervention}</p>
                </div>
              </div>
            </div>
          {/if}
          {#if aiResult.leverage_report}
            {@const lr = aiResult.leverage_report}
            <div class="card border-indigo-800/20">
              <h2 class="font-semibold text-indigo-400 mb-4">
                ⚡ Leverage Report
              </h2>
              <div class="space-y-2 text-sm">
                <div class="flex gap-2">
                  <span class="text-gray-500 w-24 flex-shrink-0">Pattern:</span
                  ><span class="text-gray-300">{lr.pattern}</span>
                </div>
                <div class="flex gap-2">
                  <span class="text-gray-500 w-24 flex-shrink-0">Verdict:</span
                  ><span class="text-gray-300">{lr.verdict}</span>
                </div>
                <div class="mt-3 bg-indigo-900/20 rounded-lg p-3">
                  <div class="text-xs font-semibold text-indigo-400 mb-1">
                    GUIDANCE
                  </div>
                  <p class="text-xs text-gray-300">{lr.guidance}</p>
                </div>
              </div>
            </div>
          {/if}
        </div>

        <!-- Insights -->
        {#if aiResult.insights?.length}
          <div class="card">
            <h2 class="font-semibold text-gray-200 mb-4">
              💡 Detailed Insights
            </h2>
            <div class="space-y-3">
              {#each aiResult.insights as ins}
                <div
                  class="flex gap-4 p-3 rounded-xl {ins.severity === 'success'
                    ? 'bg-emerald-900/10 border border-emerald-800/20'
                    : ins.severity === 'warning'
                      ? 'bg-yellow-900/10 border border-yellow-800/20'
                      : 'bg-red-900/10 border border-red-800/20'}"
                >
                  <span class="text-lg flex-shrink-0"
                    >{ins.severity === "success"
                      ? "✅"
                      : ins.severity === "warning"
                        ? "⚠️"
                        : "🚨"}</span
                  >
                  <div>
                    <div class="text-sm font-semibold text-gray-200">
                      {ins.title}
                      <span class="text-gray-600 font-normal text-xs"
                        >[{ins.category}]</span
                      >
                    </div>
                    <p class="text-sm text-gray-400 mt-1">{ins.detail}</p>
                    <p class="text-xs text-purple-400 mt-1.5 font-medium">
                      → {ins.action}
                    </p>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- 30-Day Plan -->
        {#if aiResult.plan_30_days?.length}
          <div class="card border-sky-800/30 bg-sky-950/10">
            <h2 class="font-semibold text-sky-400 mb-4">
              🗓️ 30-Day Improvement Plan
            </h2>
            <div class="space-y-2">
              {#each aiResult.plan_30_days as item, i}
                <div class="flex gap-3 p-3 bg-gray-800/40 rounded-lg">
                  <span class="text-sky-400 font-bold text-sm flex-shrink-0 w-6"
                    >{i + 1}.</span
                  >
                  <p class="text-sm text-gray-300">{item}</p>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Coach Memory -->
        {#if memory?.coach_notes}
          <div class="card border-purple-800/30 bg-purple-950/10">
            <div class="flex items-center gap-2 mb-3">
              <span class="text-purple-400 font-semibold text-sm"
                >🧠 Coach Memory</span
              >
              <span class="text-xs text-gray-600"
                >{memory.analysis_count} sessions · grows smarter over time</span
              >
            </div>
            <p class="text-sm text-gray-300 italic">"{memory.coach_notes}"</p>
            {#if memory.most_common_mistake}
              <div class="mt-2 text-xs text-gray-500">
                Most common mistake: <span class="text-yellow-400"
                  >{memory.most_common_mistake}</span
                >
              </div>
            {/if}
          </div>
        {/if}
      {/if}
    {/if}

    <!-- ── BREAKDOWN TAB ── -->
    {#if activeTab === "breakdown"}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="card">
          <h2 class="font-semibold text-gray-200 mb-4">
            🧠 Emotion × Performance
          </h2>
          {#if byEmotion.length === 0}
            <p class="text-gray-500 text-sm">No data yet</p>
          {:else}
            <table class="w-full text-sm">
              <thead
                ><tr class="border-b border-gray-800"
                  ><th class="table-header py-2 text-left">Emotion</th><th
                    class="py-2 text-center">Trades</th
                  ><th class="py-2 text-center">WR%</th><th
                    class="py-2 text-right">P&L</th
                  ></tr
                ></thead
              >
              <tbody>
                {#each byEmotion.sort((a, b) => Number(b.wr) - Number(a.wr)) as e}
                  <tr class="border-b border-gray-800/30">
                    <td class="py-2 capitalize text-gray-200">{e.em}</td>
                    <td class="py-2 text-center text-gray-400">{e.count}</td>
                    <td
                      class="py-2 text-center {Number(e.wr) >= 50
                        ? 'text-emerald-400'
                        : 'text-red-400'}">{e.wr}%</td
                    >
                    <td
                      class="py-2 text-right {e.pnl >= 0
                        ? 'pnl-positive'
                        : 'pnl-negative'}"
                      >{e.pnl >= 0 ? "+" : ""}{inr(e.pnl)}</td
                    >
                  </tr>
                {/each}
              </tbody>
            </table>
          {/if}
        </div>

        <div class="card">
          <h2 class="font-semibold text-gray-200 mb-4">
            🌊 Market Condition × Performance
          </h2>
          {#if byCondition.length === 0}
            <p class="text-gray-500 text-sm">No data yet</p>
          {:else}
            <table class="w-full text-sm">
              <thead
                ><tr class="border-b border-gray-800"
                  ><th class="table-header py-2 text-left">Condition</th><th
                    class="py-2 text-center">Trades</th
                  ><th class="py-2 text-center">WR%</th><th
                    class="py-2 text-right">P&L</th
                  ></tr
                ></thead
              >
              <tbody>
                {#each byCondition as c}
                  <tr class="border-b border-gray-800/30">
                    <td class="py-2 capitalize text-gray-200">{c.cond}</td>
                    <td class="py-2 text-center text-gray-400">{c.count}</td>
                    <td
                      class="py-2 text-center {Number(c.wr) >= 50
                        ? 'text-emerald-400'
                        : 'text-red-400'}">{c.wr}%</td
                    >
                    <td
                      class="py-2 text-right {c.pnl >= 0
                        ? 'pnl-positive'
                        : 'pnl-negative'}"
                      >{c.pnl >= 0 ? "+" : ""}{inr(c.pnl)}</td
                    >
                  </tr>
                {/each}
              </tbody>
            </table>
          {/if}
        </div>
      </div>
    {/if}
  {/if}
</div>
