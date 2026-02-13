<!-- src/routes/analytics/+page.svelte -->
<script>
  import { onMount, onDestroy } from 'svelte';
  import { tradesByAccount, activeAccount, calcStats, fmt, fmtPct } from '$lib/stores/index.js';
  import StatCard from '$lib/components/StatCard.svelte';
  import { chartDefaults } from '$lib/utils/charts';

  let Chart;
  let charts = {};

  $: trades = $tradesByAccount.slice().sort((a,b) => new Date(a.date) - new Date(b.date));
  $: stats  = calcStats(trades);

  onMount(async () => {
    const mod = await import('$lib/utils/charts');
    Chart = mod.Chart;
    mod.Chart.register(...mod.registerables);
    drawAll();
  });

  onDestroy(() => Object.values(charts).forEach(c => c?.destroy()));
  $: if (Chart && trades) { drawAll(); }

  function destroy(id) { if (charts[id]) { charts[id].destroy(); delete charts[id]; } }
  function destroyAll() { Object.keys(charts).forEach(destroy); }

  function drawAll() {
    if (!Chart) return;
    destroyAll();
    if (!trades.length) return;

    // Monthly P&L
    const monthMap = {};
    trades.forEach(t => { const m = t.date.slice(0,7); monthMap[m] = (monthMap[m]||0) + t.pnl; });
    const months = Object.keys(monthMap).sort();
    mkBar('monthlyChart', months.map(m => { const [y,mo] = m.split('-'); return new Date(y,mo-1).toLocaleString('default',{month:'short',year:'2-digit'}); }),
      months.map(m => monthMap[m]), m => monthMap[m] >= 0 ? 'rgba(0,200,150,0.7)' : 'rgba(255,77,109,0.7)');

    // Session
    const sessMap = groupBy(trades, 'session', 'Unknown');
    mkGroupedBar('sessionChart', Object.keys(sessMap),
      [{ label: 'P&L ($)', data: Object.values(sessMap).map(v=>v.pnl), backgroundColor: 'rgba(0,212,255,0.65)', borderRadius:4 }]);

    // Strategy
    const stratMap = groupBy(trades, 'strategy', 'Untagged');
    mkBar('strategyChart', Object.keys(stratMap), Object.values(stratMap).map(v=>v.pnl),
      v => v >= 0 ? 'rgba(0,200,150,0.7)' : 'rgba(255,77,109,0.7)', true);

    // Emotion
    const emoMap = groupBy(trades, 'emotion', 'None');
    const emoAvg = Object.entries(emoMap).map(([k,v]) => [k, v.pnl/v.count]);
    mkBar('emotionChart', emoAvg.map(e=>e[0]), emoAvg.map(e=>e[1]),
      v => v >= 0 ? 'rgba(0,200,150,0.7)' : 'rgba(255,77,109,0.7)', true);

    // Day of week win rate
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const dayBuckets = Array.from({length:7}, () => ({wins:0,total:0}));
    trades.forEach(t => { const d = new Date(t.date).getDay(); dayBuckets[d].total++; if(t.outcome==='WIN') dayBuckets[d].wins++; });
    mkBar('dayChart', days, dayBuckets.map(b => b.total ? +(b.wins/b.total*100).toFixed(1) : 0),
      v => v >= 50 ? 'rgba(0,200,150,0.65)' : 'rgba(0,212,255,0.5)');

    // Histogram
    const allPnls = trades.map(t => t.pnl);
    const minP = Math.floor(Math.min(...allPnls)/50)*50;
    const maxP = Math.ceil( Math.max(...allPnls)/50)*50;
    const bins = []; for (let b=minP; b<maxP; b+=50) bins.push(b);
    const counts = bins.map(b => allPnls.filter(p => p>=b && p<b+50).length);
    mkBar('histogramChart', bins.map(b=>`$${b}`), counts, v => v>0?'rgba(0,212,255,0.6)':'rgba(0,212,255,0.3)');

    // Drawdown
    const sorted = [...trades];
    let eq=0, pk=0, dds=[];
    sorted.forEach(t => { eq+=t.pnl; if(eq>pk)pk=eq; dds.push(-(pk-eq)); });
    const ddCanvas = document.getElementById('drawdownChart');
    if (ddCanvas) charts.dd = new Chart(ddCanvas, {
      type: 'line',
      data: { labels: sorted.map(t=>t.date), datasets: [{ label: 'Drawdown ($)', data: dds, borderColor: 'rgba(255,77,109,0.8)', backgroundColor: 'rgba(255,77,109,0.1)', fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2 }] },
      options: chartDefaults('line')
    });
  }

  function groupBy(trades, field, fallback) {
    return trades.reduce((m, t) => {
      const k = t[field] || fallback;
      if (!m[k]) m[k] = { pnl: 0, count: 0 };
      m[k].pnl += t.pnl; m[k].count++;
      return m;
    }, {});
  }

  function mkBar(id, labels, data, colorFn, horizontal = false) {
    const el = document.getElementById(id);
    if (!el) return;
    const colors = Array.isArray(data) ? data.map(colorFn) : colorFn;
    const opts = { ...chartDefaults('bar'), plugins: { legend: { display: false } } };
    if (horizontal) opts.indexAxis = 'y';
    charts[id] = new Chart(el, {
      type: 'bar',
      data: { labels, datasets: [{ data, backgroundColor: colors, borderRadius: 4, borderWidth: 0 }] },
      options: opts
    });
  }

  function mkGroupedBar(id, labels, datasets) {
    const el = document.getElementById(id);
    if (!el) return;
    charts[id] = new Chart(el, {
      type: 'bar',
      data: { labels, datasets: datasets.map(d => ({ ...d, borderWidth: 0 })) },
      options: chartDefaults('bar')
    });
  }

  // R:R bucketing
  $: rrBuckets = (() => {
    const b = { '<0.5': 0, '0.5–1': 0, '1–2': 0, '2–3': 0, '>3': 0 };
    trades.filter(t=>t.rr).forEach(t => {
      if      (t.rr < 0.5) b['<0.5']++;
      else if (t.rr < 1)   b['0.5–1']++;
      else if (t.rr < 2)   b['1–2']++;
      else if (t.rr < 3)   b['2–3']++;
      else                  b['>3']++;
    });
    return b;
  })();
</script>

<div class="page-header">
  <h2>Analytics</h2>
  <p>Deep-dive into <strong>{$activeAccount?.name}</strong></p>
</div>

{#if !stats}
  <div class="card" style="text-align:center;padding:60px;color:var(--muted);">No trades to analyse yet.</div>
{:else}
  <div class="stats-grid">
    <StatCard label="Profit Factor"   value={stats.profitFactor >= 999 ? '∞' : stats.profitFactor?.toFixed(2)} color={stats.profitFactor >= 1.5 ? 'positive' : stats.profitFactor >= 1 ? 'neutral' : 'negative'} />
    <StatCard label="Expectancy"      value={fmt(stats.expectancy)} sub="per trade" color={stats.expectancy >= 0 ? 'positive' : 'negative'} />
    <StatCard label="Avg Win"         value={fmt(stats.avgWin)} color="positive" />
    <StatCard label="Avg Loss"        value={fmt(stats.avgLoss)} color="negative" />
    <StatCard label="Max Consec Wins" value={String(stats.maxConsecWin)} color="positive" />
    <StatCard label="Max Consec Loss" value={String(stats.maxConsecLoss)} color="negative" />
  </div>

  <div class="grid-2">
    <div class="card"><div class="card-title">Monthly P&L</div><div style="height:280px;position:relative;"><canvas id="monthlyChart"></canvas></div></div>
    <div class="card"><div class="card-title">P&L by Session</div><div style="height:280px;position:relative;"><canvas id="sessionChart"></canvas></div></div>
  </div>
  <div class="grid-2">
    <div class="card"><div class="card-title">P&L by Strategy</div><div style="height:280px;position:relative;"><canvas id="strategyChart"></canvas></div></div>
    <div class="card"><div class="card-title">Emotion Analysis (Avg P&L)</div><div style="height:280px;position:relative;"><canvas id="emotionChart"></canvas></div></div>
  </div>
  <div class="grid-3">
    <div class="card"><div class="card-title">Win Rate by Day</div><div style="height:220px;position:relative;"><canvas id="dayChart"></canvas></div></div>
    <div class="card"><div class="card-title">P&L Distribution</div><div style="height:220px;position:relative;"><canvas id="histogramChart"></canvas></div></div>
    <div class="card">
      <div class="card-title">R:R Breakdown</div>
      <div class="rr-grid">
        {#each Object.entries(rrBuckets) as [k, v]}
          <div class="rr-cell"><div class="rr-val neutral">{v}</div><div class="rr-lbl">{k}R</div></div>
        {/each}
      </div>
    </div>
  </div>
  <div class="card full-width"><div class="card-title">Drawdown Chart</div><div style="height:280px;position:relative;"><canvas id="drawdownChart"></canvas></div></div>
{/if}

<style>
  .rr-grid { display: grid; grid-template-columns: repeat(5,1fr); gap: 6px; margin-top: 8px; }
  .rr-cell { background: var(--surface2); border: 1px solid var(--border); border-radius: 6px; padding: 8px; text-align: center; }
  .rr-val { font-size: 15px; font-weight: 700; }
  .rr-lbl { font-size: 10px; color: var(--muted); margin-top: 2px; }
</style>
