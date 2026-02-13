<!-- src/lib/components/Badge.svelte -->
<script>
  export let variant = 'default'; // buy | sell | win | loss | be | partial | accent
</script>

<span class="badge badge-{variant}"><slot /></span>

<style>
  .badge {
    display: inline-flex; align-items: center; padding: 3px 8px;
    border-radius: 20px; font-size: 11px; font-weight: 600; letter-spacing: 0.3px;
  }
  .badge-buy  { background: rgba(0,200,150,0.15); color: var(--green); }
  .badge-sell { background: rgba(255,77,109,0.15); color: var(--red); }
  .badge-win  { background: rgba(0,200,150,0.12); color: var(--green); }
  .badge-loss { background: rgba(255,77,109,0.12); color: var(--red); }
  .badge-be   { background: rgba(245,158,11,0.12); color: var(--yellow); }
  .badge-partial { background: rgba(0,212,255,0.12); color: var(--accent); font-size: 10px; padding: 2px 6px; }
  .badge-accent  { background: rgba(124,58,237,0.15); color: #a78bfa; }
  .badge-default { background: var(--surface2); color: var(--muted); }
</style>
