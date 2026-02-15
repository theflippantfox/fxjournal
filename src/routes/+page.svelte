<script lang="ts">
	import { onMount } from 'svelte';
	import { selectedAccountId } from '$lib/stores';
	import { formatCurrency, formatPercentage, calculateAnalytics } from '$lib/utils/analytics';
	import { 
		TrendingUp, 
		TrendingDown, 
		DollarSign, 
		Target, 
		Activity,
		Award,
		AlertCircle 
	} from 'lucide-svelte';
	import type { Account, Trade } from '$lib/types';

	let account = $state<Account | null>(null);
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
			const [accountRes, tradesRes] = await Promise.all([
				fetch('/api/accounts'),
				fetch(`/api/trades?accountId=${accountId}`)
			]);

			const accounts = await accountRes.json();
			account = accounts.find((a: Account) => a.id === accountId);
			trades = await tradesRes.json();
			analytics = calculateAnalytics(trades);
		} catch (error) {
			console.error('Error loading data:', error);
		} finally {
			loading = false;
		}
	}

	const recentTrades = $derived(
		trades
			.sort((a, b) => new Date(b.exitDate).getTime() - new Date(a.exitDate).getTime())
			.slice(0, 5)
	);
</script>

<svelte:head>
	<title>Dashboard - TradeJournal</title>
</svelte:head>

<div class="p-8">
	{#if loading}
		<div class="flex items-center justify-center h-64">
			<div class="text-gray-500">Loading...</div>
		</div>
	{:else if !account}
		<div class="flex flex-col items-center justify-center h-64">
			<AlertCircle class="w-16 h-16 text-gray-400 mb-4" />
			<h2 class="text-xl font-semibold text-gray-900 mb-2">No Account Selected</h2>
			<p class="text-gray-500 mb-4">Please create an account to get started</p>
			<a href="/settings" class="btn btn-primary">Go to Settings</a>
		</div>
	{:else}
		<!-- Header -->
		<div class="mb-8">
			<h1 class="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
			<p class="text-gray-600">Overview of {account.name}</p>
		</div>

		<!-- Stats Grid -->
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
			<!-- Account Balance -->
			<div class="card">
				<div class="flex items-center justify-between mb-2">
					<span class="text-sm text-gray-600">Balance</span>
					<DollarSign class="w-5 h-5 text-gray-400" />
				</div>
				<div class="text-2xl font-bold text-gray-900">
					{formatCurrency(account.balance)}
				</div>
				<div class="text-sm text-gray-500 mt-1">
					Invested: {formatCurrency(account.investedAmount)}
				</div>
			</div>

			<!-- Total P&L -->
			<div class="card">
				<div class="flex items-center justify-between mb-2">
					<span class="text-sm text-gray-600">Total P&L</span>
					{#if account.totalPnl >= 0}
						<TrendingUp class="w-5 h-5 text-profit" />
					{:else}
						<TrendingDown class="w-5 h-5 text-loss" />
					{/if}
				</div>
				<div class="text-2xl font-bold {account.totalPnl >= 0 ? 'text-profit' : 'text-loss'}">
					{formatCurrency(account.totalPnl)}
				</div>
				<div class="text-sm text-gray-500 mt-1">
					{formatPercentage((account.totalPnl / account.investedAmount) * 100)}
				</div>
			</div>

			<!-- Win Rate -->
			<div class="card">
				<div class="flex items-center justify-between mb-2">
					<span class="text-sm text-gray-600">Win Rate</span>
					<Target class="w-5 h-5 text-gray-400" />
				</div>
				<div class="text-2xl font-bold text-gray-900">
					{analytics?.winRate.toFixed(1)}%
				</div>
				<div class="text-sm text-gray-500 mt-1">
					{analytics?.totalTrades} total trades
				</div>
			</div>

			<!-- Profit Factor -->
			<div class="card">
				<div class="flex items-center justify-between mb-2">
					<span class="text-sm text-gray-600">Profit Factor</span>
					<Activity class="w-5 h-5 text-gray-400" />
				</div>
				<div class="text-2xl font-bold text-gray-900">
					{analytics?.profitFactor === Infinity ? '∞' : analytics?.profitFactor.toFixed(2)}
				</div>
				<div class="text-sm text-gray-500 mt-1">
					Expectancy: {formatCurrency(analytics?.expectancy || 0)}
				</div>
			</div>
		</div>

		<!-- Performance Metrics -->
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
			<!-- Trading Stats -->
			<div class="card">
				<h3 class="text-lg font-semibold text-gray-900 mb-4">Trading Statistics</h3>
				<div class="space-y-4">
					<div class="flex justify-between items-center">
						<span class="text-gray-600">Average Win</span>
						<span class="font-semibold text-profit">
							{formatCurrency(analytics?.averageWin || 0)}
						</span>
					</div>
					<div class="flex justify-between items-center">
						<span class="text-gray-600">Average Loss</span>
						<span class="font-semibold text-loss">
							{formatCurrency(analytics?.averageLoss || 0)}
						</span>
					</div>
					<div class="flex justify-between items-center">
						<span class="text-gray-600">Best Trade</span>
						<span class="font-semibold text-profit">
							{formatCurrency(analytics?.bestTrade?.pnl || 0)}
						</span>
					</div>
					<div class="flex justify-between items-center">
						<span class="text-gray-600">Worst Trade</span>
						<span class="font-semibold text-loss">
							{formatCurrency(analytics?.worstTrade?.pnl || 0)}
						</span>
					</div>
				</div>
			</div>

			<!-- Streaks -->
			<div class="card">
				<h3 class="text-lg font-semibold text-gray-900 mb-4">Streaks</h3>
				<div class="space-y-4">
					<div class="flex justify-between items-center">
						<div class="flex items-center gap-2">
							<Award class="w-5 h-5 text-profit" />
							<span class="text-gray-600">Consecutive Wins</span>
						</div>
						<span class="font-semibold text-gray-900">
							{analytics?.consecutiveWins || 0}
						</span>
					</div>
					<div class="flex justify-between items-center">
						<div class="flex items-center gap-2">
							<AlertCircle class="w-5 h-5 text-loss" />
							<span class="text-gray-600">Consecutive Losses</span>
						</div>
						<span class="font-semibold text-gray-900">
							{analytics?.consecutiveLosses || 0}
						</span>
					</div>
				</div>
			</div>
		</div>

		<!-- Recent Trades -->
		<div class="card">
			<div class="flex items-center justify-between mb-4">
				<h3 class="text-lg font-semibold text-gray-900">Recent Trades</h3>
				<a href="/log" class="text-sm text-primary-600 hover:text-primary-700">
					View All
				</a>
			</div>
			
			{#if recentTrades.length === 0}
				<div class="text-center py-12 text-gray-500">
					No trades yet. <a href="/log" class="text-primary-600 hover:text-primary-700">Add your first trade</a>
				</div>
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full">
						<thead>
							<tr class="border-b border-gray-200">
								<th class="text-left py-3 px-4 text-sm font-medium text-gray-600">Date</th>
								<th class="text-left py-3 px-4 text-sm font-medium text-gray-600">Symbol</th>
								<th class="text-left py-3 px-4 text-sm font-medium text-gray-600">Type</th>
								<th class="text-right py-3 px-4 text-sm font-medium text-gray-600">Entry</th>
								<th class="text-right py-3 px-4 text-sm font-medium text-gray-600">Exit</th>
								<th class="text-right py-3 px-4 text-sm font-medium text-gray-600">P&L</th>
							</tr>
						</thead>
						<tbody>
							{#each recentTrades as trade}
								<tr class="border-b border-gray-100 hover:bg-gray-50">
									<td class="py-3 px-4 text-sm text-gray-900">
										{new Date(trade.exitDate).toLocaleDateString()}
									</td>
									<td class="py-3 px-4 text-sm font-medium text-gray-900">
										{trade.symbol}
									</td>
									<td class="py-3 px-4">
										<span class="inline-flex items-center px-2 py-1 rounded text-xs font-medium {trade.type === 'long' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
											{trade.type.toUpperCase()}
										</span>
									</td>
									<td class="py-3 px-4 text-sm text-gray-900 text-right">
										${trade.entryPrice.toFixed(2)}
									</td>
									<td class="py-3 px-4 text-sm text-gray-900 text-right">
										${trade.exitPrice.toFixed(2)}
									</td>
									<td class="py-3 px-4 text-sm font-semibold text-right {trade.pnl >= 0 ? 'text-profit' : 'text-loss'}">
										{formatCurrency(trade.pnl)}
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
