<!-- src/routes/dashboard/+page.svelte -->
<script>
  import { onMount, onDestroy } from 'svelte';
  import { tradesByAccount, activeAccount, calcStats, fmt, fmtPct, seedSampleData, activeAccountId } from '$lib/stores/index.js';
  import StatCard from '$lib/components/StatCard.svelte';
  import { chartDefaults } from '$lib/utils/charts.js';
  import { goto } from '$app/navigation';
  import Modal from '$lib/components/Modal.svelte';
  import Badge from '$lib/components/Badge.svelte';

  let Chart;
  let charts = {};
  let detailModal = false;
  let selectedTrade = null;

  $: trades = $tradesByAccount.slice().sort((a,b) => new Date(b.date) - new Date(a.date));
  $: stats = calcStats(trades);

  onMount(async () => {
    const mod = await import('$lib/utils/charts');
    Chart = mod.Chart;
    mod.Chart.register(...mod.registerables);
    drawCharts();
  });

  onDestroy(() => Object.values(charts).forEach(c => c?.destroy()));

  $: if (Chart && trades) { drawCharts(); }

  function drawCharts() {
    if (!Chart || !trades.length) return;
    destroyAll();
    const sorted = [...trades].reverse();
    let cum = 0;

    // Equity
    const ec = document.getElementById('equityChart');
    if (ec) charts.equity = new Chart(ec, {
      type: 'line',
      data: { labels: sorted.map(t => t.date), datasets: [{ label: 'Equity ($)', data: sorted.map(t => { cum += t.pnl; return parseFloat(cum.toFixed(2)); }), borderColor: '#00d4ff', backgroundColor: 'rgba(0,212,255,0.08)', fill: true, tension: 0.3, pointRadius: sorted.length < 20 ? 4 : 0, pointHoverRadius: 5, borderWidth: 2 }] },
      options: chartDefaults('line')
    });

    // Doughnut
    if (stats) {
      const wl = document.getElementById('winLossChart');
      if (wl) charts.wl = new Chart(wl, {
        type: 'doughnut',
        data: { labels: ['Wins', 'Losses', 'Break Even'], datasets: [{ data: [stats.wins, stats.losses, stats.bes], backgroundColor: ['rgba(0,200,150,0.8)', 'rgba(255,77,109,0.8)', 'rgba(245,158,11,0.8)'], borderWidth: 0, hoverOffset: 6 }] },
        options: { ...chartDefaults('doughnut'), cutout: '65%', plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 16, font: { size: 12 } } } } }
      });
    }

    // Best/worst
    const top = [...trades].sort((a, b) => b.pnl - a.pnl);
    const combo = [...top.slice(0, 5), ...top.slice(-5).reverse()].sort((a, b) => b.pnl - a.pnl);
    const bw = document.getElementById('bestWorstChart');
    if (bw) charts.bw = new Chart(bw, {
      type: 'bar',
      data: { labels: combo.map(t => `${t.pair} ${t.date.slice(5)}`), datasets: [{ data: combo.map(t => t.pnl), backgroundColor: combo.map(t => t.pnl >= 0 ? 'rgba(0,200,150,0.7)' : 'rgba(255,77,109,0.7)'), borderRadius: 4, borderWidth: 0 }] },
      options: { ...chartDefaults('bar'), plugins: { legend: { display: false } } }
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
      <button class="btn btn-ghost" on:click={() => seedSampleData($activeAccountId)}>Load Sample Data</button>
    </div>
  </div>
{:else}
  <div class="stats-grid">
    <StatCard label="Total P&L" value={fmt(stats?.totalPnl)} sub="{stats?.total} trades · {stats?.partialCount} partials" color={stats?.totalPnl >= 0 ? 'positive' : 'negative'} />
    <StatCard label="Win Rate" value={fmtPct(stats?.winRate)} sub="{stats?.wins}W / {stats?.losses}L / {stats?.bes}BE" color={stats?.winRate >= 50 ? 'positive' : 'negative'} />
    <StatCard label="Profit Factor" value={stats?.profitFactor >= 999 ? '∞' : stats?.profitFactor?.toFixed(2)} sub="Gross win / gross loss" color={stats?.profitFactor >= 1.5 ? 'positive' : stats?.profitFactor >= 1 ? 'neutral' : 'negative'} />
    <StatCard label="Expectancy" value={fmt(stats?.expectancy)} sub="Per trade" color={stats?.expectancy >= 0 ? 'positive' : 'negative'} />
    <StatCard label="Avg Win" value={fmt(stats?.avgWin)} sub="Avg Loss: {fmt(stats?.avgLoss)}" color="positive" />
    <StatCard label="Max Drawdown" value={fmt(stats?.maxDrawdown)} sub="Peak to trough" color="negative" />
    <StatCard label="Best Trade" value={fmt(stats?.maxWin)} sub="Worst: {fmt(stats?.maxLoss)}" color="positive" />
    <StatCard label="Avg R:R" value={stats?.avgRR ? stats.avgRR.toFixed(2) : '—'} sub="Consec. wins: {stats?.maxConsecWin}" color="neutral" />
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
      {#each pairArr as [pair, data]}
        <div class="pair-row">
          <div class="pair-name">{pair}</div>
          <div class="pair-bar-wrap">
            <div class="pair-bar" style="width:{(Math.abs(data.pnl)/maxAbsPnl*100).toFixed(0)}%;background:{data.pnl>=0?'var(--green)':'var(--red)'};"></div>
          </div>
          <div class="pair-pnl {data.pnl>=0?'positive':'negative'}">{fmt(data.pnl)}</div>
          <div class="pair-count">{data.count}t</div>
        </div>
      {/each}
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
          <tr><th>Date</th><th>Pair</th><th>Dir</th><th>Entry</th><th>P&L</th><th>Outcome</th><th>Strategy</th></tr>
        </thead>
        <tbody>
          {#each trades.slice(0,10) as t}
            <tr on:click={() => openDetail(t)} style="cursor:pointer;">
              <td>{t.date}</td>
              <td><strong>{t.pair}</strong> {#if t.isPartial}<Badge variant="partial">PARTIAL</Badge>{/if}</td>
              <td><Badge variant={t.dir === 'BUY' ? 'buy' : 'sell'}>{t.dir}</Badge></td>
              <td>{t.entry}</td>
              <td class={t.pnl>0?'positive':t.pnl<0?'negative':''}><strong>{fmt(t.pnl)}</strong></td>
              <td><Badge variant={t.outcome === 'WIN' ? 'win' : t.outcome === 'LOSS' ? 'loss' : 'be'}>{t.outcome}</Badge></td>
              <td style="color:var(--muted);">{t.strategy || '—'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
{/if}

<!-- Detail Modal -->
<Modal bind:open={detailModal} title={selectedTrade ? `${selectedTrade.pair} — ${selectedTrade.date}` : ''}>
  {#if selectedTrade}
    {@const t = selectedTrade}
    {@const pc = t.pnl > 0 ? 'positive' : t.pnl < 0 ? 'negative' : ''}
    <div class="detail-grid">
      <div class="di"><div class="dl">Direction</div><div class="dv"><Badge variant={t.dir==='BUY'?'buy':'sell'}>{t.dir}</Badge></div></div>
      <div class="di"><div class="dl">Outcome</div><div class="dv"><Badge variant={t.outcome==='WIN'?'win':t.outcome==='LOSS'?'loss':'be'}>{t.outcome}</Badge></div></div>
      <div class="di"><div class="dl">Total P&L</div><div class="dv {pc}">{fmt(t.pnl)}</div></div>
      <div class="di"><div class="dl">Avg Entry</div><div class="dv">{t.entry}</div></div>
      <div class="di"><div class="dl">Avg Exit</div><div class="dv">{t.exit || '—'}</div></div>
      <div class="di"><div class="dl">Stop Loss</div><div class="dv negative">{t.sl || '—'}</div></div>
      <div class="di"><div class="dl">Total Lots</div><div class="dv">{t.lots || '—'}</div></div>
      <div class="di"><div class="dl">R:R</div><div class="dv neutral">{t.rr ? t.rr + 'R' : '—'}</div></div>
      <div class="di"><div class="dl">Strategy</div><div class="dv">{t.strategy || '—'}</div></div>
    </div>
    <!-- Timeline -->
    {#if t.entries?.length || t.exits?.length}
      <div class="card-title" style="margin-top:16px;">Execution Timeline</div>
      <div class="timeline">
        {#each [...(t.entries||[]).map((e,i)=>({...e,type:'entry',label:`Entry ${i+1}`})), ...(t.exits||[]).map((x,i)=>({...x,type:'exit',label:`Exit ${i+1}`}))].sort((a,b)=>(a.time||'').localeCompare(b.time||'')) as ev}
          <div class="tl-event">
            <div class="tl-dot {ev.type}" class:loss={ev.pnl < 0}></div>
            <div class="tl-content">
              <div class="tl-header">
                <span class="tl-type {ev.type}" class:loss={ev.pnl < 0}>{ev.label}</span>
                {#if ev.time}<span style="font-size:11px;color:var(--muted)">{ev.time}</span>{/if}
              </div>
              <div class="tl-details">
                <span><strong>{ev.price}</strong> price</span>
                {#if ev.lots}<span><strong>{ev.lots}</strong> lots</span>{/if}
                {#if ev.pnl !== undefined}<span style="color:{ev.pnl>=0?'var(--green)':'var(--red)'}"><strong>{fmt(ev.pnl)}</strong></span>{/if}
                {#if ev.note}<span style="font-style:italic;color:var(--muted)">{ev.note}</span>{/if}
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
    {#if t.tags?.length}
      <div style="margin:12px 0">{#each t.tags as tag}<span class="tag-pill">{tag}</span>{/each}</div>
    {/if}
    {#if t.notes}
      <div class="card" style="background:var(--surface2);margin-top:12px;">
        <div class="card-title">Notes</div>
        <p style="font-size:13px;line-height:1.6;">{t.notes}</p>
      </div>
    {/if}
    <!-- Chart Images -->
    {#if t.chartImages?.length}
      <div class="card-title" style="margin-top:16px;">Chart Screenshots</div>
      <div class="chart-imgs">
        {#each t.chartImages as img}
          <img src={img.data} alt={img.name} class="chart-img-thumb" on:click={() => window.open(img.data)} />
        {/each}
      </div>
    {/if}
    <div style="display:flex;gap:10px;margin-top:16px;">
      <button class="btn btn-ghost btn-sm" on:click={() => { goto(`/log?edit=${t.id}`); detailModal = false; }}>Edit</button>
      <button class="btn btn-danger btn-sm" on:click={() => { import('$lib/stores/index.js').then(m => { m.deleteTrade(t.id); detailModal = false; }); }}>Delete</button>
    </div>
  {/if}
</Modal>

<style>
  .empty-state { text-align: center; padding: 60px 20px; }
  .pair-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid rgba(30,58,95,0.4); }
  .pair-row:last-child { border-bottom: none; }
  .pair-name { font-weight: 600; width: 80px; font-size: 13px; }
  .pair-bar-wrap { flex: 1; background: var(--surface2); border-radius: 4px; height: 6px; overflow: hidden; }
  .pair-bar { height: 6px; border-radius: 4px; transition: width 0.5s ease; }
  .pair-pnl { width: 80px; text-align: right; font-weight: 600; font-size: 13px; }
  .pair-count { width: 40px; text-align: right; color: var(--muted); font-size: 12px; }

  .detail-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; margin-bottom: 16px; }
  .di .dl { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; }
  .di .dv { font-size: 15px; font-weight: 600; margin-top: 3px; }

  .timeline { position: relative; padding: 4px 0; }
  .tl-event { display: flex; gap: 12px; margin-bottom: 12px; }
  .tl-event:last-child { margin-bottom: 0; }
  .tl-dot { width: 12px; height: 12px; border-radius: 50%; border: 2px solid; background: var(--surface); flex-shrink: 0; margin-top: 4px; }
  .tl-dot.entry { border-color: var(--accent); background: rgba(0,212,255,0.2); }
  .tl-dot.exit  { border-color: var(--green); background: rgba(0,200,150,0.2); }
  .tl-dot.exit.loss { border-color: var(--red); background: rgba(255,77,109,0.2); }
  .tl-content { flex: 1; background: var(--surface2); border: 1px solid var(--border); border-radius: 8px; padding: 8px 12px; }
  .tl-header { display: flex; justify-content: space-between; margin-bottom: 4px; }
  .tl-type { font-size: 11px; font-weight: 700; text-transform: uppercase; }
  .tl-type.entry { color: var(--accent); }
  .tl-type.exit  { color: var(--green); }
  .tl-type.exit.loss { color: var(--red); }
  .tl-details { display: flex; gap: 14px; flex-wrap: wrap; font-size: 12px; color: var(--muted); }

  .chart-imgs { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 8px; }
  .chart-img-thumb { width: 120px; height: 80px; object-fit: cover; border-radius: 8px; border: 1px solid var(--border); cursor: pointer; transition: transform 0.15s; }
  .chart-img-thumb:hover { transform: scale(1.04); }
</style>
