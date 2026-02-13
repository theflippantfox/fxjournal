<!-- src/lib/components/Modal.svelte -->
<script>
  export let open = false;
  export let title = '';
  export let maxWidth = '820px';

  function close() { open = false; }
</script>

{#if open}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="overlay" on:click|self={close}>
    <div class="modal" style="max-width:{maxWidth}">
      <button class="close-btn" on:click={close}>✕</button>
      {#if title}
        <div class="modal-title">{title}</div>
      {/if}
      <slot />
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.75);
    backdrop-filter: blur(4px); z-index: 500;
    display: flex; align-items: center; justify-content: center; padding: 20px;
  }
  .modal {
    background: var(--surface); border: 1px solid var(--border); border-radius: 16px;
    padding: 28px; width: 100%; max-height: 90vh; overflow-y: auto; position: relative;
    animation: pop 0.25s cubic-bezier(.34,1.56,.64,1);
  }
  @keyframes pop {
    from { transform: scale(0.93); opacity: 0; }
    to   { transform: scale(1);    opacity: 1; }
  }
  .modal-title { font-size: 18px; font-weight: 700; margin-bottom: 20px; padding-right: 36px; }
  .close-btn {
    position: absolute; top: 18px; right: 18px;
    background: var(--surface2); border: 1px solid var(--border); color: var(--muted);
    width: 30px; height: 30px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; font-size: 15px; transition: all 0.2s;
  }
  .close-btn:hover { color: var(--text); border-color: var(--accent); }
</style>
