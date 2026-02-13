<!-- src/routes/calendar/+page.svelte -->
<script>
  import { tradesByAccount, activeAccount, calcStats, fmt } from '$lib/stores/index.js';
  import StatCard from '$lib/components/StatCard.svelte';

  let year  = new Date().getFullYear();
  let month = new Date().getMonth();

  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DAY_NAMES   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  $: trades = $tradesByAccount;

  // Build daily P&L map for current month
  $: dateMap = trades.reduce((m, t) => {
    const d = new Date(t.date);
    if (d.getFullYear() === year && d.getMonth() === month) {
      if (!m[t.date]) m[t.date] = { pnl: 0, count: 0 };
      m[t.date].pnl += t.pnl; m[t.date].count++;
    }
    return m;
  }, {});

  $: monthTrades = trades.filter(t => {
    const d = new Date(t.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });
  $: monthStats = calcStats(monthTrades);

  $: calDays = (() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const mm = String(month+1).padStart(2,'0'), dd = String(d).padStart(2,'0');
      const key = `${year}-${mm}-${dd}`;
      const data = dateMap[key];
      const isToday = today.getFullYear()===year && today.getMonth()===month && today.getDate()===d;
      cells.push({ d, key, data, isToday });
    }
    return cells;
  })();

  function prev() { if (month === 0) { month = 11; year--; } else month--; }
  function next() { if (month === 11) { month = 0;  year++; } else month++; }
</script>

<div class="page-header">
  <h2>Trading Calendar</h2>
  <p>Daily P&L for <strong>{$activeAccount?.name}</strong></p>
</div>

<div class="card">
  <div class="cal-nav">
    <button class="btn btn-ghost btn-sm" on:click={prev}>‹ Prev</button>
    <span class="month-label">{MONTH_NAMES[month]} {year}</span>
    <button class="btn btn-ghost btn-sm" on:click={next}>Next ›</button>
  </div>

  <div class="day-names">
    {#each DAY_NAMES as d}<div class="dn">{d}</div>{/each}
  </div>

  <div class="cal-grid">
    {#each calDays as cell}
      {#if cell === null}
        <div class="cal-cell empty"></div>
      {:else}
        <div
          class="cal-cell"
          class:win={cell.data && cell.data.pnl > 0}
          class:loss={cell.data && cell.data.pnl < 0}
          class:today={cell.isToday}
          title={cell.data ? `${cell.key}: ${fmt(cell.data.pnl)} (${cell.data.count} trade${cell.data.count>1?'s':''})` : cell.key}
        >
          <span class="cal-num">{cell.d}</span>
          {#if cell.data}
            <span class="cal-pnl" class:positive={cell.data.pnl>0} class:negative={cell.data.pnl<0}>
              {cell.data.pnl>0?'+':''}{cell.data.pnl.toFixed(0)}
            </span>
          {/if}
        </div>
      {/if}
    {/each}
  </div>

  <div class="legend">
    <span class="leg win-leg">■ Profit day</span>
    <span class="leg loss-leg">■ Loss day</span>
  </div>
</div>

<div class="card" style="margin-top:20px;">
  <div class="card-title">{MONTH_NAMES[month]} {year} — Summary</div>
  {#if !monthStats}
    <p style="color:var(--muted);padding:12px 0;">No trades this month.</p>
  {:else}
    <div class="stats-grid" style="margin-bottom:0;">
      <StatCard label="Total P&L"  value={fmt(monthStats.totalPnl)}     color={monthStats.totalPnl>=0?'positive':'negative'} />
      <StatCard label="Trades"     value={String(monthStats.total)}      color="neutral" />
      <StatCard label="Win Rate"   value={monthStats.winRate.toFixed(1)+'%'} color={monthStats.winRate>=50?'positive':'negative'} />
      <StatCard label="Best Day"   value={fmt(Math.max(...Object.values(dateMap).map(d=>d.pnl),0))} color="positive" />
      <StatCard label="Worst Day"  value={fmt(Math.min(...Object.values(dateMap).map(d=>d.pnl),0))} color="negative" />
      <StatCard label="Profit Factor" value={monthStats.profitFactor>=999?'∞':monthStats.profitFactor.toFixed(2)} color={monthStats.profitFactor>=1?'positive':'negative'} />
    </div>
  {/if}
</div>

<style>
  .cal-nav {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 16px;
  }
  .month-label { font-weight: 700; font-size: 16px; }
  .day-names { display: grid; grid-template-columns: repeat(7,1fr); gap: 4px; margin-bottom: 4px; }
  .dn { text-align: center; font-size: 10px; color: var(--muted); font-weight: 600; padding: 4px; }
  .cal-grid { display: grid; grid-template-columns: repeat(7,1fr); gap: 4px; }
  .cal-cell {
    aspect-ratio: 1; border-radius: 6px; background: var(--surface2);
    border: 1px solid var(--border); display: flex; flex-direction: column;
    align-items: center; justify-content: center; font-size: 11px;
    transition: transform 0.12s; padding: 2px;
  }
  .cal-cell:hover { transform: scale(1.06); }
  .cal-cell.empty  { background: transparent; border-color: transparent; }
  .cal-cell.win    { background: rgba(0,200,150,0.15); border-color: rgba(0,200,150,0.3); }
  .cal-cell.loss   { background: rgba(255,77,109,0.15); border-color: rgba(255,77,109,0.3); }
  .cal-cell.today  { border-color: var(--accent); }
  .cal-num  { font-weight: 700; }
  .cal-pnl  { font-size: 9px; margin-top: 1px; }
  .legend { display: flex; gap: 16px; margin-top: 14px; font-size: 11px; }
  .leg { color: var(--muted); }
  .win-leg  { color: var(--green); }
  .loss-leg { color: var(--red); }
</style>
