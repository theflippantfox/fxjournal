<!-- src/lib/components/Toast.svelte -->
<script>
  import { toast } from '$lib/stores/index.js';
</script>

{#if $toast}
  <div class="toast" class:error={$toast.type === 'error'} class:show={!!$toast}>
    <div class="dot" class:red={$toast.type === 'error'}></div>
    <span>{$toast.msg}</span>
  </div>
{/if}

<style>
  .toast {
    position: fixed; bottom: 24px; right: 24px;
    background: var(--surface2); border: 1px solid var(--border); border-radius: 10px;
    padding: 14px 18px; font-size: 13px; font-weight: 500;
    display: flex; align-items: center; gap: 10px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4); z-index: 9999;
    animation: slideUp 0.3s cubic-bezier(.34,1.56,.64,1);
  }
  @keyframes slideUp {
    from { transform: translateY(60px); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
  }
  .dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: var(--green); flex-shrink: 0;
  }
  .dot.red { background: var(--red); }
</style>
