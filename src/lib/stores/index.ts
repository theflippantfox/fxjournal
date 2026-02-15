import { writable } from 'svelte/store';
import type { Account } from '$lib/types';

export const selectedAccountId = writable<string>('');
export const accounts = writable<Account[]>([]);
