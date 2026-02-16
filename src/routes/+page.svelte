<script lang="ts">
	import { onMount } from 'svelte';
	import { selectedAccountId } from '$lib/stores';
	import {
		formatCurrency,
		formatPercentage,
		calculateAnalytics,
		formatTime
	} from '$lib/utils/analytics';
	import type { AIInsight } from '$lib/utils/aiAnalyzer';
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
		Clock,
		Sparkles,
		TrendingDown as TrendingDownIcon,
		TrendingUp as TrendingUpIcon,
		CheckCircle,
		XCircle,
		Info,
		AlertTriangle
	} from 'lucide-svelte';
	import type { Account, Trade } from '$lib/types';

	let account = $state<Account | null>(null);
	let trades = $state<Trade[]>([]);
	let analytics = $state<any>(null);
	let loading = $state(true);
	let aiInsights = $state<AIInsight[]>([]);
	let loadingAI = $state(false);

	// Chart interaction states
	let hoveredEquityPoint = $state<{ date: string; equity: number; x: number; y: number } | null>(
		null
	);
	let hoveredPieSegment = $state<string | null>(null);
	let hoveredBar = $state<{ week: string; pnl: number } | null>(null);
	let selectedChartPeriod = $state<'week' | 'month'>('week');

	// Chart data
	let equityCurveData = $state<{ date: string; equity: number }[]>([]);
	let weeklyPnlData = $state<{ week: string; pnl: number }[]>([]);
	let monthlyPnlData = $state<{ month: string; pnl: number }[]>([]);

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

			calculateEquityCurve();
			weeklyPnlData = analytics.pnlByWeek.slice(-8);
			monthlyPnlData = analytics.pnlByMonth.slice(-6);

			// Load AI analysis
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

	const outcomeData = $derived(() => {
		if (!analytics) return { wins: 0, losses: 0, breakeven: 0 };
		const closedTrades = trades.filter((t) => t.status === 'closed');
		return {
			wins: closedTrades.filter((t) => t.outcome === 'win').length,
			losses: closedTrades.filter((t) => t.outcome === 'loss').length,
			breakeven: closedTrades.filter((t) => t.outcome === 'breakeven').length
		};
	});

	function getPieSegments() {
		const data = outcomeData();
		const total = data.wins + data.losses + data.breakeven;
		if (total === 0) return [];

		const segments = [];
		let currentAngle = 0;

		const colors = { wins: '#10b981', losses: '#ef4444', breakeven: '#6b7280' };
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

	function getBarChartData() {
		const data = selectedChartPeriod === 'week' ? weeklyPnlData : monthlyPnlData;
		if (data.length === 0) return [];

		const maxPnl = Math.max(...data.map((d) => Math.abs(d.pnl)));
		const chartHeight = 200;
		const barWidth = selectedChartPeriod === 'week' ? 40 : 60;
		const gap = 10;

		return data.map((d, i) => {
			const height = (Math.abs(d.pnl) / maxPnl) * (chartHeight - 40);
			const y = d.pnl >= 0 ? chartHeight / 2 - height : chartHeight / 2;
			return {
				x: i * (barWidth + gap),
				y,
				width: barWidth,
				height,
				pnl: d.pnl,
				period: selectedChartPeriod === 'week' ? d.week : d.month,
				color: d.pnl >= 0 ? '#10b981' : '#ef4444'
			};
		});
	}

	function getEquityCurvePath() {
		if (equityCurveData.length === 0) return '';

		const width = 600;
		const height = 200;
		const padding = 60;

		const xScale = (width - padding * 2) / (equityCurveData.length - 1);
		const minEquity = Math.min(...equityCurveData.map((d) => d.equity));
		const maxEquity = Math.max(...equityCurveData.map((d) => d.equity));
		const yRange = maxEquity - minEquity || 1;
		const yScale = (height - padding * 2) / yRange;

		let path = '';
		equityCurveData.forEach((point, i) => {
			const x = padding + i * xScale;
			const y = height - padding - (point.equity - minEquity) * yScale;
			path += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
		});

		return path;
	}

	function getEquityCurvePoints() {
		if (equityCurveData.length === 0) return [];

		const width = 600;
		const height = 200;
		const padding = 60;

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

	function getYAxisLabels() {
		if (equityCurveData.length === 0) return [];

		const minEquity = Math.min(...equityCurveData.map((d) => d.equity));
		const maxEquity = Math.max(...equityCurveData.map((d) => d.equity));
		const range = maxEquity - minEquity;
		const step = range / 4;

		return [maxEquity, maxEquity - step, maxEquity - step * 2, maxEquity - step * 3, minEquity];
	}

	function getXAxisLabels() {
		if (equityCurveData.length === 0) return [];

		const points = 5;
		const step = Math.floor(equityCurveData.length / (points - 1));
		const labels = [];

		for (let i = 0; i < points; i++) {
			const index = Math.min(i * step, equityCurveData.length - 1);
			const date = new Date(equityCurveData[index].date);
			labels.push({
				text: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
				x: 60 + index * ((600 - 120) / (equityCurveData.length - 1))
			});
		}

		return labels;
	}

	function getInsightIcon(type: string) {
		switch (type) {
			case 'success':
				return CheckCircle;
			case 'warning':
				return AlertTriangle;
			case 'danger':
				return XCircle;
			case 'info':
				return Info;
			default:
				return Sparkles;
		}
	}

	function getInsightColor(type: string) {
		switch (type) {
			case 'success':
				return 'border-l-4 border-green-500 bg-green-50';
			case 'warning':
				return 'border-l-4 border-yellow-500 bg-yellow-50';
			case 'danger':
				return 'border-l-4 border-red-500 bg-red-50';
			case 'info':
				return 'border-l-4 border-blue-500 bg-blue-50';
			default:
				return 'border-l-4 border-purple-500 bg-purple-50';
		}
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

		<!-- AI Insights Panel -->
		{#if loadingAI}
			<div class="card from-primary-50 border-primary-200 mb-8 bg-gradient-to-r to-blue-50">
				<div class="flex items-center gap-3">
					<Sparkles class="text-primary-600 h-6 w-6 animate-pulse" />
					<div class="flex-1">
						<h3 class="text-lg font-semibold text-gray-900">Analyzing your trades...</h3>
						<p class="mt-1 text-sm text-gray-600">
							AI is processing your data to generate personalized insights
						</p>
					</div>
				</div>
			</div>
		{:else if aiInsights.length > 0}
			<div class="mb-8">
				<div class="mb-4 flex items-center gap-2">
					<Sparkles class="text-primary-600 h-6 w-6" />
					<h3 class="text-xl font-semibold text-gray-900">AI-Powered Insights</h3>
					<span class="text-sm text-gray-500">({aiInsights.length} insights found)</span>
				</div>
				<div class="space-y-3">
					{#each aiInsights.slice(0, 5) as insight}
						<div class="card {getInsightColor(insight.type)} transition-shadow hover:shadow-md">
							<div class="flex items-start gap-3">
								<svelte:component
									this={getInsightIcon(insight.type)}
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
										<p class="text-sm font-medium text-gray-900">💡 Action: {insight.actionable}</p>
									</div>
									{#if insight.metrics}
										<div class="mt-2 text-xs text-gray-500">
											<span class="font-medium">Data:</span>
											{JSON.stringify(insight.metrics)}
										</div>
									{/if}
								</div>
							</div>
						</div>
					{/each}
					{#if aiInsights.length > 5}
						<button class="text-primary-600 hover:text-primary-700 w-full py-2 text-center text-sm">
							View {aiInsights.length - 5} more insights →
						</button>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Stats Grid -->
		<div class="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
			<div class="card transition-shadow hover:shadow-md">
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

			<div class="card transition-shadow hover:shadow-md">
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

			<div class="card transition-shadow hover:shadow-md">
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

			<div class="card transition-shadow hover:shadow-md">
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

		<!-- Charts Row: Equity Curve & Outcome Distribution -->
		<div class="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
			<!-- Enhanced Equity Curve -->
			<div class="card transition-shadow hover:shadow-md lg:col-span-2">
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
						<svg width="100%" height="280" viewBox="0 0 600 280" class="min-w-[600px]">
							<!-- Y-axis labels -->
							{#each getYAxisLabels() as label, i}
								<text x="10" y={40 + i * 40} font-size="10" fill="#6b7280" text-anchor="start">
									{formatCurrency(label).replace('.00', '')}
								</text>
								<line
									x1="50"
									y1={40 + i * 40}
									x2="560"
									y2={40 + i * 40}
									stroke="#e5e7eb"
									stroke-dasharray="4"
									stroke-width="1"
								/>
							{/each}

							<!-- Axes -->
							<line x1="50" y1="40" x2="50" y2="200" stroke="#9ca3af" stroke-width="2" />
							<line x1="50" y1="200" x2="560" y2="200" stroke="#9ca3af" stroke-width="2" />

							<!-- X-axis labels -->
							{#each getXAxisLabels() as label}
								<text x={label.x} y="220" font-size="10" fill="#6b7280" text-anchor="middle">
									{label.text}
								</text>
							{/each}

							<!-- Gradient fill -->
							<defs>
								<linearGradient id="equityGradient" x1="0%" y1="0%" x2="0%" y2="100%">
									<stop offset="0%" style="stop-color:#0284c7;stop-opacity:0.3" />
									<stop offset="100%" style="stop-color:#0284c7;stop-opacity:0.05" />
								</linearGradient>
							</defs>
							<path
								d={getEquityCurvePath() + ' L 560 200 L 50 200 Z'}
								fill="url(#equityGradient)"
							/>

							<!-- Equity line -->
							<path d={getEquityCurvePath()} fill="none" stroke="#0284c7" stroke-width="3" />

							<!-- Points -->
							{#each getEquityCurvePoints() as point}
								<circle
									cx={point.x}
									cy={point.y}
									r={hoveredEquityPoint?.date === point.date ? 6 : 4}
									fill="#0284c7"
									stroke="white"
									stroke-width="2"
									class="cursor-pointer transition-all"
									onmouseenter={() => (hoveredEquityPoint = point)}
									onmouseleave={() => (hoveredEquityPoint = null)}
								/>
							{/each}

							<!-- Axis labels -->
							<text
								x="300"
								y="250"
								font-size="11"
								fill="#6b7280"
								text-anchor="middle"
								font-weight="500">Date</text
							>
							<text
								x="25"
								y="20"
								font-size="11"
								fill="#6b7280"
								text-anchor="middle"
								font-weight="500">Balance</text
							>
						</svg>

						{#if hoveredEquityPoint}
							<div class="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
								<div class="flex items-center justify-between">
									<div>
										<span class="text-sm font-medium text-gray-700">Date:</span>
										<span class="ml-2 text-sm text-gray-900">{hoveredEquityPoint.date}</span>
									</div>
									<div>
										<span class="text-sm font-medium text-gray-700">Balance:</span>
										<span class="text-primary-600 ml-2 text-sm font-bold">
											{formatCurrency(hoveredEquityPoint.equity)}
										</span>
									</div>
								</div>
							</div>
						{/if}
					</div>
				{/if}
			</div>

			<!-- Outcome Pie Chart -->
			<div class="card transition-shadow hover:shadow-md">
				<div class="mb-6 flex items-center justify-between">
					<div>
						<h3 class="text-lg font-semibold text-gray-900">Outcomes</h3>
						<p class="text-sm text-gray-500">Win/Loss/Breakeven</p>
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
									d={describeArc(
										100,
										100,
										hoveredPieSegment === segment.label ? 85 : 80,
										segment.startAngle,
										segment.endAngle
									)}
									fill={segment.color}
									class="cursor-pointer transition-all duration-200"
									onmouseenter={() => (hoveredPieSegment = segment.label)}
									onmouseleave={() => (hoveredPieSegment = null)}
									opacity={hoveredPieSegment === null || hoveredPieSegment === segment.label
										? 1
										: 0.5}
								/>
							{/each}
							<circle cx="100" cy="100" r="50" fill="white" />
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
							<text x="100" y="115" text-anchor="middle" font-size="12" fill="#6b7280"
								>Win Rate</text
							>
						</svg>

						<div class="mt-4 w-full space-y-2">
							{#each getPieSegments() as segment}
								<div
									class="flex cursor-pointer items-center justify-between rounded p-2 text-sm transition-colors"
									class:bg-gray-100={hoveredPieSegment === segment.label}
									onmouseenter={() => (hoveredPieSegment = segment.label)}
									onmouseleave={() => (hoveredPieSegment = null)}
								>
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

		<!-- Period Performance Chart -->
		<div class="card mb-8 transition-shadow hover:shadow-md">
			<div class="mb-6 flex items-center justify-between">
				<div>
					<h3 class="text-lg font-semibold text-gray-900">Performance Over Time</h3>
					<p class="text-sm text-gray-500">P&L by period</p>
				</div>
				<div class="flex gap-2">
					<button
						onclick={() => (selectedChartPeriod = 'week')}
						class="rounded px-3 py-1 text-xs font-medium transition-colors {selectedChartPeriod ===
						'week'
							? 'bg-primary-600 text-white'
							: 'bg-gray-200 text-gray-700'}"
					>
						Week
					</button>
					<button
						onclick={() => (selectedChartPeriod = 'month')}
						class="rounded px-3 py-1 text-xs font-medium transition-colors {selectedChartPeriod ===
						'month'
							? 'bg-primary-600 text-white'
							: 'bg-gray-200 text-gray-700'}"
					>
						Month
					</button>
				</div>
			</div>

			{#if getBarChartData().length === 0}
				<div class="py-12 text-center text-gray-500">No period data yet</div>
			{:else}
				<div class="overflow-x-auto">
					<svg width="100%" height="260" viewBox="0 0 500 260" class="min-w-[500px]">
						<line x1="40" y1="120" x2="460" y2="120" stroke="#9ca3af" stroke-width="2" />

						{#each getBarChartData() as bar}
							<rect
								x={bar.x + 60}
								y={bar.y}
								width={bar.width}
								height={bar.height}
								fill={bar.color}
								class="cursor-pointer transition-all duration-200"
								opacity={hoveredBar?.period === bar.period ? 1 : 0.8}
								onmouseenter={() => (hoveredBar = bar)}
								onmouseleave={() => (hoveredBar = null)}
							/>
							<text
								x={bar.x + 60 + bar.width / 2}
								y="250"
								font-size="10"
								fill="#6b7280"
								text-anchor="middle"
							>
								{selectedChartPeriod === 'week'
									? bar.period.split('-W')[1]
									: bar.period.split('-')[1]}
							</text>
						{/each}
					</svg>

					{#if hoveredBar}
						<div class="mt-2 rounded bg-gray-100 p-2 text-sm">
							<span class="font-medium">{hoveredBar.period}:</span>
							<span
								class="ml-2 font-bold"
								class:text-profit={hoveredBar.pnl >= 0}
								class:text-loss={hoveredBar.pnl < 0}
							>
								{formatCurrency(hoveredBar.pnl)}
							</span>
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Recent Trades -->
		<div class="card transition-shadow hover:shadow-md">
			<div class="mb-4 flex items-center justify-between">
				<h3 class="text-lg font-semibold text-gray-900">Recent Trades</h3>
				<a href="/log" class="text-primary-600 hover:text-primary-700 text-sm">View All</a>
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
								<tr class="border-b border-gray-100 transition-colors hover:bg-gray-50">
									<td class="px-4 py-3 text-sm text-gray-900">
										{new Date(trade.exitDate || trade.entryDate).toLocaleDateString()}
									</td>
									<td class="px-4 py-3 text-sm font-medium text-gray-900">{trade.symbol}</td>
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
									<td class="px-4 py-3 text-right text-sm text-gray-900"
										>${trade.entryPrice.toFixed(2)}</td
									>
									<td class="px-4 py-3 text-right text-sm text-gray-900"
										>${trade.exitPrice?.toFixed(2) || '-'}</td
									>
									<td class="px-4 py-3 text-right text-sm text-gray-900"
										>{trade.actualRR > 0 ? trade.actualRR.toFixed(2) : '-'}</td
									>
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
