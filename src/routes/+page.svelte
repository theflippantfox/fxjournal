<script lang="ts">
	import { onMount } from 'svelte';
	import { selectedAccountId } from '$lib/stores';
	import {
		formatCurrency,
		formatPercentage,
		calculateAnalytics,
		formatTime
	} from '$lib/utils/analytics';
	import {
		TrendingUp,
		TrendingDown,
		DollarSign,
		Target,
		Activity,
		Award,
		AlertCircle,
		BarChart3,
		PieChart,
		Calendar,
		Clock
	} from 'lucide-svelte';
	import type { Account, Trade } from '$lib/types';

	let account = $state<Account | null>(null);
	let trades = $state<Trade[]>([]);
	let analytics = $state<any>(null);
	let loading = $state(true);

	// Chart data
	let equityCurveData = $state<{ date: string; equity: number }[]>([]);
	let weeklyPnlData = $state<{ week: string; pnl: number }[]>([]);

	$effect(() => {
		loadData($selectedAccountId);
	});

	async function loadData(accountId: string) {
		if (!accountId) return;

		loading = true;
		try {
			const [accountRes, tradesRes] = await Promise.all([
				fetch('/api/accounts'),
				fetch(`/api/trades?accountId=${accountId}`)
			]);

			const accounts = await accountRes.json();
			account = accounts.find((a: Account) => a.id === accountId);
			trades = await tradesRes.json();
			analytics = calculateAnalytics(trades);

			// Calculate equity curve
			calculateEquityCurve();

			// Get weekly P&L
			weeklyPnlData = analytics.pnlByWeek.slice(-8); // Last 8 weeks
		} catch (error) {
			console.error('Error loading data:', error);
		} finally {
			loading = false;
		}
	}

	function calculateEquityCurve() {
		if (!account) return;

		const closedTrades = trades
			.filter((t) => t.status === 'closed' && t.exitDate)
			.sort((a, b) => new Date(a.exitDate!).getTime() - new Date(b.exitDate!).getTime());

		let runningEquity = account.investedAmount;
		const curve: { date: string; equity: number }[] = [
			{
				date: new Date(account.createdAt).toISOString().split('T')[0],
				equity: runningEquity
			}
		];

		closedTrades.forEach((trade) => {
			runningEquity += trade.netPnl;
			curve.push({
				date: trade.exitDate!.split('T')[0],
				equity: runningEquity
			});
		});

		equityCurveData = curve;
	}

	const recentTrades = $derived(
		trades
			.filter((t) => t.status === 'closed')
			.sort((a, b) => {
				const dateA = a.exitDate || a.entryDate;
				const dateB = b.exitDate || b.entryDate;
				return new Date(dateB).getTime() - new Date(dateA).getTime();
			})
			.slice(0, 5)
	);

	// Win/Loss distribution for pie chart
	const winLossData = $derived(() => {
		if (!analytics) return { wins: 0, losses: 0, breakeven: 0 };
		const closedTrades = trades.filter((t) => t.status === 'closed');
		return {
			wins: closedTrades.filter((t) => t.outcome === 'win').length,
			losses: closedTrades.filter((t) => t.outcome === 'loss').length,
			breakeven: closedTrades.filter((t) => t.outcome === 'breakeven').length
		};
	});

	// Calculate pie chart segments
	function getPieSegments() {
		const data = winLossData();
		const total = data.wins + data.losses + data.breakeven;
		if (total === 0) return [];

		const segments = [];
		let currentAngle = 0;

		const colors = {
			wins: '#10b981',
			losses: '#ef4444',
			breakeven: '#6b7280'
		};

		const values = [
			{ label: 'Wins', count: data.wins, color: colors.wins },
			{ label: 'Losses', count: data.losses, color: colors.losses },
			{ label: 'Breakeven', count: data.breakeven, color: colors.breakeven }
		];

		values.forEach((item) => {
			if (item.count > 0) {
				const percentage = item.count / total;
				const angle = percentage * 360;

				segments.push({
					label: item.label,
					count: item.count,
					percentage: Math.round(percentage * 100),
					color: item.color,
					startAngle: currentAngle,
					endAngle: currentAngle + angle
				});

				currentAngle += angle;
			}
		});

		return segments;
	}

	function polarToCartesian(
		centerX: number,
		centerY: number,
		radius: number,
		angleInDegrees: number
	) {
		const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
		return {
			x: centerX + radius * Math.cos(angleInRadians),
			y: centerY + radius * Math.sin(angleInRadians)
		};
	}

	function describeArc(x: number, y: number, radius: number, startAngle: number, endAngle: number) {
		const start = polarToCartesian(x, y, radius, endAngle);
		const end = polarToCartesian(x, y, radius, startAngle);
		const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
		return [
			'M',
			start.x,
			start.y,
			'A',
			radius,
			radius,
			0,
			largeArcFlag,
			0,
			end.x,
			end.y,
			'L',
			x,
			y,
			'Z'
		].join(' ');
	}

	// Calculate bar chart dimensions
	function getBarChartData() {
		if (weeklyPnlData.length === 0) return [];

		const maxPnl = Math.max(...weeklyPnlData.map((d) => Math.abs(d.pnl)));
		const chartHeight = 200;
		const barWidth = 40;
		const gap = 10;

		return weeklyPnlData.map((d, i) => {
			const height = (Math.abs(d.pnl) / maxPnl) * (chartHeight - 40);
			const y = d.pnl >= 0 ? chartHeight / 2 - height : chartHeight / 2;

			return {
				x: i * (barWidth + gap),
				y,
				width: barWidth,
				height,
				pnl: d.pnl,
				week: d.week,
				color: d.pnl >= 0 ? '#10b981' : '#ef4444'
			};
		});
	}

	// Calculate equity curve path
	function getEquityCurvePath() {
		if (equityCurveData.length === 0) return '';

		const width = 600;
		const height = 200;
		const padding = 40;

		const xScale = (width - padding * 2) / (equityCurveData.length - 1);
		const minEquity = Math.min(...equityCurveData.map((d) => d.equity));
		const maxEquity = Math.max(...equityCurveData.map((d) => d.equity));
		const yRange = maxEquity - minEquity || 1;
		const yScale = (height - padding * 2) / yRange;

		let path = '';
		equityCurveData.forEach((point, i) => {
			const x = padding + i * xScale;
			const y = height - padding - (point.equity - minEquity) * yScale;

			if (i === 0) {
				path += `M ${x} ${y}`;
			} else {
				path += ` L ${x} ${y}`;
			}
		});

		return path;
	}

	function getEquityCurvePoints() {
		if (equityCurveData.length === 0) return [];

		const width = 600;
		const height = 200;
		const padding = 40;

		const xScale = (width - padding * 2) / (equityCurveData.length - 1);
		const minEquity = Math.min(...equityCurveData.map((d) => d.equity));
		const maxEquity = Math.max(...equityCurveData.map((d) => d.equity));
		const yRange = maxEquity - minEquity || 1;
		const yScale = (height - padding * 2) / yRange;

		return equityCurveData.map((point, i) => ({
			x: padding + i * xScale,
			y: height - padding - (point.equity - minEquity) * yScale,
			equity: point.equity,
			date: point.date
		}));
	}
</script>

<svelte:head>
	<title>Dashboard - TradeJournal</title>
</svelte:head>

<div class="p-8">
	{#if loading}
		<div class="flex h-64 items-center justify-center">
			<div class="text-gray-500">Loading...</div>
		</div>
	{:else if !account}
		<div class="flex h-64 flex-col items-center justify-center">
			<AlertCircle class="mb-4 h-16 w-16 text-gray-400" />
			<h2 class="mb-2 text-xl font-semibold text-gray-900">No Account Selected</h2>
			<p class="mb-4 text-gray-500">Please create an account to get started</p>
			<a href="/settings" class="btn btn-primary">Go to Settings</a>
		</div>
	{:else}
		<!-- Header -->
		<div class="mb-8">
			<h1 class="mb-2 text-3xl font-bold text-gray-900">Dashboard</h1>
			<p class="text-gray-600">Overview of {account.name}</p>
		</div>

		<!-- Stats Grid -->
		<div class="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
			<!-- Account Balance -->
			<div class="card">
				<div class="mb-2 flex items-center justify-between">
					<span class="text-sm text-gray-600">Balance</span>
					<DollarSign class="h-5 w-5 text-gray-400" />
				</div>
				<div class="text-2xl font-bold text-gray-900">
					{formatCurrency(account.balance)}
				</div>
				<div class="mt-1 text-sm text-gray-500">
					Invested: {formatCurrency(account.investedAmount)}
				</div>
			</div>

			<!-- Total P&L -->
			<div class="card">
				<div class="mb-2 flex items-center justify-between">
					<span class="text-sm text-gray-600">Total P&L</span>
					{#if account.totalPnl >= 0}
						<TrendingUp class="text-profit h-5 w-5" />
					{:else}
						<TrendingDown class="text-loss h-5 w-5" />
					{/if}
				</div>
				<div class="text-2xl font-bold {account.totalPnl >= 0 ? 'text-profit' : 'text-loss'}">
					{formatCurrency(account.totalPnl)}
				</div>
				<div class="mt-1 text-sm text-gray-500">
					{formatPercentage((account.totalPnl / account.investedAmount) * 100)}
				</div>
			</div>

			<!-- Win Rate -->
			<div class="card">
				<div class="mb-2 flex items-center justify-between">
					<span class="text-sm text-gray-600">Win Rate</span>
					<Target class="h-5 w-5 text-gray-400" />
				</div>
				<div class="text-2xl font-bold text-gray-900">
					{analytics?.winRate.toFixed(1)}%
				</div>
				<div class="mt-1 text-sm text-gray-500">
					{analytics?.totalTrades} total trades
				</div>
			</div>

			<!-- Profit Factor -->
			<div class="card">
				<div class="mb-2 flex items-center justify-between">
					<span class="text-sm text-gray-600">Profit Factor</span>
					<Activity class="h-5 w-5 text-gray-400" />
				</div>
				<div class="text-2xl font-bold text-gray-900">
					{analytics?.profitFactor === Infinity ? '∞' : analytics?.profitFactor.toFixed(2)}
				</div>
				<div class="mt-1 text-sm text-gray-500">
					Expectancy: {formatCurrency(analytics?.expectancy || 0)}
				</div>
			</div>
		</div>

		<!-- Charts Row 1: Equity Curve & Win/Loss Distribution -->
		<div class="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
			<!-- Equity Curve Chart -->
			<div class="card lg:col-span-2">
				<div class="mb-6 flex items-center justify-between">
					<div>
						<h3 class="text-lg font-semibold text-gray-900">Equity Curve</h3>
						<p class="text-sm text-gray-500">Account growth over time</p>
					</div>
					<BarChart3 class="h-5 w-5 text-gray-400" />
				</div>

				{#if equityCurveData.length === 0}
					<div class="py-12 text-center text-gray-500">
						No trades yet. Start trading to see your equity curve.
					</div>
				{:else}
					<div class="overflow-x-auto">
						<svg width="100%" height="240" viewBox="0 0 600 240" class="min-w-[600px]">
							<!-- Grid lines -->
							<line x1="40" y1="40" x2="40" y2="200" stroke="#e5e7eb" stroke-width="1" />
							<line x1="40" y1="200" x2="560" y2="200" stroke="#e5e7eb" stroke-width="1" />

							<!-- Equity curve line -->
							<path d={getEquityCurvePath()} fill="none" stroke="#0284c7" stroke-width="2" />

							<!-- Data points -->
							{#each getEquityCurvePoints() as point}
								<circle
									cx={point.x}
									cy={point.y}
									r="4"
									fill="#0284c7"
									class="hover:r-6 cursor-pointer transition-all"
								>
									<title>{point.date}: {formatCurrency(point.equity)}</title>
								</circle>
							{/each}

							<!-- Axis labels -->
							<text x="10" y="120" font-size="12" fill="#6b7280">$</text>
							<text x="280" y="230" font-size="12" fill="#6b7280" text-anchor="middle">Time</text>
						</svg>
					</div>
				{/if}
			</div>

			<!-- Win/Loss Distribution Pie Chart -->
			<div class="card">
				<div class="mb-6 flex items-center justify-between">
					<div>
						<h3 class="text-lg font-semibold text-gray-900">Distribution</h3>
						<p class="text-sm text-gray-500">Win/Loss breakdown</p>
					</div>
					<PieChart class="h-5 w-5 text-gray-400" />
				</div>

				{#if analytics?.totalTrades === 0}
					<div class="py-12 text-center text-gray-500">No trades yet</div>
				{:else}
					<div class="flex flex-col items-center">
						<svg width="200" height="200" viewBox="0 0 200 200">
							{#each getPieSegments() as segment}
								<path
									d={describeArc(100, 100, 80, segment.startAngle, segment.endAngle)}
									fill={segment.color}
									class="cursor-pointer transition-opacity hover:opacity-80"
								>
									<title>{segment.label}: {segment.count} ({segment.percentage}%)</title>
								</path>
							{/each}

							<!-- Center circle for donut effect -->
							<circle cx="100" cy="100" r="50" fill="white" />

							<!-- Center text -->
							<text
								x="100"
								y="95"
								text-anchor="middle"
								font-size="24"
								font-weight="bold"
								fill="#111827"
							>
								{analytics?.winRate.toFixed(0)}%
							</text>
							<text x="100" y="115" text-anchor="middle" font-size="12" fill="#6b7280">
								Win Rate
							</text>
						</svg>

						<!-- Legend -->
						<div class="mt-4 w-full space-y-2">
							{#each getPieSegments() as segment}
								<div class="flex items-center justify-between text-sm">
									<div class="flex items-center gap-2">
										<div class="h-3 w-3 rounded" style="background-color: {segment.color}"></div>
										<span class="text-gray-700">{segment.label}</span>
									</div>
									<span class="font-medium text-gray-900"
										>{segment.count} ({segment.percentage}%)</span
									>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</div>

		<!-- Charts Row 2: Weekly P&L & Performance Metrics -->
		<div class="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
			<!-- Weekly P&L Bar Chart -->
			<div class="card lg:col-span-2">
				<div class="mb-6 flex items-center justify-between">
					<div>
						<h3 class="text-lg font-semibold text-gray-900">Weekly Performance</h3>
						<p class="text-sm text-gray-500">Last 8 weeks P&L</p>
					</div>
					<Calendar class="h-5 w-5 text-gray-400" />
				</div>

				{#if weeklyPnlData.length === 0}
					<div class="py-12 text-center text-gray-500">No weekly data yet</div>
				{:else}
					<div class="overflow-x-auto">
						<svg width="100%" height="240" viewBox="0 0 500 240" class="min-w-[500px]">
							<!-- Zero line -->
							<line x1="40" y1="120" x2="460" y2="120" stroke="#e5e7eb" stroke-width="2" />

							<!-- Bars -->
							{#each getBarChartData() as bar}
								<rect
									x={bar.x + 60}
									y={bar.y}
									width={bar.width}
									height={bar.height}
									fill={bar.color}
									class="cursor-pointer transition-opacity hover:opacity-80"
								>
									<title>{bar.week}: {formatCurrency(bar.pnl)}</title>
								</rect>

								<!-- Week label -->
								<text
									x={bar.x + 60 + bar.width / 2}
									y="230"
									font-size="10"
									fill="#6b7280"
									text-anchor="middle"
								>
									{bar.week.split('-W')[1]}
								</text>
							{/each}

							<!-- Axis labels -->
							<text x="20" y="20" font-size="12" fill="#6b7280">$</text>
							<text x="250" y="15" font-size="12" fill="#6b7280" text-anchor="middle">Week</text>
						</svg>
					</div>
				{/if}
			</div>

			<!-- Trading Statistics -->
			<div class="card">
				<h3 class="mb-4 text-lg font-semibold text-gray-900">Statistics</h3>
				<div class="space-y-4">
					<div class="flex items-center justify-between">
						<span class="text-gray-600">Average Win</span>
						<span class="text-profit font-semibold">
							{formatCurrency(analytics?.averageWin || 0)}
						</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-gray-600">Average Loss</span>
						<span class="text-loss font-semibold">
							{formatCurrency(analytics?.averageLoss || 0)}
						</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-gray-600">Best Trade</span>
						<span class="text-profit font-semibold">
							{formatCurrency(analytics?.bestTrade?.netPnl || 0)}
						</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-gray-600">Worst Trade</span>
						<span class="text-loss font-semibold">
							{formatCurrency(analytics?.worstTrade?.netPnl || 0)}
						</span>
					</div>
					<div class="flex items-center justify-between border-t border-gray-200 pt-4">
						<div class="flex items-center gap-2">
							<Clock class="h-4 w-4 text-gray-500" />
							<span class="text-gray-600">Avg Hold Time</span>
						</div>
						<span class="font-semibold text-gray-900">
							{formatTime(analytics?.avgHoldTime || 0)}
						</span>
					</div>
				</div>
			</div>
		</div>

		<!-- Performance Details & Streaks -->
		<div class="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
			<!-- Advanced Metrics -->
			<div class="card">
				<h3 class="mb-4 text-lg font-semibold text-gray-900">Advanced Metrics</h3>
				<div class="space-y-4">
					<div class="flex items-center justify-between">
						<span class="text-gray-600">Win/Loss Ratio</span>
						<span class="font-semibold text-gray-900">
							{analytics?.winLossRatio.toFixed(2)}
						</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-gray-600">Average R:R</span>
						<span class="font-semibold text-gray-900">
							{analytics?.avgRR.toFixed(2)}
						</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-gray-600">Sharpe Ratio</span>
						<span class="font-semibold text-gray-900">
							{analytics?.sharpeRatio.toFixed(2)}
						</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-gray-600">Max Drawdown</span>
						<span class="text-loss font-semibold">
							{formatCurrency(analytics?.maxDrawdown || 0)}
						</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-gray-600">Recovery Factor</span>
						<span class="font-semibold text-gray-900">
							{analytics?.recoveryFactor.toFixed(2)}
						</span>
					</div>
				</div>
			</div>

			<!-- Streaks -->
			<div class="card">
				<h3 class="mb-4 text-lg font-semibold text-gray-900">Streaks & Consistency</h3>
				<div class="space-y-4">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<Award class="text-profit h-5 w-5" />
							<span class="text-gray-600">Consecutive Wins</span>
						</div>
						<span class="font-semibold text-gray-900">
							{analytics?.consecutiveWins || 0}
						</span>
					</div>
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<AlertCircle class="text-loss h-5 w-5" />
							<span class="text-gray-600">Consecutive Losses</span>
						</div>
						<span class="font-semibold text-gray-900">
							{analytics?.consecutiveLosses || 0}
						</span>
					</div>
					<div class="flex items-center justify-between border-t border-gray-200 pt-4">
						<span class="text-gray-600">Total Trades</span>
						<span class="font-semibold text-gray-900">
							{analytics?.totalTrades || 0}
						</span>
					</div>
				</div>
			</div>
		</div>

		<!-- Recent Trades -->
		<div class="card">
			<div class="mb-4 flex items-center justify-between">
				<h3 class="text-lg font-semibold text-gray-900">Recent Trades</h3>
				<a href="/log" class="text-primary-600 hover:text-primary-700 text-sm"> View All </a>
			</div>

			{#if recentTrades.length === 0}
				<div class="py-12 text-center text-gray-500">
					No trades yet. <a href="/log" class="text-primary-600 hover:text-primary-700"
						>Add your first trade</a
					>
				</div>
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full">
						<thead>
							<tr class="border-b border-gray-200">
								<th class="px-4 py-3 text-left text-sm font-medium text-gray-600">Date</th>
								<th class="px-4 py-3 text-left text-sm font-medium text-gray-600">Symbol</th>
								<th class="px-4 py-3 text-left text-sm font-medium text-gray-600">Type</th>
								<th class="px-4 py-3 text-right text-sm font-medium text-gray-600">Entry</th>
								<th class="px-4 py-3 text-right text-sm font-medium text-gray-600">Exit</th>
								<th class="px-4 py-3 text-right text-sm font-medium text-gray-600">R:R</th>
								<th class="px-4 py-3 text-right text-sm font-medium text-gray-600">P&L</th>
							</tr>
						</thead>
						<tbody>
							{#each recentTrades as trade}
								<tr class="border-b border-gray-100 hover:bg-gray-50">
									<td class="px-4 py-3 text-sm text-gray-900">
										{new Date(trade.exitDate || trade.entryDate).toLocaleDateString()}
									</td>
									<td class="px-4 py-3 text-sm font-medium text-gray-900">
										{trade.symbol}
									</td>
									<td class="px-4 py-3">
										<span
											class="inline-flex items-center rounded px-2 py-1 text-xs font-medium {trade.type ===
											'long'
												? 'bg-green-100 text-green-800'
												: 'bg-red-100 text-red-800'}"
										>
											{trade.type.toUpperCase()}
										</span>
									</td>
									<td class="px-4 py-3 text-right text-sm text-gray-900">
										${trade.entryPrice.toFixed(2)}
									</td>
									<td class="px-4 py-3 text-right text-sm text-gray-900">
										${trade.exitPrice?.toFixed(2) || '-'}
									</td>
									<td class="px-4 py-3 text-right text-sm text-gray-900">
										{trade.actualRR > 0 ? trade.actualRR.toFixed(2) : '-'}
									</td>
									<td
										class="px-4 py-3 text-right text-sm font-semibold {trade.netPnl >= 0
											? 'text-profit'
											: 'text-loss'}"
									>
										{formatCurrency(trade.netPnl)}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	{/if}
</div>
