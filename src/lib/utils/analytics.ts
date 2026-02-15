import type { Trade, AnalyticsData } from '$lib/types';

export function calculateAnalytics(trades: Trade[]): AnalyticsData {
  if (trades.length === 0) {
    return {
      totalTrades: 0,
      winRate: 0,
      totalPnl: 0,
      averageWin: 0,
      averageLoss: 0,
      profitFactor: 0,
      expectancy: 0,
      bestTrade: null,
      worstTrade: null,
      tradesBySymbol: {},
      tradesByStrategy: {},
      winRateByStrategy: {},
      pnlByDay: [],
      pnlByWeek: [],
      pnlByMonth: [],
      consecutiveWins: 0,
      consecutiveLosses: 0,
      avgHoldTime: 0,
      winLossRatio: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      recoveryFactor: 0,
      tradesByTimeOfDay: {},
      tradesByMarketCondition: {},
      avgRR: 0
    };
  }

  const closedTrades = trades.filter(t => t.status === 'closed');
  const winningTrades = closedTrades.filter(t => t.outcome === 'win');
  const losingTrades = closedTrades.filter(t => t.outcome === 'loss');

  const totalWins = winningTrades.reduce((sum, t) => sum + t.netPnl, 0);
  const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + t.netPnl, 0));

  const averageWin = winningTrades.length > 0 ? totalWins / winningTrades.length : 0;
  const averageLoss = losingTrades.length > 0 ? totalLosses / losingTrades.length : 0;

  const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;

  const totalPnl = closedTrades.reduce((sum, t) => sum + t.netPnl, 0);
  const expectancy = closedTrades.length > 0 ? totalPnl / closedTrades.length : 0;

  // Win/Loss Ratio
  const winLossRatio = averageLoss > 0 ? averageWin / averageLoss : 0;

  // Average RR
  const avgRR = closedTrades.length > 0
    ? closedTrades.reduce((sum, t) => sum + t.actualRR, 0) / closedTrades.length
    : 0;

  // Trades by symbol
  const tradesBySymbol: { [key: string]: number } = {};
  closedTrades.forEach(trade => {
    tradesBySymbol[trade.symbol] = (tradesBySymbol[trade.symbol] || 0) + 1;
  });

  // Trades by strategy
  const tradesByStrategy: { [key: string]: number } = {};
  const winsByStrategy: { [key: string]: number } = {};
  closedTrades.forEach(trade => {
    const strategy = trade.strategyId || 'No Strategy';
    tradesByStrategy[strategy] = (tradesByStrategy[strategy] || 0) + 1;
    if (trade.outcome === 'win') {
      winsByStrategy[strategy] = (winsByStrategy[strategy] || 0) + 1;
    }
  });

  // Win rate by strategy
  const winRateByStrategy: { [key: string]: number } = {};
  Object.keys(tradesByStrategy).forEach(strategy => {
    winRateByStrategy[strategy] = ((winsByStrategy[strategy] || 0) / tradesByStrategy[strategy]) * 100;
  });

  // Trades by time of day
  const tradesByTimeOfDay: { [key: string]: number } = {};
  closedTrades.forEach(trade => {
    tradesByTimeOfDay[trade.timeOfDay] = (tradesByTimeOfDay[trade.timeOfDay] || 0) + 1;
  });

  // Trades by market condition
  const tradesByMarketCondition: { [key: string]: number } = {};
  closedTrades.forEach(trade => {
    tradesByMarketCondition[trade.marketCondition] = (tradesByMarketCondition[trade.marketCondition] || 0) + 1;
  });

  // PnL by day
  const pnlByDayMap: { [date: string]: number } = {};
  closedTrades.forEach(trade => {
    if (trade.exitDate) {
      const date = trade.exitDate.split('T')[0];
      pnlByDayMap[date] = (pnlByDayMap[date] || 0) + trade.netPnl;
    }
  });

  const pnlByDay = Object.entries(pnlByDayMap)
    .map(([date, pnl]) => ({ date, pnl }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // PnL by week
  const pnlByWeekMap: { [week: string]: number } = {};
  closedTrades.forEach(trade => {
    if (trade.exitDate) {
      const date = new Date(trade.exitDate);
      const week = `${date.getFullYear()}-W${String(getWeekNumber(date)).padStart(2, '0')}`;
      pnlByWeekMap[week] = (pnlByWeekMap[week] || 0) + trade.netPnl;
    }
  });

  const pnlByWeek = Object.entries(pnlByWeekMap)
    .map(([week, pnl]) => ({ week, pnl }))
    .sort((a, b) => a.week.localeCompare(b.week));

  // PnL by month
  const pnlByMonthMap: { [month: string]: number } = {};
  closedTrades.forEach(trade => {
    if (trade.exitDate) {
      const date = new Date(trade.exitDate);
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      pnlByMonthMap[month] = (pnlByMonthMap[month] || 0) + trade.netPnl;
    }
  });

  const pnlByMonth = Object.entries(pnlByMonthMap)
    .map(([month, pnl]) => ({ month, pnl }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // Best and worst trades
  const bestTrade = closedTrades.reduce((best, trade) =>
    !best || trade.netPnl > best.netPnl ? trade : best
    , null as Trade | null);

  const worstTrade = closedTrades.reduce((worst, trade) =>
    !worst || trade.netPnl < worst.netPnl ? trade : worst
    , null as Trade | null);

  // Consecutive wins/losses
  let currentStreak = 0;
  let maxWinStreak = 0;
  let maxLossStreak = 0;

  closedTrades.forEach(trade => {
    if (trade.outcome === 'win') {
      currentStreak = currentStreak > 0 ? currentStreak + 1 : 1;
      maxWinStreak = Math.max(maxWinStreak, currentStreak);
    } else if (trade.outcome === 'loss') {
      currentStreak = currentStreak < 0 ? currentStreak - 1 : -1;
      maxLossStreak = Math.max(maxLossStreak, Math.abs(currentStreak));
    }
  });

  // Average hold time (in hours)
  const avgHoldTime = closedTrades.length > 0
    ? closedTrades.reduce((sum, trade) => {
      if (trade.exitDate) {
        const entry = new Date(trade.entryDate).getTime();
        const exit = new Date(trade.exitDate).getTime();
        return sum + (exit - entry) / (1000 * 60 * 60);
      }
      return sum;
    }, 0) / closedTrades.length
    : 0;

  // Max Drawdown
  let peak = 0;
  let maxDrawdown = 0;
  let runningPnl = 0;

  pnlByDay.forEach(day => {
    runningPnl += day.pnl;
    if (runningPnl > peak) {
      peak = runningPnl;
    }
    const drawdown = peak - runningPnl;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  });

  // Sharpe Ratio (simplified - using daily returns)
  const dailyReturns = pnlByDay.map(d => d.pnl);
  const avgReturn = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;
  const stdDev = Math.sqrt(
    dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / dailyReturns.length
  );
  const sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;

  // Recovery Factor
  const recoveryFactor = maxDrawdown > 0 ? totalPnl / maxDrawdown : 0;

  return {
    totalTrades: closedTrades.length,
    winRate: closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0,
    totalPnl,
    averageWin,
    averageLoss,
    profitFactor,
    expectancy,
    bestTrade,
    worstTrade,
    tradesBySymbol,
    tradesByStrategy,
    winRateByStrategy,
    pnlByDay,
    pnlByWeek,
    pnlByMonth,
    consecutiveWins: maxWinStreak,
    consecutiveLosses: maxLossStreak,
    avgHoldTime,
    winLossRatio,
    sharpeRatio,
    maxDrawdown,
    recoveryFactor,
    tradesByTimeOfDay,
    tradesByMarketCondition,
    avgRR
  };
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(amount);
}

export function formatPercentage(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export function formatTime(hours: number): string {
  if (hours < 1) {
    return `${Math.round(hours * 60)}m`;
  } else if (hours < 24) {
    return `${hours.toFixed(1)}h`;
  } else {
    return `${(hours / 24).toFixed(1)}d`;
  }
}
