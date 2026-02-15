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
			tradesBySetup: {},
			winRateBySetup: {},
			pnlByDay: [],
			consecutiveWins: 0,
			consecutiveLosses: 0
		};
	}

	const winningTrades = trades.filter(t => t.pnl > 0);
	const losingTrades = trades.filter(t => t.pnl < 0);
	
	const totalWins = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
	const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
	
	const averageWin = winningTrades.length > 0 ? totalWins / winningTrades.length : 0;
	const averageLoss = losingTrades.length > 0 ? totalLosses / losingTrades.length : 0;
	
	const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;
	
	const totalPnl = trades.reduce((sum, t) => sum + t.pnl - t.fees, 0);
	const expectancy = trades.length > 0 ? totalPnl / trades.length : 0;
	
	// Trades by symbol
	const tradesBySymbol: { [key: string]: number } = {};
	trades.forEach(trade => {
		tradesBySymbol[trade.symbol] = (tradesBySymbol[trade.symbol] || 0) + 1;
	});
	
	// Trades by setup
	const tradesBySetup: { [key: string]: number } = {};
	const winsBySetup: { [key: string]: number } = {};
	trades.forEach(trade => {
		tradesBySetup[trade.setup] = (tradesBySetup[trade.setup] || 0) + 1;
		if (trade.pnl > 0) {
			winsBySetup[trade.setup] = (winsBySetup[trade.setup] || 0) + 1;
		}
	});
	
	// Win rate by setup
	const winRateBySetup: { [key: string]: number } = {};
	Object.keys(tradesBySetup).forEach(setup => {
		winRateBySetup[setup] = ((winsBySetup[setup] || 0) / tradesBySetup[setup]) * 100;
	});
	
	// PnL by day
	const pnlByDayMap: { [date: string]: number } = {};
	trades.forEach(trade => {
		const date = trade.exitDate.split('T')[0];
		pnlByDayMap[date] = (pnlByDayMap[date] || 0) + trade.pnl - trade.fees;
	});
	
	const pnlByDay = Object.entries(pnlByDayMap)
		.map(([date, pnl]) => ({ date, pnl }))
		.sort((a, b) => a.date.localeCompare(b.date));
	
	// Best and worst trades
	const bestTrade = trades.reduce((best, trade) => 
		!best || trade.pnl > best.pnl ? trade : best
	, null as Trade | null);
	
	const worstTrade = trades.reduce((worst, trade) => 
		!worst || trade.pnl < worst.pnl ? trade : worst
	, null as Trade | null);
	
	// Consecutive wins/losses
	let currentStreak = 0;
	let maxWinStreak = 0;
	let maxLossStreak = 0;
	
	trades.forEach(trade => {
		if (trade.pnl > 0) {
			currentStreak = currentStreak > 0 ? currentStreak + 1 : 1;
			maxWinStreak = Math.max(maxWinStreak, currentStreak);
		} else if (trade.pnl < 0) {
			currentStreak = currentStreak < 0 ? currentStreak - 1 : -1;
			maxLossStreak = Math.max(maxLossStreak, Math.abs(currentStreak));
		}
	});
	
	return {
		totalTrades: trades.length,
		winRate: trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0,
		totalPnl,
		averageWin,
		averageLoss,
		profitFactor,
		expectancy,
		bestTrade,
		worstTrade,
		tradesBySymbol,
		tradesBySetup,
		winRateBySetup,
		pnlByDay,
		consecutiveWins: maxWinStreak,
		consecutiveLosses: maxLossStreak
	};
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
