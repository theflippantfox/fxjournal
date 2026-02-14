<!-- src/routes/analytics/+page.svelte -->
<script>
  import { onMount, onDestroy } from 'svelte';
  import { tradesByAccount, activeAccount, calcStats, fmt, fmtPct } from '$lib/stores/api';
  import StatCard from '$lib/components/StatCard.svelte';
  import { chartDefaults, Chart } from '$lib/utils/charts';

  let charts = {};

  $: trades = $tradesByAccount.slice().sort((a,b) => new Date(a.date) - new Date(b.date));
  $: stats  = calcStats(trades);

  onMount(() => {
    drawAll();
  });

  onDestroy(() => Object.values(charts).forEach(c => c?.destroy()));
  
  $: if (trades && trades.length > 0) {
    setTimeout(drawAll, 0);
  }

  function destroyAll() { 
    Object.values(charts).forEach(c => c?.destroy());
    charts = {};
  }

  function drawAll() {
    if (typeof document === 'undefined') return;
    destroyAll();
    if (!trades.length) return;

    // Monthly P&L
    const monthMap = {};
    trades.forEach(t => { const m = t.date.slice(0,7); monthMap[m] = (monthMap[m]||0) + t.pnl; });
    const months = Object.keys(monthMap).sort();
    mkBar('monthlyChart', months, months.map(m => monthMap[m]), v => v >= 0 ? 'rgba(0,200,150,0.7)' : 'rgba(255,77,109,0.7)');

    // Session
    const sessMap = {};
    trades.forEach(t => { const s = t.session || 'Unknown'; sessMap[s] = (sessMap[s]||0) + t.pnl; });
    mkBar('sessionChart', Object.keys(sessMap), Object.values(sessMap), 'rgba(0,212,255,0.6)');

    // Drawdown
    let eq=0, pk=0, dds=[];
    trades.forEach(t => { eq+=t.pnl; if(eq>pk)pk=eq; dds.push(-(pk-eq)); });
    const ddc = document.getElementById('drawdownChart');
    if (ddc) charts.dd = new Chart(ddc, {
      type: 'line',
      data: {
        labels: trades.map(t=>t.date),
        datasets: [{
          label: 'Drawdown ($)',
          data: dds,
          borderColor: 'rgba(255,77,109,0.8)',
          backgroundColor: 'rgba(255,77,109,0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 0
        }]
      },
      options: chartDefaults('line')
    });
  }

  function mkBar(id, labels, data, color) {
    const el = document.getElementById(id);
    if (!el) return;
    const colors = typeof color === 'function' ? data.map(color) : color;
    charts[id] = new Chart(el, {
      type: 'bar',
      data: { labels, datasets: [{ data, backgroundColor: colors, borderRadius: 4 }] },
      options: { ...chartDefaults('bar'), plugins: { ...chartDefaults('bar').plugins, legend: { display: false } } }
    });
  }
</script>

<div class="page-header">
  <h2>Analytics</h2>
  <p>Performance breakdown for <strong>{$activeAccount?.name}</strong></p>
</div>

{#if !stats}
  <div class="card" style="text-align:center;padding:60px;color:var(--muted);">No trades to analyze yet.</div>
{:else}
  <div class="stats-grid">
    <StatCard label="Profit Factor" value={stats.profitFactor?.toFixed(2)} color="neutral" />
    <StatCard label="Win Rate" value={fmtPct(stats.winRate)} color="positive" />
    <StatCard label="Avg Win" value={fmt(stats.avgWin)} color="positive" />
    <StatCard label="Avg Loss" value={fmt(stats.avgLoss)} color="negative" />
  </div>

  <div class="grid-2">
    <div class="card">
      <div class="card-title">Monthly P&L</div>
      <div style="height:280px;position:relative;"><canvas id="monthlyChart"></canvas></div>
    </div>
    <div class="card">
      <div class="card-title">P&L by Session</div>
      <div style="height:280px;position:relative;"><canvas id="sessionChart"></canvas></div>
    </div>
  </div>

  <div class="card full-width">
    <div class="card-title">Drawdown Chart</div>
    <div style="height:280px;position:relative;"><canvas id="drawdownChart"></canvas></div>
  </div>
{/if}
