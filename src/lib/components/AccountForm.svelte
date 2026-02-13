<!-- src/lib/components/AccountForm.svelte -->
<script>
  export let fName = '';
  export let fBroker = '';
  export let fCurrency = 'USD';
  export let fBalance = 10000;
  export let fColor = '#00d4ff';
  export let COLORS = ['#00d4ff','#7c3aed','#00c896','#ff4d6d','#f59e0b','#ec4899','#06b6d4','#84cc16'];
</script>

<div class="form-grid" style="grid-template-columns:1fr 1fr;">
  <div class="form-group" style="grid-column:1/-1;">
    <label>Account Name *</label>
    <input type="text" bind:value={fName} placeholder="Main Account, FTMO #1, Demo…" />
  </div>
  <div class="form-group">
    <label>Broker</label>
    <input type="text" bind:value={fBroker} placeholder="IC Markets, FTMO…" />
  </div>
  <div class="form-group">
    <label>Currency</label>
    <select bind:value={fCurrency}>
      <option value="USD">USD</option>
      <option value="EUR">EUR</option>
      <option value="GBP">GBP</option>
      <option value="JPY">JPY</option>
      <option value="AUD">AUD</option>
      <option value="CAD">CAD</option>
      <option value="CHF">CHF</option>
    </select>
  </div>
  <div class="form-group" style="grid-column:1/-1;">
    <label>Starting Balance</label>
    <input type="number" bind:value={fBalance} placeholder="10000" min="0" step="100" />
  </div>
  <div class="form-group" style="grid-column:1/-1;">
    <label>Accent Color</label>
    <div class="color-row">
      {#each COLORS as c}
        <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
        <div
          class="color-dot"
          class:selected={fColor === c}
          style="background:{c}"
          on:click={() => fColor = c}
        ></div>
      {/each}
      <input type="color" bind:value={fColor} style="width:36px;height:36px;padding:2px;border-radius:8px;cursor:pointer;" />
    </div>
  </div>
</div>

<style>
  .color-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 4px; }
  .color-dot {
    width: 28px; height: 28px; border-radius: 50%; cursor: pointer;
    border: 2px solid transparent; transition: all 0.15s; flex-shrink: 0;
  }
  .color-dot:hover { transform: scale(1.15); }
  .color-dot.selected { border-color: white; box-shadow: 0 0 0 2px rgba(255,255,255,0.3); transform: scale(1.15); }
</style>
