<script lang="ts">
	import { onMount } from 'svelte';
	import { selectedAccountId } from '$lib/stores';
	import { formatCurrency, calculateAnalytics } from '$lib/utils/analytics';
	import { TrendingUp, Target, Award, BarChart3 } from 'lucide-svelte';
	import type { Trade } from '$lib/types';

	let trades = $state<Trade[]>([]);
	let analytics = $state<any>(null);
	let loading = $state(true);

	$effect(() => {
		loadData($selectedAccountId);
	});

	async function loadData(accountId: string) {
		if (!accountId) return;
		
		loading = true;
		try {
			const res = await fetch(`/api/trades?accountId=${accountId}`);
			trades = await res.json();
			analytics = calculateAnalytics(trades);
		} catch (error) {
			console.error('Error loading data:', error);
		} finally {
			loading = false;
		}
	}

	const topSymbols = $derived(
		analytics ? Object.entries(analytics.tradesBySymbol)
			.sort(([, a]: any, [, b]: any) => b - a)
			.slice(0, 5) : []
	);

	const setupPerformance = $derived(
		analytics ? Object.entries(analytics.tradesBySetup)
			.map(([setup, count]) => ({
				setup,
				count,
				winRate: analytics.winRateBySetup[setup] || 0
			}))
			.sort((a: any, b: any) => b.count - a.count) : []
	);
</script>

<svelte:head>
	<title>Analytics - TradeJournal</title>
</svelte:head>

<div class="p-8">
	{#if loading}
		<div class="flex items-center justify-center h-64">
			<div class="text-gray-500">Loading...</div>
		</div>
	{:else if !analytics}
		<div class="text-center py-12 text-gray-500">
			No data available. Start adding trades to see analytics.
		</div>
	{:else}
		<!-- Header -->
		<div class="mb-8">
			<h1 class="text-3xl font-bold text-gray-900 mb-2">Analytics</h1>
			<p class="text-gray-600">Detailed performance analysis</p>
		</div>

		<!-- Key Metrics -->
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
			<div class="card">
				<div class="flex items-center justify-between mb-2">
					<span class="text-sm text-gray-600">Total Trades</span>
					<BarChart3 class="w-5 h-5 text-gray-400" />
				</div>
				<div class="text-2xl font-bold text-gray-900">
					{analytics.totalTrades}
				</div>
			</div>

			<div class="card">
				<div class="flex items-center justify-between mb-2">
					<span class="text-sm text-gray-600">Win Rate</span>
					<Target class="w-5 h-5 text-gray-400" />
				</div>
				<div class="text-2xl font-bold text-gray-900">
					{analytics.winRate.toFixed(1)}%
				</div>
			</div>

			<div class="card">
				<div class="flex items-center justify-between mb-2">
					<span class="text-sm text-gray-600">Profit Factor</span>
					<TrendingUp class="w-5 h-5 text-gray-400" />
				</div>
				<div class="text-2xl font-bold text-gray-900">
					{analytics.profitFactor === Infinity ? '∞' : analytics.profitFactor.toFixed(2)}
				</div>
			</div>

			<div class="card">
				<div class="flex items-center justify-between mb-2">
					<span class="text-sm text-gray-600">Expectancy</span>
					<Award class="w-5 h-5 text-gray-400" />
				</div>
				<div class="text-2xl font-bold text-gray-900">
					{formatCurrency(analytics.expectancy)}
				</div>
			</div>
		</div>

		<!-- Performance Details -->
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
			<!-- Win/Loss Analysis -->
			<div class="card">
				<h3 class="text-lg font-semibold text-gray-900 mb-4">Win/Loss Analysis</h3>
				<div class="space-y-4">
					<div class="flex justify-between items-center">
						<span class="text-gray-600">Average Win</span>
						<span class="font-semibold text-profit">
							{formatCurrency(analytics.averageWin)}
						</span>
					</div>
					<div class="flex justify-between items-center">
						<span class="text-gray-600">Average Loss</span>
						<span class="font-semibold text-loss">
							{formatCurrency(analytics.averageLoss)}
						</span>
					</div>
					<div class="flex justify-between items-center">
						<span class="text-gray-600">Best Trade</span>
						<div class="text-right">
							<div class="font-semibold text-profit">
								{formatCurrency(analytics.bestTrade?.pnl || 0)}
							</div>
							<div class="text-xs text-gray-500">
								{analytics.bestTrade?.symbol || '-'}
							</div>
						</div>
					</div>
					<div class="flex justify-between items-center">
						<span class="text-gray-600">Worst Trade</span>
						<div class="text-right">
							<div class="font-semibold text-loss">
								{formatCurrency(analytics.worstTrade?.pnl || 0)}
							</div>
							<div class="text-xs text-gray-500">
								{analytics.worstTrade?.symbol || '-'}
							</div>
						</div>
					</div>
					<div class="flex justify-between items-center pt-4 border-t border-gray-200">
						<span class="text-gray-600">Risk/Reward Ratio</span>
						<span class="font-semibold text-gray-900">
							{analytics.averageLoss > 0 
								? (analytics.averageWin / analytics.averageLoss).toFixed(2) 
								: 'N/A'}
						</span>
					</div>
				</div>
			</div>

			<!-- Streaks -->
			<div class="card">
				<h3 class="text-lg font-semibold text-gray-900 mb-4">Streaks & Consistency</h3>
				<div class="space-y-4">
					<div class="flex justify-between items-center">
						<span class="text-gray-600">Max Consecutive Wins</span>
						<span class="font-semibold text-profit">
							{analytics.consecutiveWins}
						</span>
					</div>
					<div class="flex justify-between items-center">
						<span class="text-gray-600">Max Consecutive Losses</span>
						<span class="font-semibold text-loss">
							{analytics.consecutiveLosses}
						</span>
					</div>
					<div class="flex justify-between items-center pt-4 border-t border-gray-200">
						<span class="text-gray-600">Total P&L</span>
						<span class="font-semibold {analytics.totalPnl >= 0 ? 'text-profit' : 'text-loss'}">
							{formatCurrency(analytics.totalPnl)}
						</span>
					</div>
				</div>
			</div>
		</div>

		<!-- Top Symbols -->
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
			<div class="card">
				<h3 class="text-lg font-semibold text-gray-900 mb-4">Most Traded Symbols</h3>
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
									<div class="w-32 bg-gray-200 rounded-full h-2">
										<div
											class="bg-primary-600 h-2 rounded-full"
											style="width: {(count / topSymbols[0][1]) * 100}%"
										></div>
									</div>
									<span class="text-sm text-gray-600 w-12 text-right">{count} trades</span>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Setup Performance -->
			<div class="card">
				<h3 class="text-lg font-semibold text-gray-900 mb-4">Setup Performance</h3>
				{#if setupPerformance.length === 0}
					<p class="text-gray-500">No setup data available</p>
				{:else}
					<div class="space-y-3">
						{#each setupPerformance as item}
							<div class="flex items-center justify-between">
								<div class="flex flex-col">
									<span class="font-medium text-gray-900">{item.setup || 'No Setup'}</span>
									<span class="text-xs text-gray-500">{item.count} trades</span>
								</div>
								<div class="text-right">
									<span class="font-semibold {item.winRate >= 50 ? 'text-profit' : 'text-loss'}">
										{item.winRate.toFixed(1)}%
									</span>
									<div class="text-xs text-gray-500">win rate</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<!-- P&L Chart -->
		<div class="card">
			<h3 class="text-lg font-semibold text-gray-900 mb-4">P&L Over Time</h3>
			{#if analytics.pnlByDay.length === 0}
				<p class="text-gray-500">No data available</p>
			{:else}
				<div class="space-y-2">
					{#each analytics.pnlByDay as day}
						<div class="flex items-center gap-4">
							<span class="text-sm text-gray-600 w-24">
								{new Date(day.date).toLocaleDateString()}
							</span>
							<div class="flex-1 flex items-center gap-2">
								<div class="flex-1 bg-gray-200 rounded-full h-6 overflow-hidden">
									{#if day.pnl >= 0}
										<div
											class="bg-profit h-6 rounded-full flex items-center justify-end pr-2"
											style="width: {Math.min((day.pnl / Math.max(...analytics.pnlByDay.map((d: any) => Math.abs(d.pnl)))) * 100, 100)}%"
										>
											<span class="text-xs text-white font-medium">
												{formatCurrency(day.pnl)}
											</span>
										</div>
									{:else}
										<div
											class="bg-loss h-6 rounded-full flex items-center justify-end pr-2"
											style="width: {Math.min((Math.abs(day.pnl) / Math.max(...analytics.pnlByDay.map((d: any) => Math.abs(d.pnl)))) * 100, 100)}%"
										>
											<span class="text-xs text-white font-medium">
												{formatCurrency(day.pnl)}
											</span>
										</div>
									{/if}
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>
