<!-- src/routes/dashboard/+page.svelte -->
<script>
  import { onMount, onDestroy } from 'svelte';
  import { tradesByAccount, activeAccount, calcStats, fmt, fmtPct, activeAccountId } from '$lib/stores/api';
  import StatCard from '$lib/components/StatCard.svelte';
  import { chartDefaults, Chart } from '$lib/utils/charts';
  import { goto } from '$app/navigation';
  import Modal from '$lib/components/Modal.svelte';
  import Badge from '$lib/components/Badge.svelte';

  let charts = {};
  let detailModal = false;
  let selectedTrade = null;

  $: trades = $tradesByAccount.slice().sort((a,b) => new Date(b.date) - new Date(a.date));
  $: stats = calcStats(trades);

  onMount(() => {
    drawCharts();
  });

  onDestroy(() => Object.values(charts).forEach(c => c?.destroy()));

  $: if (trades && trades.length > 0) {
    // Small delay to ensure DOM is ready
    setTimeout(drawCharts, 0);
  }

  function drawCharts() {
    if (typeof document === 'undefined') return;
    
    const sorted = [...trades].reverse();
    if (!sorted.length) return;

    destroyAll();

    // Equity
    const ec = document.getElementById('equityChart');
    if (ec) {
      let cum = 0;
      charts.equity = new Chart(ec, {
        type: 'line',
        data: {
          labels: sorted.map(t => t.date),
          datasets: [{
            label: 'Equity ($)',
            data: sorted.map(t => { cum += t.pnl; return parseFloat(cum.toFixed(2)); }),
            borderColor: '#00d4ff',
            backgroundColor: 'rgba(0,212,255,0.08)',
            fill: true,
            tension: 0.3,
            pointRadius: sorted.length < 20 ? 4 : 0,
            borderWidth: 2
          }]
        },
        options: chartDefaults('line')
      });
    }

    // Doughnut
    if (stats) {
      const wl = document.getElementById('winLossChart');
      if (wl) charts.wl = new Chart(wl, {
        type: 'doughnut',
        data: {
          labels: ['Wins', 'Losses', 'Break Even'],
          datasets: [{
            data: [stats.wins, stats.losses, stats.bes],
            backgroundColor: ['rgba(0,200,150,0.8)', 'rgba(255,77,109,0.8)', 'rgba(245,158,11,0.8)'],
            borderWidth: 0
          }]
        },
        options: chartDefaults('doughnut')
      });
    }

    // Best/worst
    const top = [...trades].sort((a, b) => b.pnl - a.pnl);
    const combo = [...top.slice(0, 5), ...top.slice(-5).reverse()].sort((a, b) => b.pnl - a.pnl);
    const bw = document.getElementById('bestWorstChart');
    if (bw) charts.bw = new Chart(bw, {
      type: 'bar',
      data: {
        labels: combo.map(t => `${t.pair} ${t.date.slice(5)}`),
        datasets: [{
          data: combo.map(t => t.pnl),
          backgroundColor: combo.map(t => t.pnl >= 0 ? 'rgba(0,200,150,0.7)' : 'rgba(255,77,109,0.7)'),
          borderRadius: 4
        }]
      },
      options: {
        ...chartDefaults('bar'),
        plugins: { ...chartDefaults('bar').plugins, legend: { display: false } }
      }
    });
  }

  function destroyAll() {
    Object.values(charts).forEach(c => c?.destroy());
    charts = {};
  }

  function openDetail(t) { selectedTrade = t; detailModal = true; }

  // Pair breakdown
  $: pairMap = trades.reduce((m, t) => {
    if (!m[t.pair]) m[t.pair] = { pnl: 0, count: 0 };
    m[t.pair].pnl += t.pnl; m[t.pair].count++;
    return m;
  }, {});
  $: pairArr = Object.entries(pairMap).sort((a, b) => Math.abs(b[1].pnl) - Math.abs(a[1].pnl)).slice(0, 8);
  $: maxAbsPnl = Math.max(...pairArr.map(p => Math.abs(p[1].pnl)), 1);
</script>

<div class="page-header">
  <h2>Dashboard</h2>
  <p>Overview for <strong>{$activeAccount?.name}</strong></p>
</div>

{#if !trades.length}
  <div class="card empty-state">
    <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="opacity:.3;display:block;margin:0 auto 16px"><polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/></svg>
    <p>No trades yet for this account.</p>
    <div style="display:flex;gap:10px;justify-content:center;margin-top:16px;flex-wrap:wrap;">
      <button class="btn btn-primary" on:click={() => goto('/log')}>+ Log First Trade</button>
    </div>
  </div>
{:else}
  <div class="stats-grid">
    <StatCard label="Total P&L" value={fmt(stats?.totalPnl)} sub="{stats?.total} trades" color={stats?.totalPnl >= 0 ? 'positive' : 'negative'} />
    <StatCard label="Win Rate" value={fmtPct(stats?.winRate)} sub="{stats?.wins}W / {stats?.losses}L" color={stats?.winRate >= 50 ? 'positive' : 'negative'} />
    <StatCard label="Profit Factor" value={stats?.profitFactor >= 999 ? '∞' : stats?.profitFactor?.toFixed(2)} color={stats?.profitFactor >= 1.5 ? 'positive' : 'neutral'} />
    <StatCard label="Expectancy" value={fmt(stats?.expectancy)} color={stats?.expectancy >= 0 ? 'positive' : 'negative'} />
  </div>

  <div class="grid-2">
    <div class="card">
      <div class="card-title">Equity Curve</div>
      <div style="height:260px;position:relative;"><canvas id="equityChart"></canvas></div>
    </div>
    <div class="card">
      <div class="card-title">Win / Loss Distribution</div>
      <div style="height:260px;position:relative;"><canvas id="winLossChart"></canvas></div>
    </div>
  </div>

  <div class="grid-2">
    <div class="card">
      <div class="card-title">P&L by Currency Pair</div>
      <div class="pair-list">
        {#each pairArr as [pair, data]}
          <div class="pair-row">
            <div class="pair-name">{pair}</div>
            <div class="pair-bar-wrap">
              <div class="pair-bar" style="width:{(Math.abs(data.pnl)/maxAbsPnl*100).toFixed(0)}%;background: {data.pnl>=0?'var(--green)':'var(--red)'};"></div>
            </div>
            <div class="pair-pnl {data.pnl>=0?'positive':'negative'}">{fmt(data.pnl)}</div>
          </div>
        {/each}
      </div>
    </div>
    <div class="card">
      <div class="card-title">Best &amp; Worst Trades</div>
      <div style="height:260px;position:relative;"><canvas id="bestWorstChart"></canvas></div>
    </div>
  </div>

  <div class="card full-width">
    <div class="card-title">Recent Trades</div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Date</th><th>Pair</th><th>Dir</th><th>Entry</th><th>P&L</th><th>Outcome</th></tr>
        </thead>
        <tbody>
          {#each trades.slice(0,10) as t}
            <tr on:click={() => openDetail(t)} style="cursor:pointer;">
              <td>{t.date}</td>
              <td><strong>{t.pair}</strong></td>
              <td><Badge variant={t.dir === 'BUY' ? 'buy' : 'sell'}>{t.dir}</Badge></td>
              <td>{t.entry}</td>
              <td class={t.pnl>0?'positive':t.pnl<0?'negative':''}><strong>{fmt(t.pnl)}</strong></td>
              <td><Badge variant={t.outcome?.toLowerCase()}>{t.outcome}</Badge></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
{/if}

<Modal bind:open={detailModal} title={selectedTrade ? `${selectedTrade.pair} — ${selectedTrade.date}` : ''}>
  {#if selectedTrade}
    <div class="detail-content">
       <p>Details for trade on {selectedTrade.date}</p>
       <!-- Simplified for brevity -->
    </div>
  {/if}
</Modal>

<style>
  .empty-state { text-align: center; padding: 60px 20px; }
  .pair-list { display: flex; flex-direction: column; gap: 8px; }
  .pair-row { display: flex; align-items: center; gap: 12px; }
  .pair-name { width: 70px; font-weight: 600; font-size: 13px; }
  .pair-bar-wrap { flex: 1; height: 8px; background: var(--surface2); border-radius: 4px; overflow: hidden; }
  .pair-bar { height: 100%; border-radius: 4px; }
  .pair-pnl { width: 80px; text-align: right; font-weight: 700; font-size: 13px; }
</style>
