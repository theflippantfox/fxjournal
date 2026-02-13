// src/lib/stores/api.ts
import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';

// ─── API Helper Functions ──────────────────────────────────────────────────
async function apiRequest(endpoint: string, options: RequestInit = {}) {
  try {
    const response = await fetch(endpoint, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`API request failed for ${endpoint}:`, error);
    throw error;
  }
}

// ─── Loading State ─────────────────────────────────────────────────────────
export const isLoading = writable(true);

// ─── Accounts ──────────────────────────────────────────────────────────────
export const accounts = writable<any[]>([]);

export async function loadAccounts() {
  if (!browser) return;
  try {
    const data = await apiRequest('/api/accounts');
    accounts.set(data);
  } catch (error) {
    console.error('Failed to load accounts:', error);
  }
}

export async function saveAccount(account: any) {
  if (!browser) return;
  try {
    await apiRequest('/api/accounts', {
      method: 'POST',
      body: JSON.stringify(account),
    });
    await loadAccounts();
  } catch (error) {
    console.error('Failed to save account:', error);
    throw error;
  }
}

export async function deleteAccount(id: string) {
  if (!browser) return;
  try {
    await apiRequest(`/api/accounts?id=${id}`, { method: 'DELETE' });
    await loadAccounts();
  } catch (error) {
    console.error('Failed to delete account:', error);
    throw error;
  }
}

// ─── Active Account ────────────────────────────────────────────────────────
export const activeAccountId = writable<string>('default');

export async function loadActiveAccountId() {
  if (!browser) return;
  try {
    const data = await apiRequest('/api/active-account');
    activeAccountId.set(data.id);
  } catch (error) {
    console.error('Failed to load active account:', error);
  }
}

export async function setActiveAccountId(id: string) {
  if (!browser) return;
  try {
    await apiRequest('/api/active-account', {
      method: 'POST',
      body: JSON.stringify({ id }),
    });
    activeAccountId.set(id);
  } catch (error) {
    console.error('Failed to set active account:', error);
    throw error;
  }
}

export const activeAccount = derived(
  [accounts, activeAccountId],
  ([$accounts, $id]) => $accounts.find(a => a.id === $id) || $accounts[0]
);

// ─── Instruments ───────────────────────────────────────────────────────────
export const instruments = writable<string[]>([]);

export async function loadInstruments() {
  if (!browser) return;
  try {
    const data = await apiRequest('/api/instruments');
    instruments.set(data);
  } catch (error) {
    console.error('Failed to load instruments:', error);
  }
}

export async function saveInstruments(instrumentList: string[]) {
  if (!browser) return;
  try {
    await apiRequest('/api/instruments', {
      method: 'POST',
      body: JSON.stringify(instrumentList),
    });
    instruments.set(instrumentList);
  } catch (error) {
    console.error('Failed to save instruments:', error);
    throw error;
  }
}

export async function addInstrument(sym: string) {
  const current = get(instruments);
  const clean = sym.trim().toUpperCase();
  if (!clean || current.includes(clean)) return;
  const updated = [...current, clean].sort();
  await saveInstruments(updated);
}

export async function removeInstrument(sym: string) {
  const current = get(instruments);
  const updated = current.filter(s => s !== sym);
  await saveInstruments(updated);
}

// ─── Trades ────────────────────────────────────────────────────────────────
export const trades = writable<any[]>([]);

export async function loadTrades() {
  if (!browser) return;
  try {
    const data = await apiRequest('/api/trades');
    trades.set(data);
  } catch (error) {
    console.error('Failed to load trades:', error);
  }
}

export async function saveTrade(trade: any) {
  if (!browser) return;
  try {
    await apiRequest('/api/trades', {
      method: 'POST',
      body: JSON.stringify(trade),
    });
    await loadTrades();
  } catch (error) {
    console.error('Failed to save trade:', error);
    throw error;
  }
}

export async function deleteTrade(id: string) {
  if (!browser) return;
  try {
    await apiRequest(`/api/trades?id=${id}`, { method: 'DELETE' });
    await loadTrades();
  } catch (error) {
    console.error('Failed to delete trade:', error);
    throw error;
  }
}

export const tradesByAccount = derived(
  [trades, activeAccountId],
  ([$trades, $id]) => $trades.filter(t => t.accountId === $id)
);

// ─── Initialize All Data ───────────────────────────────────────────────────
export async function initializeData() {
  if (!browser) return;
  isLoading.set(true);
  try {
    await Promise.all([
      loadAccounts(),
      loadActiveAccountId(),
      loadInstruments(),
      loadTrades(),
    ]);
  } catch (error) {
    console.error('Failed to initialize data:', error);
  } finally {
    isLoading.set(false);
  }
}

// ─── UI State ──────────────────────────────────────────────────────────────
export const toast = writable<{ msg: string; type: string; id: number } | null>(null);

export function showToast(msg: string, type = 'success') {
  toast.set({ msg, type, id: Date.now() });
  setTimeout(() => toast.set(null), 3000);
}

// ─── Helper Functions ──────────────────────────────────────────────────────
export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function getOutcome(pnl: number, override?: string) {
  if (override && override !== '') return override;
  if (pnl > 0.5) return 'WIN';
  if (pnl < -0.5) return 'LOSS';
  return 'BE';
}

export function fmt(n: number, dec = 2) {
  if (n == null || isNaN(n)) return '—';
  const s = n < 0 ? '-' : '';
  return `${s}$${Math.abs(n).toFixed(dec)}`;
}

export function fmtPct(n: number) {
  return n == null || isNaN(n) ? '—' : `${n.toFixed(1)}%`;
}

export function calcStats(tradeList: any[]) {
  if (!tradeList.length) return null;
  
  const wins = tradeList.filter(t => t.outcome === 'WIN');
  const losses = tradeList.filter(t => t.outcome === 'LOSS');
  const bes = tradeList.filter(t => t.outcome === 'BE');
  const nonBe = tradeList.filter(t => t.outcome !== 'BE');
  
  const totalPnl = tradeList.reduce((s, t) => s + t.pnl, 0);
  const avgWin = wins.length ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
  const avgLoss = losses.length ? Math.abs(losses.reduce((s, t) => s + t.pnl, 0) / losses.length) : 0;
  const winRate = nonBe.length ? (wins.length / nonBe.length) * 100 : 0;
  
  const grossWin = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? 999 : 0;
  
  const avgRR = tradeList.filter(t => t.rr).length
    ? tradeList.filter(t => t.rr).reduce((s, t) => s + t.rr, 0) / tradeList.filter(t => t.rr).length
    : 0;
    
  const maxWin = Math.max(...tradeList.map(t => t.pnl), 0);
  const maxLoss = Math.min(...tradeList.map(t => t.pnl), 0);
  const expectancy = (winRate / 100) * avgWin - (1 - winRate / 100) * avgLoss;
  const partialCount = tradeList.filter(t => t.isPartial).length;

  let maxCW = 0, maxCL = 0, cw = 0, cl = 0;
  [...tradeList].reverse().forEach(t => {
    if (t.outcome === 'WIN') {
      cw++;
      cl = 0;
      maxCW = Math.max(maxCW, cw);
    } else if (t.outcome === 'LOSS') {
      cl++;
      cw = 0;
      maxCL = Math.max(maxCL, cl);
    } else {
      cw = 0;
      cl = 0;
    }
  });

  let peak = 0, dd = 0, maxDD = 0, eq = 0;
  [...tradeList].reverse().forEach(t => {
    eq += t.pnl;
    if (eq > peak) peak = eq;
    dd = peak - eq;
    if (dd > maxDD) maxDD = dd;
  });

  return {
    wins: wins.length,
    losses: losses.length,
    bes: bes.length,
    total: tradeList.length,
    totalPnl,
    avgWin,
    avgLoss,
    winRate,
    profitFactor,
    avgRR,
    maxWin,
    maxLoss,
    expectancy,
    maxConsecWin: maxCW,
    maxConsecLoss: maxCL,
    maxDrawdown: maxDD,
    partialCount
  };
}
