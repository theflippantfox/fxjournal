export async function getTradingViewThumbnail(url: string): Promise<string> {
  try {
    // Extract chart ID from TradingView URL
    const chartIdMatch = url.match(/chart\/([^\/]+)/);
    if (!chartIdMatch) return url;

    const chartId = chartIdMatch[1];
    // TradingView snapshot URL pattern
    return `https://s3.tradingview.com/snapshots/${chartId}.png`;
  } catch (error) {
    console.error('Error extracting TradingView thumbnail:', error);
    return url;
  }
}

export function calculatePnL(
  type: 'long' | 'short',
  entryPrice: number,
  exitPrice: number,
  lotSize: number,
  quantity: number,
  fees: number = 0,
  commissions: number = 0,
  slippage: number = 0
): { pnl: number; pnlPercentage: number; netPnl: number } {
  const priceDiff = type === 'long'
    ? exitPrice - entryPrice
    : entryPrice - exitPrice;

  const grossPnl = priceDiff * quantity * lotSize;
  const totalCosts = fees + commissions + (slippage * quantity * lotSize);
  const netPnl = grossPnl - totalCosts;
  const pnlPercentage = (priceDiff / entryPrice) * 100;

  return {
    pnl: grossPnl,
    pnlPercentage,
    netPnl
  };
}

export function calculateRiskReward(
  entryPrice: number,
  stopLoss: number,
  takeProfit: number,
  type: 'long' | 'short'
): number {
  if (type === 'long') {
    const risk = entryPrice - stopLoss;
    const reward = takeProfit - entryPrice;
    return reward / risk;
  } else {
    const risk = stopLoss - entryPrice;
    const reward = entryPrice - takeProfit;
    return reward / risk;
  }
}

export function determineOutcome(
  pnl: number,
  threshold: number = 0
): 'win' | 'loss' | 'breakeven' {
  if (Math.abs(pnl) <= threshold) return 'breakeven';
  return pnl > 0 ? 'win' : 'loss';
}

export function calculateActualRR(
  entryPrice: number,
  exitPrice: number,
  stopLoss: number,
  type: 'long' | 'short'
): number {
  if (type === 'long') {
    const risk = entryPrice - stopLoss;
    const actualReward = exitPrice - entryPrice;
    return risk !== 0 ? actualReward / risk : 0;
  } else {
    const risk = stopLoss - entryPrice;
    const actualReward = entryPrice - exitPrice;
    return risk !== 0 ? actualReward / risk : 0;
  }
}
