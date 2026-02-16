<script lang="ts">
	import { onMount } from 'svelte';
	import { selectedAccountId } from '$lib/stores';
	import { formatCurrency, calculateAnalytics, formatTime } from '$lib/utils/analytics';
	import type { AIInsight } from '$lib/utils/aiAnalyzer';
	import {
		TrendingUp,
		Target,
		Award,
		BarChart3,
		Clock,
		Zap,
		Sparkles,
		CheckCircle,
		XCircle,
		Info,
		AlertTriangle
	} from 'lucide-svelte';
	import type { Trade, Strategy } from '$lib/types';

	let trades = $state<Trade[]>([]);
	let strategies = $state<Strategy[]>([]);
	let analytics = $state<any>(null);
	let loading = $state(true);
	let aiInsights = $state<AIInsight[]>([]);
	let loadingAI = $state(false);

	// Chart data
	let monthlyPnlData = $state<{ month: string; pnl: number }[]>([]);
	let rrDistribution = $state<{ range: string; count: number }[]>([]);
	let timeOfDayData = $state<{ time: string; wins: number; losses: number; total: number }[]>([]);
	let marketConditionData = $state<{ condition: string; winRate: number; avgPnl: number }[]>([]);

	$effect(() => {
		loadData($selectedAccountId);
	});

	async function loadData(accountId: string) {
		if (!accountId) return;

		loading = true;
		try {
			const [tradesRes, strategiesRes] = await Promise.all([
				fetch(`/api/trades?accountId=${accountId}`),
				fetch('/api/strategies')
			]);

			trades = await tradesRes.json();
			strategies = await strategiesRes.json();
			analytics = calculateAnalytics(trades);

			// Process data for charts
			processChartData();

			// Load AI insights
			loadAIAnalysis(accountId);
		} catch (error) {
			console.error('Error loading data:', error);
		} finally {
			loading = false;
		}
	}

	async function loadAIAnalysis(accountId: string) {
		loadingAI = true;
		try {
			const res = await fetch(`/api/ai-analysis?accountId=${accountId}`);
			const data = await res.json();
			aiInsights = data.insights || [];
		} catch (error) {
			console.error('AI analysis failed:', error);
			aiInsights = [];
		} finally {
			loadingAI = false;
		}
	}

	function processChartData() {
		// Monthly P&L
		monthlyPnlData = analytics.pnlByMonth.slice(-12); // Last 12 months

		// R:R Distribution
		const closedTrades = trades.filter((t) => t.status === 'closed');
		const rrRanges = [
			{ range: '< 0', min: -Infinity, max: 0 },
			{ range: '0-1', min: 0, max: 1 },
			{ range: '1-2', min: 1, max: 2 },
			{ range: '2-3', min: 2, max: 3 },
			{ range: '3+', min: 3, max: Infinity }
		];

		rrDistribution = rrRanges.map((range) => ({
			range: range.range,
			count: closedTrades.filter((t) => t.actualRR >= range.min && t.actualRR < range.max).length
		}));

		// Time of Day Performance
		const timeSlots = ['premarket', 'morning', 'midday', 'afternoon', 'afterhours'];
		timeOfDayData = timeSlots
			.map((time) => {
				const tradesInSlot = closedTrades.filter((t) => t.timeOfDay === time);
				const wins = tradesInSlot.filter((t) => t.outcome === 'win').length;
				const losses = tradesInSlot.filter((t) => t.outcome === 'loss').length;
				return {
					time,
					wins,
					losses,
					total: tradesInSlot.length
				};
			})
			.filter((d) => d.total > 0);

		// Market Condition Performance
		const conditions = ['trending', 'ranging', 'volatile', 'quiet'];
		marketConditionData = conditions
			.map((condition) => {
				const tradesInCondition = closedTrades.filter((t) => t.marketCondition === condition);
				const wins = tradesInCondition.filter((t) => t.outcome === 'win').length;
				const totalPnl = tradesInCondition.reduce((sum, t) => sum + t.netPnl, 0);
				return {
					condition,
					winRate: tradesInCondition.length > 0 ? (wins / tradesInCondition.length) * 100 : 0,
					avgPnl: tradesInCondition.length > 0 ? totalPnl / tradesInCondition.length : 0
				};
			})
			.filter((d) => d.winRate > 0 || d.avgPnl !== 0);
	}

	const topSymbols = $derived(
		analytics
			? Object.entries(analytics.tradesBySymbol)
					.sort(([, a]: any, [, b]: any) => b - a)
					.slice(0, 5)
			: []
	);

	const strategyPerformance = $derived(
		analytics
			? Object.entries(analytics.tradesByStrategy)
					.map(([strategyId, count]) => {
						const strategy = strategies.find((s) => s.id === strategyId);
						return {
							id: strategyId,
							name: strategy?.name || 'Unknown',
							count,
							winRate: analytics.winRateByStrategy[strategyId] || 0
						};
					})
					.sort((a: any, b: any) => b.count - a.count)
			: []
	);

	// Monthly P&L bar chart
	function getMonthlyPnlBars() {
		if (monthlyPnlData.length === 0) return [];

		const maxPnl = Math.max(...monthlyPnlData.map((d) => Math.abs(d.pnl)));
		const chartHeight = 200;
		const barWidth = 60;
		const gap = 10;

		return monthlyPnlData.map((d, i) => {
			const height = (Math.abs(d.pnl) / maxPnl) * (chartHeight - 40);
			const y = d.pnl >= 0 ? chartHeight / 2 - height : chartHeight / 2;

			return {
				x: i * (barWidth + gap),
				y,
				width: barWidth,
				height,
				pnl: d.pnl,
				month: d.month,
				color: d.pnl >= 0 ? '#10b981' : '#ef4444'
			};
		});
	}

	// R:R Distribution bars
	function getRRDistributionBars() {
		if (rrDistribution.length === 0) return [];

		const maxCount = Math.max(...rrDistribution.map((d) => d.count));
		const chartHeight = 150;
		const barWidth = 80;
		const gap = 10;

		return rrDistribution.map((d, i) => ({
			x: i * (barWidth + gap),
			y: chartHeight - (d.count / maxCount) * (chartHeight - 20),
			width: barWidth,
			height: (d.count / maxCount) * (chartHeight - 20),
			count: d.count,
			range: d.range,
			color: '#0284c7'
		}));
	}

	// Time of day stacked bars
	function getTimeOfDayBars() {
		if (timeOfDayData.length === 0) return [];

		const maxTotal = Math.max(...timeOfDayData.map((d) => d.total));
		const chartHeight = 150;
		const barWidth = 60;
		const gap = 20;

		return timeOfDayData.map((d, i) => {
			const winHeight = (d.wins / maxTotal) * (chartHeight - 20);
			const lossHeight = (d.losses / maxTotal) * (chartHeight - 20);

			return {
				x: i * (barWidth + gap),
				wins: {
					y: chartHeight - winHeight - lossHeight,
					height: winHeight
				},
				losses: {
					y: chartHeight - lossHeight,
					height: lossHeight
				},
				width: barWidth,
				time: d.time,
				total: d.total
			};
		});
	}

	// Market condition performance bars
	function getMarketConditionBars() {
		if (marketConditionData.length === 0) return [];

		const chartHeight = 120;
		const barWidth = 80;
		const gap = 20;

		return marketConditionData.map((d, i) => ({
			x: i * (barWidth + gap),
			y: chartHeight - d.winRate,
			width: barWidth,
			height: d.winRate,
			winRate: d.winRate,
			avgPnl: d.avgPnl,
			condition: d.condition,
			color: d.avgPnl >= 0 ? '#10b981' : '#ef4444'
		}));
	}

	function capitalizeFirst(str: string) {
		return str.charAt(0).toUpperCase() + str.slice(1);
	}
</script>

<svelte:head>
	<title>Analytics - TradeJournal</title>
</svelte:head>

<div class="p-8">
	{#if loading}
		<div class="flex h-64 items-center justify-center">
			<div class="text-gray-500">Loading...</div>
		</div>
	{:else if !analytics}
		<div class="py-12 text-center text-gray-500">
			No data available. Start adding trades to see analytics.
		</div>
	{:else}
		<!-- Header -->
		<div class="mb-8">
			<h1 class="mb-2 text-3xl font-bold text-gray-900">Analytics</h1>
			<p class="text-gray-600">Detailed performance analysis and insights</p>
		</div>

		<!-- AI Insights Section -->
		{#if loadingAI}
			<div class="card from-primary-50 border-primary-200 mb-8 bg-gradient-to-r to-blue-50">
				<div class="flex items-center gap-3">
					<Sparkles class="text-primary-600 h-6 w-6 animate-pulse" />
					<div class="flex-1">
						<h3 class="text-lg font-semibold text-gray-900">Analyzing your performance...</h3>
						<p class="mt-1 text-sm text-gray-600">AI is generating detailed insights</p>
					</div>
				</div>
			</div>
		{:else if aiInsights.length > 0}
			<div class="mb-8">
				<div class="mb-4 flex items-center gap-2">
					<Sparkles class="text-primary-600 h-6 w-6" />
					<h3 class="text-xl font-semibold text-gray-900">Deep Performance Insights</h3>
					<span class="text-sm text-gray-500">({aiInsights.length} insights)</span>
				</div>
				<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
					{#each aiInsights as insight}
						<div
							class="card {insight.type === 'success'
								? 'border-l-4 border-green-500 bg-green-50'
								: insight.type === 'warning'
									? 'border-l-4 border-yellow-500 bg-yellow-50'
									: insight.type === 'danger'
										? 'border-l-4 border-red-500 bg-red-50'
										: insight.type === 'info'
											? 'border-l-4 border-blue-500 bg-blue-50'
											: 'border-l-4 border-purple-500 bg-purple-50'} transition-shadow hover:shadow-md"
						>
							<div class="flex items-start gap-3">
								<svelte:component
									this={{
										success: CheckCircle,
										warning: AlertTriangle,
										danger: XCircle,
										info: Info
									}[insight.type] || Sparkles}
									class="mt-0.5 h-5 w-5 flex-shrink-0 {insight.type === 'success'
										? 'text-green-600'
										: insight.type === 'warning'
											? 'text-yellow-600'
											: insight.type === 'danger'
												? 'text-red-600'
												: insight.type === 'info'
													? 'text-blue-600'
													: 'text-purple-600'}"
								/>
								<div class="min-w-0 flex-1">
									<div class="flex items-start justify-between gap-2">
										<h4 class="text-sm font-semibold text-gray-900">{insight.title}</h4>
										<span
											class="flex-shrink-0 rounded-full px-2 py-0.5 text-xs {insight.severity ===
											'high'
												? 'bg-red-100 text-red-700'
												: insight.severity === 'medium'
													? 'bg-yellow-100 text-yellow-700'
													: 'bg-blue-100 text-blue-700'}"
										>
											{insight.severity.toUpperCase()}
										</span>
									</div>
									<p class="mt-1 text-sm text-gray-700">{insight.message}</p>
									<div class="mt-2 rounded bg-white/50 p-2">
										<p class="text-sm font-medium text-gray-900">💡 {insight.actionable}</p>
									</div>
									{#if insight.category}
										<span class="mt-2 inline-block text-xs text-gray-500"
											>Category: {insight.category}</span
										>
									{/if}
								</div>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Key Metrics -->
		<div class="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
			<div class="card">
				<div class="mb-2 flex items-center justify-between">
					<span class="text-sm text-gray-600">Total Trades</span>
					<BarChart3 class="h-5 w-5 text-gray-400" />
				</div>
				<div class="text-2xl font-bold text-gray-900">
					{analytics.totalTrades}
				</div>
			</div>

			<div class="card">
				<div class="mb-2 flex items-center justify-between">
					<span class="text-sm text-gray-600">Win Rate</span>
					<Target class="h-5 w-5 text-gray-400" />
				</div>
				<div class="text-2xl font-bold text-gray-900">
					{analytics.winRate.toFixed(1)}%
				</div>
			</div>

			<div class="card">
				<div class="mb-2 flex items-center justify-between">
					<span class="text-sm text-gray-600">Profit Factor</span>
					<TrendingUp class="h-5 w-5 text-gray-400" />
				</div>
				<div class="text-2xl font-bold text-gray-900">
					{analytics.profitFactor === Infinity ? '∞' : analytics.profitFactor.toFixed(2)}
				</div>
			</div>

			<div class="card">
				<div class="mb-2 flex items-center justify-between">
					<span class="text-sm text-gray-600">Avg Hold Time</span>
					<Clock class="h-5 w-5 text-gray-400" />
				</div>
				<div class="text-2xl font-bold text-gray-900">
					{formatTime(analytics.avgHoldTime)}
				</div>
			</div>
		</div>

		<!-- Monthly P&L Chart -->
		<div class="card mb-8">
			<div class="mb-6 flex items-center justify-between">
				<div>
					<h3 class="text-lg font-semibold text-gray-900">Monthly P&L</h3>
					<p class="text-sm text-gray-500">Last 12 months performance</p>
				</div>
				<BarChart3 class="h-5 w-5 text-gray-400" />
			</div>

			{#if monthlyPnlData.length === 0}
				<div class="py-12 text-center text-gray-500">No monthly data yet</div>
			{:else}
				<div class="overflow-x-auto">
					<svg width="100%" height="260" viewBox="0 0 900 260" class="min-w-[900px]">
						<!-- Zero line -->
						<line x1="40" y1="130" x2="860" y2="130" stroke="#e5e7eb" stroke-width="2" />

						<!-- Bars -->
						{#each getMonthlyPnlBars() as bar}
							<rect
								x={bar.x + 60}
								y={bar.y}
								width={bar.width}
								height={bar.height}
								fill={bar.color}
								class="cursor-pointer transition-opacity hover:opacity-80"
							>
								<title>{bar.month}: {formatCurrency(bar.pnl)}</title>
							</rect>

							<!-- Month label -->
							<text
								x={bar.x + 60 + bar.width / 2}
								y="250"
								font-size="10"
								fill="#6b7280"
								text-anchor="middle"
							>
								{bar.month.split('-')[1]}
							</text>
						{/each}

						<!-- Axis labels -->
						<text x="20" y="20" font-size="12" fill="#6b7280">$</text>
						<text x="450" y="20" font-size="12" fill="#6b7280" text-anchor="middle">Month</text>
					</svg>
				</div>
			{/if}
		</div>

		<!-- R:R Distribution & Time of Day Performance -->
		<div class="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
			<!-- R:R Distribution -->
			<div class="card">
				<div class="mb-6 flex items-center justify-between">
					<div>
						<h3 class="text-lg font-semibold text-gray-900">R:R Distribution</h3>
						<p class="text-sm text-gray-500">Risk-Reward achievement</p>
					</div>
					<Award class="h-5 w-5 text-gray-400" />
				</div>

				{#if rrDistribution.length === 0}
					<div class="py-12 text-center text-gray-500">No R:R data yet</div>
				{:else}
					<div class="overflow-x-auto">
						<svg width="100%" height="200" viewBox="0 0 500 200">
							<!-- Grid -->
							<line x1="40" y1="20" x2="40" y2="170" stroke="#e5e7eb" stroke-width="1" />
							<line x1="40" y1="170" x2="460" y2="170" stroke="#e5e7eb" stroke-width="1" />

							<!-- Bars -->
							{#each getRRDistributionBars() as bar}
								<rect
									x={bar.x + 60}
									y={bar.y}
									width={bar.width}
									height={bar.height}
									fill={bar.color}
									class="cursor-pointer transition-opacity hover:opacity-80"
								>
									<title>{bar.range}: {bar.count} trades</title>
								</rect>

								<!-- Count on bar -->
								<text
									x={bar.x + 60 + bar.width / 2}
									y={bar.y - 5}
									font-size="12"
									fill="#111827"
									font-weight="bold"
									text-anchor="middle"
								>
									{bar.count}
								</text>

								<!-- Range label -->
								<text
									x={bar.x + 60 + bar.width / 2}
									y="190"
									font-size="11"
									fill="#6b7280"
									text-anchor="middle"
								>
									{bar.range}
								</text>
							{/each}

							<text x="250" y="15" font-size="12" fill="#6b7280" text-anchor="middle"
								>R:R Range</text
							>
						</svg>
					</div>
				{/if}
			</div>

			<!-- Time of Day Performance -->
			<div class="card">
				<div class="mb-6 flex items-center justify-between">
					<div>
						<h3 class="text-lg font-semibold text-gray-900">Time of Day</h3>
						<p class="text-sm text-gray-500">Performance by session</p>
					</div>
					<Clock class="h-5 w-5 text-gray-400" />
				</div>

				{#if timeOfDayData.length === 0}
					<div class="py-12 text-center text-gray-500">No time data yet</div>
				{:else}
					<div class="overflow-x-auto">
						<svg width="100%" height="200" viewBox="0 0 450 200">
							<!-- Grid -->
							<line x1="40" y1="170" x2="410" y2="170" stroke="#e5e7eb" stroke-width="1" />

							<!-- Stacked Bars -->
							{#each getTimeOfDayBars() as bar}
								<!-- Wins (green) -->
								<rect
									x={bar.x + 50}
									y={bar.wins.y}
									width={bar.width}
									height={bar.wins.height}
									fill="#10b981"
									class="cursor-pointer transition-opacity hover:opacity-80"
								>
									<title>{capitalizeFirst(bar.time)}: {bar.total} trades</title>
								</rect>

								<!-- Losses (red) -->
								<rect
									x={bar.x + 50}
									y={bar.losses.y}
									width={bar.width}
									height={bar.losses.height}
									fill="#ef4444"
									class="cursor-pointer transition-opacity hover:opacity-80"
								/>

								<!-- Time label -->
								<text
									x={bar.x + 50 + bar.width / 2}
									y="190"
									font-size="10"
									fill="#6b7280"
									text-anchor="middle"
								>
									{capitalizeFirst(bar.time).slice(0, 6)}
								</text>
							{/each}

							<!-- Legend -->
							<rect x="340" y="20" width="12" height="12" fill="#10b981" />
							<text x="355" y="30" font-size="10" fill="#6b7280">Wins</text>
							<rect x="340" y="35" width="12" height="12" fill="#ef4444" />
							<text x="355" y="45" font-size="10" fill="#6b7280">Losses</text>
						</svg>
					</div>
				{/if}
			</div>
		</div>

		<!-- Market Condition Performance -->
		<div class="card mb-8">
			<div class="mb-6 flex items-center justify-between">
				<div>
					<h3 class="text-lg font-semibold text-gray-900">Market Condition Performance</h3>
					<p class="text-sm text-gray-500">Win rate by market type</p>
				</div>
				<Zap class="h-5 w-5 text-gray-400" />
			</div>

			{#if marketConditionData.length === 0}
				<div class="py-12 text-center text-gray-500">No market condition data yet</div>
			{:else}
				<div class="overflow-x-auto">
					<svg width="100%" height="180" viewBox="0 0 500 180">
						<!-- Grid -->
						<line x1="40" y1="140" x2="460" y2="140" stroke="#e5e7eb" stroke-width="1" />

						<!-- 100% line -->
						<line
							x1="40"
							y1="40"
							x2="460"
							y2="40"
							stroke="#e5e7eb"
							stroke-width="1"
							stroke-dasharray="4"
						/>
						<text x="30" y="44" font-size="10" fill="#6b7280" text-anchor="end">100%</text>

						<!-- 50% line -->
						<line
							x1="40"
							y1="90"
							x2="460"
							y2="90"
							stroke="#e5e7eb"
							stroke-width="1"
							stroke-dasharray="4"
						/>
						<text x="30" y="94" font-size="10" fill="#6b7280" text-anchor="end">50%</text>

						<!-- Bars -->
						{#each getMarketConditionBars() as bar}
							<rect
								x={bar.x + 80}
								y={bar.y + 40}
								width={bar.width}
								height={bar.height}
								fill={bar.color}
								class="cursor-pointer transition-opacity hover:opacity-80"
							>
								<title
									>{capitalizeFirst(bar.condition)}: {bar.winRate.toFixed(1)}% win rate, {formatCurrency(
										bar.avgPnl
									)} avg</title
								>
							</rect>

							<!-- Win rate text -->
							<text
								x={bar.x + 80 + bar.width / 2}
								y={bar.y + 35}
								font-size="12"
								fill="#111827"
								font-weight="bold"
								text-anchor="middle"
							>
								{bar.winRate.toFixed(0)}%
							</text>

							<!-- Condition label -->
							<text
								x={bar.x + 80 + bar.width / 2}
								y="165"
								font-size="10"
								fill="#6b7280"
								text-anchor="middle"
							>
								{capitalizeFirst(bar.condition)}
							</text>
						{/each}
					</svg>
				</div>
			{/if}
		</div>

		<!-- Performance Details -->
		<div class="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
			<!-- Win/Loss Analysis -->
			<div class="card">
				<h3 class="mb-4 text-lg font-semibold text-gray-900">Win/Loss Analysis</h3>
				<div class="space-y-4">
					<div class="flex items-center justify-between">
						<span class="text-gray-600">Average Win</span>
						<span class="text-profit font-semibold">
							{formatCurrency(analytics.averageWin)}
						</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-gray-600">Average Loss</span>
						<span class="text-loss font-semibold">
							{formatCurrency(analytics.averageLoss)}
						</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-gray-600">Best Trade</span>
						<div class="text-right">
							<div class="text-profit font-semibold">
								{formatCurrency(analytics.bestTrade?.netPnl || 0)}
							</div>
							<div class="text-xs text-gray-500">
								{analytics.bestTrade?.symbol || '-'}
							</div>
						</div>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-gray-600">Worst Trade</span>
						<div class="text-right">
							<div class="text-loss font-semibold">
								{formatCurrency(analytics.worstTrade?.netPnl || 0)}
							</div>
							<div class="text-xs text-gray-500">
								{analytics.worstTrade?.symbol || '-'}
							</div>
						</div>
					</div>
					<div class="flex items-center justify-between border-t border-gray-200 pt-4">
						<span class="text-gray-600">Win/Loss Ratio</span>
						<span class="font-semibold text-gray-900">
							{analytics.winLossRatio.toFixed(2)}
						</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-gray-600">Average R:R</span>
						<span class="font-semibold text-gray-900">
							{analytics.avgRR.toFixed(2)}
						</span>
					</div>
				</div>
			</div>

			<!-- Risk Metrics -->
			<div class="card">
				<h3 class="mb-4 text-lg font-semibold text-gray-900">Risk Metrics</h3>
				<div class="space-y-4">
					<div class="flex items-center justify-between">
						<span class="text-gray-600">Expectancy</span>
						<span class="font-semibold {analytics.expectancy >= 0 ? 'text-profit' : 'text-loss'}">
							{formatCurrency(analytics.expectancy)}
						</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-gray-600">Sharpe Ratio</span>
						<span class="font-semibold text-gray-900">
							{analytics.sharpeRatio.toFixed(2)}
						</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-gray-600">Max Drawdown</span>
						<span class="text-loss font-semibold">
							{formatCurrency(analytics.maxDrawdown)}
						</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-gray-600">Recovery Factor</span>
						<span class="font-semibold text-gray-900">
							{analytics.recoveryFactor.toFixed(2)}
						</span>
					</div>
					<div class="flex items-center justify-between border-t border-gray-200 pt-4">
						<span class="text-gray-600">Consecutive Wins</span>
						<span class="text-profit font-semibold">
							{analytics.consecutiveWins}
						</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-gray-600">Consecutive Losses</span>
						<span class="text-loss font-semibold">
							{analytics.consecutiveLosses}
						</span>
					</div>
				</div>
			</div>
		</div>

		<!-- Top Symbols & Strategy Performance -->
		<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
			<!-- Top Symbols -->
			<div class="card">
				<h3 class="mb-4 text-lg font-semibold text-gray-900">Most Traded Symbols</h3>
				{#if topSymbols.length === 0}
					<p class="text-gray-500">No data available</p>
				{:else}
					<div class="space-y-3">
						{#each topSymbols as [symbol, count]}
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-3">
									<span class="font-medium text-gray-900">{symbol}</span>
								</div>
								<div class="flex items-center gap-3">
									<div class="h-2 w-32 rounded-full bg-gray-200">
										<div
											class="bg-primary-600 h-2 rounded-full"
											style="width: {(count / topSymbols[0][1]) * 100}%"
										></div>
									</div>
									<span class="w-16 text-right text-sm text-gray-600">{count} trades</span>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Strategy Performance -->
			<div class="card">
				<h3 class="mb-4 text-lg font-semibold text-gray-900">Strategy Performance</h3>
				{#if strategyPerformance.length === 0}
					<p class="text-gray-500">No strategy data available</p>
				{:else}
					<div class="space-y-3">
						{#each strategyPerformance as strategy}
							<div class="flex items-center justify-between">
								<div class="flex flex-col">
									<span class="font-medium text-gray-900">{strategy.name}</span>
									<span class="text-xs text-gray-500">{strategy.count} trades</span>
								</div>
								<div class="text-right">
									<span
										class="font-semibold {strategy.winRate >= 50 ? 'text-profit' : 'text-loss'}"
									>
										{strategy.winRate.toFixed(1)}%
									</span>
									<div class="text-xs text-gray-500">win rate</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>
