import type { Trade, AdvancedAnalytics } from '$lib/types';

export function computeAdvancedAnalytics(trades: Trade[], initialBalance: number): AdvancedAnalytics {
  const closed = trades.filter(t => t.status === 'closed').sort(
    (a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime()
  );

  if (closed.length < 2) {
    return emptyAnalytics();
  }

  const pnls = closed.map(t => t.net_pnl);
  const wins = closed.filter(t => t.outcome === 'win');
  const losses = closed.filter(t => t.outcome === 'loss');

  // Win rate
  const win_rate = closed.length ? wins.length / closed.length : 0;

  // Avg win / avg loss
  const avg_win = wins.length ? wins.reduce((s, t) => s + t.net_pnl, 0) / wins.length : 0;
  const avg_loss = losses.length ? Math.abs(losses.reduce((s, t) => s + t.net_pnl, 0) / losses.length) : 0;

  // Profit factor
  const gross_wins = wins.reduce((s, t) => s + t.net_pnl, 0);
  const gross_losses = Math.abs(losses.reduce((s, t) => s + t.net_pnl, 0));
  const profit_factor = gross_losses > 0 ? gross_wins / gross_losses : gross_wins > 0 ? 999 : 0;

  // Expectancy
  const expectancy = (win_rate * avg_win) - ((1 - win_rate) * avg_loss);

  // Equity curve + drawdown
  let balance = initialBalance;
  let peak = initialBalance;
  let max_drawdown = 0;
  let max_drawdown_pct = 0;
  const equity_curve: { date: string; balance: number; drawdown: number }[] = [];

  for (const trade of closed) {
    balance += trade.net_pnl;
    if (balance > peak) peak = balance;
    const dd = peak - balance;
    const dd_pct = peak > 0 ? (dd / peak) * 100 : 0;
    if (dd > max_drawdown) max_drawdown = dd;
    if (dd_pct > max_drawdown_pct) max_drawdown_pct = dd_pct;
    equity_curve.push({ date: trade.entry_date, balance, drawdown: dd });
  }

  const net_profit = balance - initialBalance;
  const recovery_factor = max_drawdown > 0 ? net_profit / max_drawdown : net_profit > 0 ? 999 : 0;
  const calmar_ratio = max_drawdown_pct > 0 ? (net_profit / initialBalance * 100) / max_drawdown_pct : 0;

  // Returns as % of risk (use net_pnl directly, normalised)
  const mean_return = pnls.reduce((s, p) => s + p, 0) / pnls.length;
  const variance = pnls.reduce((s, p) => s + Math.pow(p - mean_return, 2), 0) / pnls.length;
  const std_dev = Math.sqrt(variance);
  const risk_free = 0.02 / 252;
  const sharpe_ratio = std_dev > 0 ? (mean_return - risk_free) / std_dev : 0;

  // Sortino
  const downside_returns = pnls.filter(p => p < 0);
  const downside_variance = downside_returns.length
    ? downside_returns.reduce((s, p) => s + Math.pow(p, 2), 0) / downside_returns.length
    : 0;
  const downside_dev = Math.sqrt(downside_variance);
  const sortino_ratio = downside_dev > 0 ? mean_return / downside_dev : mean_return > 0 ? 999 : 0;

  // Kelly
  const b = avg_loss > 0 ? avg_win / avg_loss : 0;
  const kelly_full = b > 0 ? (win_rate * b - (1 - win_rate)) / b : 0;
  const kelly_half = kelly_full / 2;
  const kelly_quarter = kelly_full / 4;

  // MAE / MFE estimates
  const mae_avg = closed.reduce((s, t) => {
    const mae = t.outcome === 'win' ? (t.actual_rr > 3 ? 0.2 : t.actual_rr > 2 ? 0.3 : 0.4) : 1.0;
    const risk = Math.abs(t.entry_price - t.stop_loss) * t.quantity * t.lot_size;
    return s + mae * risk;
  }, 0) / closed.length;

  const mfe_avg = closed.reduce((s, t) => {
    const mfe = t.outcome === 'win' ? Math.min(t.actual_rr * 0.5, 2.0) : 0.2;
    const reward = Math.abs(t.take_profit - t.entry_price) * t.quantity * t.lot_size;
    return s + mfe * reward;
  }, 0) / closed.length;

  // Monte Carlo (1000 sims for performance)
  const monte_carlo = runMonteCarlo(pnls, initialBalance, 1000);

  return {
    sharpe_ratio: round2(sharpe_ratio),
    sortino_ratio: round2(sortino_ratio),
    calmar_ratio: round2(calmar_ratio),
    max_drawdown: round2(max_drawdown),
    max_drawdown_pct: round2(max_drawdown_pct),
    recovery_factor: round2(recovery_factor),
    profit_factor: round2(profit_factor),
    expectancy: round2(expectancy),
    win_rate: round2(win_rate * 100),
    avg_win: round2(avg_win),
    avg_loss: round2(avg_loss),
    kelly_full: round2(kelly_full * 100),
    kelly_half: round2(kelly_half * 100),
    kelly_quarter: round2(kelly_quarter * 100),
    monte_carlo,
    mae_avg: round2(mae_avg),
    mfe_avg: round2(mfe_avg),
    equity_curve
  };
}

function runMonteCarlo(pnls: number[], initialBalance: number, simCount: number) {
  const results: number[] = [];
  let ruinCount = 0;
  let totalMaxDD = 0;

  for (let i = 0; i < simCount; i++) {
    let bal = initialBalance;
    let peak = initialBalance;
    let maxDD = 0;
    let ruined = false;

    for (let j = 0; j < 100; j++) {
      const pnl = pnls[Math.floor(Math.random() * pnls.length)];
      bal += pnl;
      if (bal > peak) peak = bal;
      const dd = (peak - bal) / peak;
      if (dd > maxDD) maxDD = dd;
      if (bal < initialBalance * 0.2) { ruined = true; break; }
    }

    results.push(bal);
    if (ruined) ruinCount++;
    totalMaxDD += maxDD;
  }

  results.sort((a, b) => a - b);
  const prob_profit = results.filter(r => r > initialBalance).length / simCount;

  return {
    median: round2(results[Math.floor(simCount * 0.5)]),
    best_case: round2(results[Math.floor(simCount * 0.95)]),
    worst_case: round2(results[Math.floor(simCount * 0.05)]),
    prob_profit: round2(prob_profit * 100),
    prob_ruin: round2((ruinCount / simCount) * 100),
    avg_drawdown: round2((totalMaxDD / simCount) * 100),
    max_drawdown_sim: round2(Math.max(...results.map((_, i) => i)) * 0.01)
  };
}

function round2(n: number) { return Math.round(n * 100) / 100; }

function emptyAnalytics(): AdvancedAnalytics {
  return {
    sharpe_ratio: 0, sortino_ratio: 0, calmar_ratio: 0,
    max_drawdown: 0, max_drawdown_pct: 0, recovery_factor: 0,
    profit_factor: 0, expectancy: 0, win_rate: 0,
    avg_win: 0, avg_loss: 0, kelly_full: 0, kelly_half: 0, kelly_quarter: 0,
    monte_carlo: { median: 0, best_case: 0, worst_case: 0, prob_profit: 0, prob_ruin: 0, avg_drawdown: 0, max_drawdown_sim: 0 },
    mae_avg: 0, mfe_avg: 0, equity_curve: []
  };
}
