<!-- src/routes/journal/+page.svelte -->
<script>
  import { tradesByAccount, deleteTrade, instruments, fmt, fmtPct, activeAccount } from '$lib/stores/index.js';
  import Badge from '$lib/components/Badge.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import { goto } from '$app/navigation';

  let filterPair = '';
  let filterDir = '';
  let filterOutcome = '';
  let filterStrategy = '';
  let search = '';
  let detailModal = false;
  let selectedTrade = null;

  $: trades = $tradesByAccount.slice().sort((a,b) => new Date(b.date) - new Date(a.date));

  $: pairs      = [...new Set(trades.map(t => t.pair))].sort();
  $: strategies = [...new Set(trades.map(t => t.strategy).filter(Boolean))].sort();

  $: filtered = trades.filter(t => {
    if (filterPair     && t.pair     !== filterPair)     return false;
    if (filterDir      && t.dir      !== filterDir)      return false;
    if (filterOutcome  && t.outcome  !== filterOutcome)  return false;
    if (filterStrategy && t.strategy !== filterStrategy) return false;
    if (search) {
      const q = search.toLowerCase();
      return t.pair.toLowerCase().includes(q) ||
             (t.notes||'').toLowerCase().includes(q) ||
             (t.strategy||'').toLowerCase().includes(q) ||
             t.date.includes(q);
    }
    return true;
  });

  function openDetail(t) { selectedTrade = t; detailModal = true; }
  function confirmDelete(id) { if (confirm('Delete this trade?')) { deleteTrade(id); detailModal = false; } }
</script>

<div class="page-header">
  <h2>Trade Log</h2>
  <p>All trades for <strong>{$activeAccount?.name}</strong></p>
</div>

<div class="filters">
  <span class="fl">Filter:</span>
  <select bind:value={filterPair}>
    <option value="">All Pairs</option>
    {#each pairs as p}<option>{p}</option>{/each}
  </select>
  <select bind:value={filterDir}>
    <option value="">All Directions</option>
    <option value="BUY">Buy</option>
    <option value="SELL">Sell</option>
  </select>
  <select bind:value={filterOutcome}>
    <option value="">All Outcomes</option>
    <option value="WIN">Win</option>
    <option value="LOSS">Loss</option>
    <option value="BE">Break Even</option>
  </select>
  <select bind:value={filterStrategy}>
    <option value="">All Strategies</option>
    {#each strategies as s}<option>{s}</option>{/each}
  </select>
  <input type="text" bind:value={search} placeholder="Search…" style="min-width:160px;" />
</div>

<div class="card">
  {#if !filtered.length}
    <div class="empty" style="text-align:center;padding:40px;color:var(--muted);">
      {#if !trades.length}
        No trades yet. <a href="/log" style="color:var(--accent)">Log your first trade →</a>
      {:else}
        No trades match the current filters.
      {/if}
    </div>
  {:else}
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th><th>Pair</th><th>Dir</th><th>Avg Entry</th><th>Avg Exit</th>
            <th>Lots</th><th>P&L</th><th>R:R</th><th>Outcome</th><th>Strategy</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each filtered as t}
            <tr>
              <td>{t.date} <span style="color:var(--muted);font-size:11px;">{t.time || ''}</span></td>
              <td>
                <strong>{t.pair}</strong>
                {#if t.isPartial}<Badge variant="partial">PARTIAL</Badge>{/if}
                {#if t.chartImages?.length}<span title="{t.chartImages.length} chart(s)" style="margin-left:4px;font-size:11px;">📊</span>{/if}
              </td>
              <td><Badge variant={t.dir === 'BUY' ? 'buy' : 'sell'}>{t.dir}</Badge></td>
              <td>{t.entry}{#if t.entries?.length > 1}<span style="color:var(--muted);font-size:10px;"> ×{t.entries.length}</span>{/if}</td>
              <td>{t.exit || '—'}{#if t.exits?.length > 1}<span style="color:var(--muted);font-size:10px;"> ×{t.exits.length}</span>{/if}</td>
              <td>{t.lots || '—'}</td>
              <td class={t.pnl>0?'positive':t.pnl<0?'negative':''}><strong>{fmt(t.pnl)}</strong></td>
              <td>{t.rr ? t.rr.toFixed(1) + 'R' : '—'}</td>
              <td><Badge variant={t.outcome==='WIN'?'win':t.outcome==='LOSS'?'loss':'be'}>{t.outcome}</Badge></td>
              <td style="color:var(--muted);font-size:12px;">{t.strategy || '—'}</td>
              <td>
                <button class="btn btn-ghost btn-sm" on:click={() => openDetail(t)}>View</button>
                <button class="btn btn-ghost btn-sm" on:click={() => goto(`/log?edit=${t.id}`)}>Edit</button>
                <button class="btn btn-danger btn-sm" on:click={() => confirmDelete(t.id)}>Del</button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<!-- Detail Modal -->
<Modal bind:open={detailModal} maxWidth="860px">
  {#if selectedTrade}
    {@const t = selectedTrade}
    {@const pc = t.pnl > 0 ? 'positive' : t.pnl < 0 ? 'negative' : ''}
    <div class="modal-header">
      <div style="font-size:18px;font-weight:700;padding-right:40px;">
        {t.pair} — {t.date}
        <Badge variant={t.outcome==='WIN'?'win':t.outcome==='LOSS'?'loss':'be'} style="margin-left:8px;">{t.outcome}</Badge>
        {#if t.isPartial}<Badge variant="partial" style="margin-left:4px;">PARTIAL · {t.entries?.length}E {t.exits?.length}X</Badge>{/if}
      </div>
    </div>

    <!-- Aggregate summary for partials -->
    {#if t.isPartial}
      {@const totalIn  = (t.entries||[]).reduce((s,e) => s+(e.lots||0), 0)}
      {@const totalOut = (t.exits||[]).reduce((s,x)  => s+(x.lots||0), 0)}
      {@const fillPct  = totalIn > 0 ? Math.min(100, totalOut/totalIn*100) : 0}
      <div class="agg-grid">
        <div class="ag"><div class="agl">Lots In</div><div class="agv neutral">{totalIn.toFixed(2)}</div></div>
        <div class="ag"><div class="agl">Lots Out</div><div class="agv neutral">{totalOut.toFixed(2)}</div></div>
        <div class="ag"><div class="agl">Avg Entry</div><div class="agv neutral">{t.entry}</div></div>
        <div class="ag"><div class="agl">Total P&L</div><div class="agv {pc}">{fmt(t.pnl)}</div></div>
      </div>
      <div class="fill-bar-wrap">
        <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-bottom:4px;">
          <span>Position closed</span><span>{fillPct.toFixed(0)}%</span>
        </div>
        <div class="fill-bar"><div class="fill-inner" style="width:{fillPct}%"></div></div>
      </div>
    {/if}

    <!-- Execution timeline -->
    {#if t.entries?.length || t.exits?.length}
      <div class="card-title" style="margin-top:16px;margin-bottom:8px;">Execution Timeline</div>
      <div class="tl">
        {#each [
          ...(t.entries||[]).map((e,i)=>({...e,evType:'entry',label:`Entry ${i+1}`})),
          ...(t.exits  ||[]).map((x,i)=>({...x,evType:'exit', label:`Exit ${i+1}`}))
        ].sort((a,b)=>(a.time||'').localeCompare(b.time||'')) as ev}
          <div class="tl-ev">
            <div class="tl-dot {ev.evType}" class:loss={ev.pnl < 0}></div>
            <div class="tl-body">
              <div class="tl-hd">
                <span class="tl-type {ev.evType}" class:loss={ev.pnl < 0}>{ev.label}</span>
                {#if ev.time}<span class="tl-time">{ev.time}</span>{/if}
              </div>
              <div class="tl-row">
                <span><strong>{ev.price}</strong> price</span>
                {#if ev.lots}<span><strong>{ev.lots}</strong> lots</span>{/if}
                {#if ev.pnl !== undefined}<span style="color:{ev.pnl>=0?'var(--green)':'var(--red)'}"><strong>{fmt(ev.pnl)}</strong></span>{/if}
                {#if ev.note}<em style="color:var(--muted)">{ev.note}</em>{/if}
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Core details -->
    <div class="detail-grid">
      <div class="di"><div class="dl">Direction</div><div class="dv"><Badge variant={t.dir==='BUY'?'buy':'sell'}>{t.dir}</Badge></div></div>
      <div class="di"><div class="dl">Avg Entry</div><div class="dv">{t.entry}</div></div>
      <div class="di"><div class="dl">Avg Exit</div><div class="dv">{t.exit||'—'}</div></div>
      <div class="di"><div class="dl">Stop Loss</div><div class="dv negative">{t.sl||'—'}</div></div>
      <div class="di"><div class="dl">Total Lots</div><div class="dv">{t.lots||'—'}</div></div>
      <div class="di"><div class="dl">R:R</div><div class="dv neutral">{t.rr?t.rr+'R':'—'}</div></div>
      <div class="di"><div class="dl">Total P&L</div><div class="dv {pc}">{fmt(t.pnl)}</div></div>
      <div class="di"><div class="dl">Strategy</div><div class="dv">{t.strategy||'—'}</div></div>
      <div class="di"><div class="dl">Session</div><div class="dv">{t.session||'—'}</div></div>
      <div class="di"><div class="dl">Emotion</div><div class="dv">{t.emotion||'—'}</div></div>
    </div>

    {#if t.tags?.length}
      <div style="margin:12px 0">{#each t.tags as tag}<span class="tag-pill">{tag}</span>{/each}</div>
    {/if}

    {#if t.notes}
      <div class="card" style="background:var(--surface2);margin-bottom:12px;">
        <div class="card-title">Notes</div>
        <p style="font-size:13px;line-height:1.7;">{t.notes}</p>
      </div>
    {/if}

    <!-- Chart images -->
    {#if t.chartImages?.length}
      <div class="card-title" style="margin-bottom:8px;">Charts</div>
      <div class="chart-imgs">
        {#each t.chartImages as img}
          {#if img.isLink}
            <a href={img.data} target="_blank" rel="noopener" class="img-link-card">
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              TradingView
            </a>
          {:else}
            <img src={img.data} alt={img.name} class="chart-thumb" on:click={() => window.open(img.data)} />
          {/if}
        {/each}
      </div>
    {/if}

    <div style="display:flex;gap:10px;margin-top:16px;">
      <button class="btn btn-ghost btn-sm" on:click={() => { goto(`/log?edit=${t.id}`); detailModal=false; }}>Edit Trade</button>
      <button class="btn btn-danger btn-sm" on:click={() => confirmDelete(t.id)}>Delete Trade</button>
    </div>
  {/if}
</Modal>

<style>
  .filters {
    display: flex; gap: 10px; margin-bottom: 18px; flex-wrap: wrap; align-items: center;
  }
  .filters select, .filters input { width: auto; min-width: 130px; }
  .fl { font-size: 12px; color: var(--muted); font-weight: 500; align-self: center; }

  .modal-header { margin-bottom: 16px; }

  .agg-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; margin-bottom: 12px; }
  .ag .agl { font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; }
  .ag .agv { font-size: 15px; font-weight: 700; margin-top: 3px; }

  .fill-bar-wrap { margin-bottom: 16px; }
  .fill-bar { height: 6px; background: var(--surface2); border-radius: 4px; overflow: hidden; }
  .fill-inner { height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent2)); border-radius: 4px; transition: width 0.5s ease; }

  .tl { padding: 4px 0; }
  .tl-ev { display: flex; gap: 12px; margin-bottom: 10px; }
  .tl-ev:last-child { margin-bottom: 0; }
  .tl-dot { width: 12px; height: 12px; border-radius: 50%; border: 2px solid; flex-shrink: 0; margin-top: 4px; }
  .tl-dot.entry { border-color: var(--accent); background: rgba(0,212,255,0.2); }
  .tl-dot.exit  { border-color: var(--green); background: rgba(0,200,150,0.2); }
  .tl-dot.exit.loss { border-color: var(--red); background: rgba(255,77,109,0.2); }
  .tl-body { flex: 1; background: var(--surface2); border: 1px solid var(--border); border-radius: 8px; padding: 8px 12px; }
  .tl-hd { display: flex; justify-content: space-between; margin-bottom: 4px; }
  .tl-type { font-size: 11px; font-weight: 700; text-transform: uppercase; }
  .tl-type.entry { color: var(--accent); }
  .tl-type.exit  { color: var(--green); }
  .tl-type.exit.loss { color: var(--red); }
  .tl-time { font-size: 11px; color: var(--muted); }
  .tl-row { display: flex; gap: 14px; flex-wrap: wrap; font-size: 12px; color: var(--muted); }

  .detail-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; margin: 16px 0; }
  .di .dl { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; }
  .di .dv { font-size: 14px; font-weight: 600; margin-top: 3px; }

  .chart-imgs { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
  .chart-thumb { width: 120px; height: 80px; object-fit: cover; border-radius: 8px; border: 1px solid var(--border); cursor: zoom-in; transition: transform 0.15s; }
  .chart-thumb:hover { transform: scale(1.04); }
  .img-link-card {
    width: 120px; height: 80px; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 5px;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 8px; color: var(--accent); text-decoration: none; font-size: 11px;
  }
  .img-link-card:hover { border-color: var(--accent); }
</style>
