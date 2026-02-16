import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import type { Account } from '$lib/types';

export const selectedAccountId = writable<string>('');
export const accounts = writable<Account[]>([]);

// Theme store with localStorage persistence
function createThemeStore() {
  const defaultTheme = browser
    ? (localStorage.getItem('theme') as 'light' | 'dark' || 'light')
    : 'light';

  const { subscribe, set } = writable<'light' | 'dark'>(defaultTheme);

  return {
    subscribe,
    set: (value: 'light' | 'dark') => {
      if (browser) {
        localStorage.setItem('theme', value);
        if (value === 'dark') {
          document.body.classList.add('dark');
        } else {
          document.body.classList.remove('dark');
        }
      }
      set(value);
    },
    toggle: () => {
      if (browser) {
        const current = localStorage.getItem('theme') as 'light' | 'dark' || 'light';
        const newTheme = current === 'light' ? 'dark' : 'light';
        localStorage.setItem('theme', newTheme);
        if (newTheme === 'dark') {
          document.body.classList.add('dark');
        } else {
          document.body.classList.remove('dark');
        }
        set(newTheme);
      }
    },
    init: () => {
      if (browser) {
        const theme = localStorage.getItem('theme') as 'light' | 'dark' || 'light';
        if (theme === 'dark') {
          document.body.classList.add('dark');
        } else {
          document.body.classList.remove('dark');
        }
        set(theme);
      }
    }
  };
}

export const theme = createThemeStore();
