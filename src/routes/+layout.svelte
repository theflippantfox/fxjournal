<!-- src/routes/+layout.svelte -->
<script>
  import Sidebar from '$lib/components/Sidebar.svelte';
  import Toast from '$lib/components/Toast.svelte';
</script>

<div class="app">
  <Sidebar />
  <main class="main">
    <slot />
  </main>
  <Toast />
</div>

<style>
  :global(*) { margin: 0; padding: 0; box-sizing: border-box; }
  :global(:root) {
    --bg: #0a0e1a;
    --surface: #111827;
    --surface2: #1a2236;
    --surface3: #1f2d45;
    --border: #1e3a5f;
    --accent: #00d4ff;
    --accent2: #7c3aed;
    --green: #00c896;
    --red: #ff4d6d;
    --yellow: #f59e0b;
    --text: #e2e8f0;
    --muted: #64748b;
  }
  :global(body) {
    font-family: 'Segoe UI', system-ui, sans-serif;
    background: var(--bg); color: var(--text); min-height: 100vh; font-size: 14px;
  }
  :global(input), :global(select), :global(textarea) {
    background: var(--surface2); border: 1px solid var(--border); border-radius: 8px;
    color: var(--text); padding: 9px 12px; font-size: 13px; font-family: inherit;
    transition: border-color 0.2s; outline: none; width: 100%;
  }
  :global(input:focus), :global(select:focus), :global(textarea:focus) {
    border-color: var(--accent); box-shadow: 0 0 0 3px rgba(0,212,255,0.08);
  }
  :global(textarea) { resize: vertical; min-height: 80px; }
  :global(select option) { background: var(--surface2); }
  :global(.btn) {
    display: inline-flex; align-items: center; gap: 7px; padding: 10px 20px;
    border-radius: 8px; border: none; cursor: pointer; font-size: 13px;
    font-weight: 600; font-family: inherit; transition: all 0.2s;
  }
  :global(.btn-primary) {
    background: linear-gradient(135deg, #0ea5e9, #7c3aed); color: #fff;
    box-shadow: 0 4px 12px rgba(14,165,233,0.3);
  }
  :global(.btn-primary:hover) { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(14,165,233,0.4); }
  :global(.btn-danger)  { background: rgba(255,77,109,0.15); color: var(--red); border: 1px solid rgba(255,77,109,0.3); }
  :global(.btn-danger:hover)  { background: rgba(255,77,109,0.25); }
  :global(.btn-ghost)   { background: transparent; color: var(--muted); border: 1px solid var(--border); }
  :global(.btn-ghost:hover)   { color: var(--text); border-color: var(--accent); }
  :global(.btn-add) { background: rgba(0,212,255,0.08); color: var(--accent); border: 1px dashed rgba(0,212,255,0.4); padding: 7px 14px; font-size: 12px; }
  :global(.btn-add:hover) { background: rgba(0,212,255,0.15); border-style: solid; }
  :global(.btn-sm) { padding: 5px 10px; font-size: 11px; }
  :global(.card) { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 20px; }
  :global(.card-title) { font-size: 12px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 12px; }
  :global(.page-header) { margin-bottom: 24px; }
  :global(.page-header h2) { font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
  :global(.page-header p) { color: var(--muted); margin-top: 4px; font-size: 13px; }
  :global(.stats-grid) { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 14px; margin-bottom: 24px; }
  :global(.grid-2) { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
  :global(.grid-3) { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-bottom: 20px; }
  :global(.full-width) { margin-bottom: 20px; }
  :global(.positive) { color: var(--green); }
  :global(.negative) { color: var(--red); }
  :global(.neutral)  { color: var(--accent); }
  :global(table) { width: 100%; border-collapse: collapse; font-size: 13px; }
  :global(thead tr) { border-bottom: 1px solid var(--border); }
  :global(th) { padding: 10px 12px; text-align: left; color: var(--muted); font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; }
  :global(td) { padding: 11px 12px; border-bottom: 1px solid rgba(30,58,95,0.4); vertical-align: middle; }
  :global(tbody tr:hover) { background: var(--surface2); }
  :global(tbody tr:last-child td) { border-bottom: none; }
  :global(.form-grid) { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
  :global(.form-group) { display: flex; flex-direction: column; gap: 6px; }
  :global(.form-group label) { font-size: 12px; color: var(--muted); font-weight: 500; }
  :global(.form-actions) { display: flex; gap: 10px; margin-top: 20px; flex-wrap: wrap; }
  :global(.tag-pill) { display: inline-flex; padding: 2px 7px; border-radius: 4px; font-size: 10px; font-weight: 600; background: rgba(124,58,237,0.15); color: #a78bfa; margin: 1px; }
  :global(::-webkit-scrollbar) { width: 6px; }
  :global(::-webkit-scrollbar-track) { background: transparent; }
  :global(::-webkit-scrollbar-thumb) { background: var(--surface3); border-radius: 3px; }
  :global(.table-wrap) { overflow-x: auto; }

  .app { display: flex; min-height: 100vh; }
  .main { margin-left: 220px; flex: 1; padding: 28px; }

  @media (max-width: 900px) {
    .main { margin-left: 60px; }
    :global(.grid-2), :global(.grid-3) { grid-template-columns: 1fr; }
    :global(.stats-grid) { grid-template-columns: repeat(2, 1fr); }
  }
</style>
