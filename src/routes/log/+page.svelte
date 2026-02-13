<!-- src/routes/log/+page.svelte -->
<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { trades, instruments, activeAccountId, activeAccount, saveTrade, getOutcome, newId, showToast, fmt } from '$lib/stores/index.js';
  import Badge from '$lib/components/Badge.svelte';

  // ── Form state ─────────────────────────────────────────────────
  let editId = '';
  let isEditing = false;

  let fDate = today();
  let fPair = '';
  let fDir = '';
  let fSl = '';
  let fRr = '';
  let fStrategy = '';
  let fSession = '';
  let fEmotion = '';
  let fOutcome = '';
  let fTags = '';
  let fNotes = '';

  // Partials
  let entries = [freshEntry()];
  let exits   = [freshExit()];

  // Chart images
  let chartImages = [];  // [{name, data}]
  let tvLink = '';

  // Computed summary
  $: totalLotsIn  = entries.reduce((s,e) => s + (parseFloat(e.lots)||0), 0);
  $: totalLotsOut = exits.reduce((s,x) => s + (parseFloat(x.lots)||0), 0);
  $: totalPnl     = exits.reduce((s,x) => s + (parseFloat(x.pnl)||0), 0);
  $: avgEntry     = (() => { let wS=0,lS=0; entries.forEach(e=>{const p=parseFloat(e.price)||0,l=parseFloat(e.lots)||0;wS+=p*l;lS+=l;}); return lS>0?wS/lS:0; })();
  $: avgExit      = (() => { let wS=0,lS=0; exits.forEach(x=>{const p=parseFloat(x.price)||0,l=parseFloat(x.lots)||0;wS+=p*l;lS+=l;}); return lS>0?wS/lS:null; })();

  function today() { return new Date().toISOString().split('T')[0]; }
  function freshEntry() { return { id: newId(), time: '', price: '', lots: '', note: '' }; }
  function freshExit()  { return { id: newId(), time: '', price: '', lots: '', pnl: '', note: '' }; }

  function addEntry() { entries = [...entries, freshEntry()]; }
  function addExit()  { exits   = [...exits,   freshExit()]; }
  function removeEntry(id) { if (entries.length > 1) entries = entries.filter(e => e.id !== id); }
  function removeExit(id)  { if (exits.length   > 1) exits   = exits.filter(x   => x.id !== id); }

  // Chart image handling
  function handleImageFiles(files) {
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = e => {
        chartImages = [...chartImages, { name: file.name, data: e.target.result }];
      };
      reader.readAsDataURL(file);
    });
  }

  function handleDropZone(e) {
    e.preventDefault();
    handleImageFiles(e.dataTransfer.files);
    dragOver = false;
  }

  let dragOver = false;
  let fileInput;

  // TradingView screenshot link
  function addTvLink() {
    const trimmed = tvLink.trim();
    if (!trimmed) return;
    // Store as a "link" image entry
    chartImages = [...chartImages, { name: 'TradingView Link', data: trimmed, isLink: true }];
    tvLink = '';
    showToast('Chart link added!');
  }

  function removeImage(idx) { chartImages = chartImages.filter((_,i) => i !== idx); }

  // Load edit trade
  onMount(() => {
    const editParam = $page.url.searchParams.get('edit');
    if (editParam) {
      const t = $trades.find(tr => tr.id === editParam);
      if (t) loadTrade(t);
    }
  });

  function loadTrade(t) {
    isEditing = true; editId = t.id;
    fDate = t.date; fPair = t.pair; fDir = t.dir;
    fSl = t.sl ?? ''; fRr = t.rr ?? '';
    fStrategy = t.strategy ?? ''; fSession = t.session ?? '';
    fEmotion = t.emotion ?? ''; fOutcome = t.outcome;
    fTags = t.tags?.join(', ') ?? ''; fNotes = t.notes ?? '';
    chartImages = t.chartImages ?? [];

    entries = t.entries?.length
      ? t.entries.map(e => ({ ...e, id: newId() }))
      : [{ id: newId(), time: t.time ?? '', price: t.entry ?? '', lots: t.lots ?? '', note: '' }];
    exits = t.exits?.length
      ? t.exits.map(x => ({ ...x, id: newId() }))
      : [{ id: newId(), time: '', price: t.exit ?? '', lots: t.lots ?? '', pnl: t.pnl ?? '', note: '' }];
  }

  function clearForm() {
    isEditing = false; editId = '';
    fDate = today(); fPair = ''; fDir = ''; fSl = ''; fRr = '';
    fStrategy = ''; fSession = ''; fEmotion = ''; fOutcome = '';
    fTags = ''; fNotes = '';
    entries = [freshEntry()]; exits = [freshExit()];
    chartImages = []; tvLink = '';
  }

  function save() {
    if (!fPair || !fDir || !fDate) { showToast('Fill in pair, direction and date', 'error'); return; }
    const validEntries = entries.filter(e => e.price);
    if (!validEntries.length) { showToast('Add at least one entry price', 'error'); return; }

    const validExits = exits.filter(x => x.price);
    const pnl = parseFloat(totalPnl.toFixed(2));

    const trade = {
      id: editId || newId(),
      accountId: $activeAccountId,
      date: fDate,
      time: validEntries[0]?.time ?? '',
      pair: fPair, dir: fDir,
      lots: parseFloat(totalLotsIn.toFixed(2)) || null,
      entry: parseFloat(avgEntry.toFixed(5)),
      exit: avgExit ? parseFloat(avgExit.toFixed(5)) : null,
      sl: parseFloat(fSl) || null,
      pnl,
      rr: parseFloat(fRr) || null,
      strategy: fStrategy, session: fSession, emotion: fEmotion,
      outcome: getOutcome(pnl, fOutcome),
      tags: fTags.split(',').map(t => t.trim()).filter(Boolean),
      notes: fNotes,
      entries: validEntries.map(e => ({ time: e.time, price: parseFloat(e.price)||0, lots: parseFloat(e.lots)||0, note: e.note })),
      exits: validExits.map(x => ({ time: x.time, price: parseFloat(x.price)||0, lots: parseFloat(x.lots)||0, pnl: parseFloat(x.pnl)||0, note: x.note })),
      isPartial: validEntries.length > 1 || validExits.length > 1,
      chartImages,
    };

    saveTrade(trade);
    showToast(isEditing ? 'Trade updated!' : 'Trade saved!');
    clearForm();
    goto('/journal');
  }

  const STRATEGIES = ['Price Action','Trend Following','Breakout','Reversal','Scalp','Swing','ICT / SMC','Supply & Demand','News Trade','Other'];
  const SESSIONS   = ['London','New York','Asian','London/NY Overlap','Off-hours'];
  const EMOTIONS   = ['Calm & Focused','Confident','Anxious','Overconfident','Fearful','FOMO','Revenge Trading','Neutral'];
</script>

<div class="page-header">
  <h2>{isEditing ? 'Edit Trade' : 'Log New Trade'}</h2>
  <p>Account: <strong>{$activeAccount?.name}</strong> — add multiple entries &amp; exits for partials</p>
</div>

<div class="card">
  <!-- Core fields -->
  <div class="form-grid">
    <div class="form-group">
      <label>Date *</label>
      <input type="date" bind:value={fDate} />
    </div>
    <div class="form-group">
      <label>Currency Pair *</label>
      <select bind:value={fPair}>
        <option value="">Select pair…</option>
        {#each $instruments as sym}
          <option value={sym}>{sym}</option>
        {/each}
      </select>
    </div>
    <div class="form-group">
      <label>Direction *</label>
      <select bind:value={fDir}>
        <option value="">Select…</option>
        <option value="BUY">BUY (Long)</option>
        <option value="SELL">SELL (Short)</option>
      </select>
    </div>
    <div class="form-group">
      <label>Stop Loss</label>
      <input type="number" bind:value={fSl} placeholder="1.09000" step="0.00001" />
    </div>
    <div class="form-group">
      <label>R:R Ratio</label>
      <input type="number" bind:value={fRr} placeholder="2.0" step="0.1" min="0" />
    </div>
    <div class="form-group">
      <label>Strategy</label>
      <select bind:value={fStrategy}>
        <option value="">None</option>
        {#each STRATEGIES as s}<option>{s}</option>{/each}
      </select>
    </div>
    <div class="form-group">
      <label>Session</label>
      <select bind:value={fSession}>
        <option value="">None</option>
        {#each SESSIONS as s}<option>{s}</option>{/each}
      </select>
    </div>
    <div class="form-group">
      <label>Emotion</label>
      <select bind:value={fEmotion}>
        <option value="">None</option>
        {#each EMOTIONS as e}<option>{e}</option>{/each}
      </select>
    </div>
    <div class="form-group">
      <label>Outcome Override</label>
      <select bind:value={fOutcome}>
        <option value="">Auto-detect from P&amp;L</option>
        <option value="WIN">Win</option>
        <option value="LOSS">Loss</option>
        <option value="BE">Break Even</option>
      </select>
    </div>
  </div>

  <!-- ── Entries ── -->
  <div class="partials-block">
    <div class="pb-header">
      <div class="pb-title">
        <span class="pb-icon entry">↓</span>
        Entries
      </div>
      <span class="pb-summary">{totalLotsIn > 0 ? `${totalLotsIn.toFixed(2)} lots · avg @ ${avgEntry.toFixed(5)}` : ''}</span>
    </div>

    <div class="ph-row">
      <span>#</span><span>Time</span><span>Price *</span><span>Lots</span><span>Note</span><span></span>
    </div>

    {#each entries as entry, i (entry.id)}
      <div class="partial-row">
        <div class="pnum">E{i+1}</div>
        <input type="time" bind:value={entry.time} placeholder="Time" />
        <input type="number" bind:value={entry.price} placeholder="Price" step="0.00001" />
        <input type="number" bind:value={entry.lots} placeholder="Lots" step="0.01" min="0" />
        <input type="text"   bind:value={entry.note} placeholder="Note (e.g. Scale-in)" />
        <button class="del-btn" on:click={() => removeEntry(entry.id)} disabled={entries.length===1} title="Remove">×</button>
      </div>
    {/each}

    <button class="btn btn-add" on:click={addEntry}>+ Add Entry</button>
  </div>

  <!-- ── Exits ── -->
  <div class="partials-block" style="margin-top:14px;">
    <div class="pb-header">
      <div class="pb-title">
        <span class="pb-icon exit">→</span>
        Exits
      </div>
      <span class="pb-summary" class:positive={totalPnl>0} class:negative={totalPnl<0}>
        {totalLotsOut > 0 ? `${totalLotsOut.toFixed(2)} lots · total ${fmt(totalPnl)}` : ''}
      </span>
    </div>

    <div class="ph-row">
      <span>#</span><span>Time</span><span>Price</span><span>Lots</span><span>P&amp;L ($)</span><span>Note</span><span></span>
    </div>

    {#each exits as exit, i (exit.id)}
      <div class="partial-row exit-row">
        <div class="pnum">X{i+1}</div>
        <input type="time"   bind:value={exit.time}  placeholder="Time" />
        <input type="number" bind:value={exit.price} placeholder="Price" step="0.00001" />
        <input type="number" bind:value={exit.lots}  placeholder="Lots"  step="0.01" min="0" />
        <input type="number" bind:value={exit.pnl}   placeholder="P&L"   step="0.01" />
        <input type="text"   bind:value={exit.note}  placeholder="Note (e.g. TP1)" />
        <button class="del-btn" on:click={() => removeExit(exit.id)} disabled={exits.length===1} title="Remove">×</button>
      </div>
    {/each}

    <button class="btn btn-add" on:click={addExit}>+ Add Exit</button>

    {#if totalLotsIn > 0 || totalPnl !== 0}
      <div class="partials-summary">
        <div class="ps-item"><div class="ps-lbl">Lots In</div><div class="ps-val neutral">{totalLotsIn.toFixed(2)}</div></div>
        <div class="ps-item"><div class="ps-lbl">Lots Out</div><div class="ps-val neutral">{totalLotsOut.toFixed(2)}</div></div>
        <div class="ps-item"><div class="ps-lbl">Avg Entry</div><div class="ps-val neutral">{avgEntry > 0 ? avgEntry.toFixed(5) : '—'}</div></div>
        <div class="ps-item">
          <div class="ps-lbl">Total P&L</div>
          <div class="ps-val" class:positive={totalPnl>0} class:negative={totalPnl<0}>{fmt(totalPnl)}</div>
        </div>
      </div>
    {/if}
  </div>

  <!-- ── Chart Images / TradingView ── -->
  <div class="chart-section">
    <div class="pb-header">
      <div class="pb-title">
        <span class="pb-icon tv">📊</span>
        Chart Screenshots
      </div>
    </div>

    <!-- TradingView link input -->
    <div class="tv-link-row">
      <input type="url" bind:value={tvLink} placeholder="Paste TradingView chart link (https://www.tradingview.com/x/...)" />
      <button class="btn btn-ghost btn-sm" on:click={addTvLink}>Add Link</button>
    </div>

    <!-- Drop zone -->
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <div
      class="drop-zone"
      class:drag-over={dragOver}
      on:dragover|preventDefault={() => dragOver = true}
      on:dragleave={() => dragOver = false}
      on:drop={handleDropZone}
      on:click={() => fileInput.click()}
    >
      <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="opacity:.4;display:block;margin:0 auto 8px"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/></svg>
      <p>Drop chart screenshots here or click to browse</p>
      <input type="file" accept="image/*" multiple bind:this={fileInput} on:change={e => handleImageFiles(e.target.files)} style="display:none" />
    </div>

    <!-- Preview grid -->
    {#if chartImages.length}
      <div class="img-grid">
        {#each chartImages as img, idx}
          <div class="img-item">
            {#if img.isLink}
              <a href={img.data} target="_blank" rel="noopener" class="img-link-card">
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                <span>TradingView</span>
              </a>
            {:else}
              <img src={img.data} alt={img.name} class="img-preview" on:click={() => window.open(img.data)} />
            {/if}
            <button class="img-remove" on:click={() => removeImage(idx)} title="Remove">×</button>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Tags & Notes -->
  <div class="form-group" style="margin-top:16px;">
    <label>Tags (comma-separated)</label>
    <input type="text" bind:value={fTags} placeholder="confluence, fib-618, trend-aligned, news-driven" />
  </div>
  <div class="form-group" style="margin-top:12px;">
    <label>Notes / Analysis</label>
    <textarea bind:value={fNotes} placeholder="Why did you take this trade? What did you see? Mistakes? Lessons learned?" />
  </div>

  <div class="form-actions">
    <button class="btn btn-primary" on:click={save}>
      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17,21 17,13 7,13 7,21"/><polyline points="7,3 7,8 15,8"/></svg>
      {isEditing ? 'Update Trade' : 'Save Trade'}
    </button>
    <button class="btn btn-ghost" on:click={clearForm}>Clear</button>
  </div>
</div>

<style>
  .partials-block {
    background: var(--surface2); border: 1px solid var(--border);
    border-radius: 10px; padding: 16px; margin-top: 20px;
  }
  .pb-header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid var(--border);
  }
  .pb-title { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; }
  .pb-icon { font-size: 14px; }
  .pb-icon.entry { color: var(--accent); }
  .pb-icon.exit  { color: var(--green); }
  .pb-icon.tv    { }
  .pb-summary { font-size: 12px; color: var(--muted); }

  .ph-row {
    display: grid;
    grid-template-columns: 36px 90px 1fr 90px 1fr 90px 30px;
    gap: 6px; padding: 0 4px; margin-bottom: 6px;
  }
  .ph-row span { font-size: 10px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; }

  .exit-row { grid-template-columns: 36px 90px 1fr 90px 90px 1fr 30px; }

  .partial-row {
    display: grid;
    grid-template-columns: 36px 90px 1fr 90px 1fr 90px 30px;
    gap: 6px; align-items: center;
    margin-bottom: 8px; padding: 8px;
    background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
  }
  .partial-row.exit-row {
    grid-template-columns: 36px 90px 1fr 90px 90px 1fr 30px;
  }
  .partial-row input { padding: 7px 9px; font-size: 12px; }
  .pnum { font-size: 10px; font-weight: 700; color: var(--accent); }

  .del-btn {
    width: 26px; height: 26px; background: rgba(255,77,109,0.1);
    border: 1px solid rgba(255,77,109,0.2); border-radius: 6px;
    color: var(--red); cursor: pointer; font-size: 14px;
    display: flex; align-items: center; justify-content: center; transition: all 0.2s;
  }
  .del-btn:hover { background: rgba(255,77,109,0.25); }
  .del-btn:disabled { opacity: 0.3; cursor: not-allowed; }

  .partials-summary {
    display: grid; grid-template-columns: repeat(4,1fr);
    gap: 10px; margin-top: 12px; padding-top: 12px;
    border-top: 1px solid var(--border);
  }
  .ps-item { text-align: center; }
  .ps-lbl { font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; }
  .ps-val { font-size: 15px; font-weight: 700; margin-top: 3px; }

  /* Chart section */
  .chart-section {
    background: var(--surface2); border: 1px solid var(--border);
    border-radius: 10px; padding: 16px; margin-top: 14px;
  }
  .tv-link-row { display: flex; gap: 8px; margin-bottom: 10px; }
  .tv-link-row input { flex: 1; }

  .drop-zone {
    border: 2px dashed var(--border); border-radius: 10px;
    padding: 24px; text-align: center; cursor: pointer; transition: all 0.2s;
    color: var(--muted); font-size: 13px;
  }
  .drop-zone:hover, .drop-zone.drag-over {
    border-color: var(--accent); background: rgba(0,212,255,0.04); color: var(--text);
  }

  .img-grid { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 12px; }
  .img-item { position: relative; }
  .img-preview {
    width: 110px; height: 74px; object-fit: cover; border-radius: 8px;
    border: 1px solid var(--border); cursor: pointer; display: block;
    transition: transform 0.15s;
  }
  .img-preview:hover { transform: scale(1.04); }
  .img-link-card {
    width: 110px; height: 74px; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 5px;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 8px; color: var(--accent); text-decoration: none; font-size: 11px;
    transition: border-color 0.15s;
  }
  .img-link-card:hover { border-color: var(--accent); }
  .img-remove {
    position: absolute; top: -6px; right: -6px; width: 18px; height: 18px;
    background: var(--red); border: none; border-radius: 50%;
    color: #fff; cursor: pointer; font-size: 11px; display: flex;
    align-items: center; justify-content: center;
  }
</style>
