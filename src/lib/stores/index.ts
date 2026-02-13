// src/lib/stores/index.js
import { writable, derived, get } from 'svelte/store';

// ─── Persistence helpers ───────────────────────────────────────────────────
function persist(key, initial) {
  let stored = initial;
  if (typeof window !== 'undefined') {
    try {
      stored = JSON.parse(localStorage.getItem(key)) ?? initial;
    } catch { }
  }
  const store = writable(stored);
  store.subscribe(val => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(val));
    }
  });
  return store;
}

// ─── Accounts ─────────────────────────────────────────────────────────────
export const accounts = persist('fx_accounts_v1', [
  { id: 'default', name: 'Main Account', broker: '', currency: 'USD', balance: 10000, color: '#00d4ff', createdAt: new Date().toISOString() }
]);

export const activeAccountId = persist('fx_active_account_v1', 'default');

export const activeAccount = derived([accounts, activeAccountId], ([$accounts, $id]) =>
  $accounts.find(a => a.id === $id) ?? $accounts[0]
);

// ─── Instruments ──────────────────────────────────────────────────────────
const DEFAULT_INSTRUMENTS = [
  // Forex majors
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD',
  // Forex minors
  'EUR/GBP', 'EUR/JPY', 'GBP/JPY', 'EUR/CHF', 'AUD/JPY', 'EUR/AUD', 'GBP/CAD',
  'GBP/AUD', 'AUD/NZD', 'EUR/CAD', 'EUR/NZD', 'GBP/NZD', 'CAD/JPY', 'CHF/JPY',
  // Metals
  'XAU/USD', 'XAG/USD',
  // Indices
  'US30', 'US500', 'NAS100', 'GER40', 'UK100', 'JPN225',
  // Crypto
  'BTC/USD', 'ETH/USD', 'SOL/USD',
  // Energy
  'USOIL', 'UKOIL'
];

export const instruments = persist('fx_instruments_v1', DEFAULT_INSTRUMENTS);

export function addInstrument(sym) {
  instruments.update(list => {
    const clean = sym.trim().toUpperCase();
    if (!clean || list.includes(clean)) return list;
    return [...list, clean].sort();
  });
}

export function removeInstrument(sym) {
  instruments.update(list => list.filter(s => s !== sym));
}

// ─── Trades ───────────────────────────────────────────────────────────────
export const trades = persist('fx_trades_v4', []);

export const tradesByAccount = derived([trades, activeAccountId], ([$trades, $id]) =>
  $trades.filter(t => t.accountId === $id)
);

export function saveTrade(trade) {
  trades.update(list => {
    const idx = list.findIndex(t => t.id === trade.id);
    if (idx !== -1) {
      list[idx] = trade;
      return [...list];
    }
    return [...list, trade];
  });
}

export function deleteTrade(id) {
  trades.update(list => list.filter(t => t.id !== id));
}

// ─── UI state ─────────────────────────────────────────────────────────────
export const toast = writable(null);

export function showToast(msg, type = 'success') {
  toast.set({ msg, type, id: Date.now() });
  setTimeout(() => toast.set(null), 3000);
}

// ─── Helpers ──────────────────────────────────────────────────────────────
export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function getOutcome(pnl, override) {
  if (override && override !== '') return override;
  if (pnl > 0.5) return 'WIN';
  if (pnl < -0.5) return 'LOSS';
  return 'BE';
}

export function fmt(n, dec = 2) {
  if (n == null || isNaN(n)) return '—';
  const s = n < 0 ? '-' : '';
  return `${s}$${Math.abs(n).toFixed(dec)}`;
}

export function fmtPct(n) {
  return n == null || isNaN(n) ? '—' : `${n.toFixed(1)}%`;
}

export function calcStats(tradeList) {
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
    ? tradeList.filter(t => t.rr).reduce((s, t) => s + t.rr, 0) / tradeList.filter(t => t.rr).length : 0;
  const maxWin = Math.max(...tradeList.map(t => t.pnl), 0);
  const maxLoss = Math.min(...tradeList.map(t => t.pnl), 0);
  const expectancy = (winRate / 100) * avgWin - (1 - winRate / 100) * avgLoss;
  const partialCount = tradeList.filter(t => t.isPartial).length;

  let maxCW = 0, maxCL = 0, cw = 0, cl = 0;
  [...tradeList].reverse().forEach(t => {
    if (t.outcome === 'WIN') { cw++; cl = 0; maxCW = Math.max(maxCW, cw); }
    else if (t.outcome === 'LOSS') { cl++; cw = 0; maxCL = Math.max(maxCL, cl); }
    else { cw = 0; cl = 0; }
  });

  let peak = 0, dd = 0, maxDD = 0, eq = 0;
  [...tradeList].reverse().forEach(t => {
    eq += t.pnl; if (eq > peak) peak = eq;
    dd = peak - eq; if (dd > maxDD) maxDD = dd;
  });

  return {
    wins: wins.length, losses: losses.length, bes: bes.length, total: tradeList.length,
    totalPnl, avgWin, avgLoss, winRate, profitFactor, avgRR, maxWin, maxLoss,
    expectancy, maxConsecWin: maxCW, maxConsecLoss: maxCL, maxDrawdown: maxDD, partialCount
  };
}

export function seedSampleData(accountId) {
  const pairs = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'GBP/JPY', 'XAU/USD'];
  const strats = ['Price Action', 'Trend Following', 'Breakout', 'Reversal', 'ICT / SMC'];
  const sessions = ['London', 'New York', 'Asian', 'London/NY Overlap'];
  const emotions = ['Calm & Focused', 'Confident', 'Anxious', 'Neutral'];
  const rnd = (a, b) => Math.random() * (b - a) + a;
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  const list = [];
  let d = new Date('2024-10-01');

  for (let i = 0; i < 60; i++) {
    d.setDate(d.getDate() + Math.floor(rnd(0.5, 2)));
    const isPartial = Math.random() > 0.6;
    const e1 = parseFloat(rnd(1.05, 1.12).toFixed(5));
    const dir = Math.random() > 0.5 ? 'BUY' : 'SELL';
    const lots1 = parseFloat(rnd(0.05, 0.5).toFixed(2));
    const isWin = Math.random() > 0.38;

    let entries, exits, totalPnl;
    if (isPartial) {
      const lots2 = parseFloat(rnd(0.05, 0.3).toFixed(2));
      const e2 = parseFloat((e1 + (dir === 'BUY' ? -1 : 1) * rnd(0.0002, 0.001)).toFixed(5));
      entries = [
        { time: `${String(Math.floor(rnd(7, 12))).padStart(2, '0')}:${String(Math.floor(rnd(0, 59))).padStart(2, '0')}`, price: e1, lots: lots1, note: 'Initial entry' },
        { time: `${String(Math.floor(rnd(12, 16))).padStart(2, '0')}:${String(Math.floor(rnd(0, 59))).padStart(2, '0')}`, price: e2, lots: lots2, note: 'Scale-in' }
      ];
      const p1 = parseFloat((rnd(30, 200) * (isWin ? 1 : -0.6)).toFixed(2));
      const p2 = parseFloat((rnd(20, 150) * (isWin ? 1 : -0.4)).toFixed(2));
      exits = [
        { time: `${String(Math.floor(rnd(13, 17))).padStart(2, '0')}:00`, price: parseFloat((e1 + (dir === 'BUY' ? 1 : -1) * rnd(0.001, 0.006)).toFixed(5)), lots: lots1, pnl: p1, note: 'TP1' },
        { time: `${String(Math.floor(rnd(17, 20))).padStart(2, '0')}:00`, price: parseFloat((e1 + (dir === 'BUY' ? 1 : -1) * rnd(0.004, 0.012)).toFixed(5)), lots: lots2, pnl: p2, note: 'TP2' }
      ];
      totalPnl = parseFloat((p1 + p2).toFixed(2));
    } else {
      entries = [{ time: `${String(Math.floor(rnd(7, 18))).padStart(2, '0')}:00`, price: e1, lots: lots1, note: '' }];
      const pnl = parseFloat((rnd(50, 300) * (isWin ? 1 : -1)).toFixed(2));
      exits = [{ time: '', price: parseFloat((e1 + (dir === 'BUY' ? 1 : -1) * rnd(0.002, 0.01)).toFixed(5)), lots: lots1, pnl, note: '' }];
      totalPnl = pnl;
    }

    let wS = 0, lS = 0;
    entries.forEach(e => { wS += e.price * e.lots; lS += e.lots; });
    const avgEntry = lS > 0 ? wS / lS : e1;
    let wxS = 0, xlS = 0;
    exits.forEach(x => { wxS += x.price * x.lots; xlS += x.lots; });
    const avgExit = xlS > 0 ? wxS / xlS : null;

    list.push({
      id: newId() + '_' + i, accountId,
      date: d.toISOString().split('T')[0],
      pair: pick(pairs), dir,
      lots: parseFloat(entries.reduce((s, e) => s + e.lots, 0).toFixed(2)),
      entry: parseFloat(avgEntry.toFixed(5)),
      exit: avgExit ? parseFloat(avgExit.toFixed(5)) : null,
      sl: parseFloat((e1 - (dir === 'BUY' ? 1 : -1) * rnd(0.001, 0.005)).toFixed(5)),
      pnl: totalPnl,
      rr: parseFloat(rnd(0.5, 3.5).toFixed(1)),
      strategy: pick(strats), session: pick(sessions), emotion: pick(emotions),
      outcome: getOutcome(totalPnl, ''),
      tags: [pick(['confluence', 'fib', 'trend', 'breakout', 'news']), pick(['H4', 'D1', 'M15'])],
      notes: '', entries, exits,
      isPartial, chartImages: []
    });
  }

  list.sort((a, b) => new Date(b.date) - new Date(a.date));
  trades.update(existing => {
    const without = existing.filter(t => t.accountId !== accountId);
    return [...without, ...list];
  });
}
