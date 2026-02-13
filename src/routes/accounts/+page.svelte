<!-- src/routes/accounts/+page.svelte -->
<script>
  import { accounts, activeAccountId, trades, calcStats, fmt, fmtPct, newId, showToast, seedSampleData } from '$lib/stores/index.js';
  import Modal from '$lib/components/Modal.svelte';
  import StatCard from '$lib/components/StatCard.svelte';
  import AccountForm from '$lib/components/AccountForm.svelte';

  let createModal = false;
  let editModal = false;
  let editingAcct = null;

  // Form state
  let fName = '';
  let fBroker = '';
  let fCurrency = 'USD';
  let fBalance = 10000;
  let fColor = '#00d4ff';

  const COLORS = ['#00d4ff','#7c3aed','#00c896','#ff4d6d','#f59e0b','#ec4899','#06b6d4','#84cc16'];

  function openCreate() {
    fName = ''; fBroker = ''; fCurrency = 'USD'; fBalance = 10000; fColor = COLORS[0];
    createModal = true;
  }

  function openEdit(acct) {
    editingAcct = acct;
    fName = acct.name; fBroker = acct.broker ?? ''; fCurrency = acct.currency ?? 'USD';
    fBalance = acct.balance ?? 10000; fColor = acct.color ?? '#00d4ff';
    editModal = true;
  }

  function saveNew() {
    if (!fName.trim()) { showToast('Account name required', 'error'); return; }
    const acct = {
      id: newId(), name: fName.trim(), broker: fBroker, currency: fCurrency,
      balance: parseFloat(fBalance) || 0, color: fColor,
      createdAt: new Date().toISOString()
    };
    $accounts = [...$accounts, acct];
    $activeAccountId = acct.id;
    createModal = false;
    showToast('Account created!');
  }

  function saveEdit() {
    if (!fName.trim()) { showToast('Name required', 'error'); return; }
    $accounts = $accounts.map(a => a.id === editingAcct.id
      ? { ...a, name: fName.trim(), broker: fBroker, currency: fCurrency, balance: parseFloat(fBalance)||0, color: fColor }
      : a
    );
    editModal = false;
    showToast('Account updated!');
  }

  function deleteAcct(id) {
    if ($accounts.length === 1) { showToast('Cannot delete the only account', 'error'); return; }
    const tradeCount = $trades.filter(t => t.accountId === id).length;
    if (!confirm(`Delete this account?\n${tradeCount > 0 ? `This will also delete ${tradeCount} trades.` : 'No trades in this account.'}`)) return;
    $accounts = $accounts.filter(a => a.id !== id);
    if ($activeAccountId === id) $activeAccountId = $accounts[0]?.id;
    showToast('Account deleted', 'error');
  }

  function switchTo(id) { $activeAccountId = id; showToast('Switched account'); }

  function acctTrades(id) { return $trades.filter(t => t.accountId === id); }
  function acctStats(id) { return calcStats(acctTrades(id)); }
</script>

<div class="page-header">
  <h2>Trading Accounts</h2>
  <p>Manage multiple accounts and switch between them</p>
</div>

<div style="display:flex;justify-content:flex-end;margin-bottom:20px;">
  <button class="btn btn-primary" on:click={openCreate}>+ New Account</button>
</div>

<div class="acct-grid">
  {#each $accounts as acct}
    {@const st = acctStats(acct.id)}
    {@const isActive = acct.id === $activeAccountId}
    <div class="acct-card" class:active={isActive}>
      <div class="acct-stripe" style="background:{acct.color}"></div>
      <div class="acct-top">
        <div>
          <div class="acct-name">{acct.name}</div>
          <div class="acct-meta">{acct.broker || 'No broker'} · {acct.currency}</div>
        </div>
        {#if isActive}
          <span class="active-badge">ACTIVE</span>
        {/if}
      </div>

      <div class="acct-stats">
        <div class="as"><div class="asl">Balance</div><div class="asv">${(acct.balance||0).toLocaleString()}</div></div>
        <div class="as"><div class="asl">Trades</div><div class="asv">{st?.total ?? 0}</div></div>
        <div class="as">
          <div class="asl">P&L</div>
          <div class="asv" class:positive={st?.totalPnl > 0} class:negative={st?.totalPnl < 0}>{fmt(st?.totalPnl ?? 0)}</div>
        </div>
        <div class="as">
          <div class="asl">Win Rate</div>
          <div class="asv" class:positive={st?.winRate >= 50} class:negative={st?.winRate < 50 && st?.total > 0}>{st ? fmtPct(st.winRate) : '—'}</div>
        </div>
      </div>

      <div class="acct-actions">
        {#if !isActive}
          <button class="btn btn-ghost btn-sm" on:click={() => switchTo(acct.id)}>Switch To</button>
        {/if}
        <button class="btn btn-ghost btn-sm" on:click={() => openEdit(acct)}>Edit</button>
        {#if st?.total === 0}
          <button class="btn btn-ghost btn-sm" on:click={() => seedSampleData(acct.id)}>Load Samples</button>
        {/if}
        {#if !isActive}
          <button class="btn btn-danger btn-sm" on:click={() => deleteAcct(acct.id)}>Delete</button>
        {/if}
      </div>
    </div>
  {/each}
</div>

<!-- Create Modal -->
<Modal bind:open={createModal} title="New Account" maxWidth="480px">
  <AccountForm bind:fName bind:fBroker bind:fCurrency bind:fBalance bind:fColor {COLORS} />
  <div class="form-actions">
    <button class="btn btn-primary" on:click={saveNew}>Create Account</button>
    <button class="btn btn-ghost" on:click={() => createModal = false}>Cancel</button>
  </div>
</Modal>

<!-- Edit Modal -->
<Modal bind:open={editModal} title="Edit Account" maxWidth="480px">
  <AccountForm bind:fName bind:fBroker bind:fCurrency bind:fBalance bind:fColor {COLORS} />
  <div class="form-actions">
    <button class="btn btn-primary" on:click={saveEdit}>Save Changes</button>
    <button class="btn btn-ghost" on:click={() => editModal = false}>Cancel</button>
  </div>
</Modal>

<style>
  .acct-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }
  .acct-card {
    background: var(--surface); border: 1px solid var(--border); border-radius: 14px;
    padding: 20px; position: relative; overflow: hidden; transition: border-color 0.2s;
  }
  .acct-card.active { border-color: rgba(0,212,255,0.4); box-shadow: 0 0 20px rgba(0,212,255,0.06); }
  .acct-stripe { position: absolute; top: 0; left: 0; right: 0; height: 3px; }
  .acct-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
  .acct-name { font-size: 16px; font-weight: 700; }
  .acct-meta { font-size: 12px; color: var(--muted); margin-top: 2px; }
  .active-badge { background: rgba(0,212,255,0.12); color: var(--accent); font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 20px; letter-spacing: 0.5px; }
  .acct-stats { display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; margin-bottom: 16px; }
  .as .asl { font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.4px; }
  .as .asv { font-size: 14px; font-weight: 700; margin-top: 2px; }
  .acct-actions { display: flex; gap: 8px; flex-wrap: wrap; }
</style>


