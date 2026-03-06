import type { Trade, Instrument } from '$lib/types';

export function calculatePnL(trade: Partial<Trade>, instrument: Instrument): { grossPnl: number; netPnl: number } {
  if (!trade.exit_price || !trade.entry_price) return { grossPnl: 0, netPnl: 0 };

  const priceDiff = trade.type === 'long'
    ? trade.exit_price - trade.entry_price
    : trade.entry_price - trade.exit_price;

  const grossPnl = priceDiff * (trade.quantity ?? 1) * (trade.lot_size ?? 1) * instrument.pip_value;
  const netPnl = grossPnl - (trade.fees ?? 0) - (trade.commissions ?? 0) - (trade.slippage ?? 0);

  return { grossPnl: Math.round(grossPnl * 100) / 100, netPnl: Math.round(netPnl * 100) / 100 };
}

export function calculateRR(trade: Partial<Trade>, instrument: Instrument): { expectedRR: number; actualRR: number } {
  if (!trade.entry_price || !trade.stop_loss || !trade.take_profit) return { expectedRR: 0, actualRR: 0 };

  const risk = Math.abs(trade.entry_price - trade.stop_loss) * (trade.quantity ?? 1) * (trade.lot_size ?? 1) * instrument.pip_value;
  const reward = Math.abs(trade.take_profit - trade.entry_price) * (trade.quantity ?? 1) * (trade.lot_size ?? 1) * instrument.pip_value;

  const expectedRR = risk > 0 ? Math.round((reward / risk) * 100) / 100 : 0;

  let actualRR = 0;
  if (trade.net_pnl !== undefined && risk > 0) {
    actualRR = Math.round((trade.net_pnl / risk) * 100) / 100;
  }

  return { expectedRR, actualRR };
}

export function determineOutcome(netPnl: number, status: string): 'win' | 'loss' | 'breakeven' | 'pending' {
  if (status !== 'closed') return 'pending';
  if (netPnl > 5) return 'win';
  if (netPnl < -5) return 'loss';
  return 'breakeven';
}

export function calcWinRate(trades: Trade[]): number {
  const closed = trades.filter(t => t.status === 'closed');
  if (!closed.length) return 0;
  const wins = closed.filter(t => t.outcome === 'win').length;
  return Math.round((wins / closed.length) * 1000) / 10;
}

export function calcProfitFactor(trades: Trade[]): number {
  const closed = trades.filter(t => t.status === 'closed');
  const grossWins = closed.filter(t => t.net_pnl > 0).reduce((s, t) => s + t.net_pnl, 0);
  const grossLosses = Math.abs(closed.filter(t => t.net_pnl < 0).reduce((s, t) => s + t.net_pnl, 0));
  return grossLosses > 0 ? Math.round((grossWins / grossLosses) * 100) / 100 : grossWins > 0 ? 999 : 0;
}

export function calcExpectancy(trades: Trade[]): number {
  const closed = trades.filter(t => t.status === 'closed');
  if (!closed.length) return 0;
  const wins = closed.filter(t => t.outcome === 'win');
  const losses = closed.filter(t => t.outcome === 'loss');
  const winRate = wins.length / closed.length;
  const lossRate = losses.length / closed.length;
  const avgWin = wins.length ? wins.reduce((s, t) => s + t.net_pnl, 0) / wins.length : 0;
  const avgLoss = losses.length ? Math.abs(losses.reduce((s, t) => s + t.net_pnl, 0) / losses.length) : 0;
  return Math.round(((winRate * avgWin) - (lossRate * avgLoss)) * 100) / 100;
}
