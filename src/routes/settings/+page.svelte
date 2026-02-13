<!-- src/routes/settings/+page.svelte -->
<script>
  import { instruments, addInstrument, removeInstrument, trades, showToast } from '$lib/stores/index.js';

  let newSym = '';
  let search = '';

  const CATEGORIES = {
    'Forex Majors':   ['EUR/USD','GBP/USD','USD/JPY','USD/CHF','AUD/USD','USD/CAD','NZD/USD'],
    'Forex Minors':   ['EUR/GBP','EUR/JPY','GBP/JPY','EUR/CHF','AUD/JPY','EUR/AUD','GBP/CAD','GBP/AUD','AUD/NZD','EUR/CAD','EUR/NZD','GBP/NZD','CAD/JPY','CHF/JPY'],
    'Metals':         ['XAU/USD','XAG/USD'],
    'Indices':        ['US30','US500','NAS100','GER40','UK100','JPN225','AUS200'],
    'Crypto':         ['BTC/USD','ETH/USD','SOL/USD','XRP/USD'],
    'Energy':         ['USOIL','UKOIL','NATGAS'],
  };

  const QUICK_ADD = Object.values(CATEGORIES).flat();

  function add() {
    if (!newSym.trim()) return;
    addInstrument(newSym);
    newSym = '';
    showToast('Instrument added!');
  }

  function handleKey(e) { if (e.key === 'Enter') add(); }

  function remove(sym) {
    const inUse = $trades.some(t => t.pair === sym);
    if (inUse && !confirm(`"${sym}" is used in ${$trades.filter(t=>t.pair===sym).length} trade(s). Remove anyway?`)) return;
    removeInstrument(sym);
    showToast(`${sym} removed`, 'error');
  }

  function quickAdd(sym) {
    if ($instruments.includes(sym)) { showToast(`${sym} already in list`, 'error'); return; }
    addInstrument(sym);
    showToast(`${sym} added!`);
  }

  $: displayed = search
    ? $instruments.filter(s => s.toLowerCase().includes(search.toLowerCase()))
    : $instruments;

  // Export/import JSON
  function exportData() {
    const data = { instruments: $instruments, trades: $trades, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `fx-journal-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click(); URL.revokeObjectURL(url);
    showToast('Backup exported!');
  }

  let fileImport;
  function importData() { fileImport.click(); }
  function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.trades) {
          if (!confirm(`Import ${data.trades.length} trades? This will REPLACE existing data.`)) return;
          import('$lib/stores/index.js').then(m => {
            m.trades.set(data.trades);
            if (data.instruments) m.instruments.set(data.instruments);
            showToast(`Imported ${data.trades.length} trades!`);
          });
        }
      } catch { showToast('Invalid file', 'error'); }
    };
    reader.readAsText(file);
  }
</script>

<div class="page-header">
  <h2>Settings</h2>
  <p>Manage instruments, data export/import</p>
</div>

<!-- ── Instruments Manager ── -->
<div class="card" style="margin-bottom:20px;">
  <div class="card-title">Instruments / Scripts</div>
  <p style="color:var(--muted);font-size:13px;margin-bottom:16px;">
    Add any custom forex pair, index, commodity, or crypto symbol. These appear in the Log Trade form.
  </p>

  <!-- Add new -->
  <div class="add-row">
    <input
      type="text" bind:value={newSym} placeholder="e.g. EUR/USD, US500, BTC/USD…"
      on:keydown={handleKey} style="max-width:280px;"
    />
    <button class="btn btn-primary btn-sm" on:click={add}>Add Instrument</button>
  </div>

  <!-- Search current list -->
  <div style="margin:16px 0 10px;">
    <input type="text" bind:value={search} placeholder="Search instruments…" style="max-width:280px;" />
  </div>

  <!-- Current instruments -->
  <div class="sym-grid">
    {#each displayed as sym}
      <div class="sym-chip">
        <span>{sym}</span>
        <button class="chip-del" on:click={() => remove(sym)} title="Remove">×</button>
      </div>
    {/each}
    {#if !displayed.length}
      <p style="color:var(--muted);font-size:13px;">No instruments match.</p>
    {/if}
  </div>

  <!-- Quick-add by category -->
  <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border);">
    <div class="card-title" style="margin-bottom:12px;">Quick Add by Category</div>
    {#each Object.entries(CATEGORIES) as [cat, syms]}
      <div class="cat-row">
        <div class="cat-name">{cat}</div>
        <div class="cat-chips">
          {#each syms as sym}
            <button
              class="qchip"
              class:exists={$instruments.includes(sym)}
              on:click={() => quickAdd(sym)}
              disabled={$instruments.includes(sym)}
            >{sym}</button>
          {/each}
        </div>
      </div>
    {/each}
  </div>
</div>

<!-- ── Data Management ── -->
<div class="card">
  <div class="card-title">Data Management</div>
  <p style="color:var(--muted);font-size:13px;margin-bottom:16px;">
    All data is stored locally in your browser. Export a backup or import from a previous backup.
  </p>
  <div style="display:flex;gap:10px;flex-wrap:wrap;">
    <button class="btn btn-ghost" on:click={exportData}>
      ↓ Export Backup (JSON)
    </button>
    <button class="btn btn-ghost" on:click={importData}>
      ↑ Import Backup (JSON)
    </button>
    <input type="file" accept=".json" bind:this={fileImport} on:change={handleImport} style="display:none;" />
  </div>
</div>

<style>
  .add-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }

  .sym-grid { display: flex; flex-wrap: wrap; gap: 8px; }
  .sym-chip {
    display: flex; align-items: center; gap: 6px;
    background: var(--surface2); border: 1px solid var(--border);
    border-radius: 8px; padding: 6px 10px; font-size: 12px; font-weight: 600;
  }
  .chip-del {
    background: none; border: none; color: var(--muted); cursor: pointer;
    font-size: 14px; line-height: 1; padding: 0; transition: color 0.15s;
  }
  .chip-del:hover { color: var(--red); }

  .cat-row { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 10px; }
  .cat-name { font-size: 11px; font-weight: 600; color: var(--muted); width: 100px; flex-shrink: 0; padding-top: 5px; text-transform: uppercase; letter-spacing: 0.4px; }
  .cat-chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .qchip {
    padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600;
    background: var(--surface2); border: 1px solid var(--border); cursor: pointer;
    color: var(--text); transition: all 0.15s;
  }
  .qchip:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
  .qchip.exists { opacity: 0.35; cursor: not-allowed; }
</style>
