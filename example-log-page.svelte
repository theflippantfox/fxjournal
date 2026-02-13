<!-- EXAMPLE: src/routes/log/+page.svelte (Updated version) -->
<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  
  // NEW: Import from api stores
  import {
    trades,
    instruments,
    activeAccountId,
    activeAccount,
    saveTrade,
    getOutcome,
    newId,
    showToast,
    fmt
  } from '$lib/stores/api';
  
  // NEW: Import UI components and icons
  import Button from '$lib/components/ui/Button.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import {
    Save,
    X,
    Plus,
    Trash2,
    Image as ImageIcon,
    Link as LinkIcon,
    Calendar,
    TrendingUp,
    TrendingDown
  } from 'lucide-svelte';
  
  import Badge from '$lib/components/Badge.svelte';

  // Form state (same as before)
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
  let entries = [freshEntry()];
  let exits = [freshExit()];
  let chartImages = [];
  let tvLink = '';
  
  // Computed
  $: totalLotsIn = entries.reduce((s, e) => s + (parseFloat(e.lots) || 0), 0);
  $: totalLotsOut = exits.reduce((s, x) => s + (parseFloat(x.lots) || 0), 0);
  $: totalPnl = exits.reduce((s, x) => s + (parseFloat(x.pnl) || 0), 0);
  $: avgEntry = (() => {
    let wS = 0, lS = 0;
    entries.forEach(e => {
      const p = parseFloat(e.price) || 0;
      const l = parseFloat(e.lots) || 0;
      wS += p * l;
      lS += l;
    });
    return lS > 0 ? wS / lS : 0;
  })();
  
  function today() {
    return new Date().toISOString().split('T')[0];
  }
  
  function freshEntry() {
    return { id: newId(), time: '', price: '', lots: '', note: '' };
  }
  
  function freshExit() {
    return { id: newId(), time: '', price: '', lots: '', pnl: '', note: '' };
  }

  // Chart image handling - IMPROVED with error handling
  let dragOver = false;
  let fileInput;
  
  function handleImageFiles(files) {
    if (!files || files.length === 0) return;
    
    Array.from(files).forEach(file => {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        showToast(`${file.name} is not an image`, 'error');
        return;
      }
      
      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        showToast(`${file.name} is too large (max 5MB)`, 'error');
        return;
      }
      
      const reader = new FileReader();
      
      reader.onload = (e) => {
        if (e.target?.result) {
          chartImages = [...chartImages, {
            name: file.name,
            data: e.target.result,
            isLink: false
          }];
          showToast(`${file.name} uploaded!`);
        }
      };
      
      reader.onerror = () => {
        showToast(`Failed to read ${file.name}`, 'error');
      };
      
      reader.readAsDataURL(file);
    });
  }

  function handleDropZone(e) {
    e.preventDefault();
    handleImageFiles(e.dataTransfer.files);
    dragOver = false;
  }

  function addTvLink() {
    const trimmed = tvLink.trim();
    if (!trimmed) return;
    
    // Validate URL
    try {
      new URL(trimmed);
      chartImages = [...chartImages, {
        name: 'TradingView Link',
        data: trimmed,
        isLink: true
      }];
      tvLink = '';
      showToast('Chart link added!');
    } catch {
      showToast('Invalid URL', 'error');
    }
  }

  function removeImage(idx) {
    chartImages = chartImages.filter((_, i) => i !== idx);
    showToast('Image removed', 'error');
  }

  // Load trade for editing
  onMount(() => {
    const editParam = $page.url.searchParams.get('edit');
    if (editParam) {
      const t = $trades.find(tr => tr.id === editParam);
      if (t) loadTrade(t);
    }
  });

  function loadTrade(t) {
    isEditing = true;
    editId = t.id;
    fDate = t.date;
    fPair = t.pair;
    fDir = t.dir;
    fSl = t.sl ?? '';
    fRr = t.rr ?? '';
    fStrategy = t.strategy ?? '';
    fSession = t.session ?? '';
    fEmotion = t.emotion ?? '';
    fOutcome = t.outcome;
    fTags = t.tags?.join(', ') ?? '';
    fNotes = t.notes ?? '';
    chartImages = t.chartImages ?? [];

    entries = t.entries?.length
      ? t.entries.map(e => ({ ...e, id: newId() }))
      : [{ id: newId(), time: t.time ?? '', price: t.entry ?? '', lots: t.lots ?? '', note: '' }];
      
    exits = t.exits?.length
      ? t.exits.map(x => ({ ...x, id: newId() }))
      : [{ id: newId(), time: '', price: t.exit ?? '', lots: t.lots ?? '', pnl: t.pnl ?? '', note: '' }];
  }

  function clearForm() {
    isEditing = false;
    editId = '';
    fDate = today();
    fPair = '';
    fDir = '';
    fSl = '';
    fRr = '';
    fStrategy = '';
    fSession = '';
    fEmotion = '';
    fOutcome = '';
    fTags = '';
    fNotes = '';
    entries = [freshEntry()];
    exits = [freshExit()];
    chartImages = [];
    tvLink = '';
  }

  // NEW: Save function with async/await
  async function save() {
    if (!fPair || !fDir || !fDate) {
      showToast('Fill in pair, direction and date', 'error');
      return;
    }
    
    const validEntries = entries.filter(e => e.price);
    if (!validEntries.length) {
      showToast('Add at least one entry price', 'error');
      return;
    }

    const validExits = exits.filter(x => x.price);
    const pnl = parseFloat(totalPnl.toFixed(2));

    const trade = {
      id: editId || newId(),
      accountId: $activeAccountId,
      date: fDate,
      time: validEntries[0]?.time ?? '',
      pair: fPair,
      dir: fDir,
      lots: parseFloat(totalLotsIn.toFixed(2)) || null,
      entry: parseFloat(avgEntry.toFixed(5)),
      exit: exits[0]?.price ? parseFloat(exits[0].price) : null,
      sl: parseFloat(fSl) || null,
      pnl,
      rr: parseFloat(fRr) || null,
      strategy: fStrategy,
      session: fSession,
      emotion: fEmotion,
      outcome: getOutcome(pnl, fOutcome),
      tags: fTags.split(',').map(t => t.trim()).filter(Boolean),
      notes: fNotes,
      entries: validEntries.map(e => ({
        time: e.time,
        price: parseFloat(e.price) || 0,
        lots: parseFloat(e.lots) || 0,
        note: e.note
      })),
      exits: validExits.map(x => ({
        time: x.time,
        price: parseFloat(x.price) || 0,
        lots: parseFloat(x.lots) || 0,
        pnl: parseFloat(x.pnl) || 0,
        note: x.note
      })),
      isPartial: validEntries.length > 1 || validExits.length > 1,
      chartImages,
    };

    try {
      await saveTrade(trade); // NEW: async call
      showToast(isEditing ? 'Trade updated!' : 'Trade saved!');
      clearForm();
      goto('/journal');
    } catch (error) {
      showToast('Failed to save trade', 'error');
      console.error(error);
    }
  }

  const STRATEGIES = ['Price Action', 'Trend Following', 'Breakout', 'Reversal', 'Scalp', 'Swing', 'ICT / SMC', 'Supply & Demand', 'News Trade', 'Other'];
  const SESSIONS = ['London', 'New York', 'Asian', 'London/NY Overlap', 'Off-hours'];
  const EMOTIONS = ['Calm & Focused', 'Confident', 'Anxious', 'Overconfident', 'Fearful', 'FOMO', 'Revenge Trading', 'Neutral'];
</script>

<div class="page-header">
  <h2>
    {isEditing ? 'Edit Trade' : 'Log New Trade'}
  </h2>
  <p>
    Account: <strong>{$activeAccount?.name}</strong>
  </p>
</div>

<Card>
  <!-- Core fields grid -->
  <div class="form-grid">
    <div class="form-group">
      <label>
        <Calendar size={14} class="inline" />
        Date *
      </label>
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
        <option value="BUY">
          <TrendingUp size={14} class="inline" /> BUY (Long)
        </option>
        <option value="SELL">
          <TrendingDown size={14} class="inline" /> SELL (Short)
        </option>
      </select>
    </div>
    
    <!-- Rest of form fields... -->
  </div>

  <!-- Chart Images Section - IMPROVED -->
  <div class="chart-section">
    <h3 class="section-title">
      <ImageIcon size={18} />
      Chart Screenshots
    </h3>

    <!-- TradingView link -->
    <div class="flex gap-2 mb-3">
      <input
        type="url"
        bind:value={tvLink}
        placeholder="Paste TradingView chart link..."
        class="flex-1"
      />
      <Button variant="ghost" size="sm" on:click={addTvLink}>
        <LinkIcon size={16} />
        Add Link
      </Button>
    </div>

    <!-- Drop zone - IMPROVED -->
    <div
      class="drop-zone"
      class:drag-over={dragOver}
      on:dragover|preventDefault={() => (dragOver = true)}
      on:dragleave={() => (dragOver = false)}
      on:drop={handleDropZone}
      on:click={() => fileInput.click()}
      role="button"
      tabindex="0"
    >
      <ImageIcon size={32} class="opacity-40 mx-auto mb-2" />
      <p>Drop chart screenshots here or click to browse</p>
      <p class="text-xs text-muted mt-1">Max 5MB per image</p>
      <input
        type="file"
        accept="image/*"
        multiple
        bind:this={fileInput}
        on:change={e => handleImageFiles(e.target.files)}
        class="hidden"
      />
    </div>

    <!-- Image preview grid -->
    {#if chartImages.length}
      <div class="img-grid">
        {#each chartImages as img, idx}
          <div class="img-item">
            {#if img.isLink}
              <a href={img.data} target="_blank" rel="noopener" class="img-link-card">
                <LinkIcon size={20} />
                <span>TradingView</span>
              </a>
            {:else}
              <img
                src={img.data}
                alt={img.name}
                class="img-preview"
                on:click={() => window.open(img.data)}
                role="button"
                tabindex="0"
              />
            {/if}
            <button
              class="img-remove"
              on:click={() => removeImage(idx)}
              title="Remove"
            >
              <Trash2 size={14} />
            </button>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Action buttons - NEW UI -->
  <svelte:fragment slot="footer">
    <div class="flex gap-2 justify-end">
      <Button variant="ghost" on:click={clearForm}>
        <X size={16} />
        Cancel
      </Button>
      <Button variant="primary" on:click={save}>
        <Save size={16} />
        {isEditing ? 'Update Trade' : 'Save Trade'}
      </Button>
    </div>
  </svelte:fragment>
</Card>

<style>
  .form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
    margin-bottom: 24px;
  }
  
  .form-group label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    font-weight: 500;
    margin-bottom: 6px;
    color: var(--foreground);
  }
  
  .chart-section {
    margin-top: 24px;
    padding-top: 24px;
    border-top: 1px solid var(--border);
  }
  
  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 16px;
  }
  
  .drop-zone {
    border: 2px dashed var(--border);
    border-radius: 8px;
    padding: 32px;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s;
    background: var(--surface2);
  }
  
  .drop-zone:hover,
  .drop-zone.drag-over {
    border-color: var(--accent);
    background: rgba(0, 212, 255, 0.05);
  }
  
  .img-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 12px;
    margin-top: 16px;
  }
  
  .img-item {
    position: relative;
    aspect-ratio: 4/3;
    border-radius: 8px;
    overflow: hidden;
  }
  
  .img-preview {
    width: 100%;
    height: 100%;
    object-fit: cover;
    cursor: pointer;
    transition: transform 0.2s;
  }
  
  .img-preview:hover {
    transform: scale(1.05);
  }
  
  .img-link-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    height: 100%;
    background: var(--surface3);
    border: 1px solid var(--border);
    color: var(--accent);
    text-decoration: none;
    transition: all 0.2s;
  }
  
  .img-link-card:hover {
    background: var(--accent);
    color: white;
  }
  
  .img-remove {
    position: absolute;
    top: 6px;
    right: 6px;
    background: var(--red);
    color: white;
    border: none;
    border-radius: 4px;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.2s;
  }
  
  .img-item:hover .img-remove {
    opacity: 1;
  }
</style>
