<script lang="ts">
  import { onMount } from 'svelte';
  import { selectedAccountId } from '$lib/stores';
  import type { AdvancedAnalytics } from '$lib/types';

  let data: AdvancedAnalytics | null = null;
  let loading = false;
  let accountId = '';

  selectedAccountId.subscribe(id => { accountId = id; if (id) loadAnalytics(); });
  onMount(() => { if (accountId) loadAnalytics(); });

  async function loadAnalytics() {
    loading = true;
    const res = await fetch(`/api/advanced-analytics?accountId=${accountId}`);
    data = await res.json();
    loading = false;
  }

  function scoreColor(n: number, good = 1) {
    if (n >= good * 2) return 'text-emerald-400';
    if (n >= good) return 'text-sky-400';
    if (n >= 0) return 'text-yellow-400';
    return 'text-red-400';
  }

  function pct(n: number) { return `${n.toFixed(1)}%`; }
  function usd(n: number) { return `$${n.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`; }
</script>

<div class="p-6 space-y-6">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold text-white">Advanced Analytics</h1>
      <p class="text-gray-500 text-sm">Professional-grade metrics: Sharpe, Sortino, Monte Carlo, Kelly Criterion</p>
    </div>
    <button class="btn-secondary btn-sm" onclick={loadAnalytics}>↺ Refresh</button>
  </div>

  {#if loading}
    <div class="text-center py-20 text-gray-500">Computing analytics...</div>
  {:else if !data || data.equity_curve.length < 2}
    <div class="card text-center py-16">
      <div class="text-4xl mb-4">🔬</div>
      <p class="text-gray-400 mb-2">Need at least 2 closed trades for advanced analytics</p>
      <a href="/log?new=1" class="btn-primary btn-sm mt-4">Log More Trades</a>
    </div>
  {:else}
    <!-- Risk-Adjusted Returns -->
    <div>
      <h2 class="text-lg font-semibold text-gray-200 mb-3">📐 Risk-Adjusted Returns</h2>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="stat-card">
          <div class="stat-label">Sharpe Ratio</div>
          <div class="stat-value {scoreColor(data.sharpe_ratio)}">{data.sharpe_ratio}</div>
          <div class="text-xs text-gray-500">{data.sharpe_ratio >= 2 ? 'Excellent' : data.sharpe_ratio >= 1 ? 'Good' : data.sharpe_ratio >= 0 ? 'Poor' : 'Losing'}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Sortino Ratio</div>
          <div class="stat-value {scoreColor(data.sortino_ratio)}">{data.sortino_ratio}</div>
          <div class="text-xs text-gray-500">Downside risk adjusted</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Calmar Ratio</div>
          <div class="stat-value {scoreColor(data.calmar_ratio, 0.5)}">{data.calmar_ratio}</div>
          <div class="text-xs text-gray-500">Return/Max Drawdown</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Recovery Factor</div>
          <div class="stat-value {scoreColor(data.recovery_factor, 2)}">{data.recovery_factor}</div>
          <div class="text-xs text-gray-500">Profit/Max Drawdown</div>
        </div>
      </div>
    </div>

    <!-- Drawdown -->
    <div>
      <h2 class="text-lg font-semibold text-gray-200 mb-3">📉 Drawdown Analysis</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="stat-card border-red-900/30">
          <div class="stat-label">Max Drawdown</div>
          <div class="stat-value text-red-400">-{usd(data.max_drawdown)}</div>
          <div class="text-xs text-red-500">-{pct(data.max_drawdown_pct)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Profit Factor</div>
          <div class="stat-value {data.profit_factor >= 1.5 ? 'text-emerald-400' : data.profit_factor >= 1 ? 'text-yellow-400' : 'text-red-400'}">{data.profit_factor}</div>
          <div class="text-xs text-gray-500">{data.profit_factor >= 2 ? 'Excellent (>2)' : data.profit_factor >= 1.5 ? 'Good' : 'Needs work'}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Expectancy</div>
          <div class="stat-value {data.expectancy >= 0 ? 'text-emerald-400' : 'text-red-400'}">{usd(data.expectancy)}</div>
          <div class="text-xs text-gray-500">Per trade average</div>
        </div>
      </div>
    </div>

    <!-- Equity Curve -->
    {#if data.equity_curve.length > 0}
      <div class="card">
        <h2 class="font-semibold text-gray-200 mb-4">📈 Equity Curve</h2>
        <div class="h-48 relative">
          <svg class="w-full h-full" viewBox="0 0 800 200" preserveAspectRatio="none">
            {#if data.equity_curve.length > 1}
              {@const minB = Math.min(...data.equity_curve.map(p => p.balance))}
              {@const maxB = Math.max(...data.equity_curve.map(p => p.balance))}
              {@const range = maxB - minB || 1}
              {@const pts = data.equity_curve.map((p, i) => `${(i/(data!.equity_curve.length-1))*800},${200 - ((p.balance - minB)/range)*190}`).join(' ')}
              <polyline points={pts} fill="none" stroke="#0ea5e9" stroke-width="2" />
              <polyline points={`0,200 ${pts} 800,200`} fill="url(#grad)" stroke="none" />
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#0ea5e9" stop-opacity="0.3" />
                  <stop offset="100%" stop-color="#0ea5e9" stop-opacity="0" />
                </linearGradient>
              </defs>
            {/if}
          </svg>
          <div class="absolute bottom-0 left-0 text-xs text-gray-600">{data.equity_curve[0]?.date?.slice(0,10)}</div>
          <div class="absolute bottom-0 right-0 text-xs text-gray-600">{data.equity_curve[data.equity_curve.length-1]?.date?.slice(0,10)}</div>
        </div>
      </div>
    {/if}

    <!-- Monte Carlo -->
    <div>
      <h2 class="text-lg font-semibold text-gray-200 mb-3">🎲 Monte Carlo Simulation</h2>
      <div class="card">
        <p class="text-sm text-gray-500 mb-4">Simulating 1,000 possible next 100-trade outcomes based on your historical P&L distribution.</p>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div class="bg-gray-800/40 rounded-xl p-3">
            <div class="text-xs text-gray-500 mb-1">Median Outcome</div>
            <div class="text-lg font-bold text-sky-400">{usd(data.monte_carlo.median)}</div>
          </div>
          <div class="bg-emerald-900/20 rounded-xl p-3">
            <div class="text-xs text-gray-500 mb-1">Best Case (95%)</div>
            <div class="text-lg font-bold text-emerald-400">{usd(data.monte_carlo.best_case)}</div>
          </div>
          <div class="bg-red-900/20 rounded-xl p-3">
            <div class="text-xs text-gray-500 mb-1">Worst Case (5%)</div>
            <div class="text-lg font-bold text-red-400">{usd(data.monte_carlo.worst_case)}</div>
          </div>
          <div class="bg-gray-800/40 rounded-xl p-3">
            <div class="text-xs text-gray-500 mb-1">Avg Drawdown</div>
            <div class="text-lg font-bold text-yellow-400">{pct(data.monte_carlo.avg_drawdown)}</div>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div class="flex items-center justify-between p-3 bg-gray-800/40 rounded-xl">
            <span class="text-sm text-gray-400">Probability of Profit</span>
            <span class="font-bold text-emerald-400">{pct(data.monte_carlo.prob_profit)}</span>
          </div>
          <div class="flex items-center justify-between p-3 {data.monte_carlo.prob_ruin > 10 ? 'bg-red-900/20 border border-red-800/40' : 'bg-gray-800/40'} rounded-xl">
            <span class="text-sm text-gray-400">Probability of Ruin</span>
            <span class="font-bold {data.monte_carlo.prob_ruin > 10 ? 'text-red-400' : data.monte_carlo.prob_ruin > 5 ? 'text-yellow-400' : 'text-emerald-400'}">{pct(data.monte_carlo.prob_ruin)}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Kelly Criterion -->
    <div>
      <h2 class="text-lg font-semibold text-gray-200 mb-3">💰 Kelly Criterion Position Sizing</h2>
      <div class="card">
        <p class="text-sm text-gray-500 mb-4">Mathematically optimal position sizing based on your win rate and win/loss ratio.</p>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="bg-gray-800/40 rounded-xl p-4 text-center">
            <div class="text-xs text-gray-500 mb-1">Conservative (¼ Kelly)</div>
            <div class="text-2xl font-bold text-sky-400">{pct(data.kelly_quarter)}</div>
            <div class="text-xs text-gray-500 mt-1">Beginners</div>
          </div>
          <div class="bg-sky-900/20 border border-sky-800/40 rounded-xl p-4 text-center">
            <div class="text-xs text-sky-400 mb-1">⭐ Recommended (½ Kelly)</div>
            <div class="text-2xl font-bold text-sky-300">{pct(data.kelly_half)}</div>
            <div class="text-xs text-gray-500 mt-1">Most traders</div>
          </div>
          <div class="bg-gray-800/40 rounded-xl p-4 text-center">
            <div class="text-xs text-gray-500 mb-1">Aggressive (¾ Kelly)</div>
            <div class="text-2xl font-bold text-yellow-400">{pct(data.kelly_full * 0.75)}</div>
            <div class="text-xs text-gray-500 mt-1">Experienced</div>
          </div>
          <div class="bg-red-900/20 rounded-xl p-4 text-center">
            <div class="text-xs text-red-400 mb-1">Full Kelly (⚠️ NOT REC.)</div>
            <div class="text-2xl font-bold text-red-400">{pct(data.kelly_full)}</div>
            <div class="text-xs text-gray-500 mt-1">Theory only</div>
          </div>
        </div>
      </div>
    </div>

    <!-- MAE / MFE -->
    <div>
      <h2 class="text-lg font-semibold text-gray-200 mb-3">🎯 MAE / MFE Analysis</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="card">
          <div class="font-semibold text-gray-300 mb-2">Maximum Adverse Excursion (MAE)</div>
          <p class="text-sm text-gray-500 mb-3">How far trades move against you before closing</p>
          <div class="text-3xl font-bold text-yellow-400">{usd(data.mae_avg)}</div>
          <div class="text-xs text-gray-500 mt-1">Average per trade</div>
        </div>
        <div class="card">
          <div class="font-semibold text-gray-300 mb-2">Maximum Favorable Excursion (MFE)</div>
          <p class="text-sm text-gray-500 mb-3">How far trades move in your favor before closing</p>
          <div class="text-3xl font-bold text-emerald-400">{usd(data.mfe_avg)}</div>
          <div class="text-xs text-gray-500 mt-1">Average per trade</div>
        </div>
      </div>
    </div>
  {/if}
</div>
