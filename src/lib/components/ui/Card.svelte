<!-- src/lib/components/ui/Card.svelte -->
<script lang="ts">
  import { cn } from '$lib/utils';
  
  export let title: string = '';
  export let description: string = '';
</script>

<div class={cn('card', $$props.class)}>
  {#if title || description}
    <div class="card-header">
      {#if title}
        <h3 class="card-title">{title}</h3>
      {/if}
      {#if description}
        <p class="card-description">{description}</p>
      {/if}
    </div>
  {/if}
  
  <div class="card-content">
    <slot />
  </div>
  
  {#if $$slots.footer}
    <div class="card-footer">
      <slot name="footer" />
    </div>
  {/if}
</div>

<style>
  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
  }
  
  .card-header {
    padding: 20px 24px;
    border-bottom: 1px solid var(--border);
  }
  
  .card-title {
    font-size: 18px;
    font-weight: 700;
    color: var(--foreground);
    margin: 0;
  }
  
  .card-description {
    font-size: 14px;
    color: var(--muted);
    margin: 4px 0 0 0;
  }
  
  .card-content {
    padding: 24px;
  }
  
  .card-footer {
    padding: 16px 24px;
    border-top: 1px solid var(--border);
    background: var(--surface2);
  }
</style>
