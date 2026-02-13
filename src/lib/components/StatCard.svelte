<!-- src/lib/components/StatCard.svelte -->
<script>
  export let label = '';
  export let value = '—';
  export let sub = '';
  export let color = ''; // 'positive' | 'negative' | 'neutral'
</script>

<div class="stat-card">
  <div class="stat-label">{label}</div>
  <div class="stat-value {color}">{value}</div>
  {#if sub}<div class="stat-sub">{sub}</div>{/if}
</div>

<style>
  .stat-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 12px; padding: 18px; position: relative; overflow: hidden;
  }
  .stat-card::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
    background: linear-gradient(90deg, var(--accent), var(--accent2)); opacity: 0.6;
  }
  .stat-label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.6px; }
  .stat-value { font-size: 24px; font-weight: 700; margin-top: 6px; letter-spacing: -1px; }
  .stat-sub { font-size: 11px; color: var(--muted); margin-top: 4px; }
</style>
