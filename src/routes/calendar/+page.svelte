<script lang="ts">
	import { onMount } from 'svelte';
	import { selectedAccountId } from '$lib/stores';
	import { formatCurrency } from '$lib/utils/analytics';
	import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown } from 'lucide-svelte';
	import type { Trade } from '$lib/types';

	let trades = $state<Trade[]>([]);
	let currentDate = $state(new Date());
	let loading = $state(true);
	let selectedDay = $state<string | null>(null);
	let dayTrades = $state<Trade[]>([]);

	// Get calendar data
	let calendarData = $state<{
		[date: string]: { pnl: number; trades: number; wins: number; losses: number };
	}>({});

	$effect(() => {
		loadData($selectedAccountId);
	});

	async function loadData(accountId: string) {
		if (!accountId) return;

		loading = true;
		try {
			const res = await fetch(`/api/trades?accountId=${accountId}`);
			trades = await res.json();
			processCalendarData();
		} catch (error) {
			console.error('Error loading trades:', error);
		} finally {
			loading = false;
		}
	}

	function processCalendarData() {
		const data: { [date: string]: { pnl: number; trades: number; wins: number; losses: number } } =
			{};

		trades.forEach((trade) => {
			if (trade.status === 'closed' && trade.exitDate) {
				const date = trade.exitDate.split('T')[0];
				if (!data[date]) {
					data[date] = { pnl: 0, trades: 0, wins: 0, losses: 0 };
				}
				data[date].pnl += trade.netPnl;
				data[date].trades += 1;
				if (trade.outcome === 'win') data[date].wins += 1;
				if (trade.outcome === 'loss') data[date].losses += 1;
			}
		});

		calendarData = data;
	}

	function getCalendarDays() {
		const year = currentDate.getFullYear();
		const month = currentDate.getMonth();

		const firstDay = new Date(year, month, 1);
		const lastDay = new Date(year, month + 1, 0);
		const daysInMonth = lastDay.getDate();
		const startDayOfWeek = firstDay.getDay();

		const days = [];

		// Add empty cells for days before month starts
		for (let i = 0; i < startDayOfWeek; i++) {
			days.push(null);
		}

		// Add days of the month
		for (let day = 1; day <= daysInMonth; day++) {
			const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
			days.push({
				day,
				dateStr,
				data: calendarData[dateStr]
			});
		}

		return days;
	}

	function previousMonth() {
		currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
	}

	function nextMonth() {
		currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
	}

	function today() {
		currentDate = new Date();
	}

	function selectDay(dateStr: string) {
		selectedDay = dateStr;
		dayTrades = trades.filter((t) => t.exitDate?.startsWith(dateStr));
	}

	function getDayColor(pnl: number) {
		if (pnl > 0) return 'bg-green-100 hover:bg-green-200 border-green-300';
		if (pnl < 0) return 'bg-red-100 hover:bg-red-200 border-red-300';
		return 'bg-gray-100 hover:bg-gray-200 border-gray-300';
	}

	const monthName = $derived(
		currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
	);

	const monthStats = $derived(() => {
		const days = getCalendarDays().filter((d) => d && d.data);
		const totalPnl = days.reduce((sum, d) => sum + (d!.data!.pnl || 0), 0);
		const totalTrades = days.reduce((sum, d) => sum + (d!.data!.trades || 0), 0);
		const profitableDays = days.filter((d) => d!.data!.pnl > 0).length;
		const unprofitableDays = days.filter((d) => d!.data!.pnl < 0).length;

		return {
			totalPnl,
			totalTrades,
			profitableDays,
			unprofitableDays,
			activeDays: days.length
		};
	});
</script>

<svelte:head>
	<title>Calendar - TradeJournal</title>
</svelte:head>

<div class="p-8">
	{#if loading}
		<div class="flex h-64 items-center justify-center">
			<div class="text-gray-500">Loading...</div>
		</div>
	{:else}
		<!-- Header -->
		<div class="mb-8">
			<h1 class="mb-2 text-3xl font-bold text-gray-900">Trading Calendar</h1>
			<p class="text-gray-600">Daily profit/loss and trade activity</p>
		</div>

		<!-- Month Stats -->
		<div class="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
			<div class="card">
				<span class="text-sm text-gray-600">Month P&L</span>
				<div
					class="text-2xl font-bold {monthStats().totalPnl >= 0 ? 'text-profit' : 'text-loss'} mt-1"
				>
					{formatCurrency(monthStats().totalPnl)}
				</div>
			</div>
			<div class="card">
				<span class="text-sm text-gray-600">Total Trades</span>
				<div class="mt-1 text-2xl font-bold text-gray-900">
					{monthStats().totalTrades}
				</div>
			</div>
			<div class="card">
				<span class="text-sm text-gray-600">Trading Days</span>
				<div class="mt-1 text-2xl font-bold text-gray-900">
					{monthStats().activeDays}
				</div>
			</div>
			<div class="card">
				<span class="text-sm text-gray-600">Profitable Days</span>
				<div class="text-profit mt-1 text-2xl font-bold">
					{monthStats().profitableDays}
				</div>
			</div>
			<div class="card">
				<span class="text-sm text-gray-600">Unprofitable Days</span>
				<div class="text-loss mt-1 text-2xl font-bold">
					{monthStats().unprofitableDays}
				</div>
			</div>
		</div>

		<!-- Calendar Navigation -->
		<div class="card mb-6">
			<div class="mb-6 flex items-center justify-between">
				<button onclick={previousMonth} class="rounded p-2 transition-colors hover:bg-gray-100">
					<ChevronLeft class="h-6 w-6 text-gray-600" />
				</button>
				<div class="flex items-center gap-3">
					<h2 class="text-xl font-semibold text-gray-900">{monthName}</h2>
					<button
						onclick={today}
						class="bg-primary-100 text-primary-700 hover:bg-primary-200 rounded px-3 py-1 text-sm transition-colors"
					>
						Today
					</button>
				</div>
				<button onclick={nextMonth} class="rounded p-2 transition-colors hover:bg-gray-100">
					<ChevronRight class="h-6 w-6 text-gray-600" />
				</button>
			</div>

			<!-- Calendar Grid -->
			<div class="grid grid-cols-7 gap-2">
				<!-- Day headers -->
				{#each ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as dayName}
					<div class="py-2 text-center text-sm font-semibold text-gray-600">
						{dayName}
					</div>
				{/each}

				<!-- Calendar days -->
				{#each getCalendarDays() as day}
					{#if day === null}
						<div class="aspect-square"></div>
					{:else}
						<button
							onclick={() => day.data && selectDay(day.dateStr)}
							class="aspect-square rounded-lg border-2 p-2 transition-all {day.data
								? getDayColor(day.data.pnl) + ' cursor-pointer'
								: 'cursor-default border-gray-200 bg-gray-50'} {selectedDay === day.dateStr
								? 'ring-primary-500 ring-2'
								: ''}"
						>
							<div class="text-sm font-semibold text-gray-900">{day.day}</div>
							{#if day.data}
								<div
									class="text-xs font-bold {day.data.pnl >= 0
										? 'text-green-700'
										: 'text-red-700'} mt-1"
								>
									{formatCurrency(day.data.pnl).replace('.00', '')}
								</div>
								<div class="mt-0.5 text-xs text-gray-600">
									{day.data.trades}
									{day.data.trades === 1 ? 'trade' : 'trades'}
								</div>
								<div class="mt-0.5 flex items-center justify-center gap-1">
									{#if day.data.wins > 0}
										<span class="text-xs text-green-700">{day.data.wins}W</span>
									{/if}
									{#if day.data.losses > 0}
										<span class="text-xs text-red-700">{day.data.losses}L</span>
									{/if}
								</div>
							{/if}
						</button>
					{/if}
				{/each}
			</div>
		</div>

		<!-- Selected Day Details -->
		{#if selectedDay && dayTrades.length > 0}
			<div class="card">
				<h3 class="mb-4 text-lg font-semibold text-gray-900">
					Trades on {new Date(selectedDay).toLocaleDateString('en-US', {
						month: 'long',
						day: 'numeric',
						year: 'numeric'
					})}
				</h3>

				<div class="overflow-x-auto">
					<table class="w-full">
						<thead>
							<tr class="border-b border-gray-200">
								<th class="px-4 py-3 text-left text-sm font-medium text-gray-600">Symbol</th>
								<th class="px-4 py-3 text-left text-sm font-medium text-gray-600">Type</th>
								<th class="px-4 py-3 text-right text-sm font-medium text-gray-600">Entry</th>
								<th class="px-4 py-3 text-right text-sm font-medium text-gray-600">Exit</th>
								<th class="px-4 py-3 text-right text-sm font-medium text-gray-600">Qty</th>
								<th class="px-4 py-3 text-left text-sm font-medium text-gray-600">Result</th>
								<th class="px-4 py-3 text-right text-sm font-medium text-gray-600">P&L</th>
							</tr>
						</thead>
						<tbody>
							{#each dayTrades as trade}
								<tr class="border-b border-gray-100 hover:bg-gray-50">
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
									<td class="px-4 py-3 text-right text-sm text-gray-900">{trade.quantity}</td>
									<td class="px-4 py-3">
										<span
											class="inline-flex items-center gap-1 text-xs font-medium {trade.outcome ===
											'win'
												? 'text-profit'
												: trade.outcome === 'loss'
													? 'text-loss'
													: 'text-gray-600'}"
										>
											{#if trade.outcome === 'win'}
												<TrendingUp class="h-3 w-3" />
											{:else if trade.outcome === 'loss'}
												<TrendingDown class="h-3 w-3" />
											{/if}
											{trade.outcome.toUpperCase()}
										</span>
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
			</div>
		{:else if selectedDay}
			<div class="card">
				<p class="py-8 text-center text-gray-500">No trades on this day</p>
			</div>
		{/if}
	{/if}
</div>
