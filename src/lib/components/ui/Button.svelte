<!-- src/lib/components/ui/Button.svelte -->
<script lang="ts">
  import { cn } from '$lib/utils';
  
  export let variant: 'default' | 'primary' | 'secondary' | 'ghost' | 'danger' = 'default';
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let disabled = false;
  export let type: 'button' | 'submit' | 'reset' = 'button';
  
  const baseStyles = 'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50';
  
  const variants = {
    default: 'bg-surface2 text-foreground hover:bg-surface3 border border-border',
    primary: 'bg-accent text-white hover:bg-accent/90 shadow-sm',
    secondary: 'bg-accent2 text-white hover:bg-accent2/90',
    ghost: 'hover:bg-surface2 text-foreground',
    danger: 'bg-red text-white hover:bg-red/90'
  };
  
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  };
</script>

<button
  {type}
  {disabled}
  class={cn(baseStyles, variants[variant], sizes[size], $$props.class)}
  on:click
>
  <slot />
</button>
