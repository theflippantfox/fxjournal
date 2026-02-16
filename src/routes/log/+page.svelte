<script lang="ts">
	import { onMount } from 'svelte';
	import { selectedAccountId } from '$lib/stores';
	import { formatCurrency } from '$lib/utils/analytics';
	import {
		calculatePnL,
		calculateRiskReward,
		determineOutcome,
		calculateActualRR,
		getTradingViewThumbnail
	} from '$lib/utils/tradeCalculations';
	import {
		Plus,
		Edit,
		Trash2,
		Filter,
		Search,
		X,
		TrendingUp,
		TrendingDown,
		Image as ImageIcon,
		CheckCircle2,
		XCircle,
		MinusCircle
	} from 'lucide-svelte';
	import type { Trade, Instrument, Strategy, ChecklistTemplate } from '$lib/types';

	let trades = $state<Trade[]>([]);
	let filteredTrades = $state<Trade[]>([]);
	let instruments = $state<Instrument[]>([]);
	let strategies = $state<Strategy[]>([]);
	let checklists = $state<ChecklistTemplate[]>([]);

	let showModal = $state(false);
	let editingTrade = $state<Trade | null>(null);
	let searchQuery = $state('');

	// Filter states
	let filterType = $state<'all' | 'long' | 'short'>('all');
	let filterOutcome = $state<'all' | 'win' | 'loss' | 'breakeven' | 'pending'>('all');
	let filterStatus = $state<'all' | 'open' | 'closed' | 'partial'>('all');
	let filterStrategy = $state<string>('all');
	let filterDateFrom = $state('');
	let filterDateTo = $state('');
	let showFilters = $state(false);

	let formData = $state({
		symbol: '',
		instrumentId: '',
		type: 'long' as 'long' | 'short',
		entryPrice: '',
		exitPrice: '',
		lotSize: '',
		quantity: '',
		stopLoss: '',
		takeProfit: '',
		entryDate: '',
		exitDate: '',
		status: 'closed' as 'open' | 'closed' | 'partial',
		fees: '',
		commissions: '',
		slippage: '',
		strategyId: '',
		emotion: 'neutral' as
			| 'confident'
			| 'fearful'
			| 'greedy'
			| 'neutral'
			| 'disciplined'
			| 'revenge'
			| 'fomo',
		timeOfDay: 'morning' as 'premarket' | 'morning' | 'midday' | 'afternoon' | 'afterhours',
		marketCondition: 'trending' as 'trending' | 'ranging' | 'volatile' | 'quiet',
		followedPlan: true,
		sessionQuality: 3 as 1 | 2 | 3 | 4 | 5,
		preTradeNotes: '',
		postTradeNotes: '',
		notes: '',
		tags: '',
		mistakes: '',
		lessonsLearned: '',
		chartBeforeUrl: '',
		chartAfterUrl: ''
	});

	let checklistItems = $state<{ [key: string]: boolean }>({});
	let calculatedPnL = $state<number>(0);
	let calculatedNetPnL = $state<number>(0);
	let calculatedRR = $state<number>(0);
	let expectedRR = $state<number>(0);

	$effect(() => {
		loadTrades($selectedAccountId);
	});

	$effect(() => {
		filterTrades();
	});

	$effect(() => {
		if (formData.entryPrice && formData.exitPrice && formData.lotSize && formData.quantity) {
			const result = calculatePnL(
				formData.type,
				parseFloat(formData.entryPrice),
				parseFloat(formData.exitPrice),
				parseFloat(formData.lotSize),
				parseFloat(formData.quantity),
				parseFloat(formData.fees || '0'),
				parseFloat(formData.commissions || '0'),
				parseFloat(formData.slippage || '0')
			);
			calculatedPnL = result.pnl;
			calculatedNetPnL = result.netPnl;
		}

		if (formData.entryPrice && formData.stopLoss && formData.takeProfit) {
			expectedRR = calculateRiskReward(
				parseFloat(formData.entryPrice),
				parseFloat(formData.stopLoss),
				parseFloat(formData.takeProfit),
				formData.type
			);
		}

		if (formData.entryPrice && formData.exitPrice && formData.stopLoss) {
			calculatedRR = calculateActualRR(
				parseFloat(formData.entryPrice),
				parseFloat(formData.exitPrice),
				parseFloat(formData.stopLoss),
				formData.type
			);
		}
	});

	onMount(async () => {
		await Promise.all([loadInstruments(), loadStrategies(), loadChecklists()]);
	});

	async function loadTrades(accountId: string) {
		if (!accountId) return;

		try {
			const res = await fetch(`/api/trades?accountId=${accountId}`);
			trades = await res.json();
			filterTrades();
		} catch (error) {
			console.error('Error loading trades:', error);
		}
	}

	async function loadInstruments() {
		try {
			const res = await fetch('/api/instruments');
			instruments = await res.json();
		} catch (error) {
			console.error('Error loading instruments:', error);
		}
	}

	async function loadStrategies() {
		try {
			const res = await fetch('/api/strategies');
			strategies = await res.json();
		} catch (error) {
			console.error('Error loading strategies:', error);
		}
	}

	async function loadChecklists() {
		try {
			const res = await fetch('/api/checklists');
			checklists = await res.json();
		} catch (error) {
			console.error('Error loading checklists:', error);
		}
	}

	function filterTrades() {
		let result = trades;

		if (filterType !== 'all') {
			result = result.filter((t) => t.type === filterType);
		}

		if (filterOutcome !== 'all') {
			result = result.filter((t) => t.outcome === filterOutcome);
		}

		if (filterStatus !== 'all') {
			result = result.filter((t) => t.status === filterStatus);
		}

		if (filterStrategy !== 'all') {
			result = result.filter((t) => t.strategyId === filterStrategy);
		}

		if (filterDateFrom) {
			result = result.filter((t) => t.entryDate >= filterDateFrom);
		}

		if (filterDateTo) {
			result = result.filter((t) => t.entryDate <= filterDateTo);
		}

		if (searchQuery) {
			result = result.filter(
				(t) =>
					t.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
					t.notes.toLowerCase().includes(searchQuery.toLowerCase())
			);
		}

		filteredTrades = result.sort((a, b) => {
			const dateA = a.exitDate || a.entryDate;
			const dateB = b.exitDate || b.entryDate;
			return new Date(dateB).getTime() - new Date(dateA).getTime();
		});
	}

	function resetFilters() {
		filterType = 'all';
		filterOutcome = 'all';
		filterStatus = 'all';
		filterStrategy = 'all';
		filterDateFrom = '';
		filterDateTo = '';
		searchQuery = '';
	}

	function openAddModal() {
		editingTrade = null;
		formData = {
			symbol: '',
			instrumentId: '',
			type: 'long',
			entryPrice: '',
			exitPrice: '',
			lotSize: '1',
			quantity: '',
			stopLoss: '',
			takeProfit: '',
			entryDate: '',
			exitDate: '',
			status: 'closed',
			fees: '0',
			commissions: '0',
			slippage: '0',
			strategyId: '',
			emotion: 'neutral',
			timeOfDay: 'morning',
			marketCondition: 'trending',
			followedPlan: true,
			sessionQuality: 3,
			preTradeNotes: '',
			postTradeNotes: '',
			notes: '',
			tags: '',
			mistakes: '',
			lessonsLearned: '',
			chartBeforeUrl: '',
			chartAfterUrl: ''
		};
		checklistItems = {};
		showModal = true;
	}

	function openEditModal(trade: Trade) {
		editingTrade = trade;
		formData = {
			symbol: trade.symbol,
			instrumentId: trade.instrumentId,
			type: trade.type,
			entryPrice: trade.entryPrice.toString(),
			exitPrice: trade.exitPrice?.toString() || '',
			lotSize: trade.lotSize.toString(),
			quantity: trade.quantity.toString(),
			stopLoss: trade.stopLoss.toString(),
			takeProfit: trade.takeProfit.toString(),
			entryDate: trade.entryDate.split('T')[0],
			exitDate: trade.exitDate?.split('T')[0] || '',
			status: trade.status,
			fees: trade.fees.toString(),
			commissions: trade.commissions.toString(),
			slippage: trade.slippage.toString(),
			strategyId: trade.strategyId,
			emotion: trade.emotion,
			timeOfDay: trade.timeOfDay,
			marketCondition: trade.marketCondition,
			followedPlan: trade.followedPlan,
			sessionQuality: trade.sessionQuality,
			preTradeNotes: trade.preTradeNotes,
			postTradeNotes: trade.postTradeNotes,
			notes: trade.notes,
			tags: trade.tags.join(', '),
			mistakes: trade.mistakes,
			lessonsLearned: trade.lessonsLearned,
			chartBeforeUrl: trade.chartBeforeUrl || '',
			chartAfterUrl: trade.chartAfterUrl || ''
		};
		checklistItems = trade.checklistItems || {};
		showModal = true;
	}

	async function handleChartUrlBlur(field: 'before' | 'after') {
		const url = field === 'before' ? formData.chartBeforeUrl : formData.chartAfterUrl;
		if (url && url.includes('tradingview.com')) {
			const thumbnail = await getTradingViewThumbnail(url);
			// Store thumbnail URL (in real implementation, you'd save this)
		}
	}

	async function handleSubmit() {
		const entryPrice = parseFloat(formData.entryPrice);
		const exitPrice = formData.exitPrice ? parseFloat(formData.exitPrice) : null;
		const lotSize = parseFloat(formData.lotSize);
		const quantity = parseFloat(formData.quantity);
		const stopLoss = parseFloat(formData.stopLoss);
		const takeProfit = parseFloat(formData.takeProfit);
		const fees = parseFloat(formData.fees || '0');
		const commissions = parseFloat(formData.commissions || '0');
		const slippage = parseFloat(formData.slippage || '0');

		let pnl = 0;
		let pnlPercentage = 0;
		let netPnl = 0;
		let outcome: 'win' | 'loss' | 'breakeven' | 'pending' = 'pending';
		let actualRR = 0;

		if (exitPrice && formData.status === 'closed') {
			const result = calculatePnL(
				formData.type,
				entryPrice,
				exitPrice,
				lotSize,
				quantity,
				fees,
				commissions,
				slippage
			);
			pnl = result.pnl;
			pnlPercentage = result.pnlPercentage;
			netPnl = result.netPnl;
			outcome = determineOutcome(netPnl);
			actualRR = calculateActualRR(entryPrice, exitPrice, stopLoss, formData.type);
		}

		const expectedRRValue = calculateRiskReward(entryPrice, stopLoss, takeProfit, formData.type);

		const checklistCompleted = Object.values(checklistItems).every((v) => v);

		const chartBeforeThumbnail = formData.chartBeforeUrl
			? await getTradingViewThumbnail(formData.chartBeforeUrl)
			: undefined;

		const chartAfterThumbnail = formData.chartAfterUrl
			? await getTradingViewThumbnail(formData.chartAfterUrl)
			: undefined;

		const tradeData = {
			accountId: $selectedAccountId,
			symbol: formData.symbol.toUpperCase(),
			instrumentId: formData.instrumentId,
			type: formData.type,
			entryPrice,
			exitPrice,
			lotSize,
			quantity,
			stopLoss,
			takeProfit,
			expectedRR: expectedRRValue,
			actualRR,
			entryDate: new Date(formData.entryDate).toISOString(),
			exitDate: formData.exitDate ? new Date(formData.exitDate).toISOString() : null,
			status: formData.status,
			outcome,
			pnl,
			pnlPercentage,
			fees,
			commissions,
			slippage,
			netPnl,
			notes: formData.notes,
			preTradeNotes: formData.preTradeNotes,
			postTradeNotes: formData.postTradeNotes,
			tags: formData.tags
				.split(',')
				.map((t) => t.trim())
				.filter(Boolean),
			strategyId: formData.strategyId,
			emotion: formData.emotion,
			timeOfDay: formData.timeOfDay,
			marketCondition: formData.marketCondition,
			followedPlan: formData.followedPlan,
			sessionQuality: formData.sessionQuality,
			mistakes: formData.mistakes,
			lessonsLearned: formData.lessonsLearned,
			chartBeforeUrl: formData.chartBeforeUrl || undefined,
			chartAfterUrl: formData.chartAfterUrl || undefined,
			chartBeforeThumbnail,
			chartAfterThumbnail,
			checklistCompleted,
			checklistItems,
			partialExits: []
		};

		try {
			if (editingTrade) {
				await fetch('/api/trades', {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ id: editingTrade.id, ...tradeData })
				});
			} else {
				await fetch('/api/trades', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(tradeData)
				});
			}

			showModal = false;
			await loadTrades($selectedAccountId);
		} catch (error) {
			console.error('Error saving trade:', error);
		}
	}

	async function deleteTrade(id: string) {
		if (!confirm('Are you sure you want to delete this trade?')) return;

		try {
			await fetch('/api/trades', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id })
			});

			await loadTrades($selectedAccountId);
		} catch (error) {
			console.error('Error deleting trade:', error);
		}
	}

	function getOutcomeIcon(outcome: string) {
		switch (outcome) {
			case 'win':
				return CheckCircle2;
			case 'loss':
				return XCircle;
			case 'breakeven':
				return MinusCircle;
			default:
				return MinusCircle;
		}
	}

	function getOutcomeColor(outcome: string) {
		switch (outcome) {
			case 'win':
				return 'text-profit';
			case 'loss':
				return 'text-loss';
			default:
				return 'text-gray-500';
		}
	}
</script>

<svelte:head>
	<title>Trade Log - TradeJournal</title>
</svelte:head>

<div class="p-8">
	<!-- Header -->
	<div class="mb-8 flex items-center justify-between">
		<div>
			<h1 class="mb-2 text-3xl font-bold text-gray-900">Trade Log</h1>
			<p class="text-gray-600">Track and manage all your trades</p>
		</div>
		<button onclick={openAddModal} class="btn btn-primary flex items-center gap-2">
			<Plus class="h-5 w-5" />
			Add Trade
		</button>
	</div>

	<!-- Filters -->
	<div class="card mb-6">
		<div class="flex flex-col gap-4">
			<!-- Search and Filter Toggle -->
			<div class="flex gap-4">
				<div class="relative flex-1">
					<Search
						class="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 transform text-gray-400"
					/>
					<input
						type="text"
						bind:value={searchQuery}
						placeholder="Search by symbol or notes..."
						class="input pl-10"
					/>
				</div>
				<button
					onclick={() => (showFilters = !showFilters)}
					class="btn btn-secondary flex items-center gap-2"
				>
					<Filter class="h-5 w-5" />
					Filters
					{#if filterType !== 'all' || filterOutcome !== 'all' || filterStatus !== 'all' || filterStrategy !== 'all' || filterDateFrom || filterDateTo}
						<span
							class="bg-primary-600 flex h-5 w-5 items-center justify-center rounded-full text-xs text-white"
						>
							{[
								filterType !== 'all',
								filterOutcome !== 'all',
								filterStatus !== 'all',
								filterStrategy !== 'all',
								filterDateFrom,
								filterDateTo
							].filter(Boolean).length}
						</span>
					{/if}
				</button>
			</div>

			<!-- Expanded Filters -->
			{#if showFilters}
				<div
					class="grid grid-cols-2 gap-4 border-t border-gray-200 pt-4 md:grid-cols-3 lg:grid-cols-6"
				>
					<div>
						<label class="label">Type</label>
						<select bind:value={filterType} class="select">
							<option value="all">All</option>
							<option value="long">Long</option>
							<option value="short">Short</option>
						</select>
					</div>

					<div>
						<label class="label">Outcome</label>
						<select bind:value={filterOutcome} class="select">
							<option value="all">All</option>
							<option value="win">Win</option>
							<option value="loss">Loss</option>
							<option value="breakeven">Breakeven</option>
							<option value="pending">Pending</option>
						</select>
					</div>

					<div>
						<label class="label">Status</label>
						<select bind:value={filterStatus} class="select">
							<option value="all">All</option>
							<option value="open">Open</option>
							<option value="closed">Closed</option>
							<option value="partial">Partial</option>
						</select>
					</div>

					<div>
						<label class="label">Strategy</label>
						<select bind:value={filterStrategy} class="select">
							<option value="all">All</option>
							{#each strategies as strategy}
								<option value={strategy.id}>{strategy.name}</option>
							{/each}
						</select>
					</div>

					<div>
						<label class="label">From Date</label>
						<input type="date" bind:value={filterDateFrom} class="input" />
					</div>

					<div>
						<label class="label">To Date</label>
						<input type="date" bind:value={filterDateTo} class="input" />
					</div>

					<div class="col-span-full flex justify-end gap-2">
						<button onclick={resetFilters} class="btn btn-secondary"> Clear Filters </button>
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- Trades Table -->
	<div class="card overflow-x-auto">
		{#if filteredTrades.length === 0}
			<div class="py-12 text-center text-gray-500">
				No trades found. Click "Add Trade" to get started.
			</div>
		{:else}
			<table class="w-full">
				<thead>
					<tr class="border-b border-gray-200">
						<th class="px-4 py-3 text-left text-sm font-medium text-gray-600">Date</th>
						<th class="px-4 py-3 text-left text-sm font-medium text-gray-600">Symbol</th>
						<th class="px-4 py-3 text-left text-sm font-medium text-gray-600">Type</th>
						<th class="px-4 py-3 text-left text-sm font-medium text-gray-600">Status</th>
						<th class="px-4 py-3 text-right text-sm font-medium text-gray-600">Entry</th>
						<th class="px-4 py-3 text-right text-sm font-medium text-gray-600">Exit</th>
						<th class="px-4 py-3 text-right text-sm font-medium text-gray-600">Qty</th>
						<th class="px-4 py-3 text-right text-sm font-medium text-gray-600">R:R</th>
						<th class="px-4 py-3 text-left text-sm font-medium text-gray-600">Result</th>
						<th class="px-4 py-3 text-right text-sm font-medium text-gray-600">Net P&L</th>
						<th class="px-4 py-3 text-right text-sm font-medium text-gray-600">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each filteredTrades as trade}
						<tr class="border-b border-gray-100 hover:bg-gray-50">
							<td class="px-4 py-3 text-sm text-gray-900">
								{new Date(trade.entryDate).toLocaleDateString()}
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
							<td class="px-4 py-3">
								<span
									class="inline-flex items-center rounded px-2 py-1 text-xs font-medium {trade.status ===
									'open'
										? 'bg-blue-100 text-blue-800'
										: trade.status === 'closed'
											? 'bg-gray-100 text-gray-800'
											: 'bg-yellow-100 text-yellow-800'}"
								>
									{trade.status.toUpperCase()}
								</span>
							</td>
							<td class="px-4 py-3 text-right text-sm text-gray-900">
								${trade.entryPrice.toFixed(2)}
							</td>
							<td class="px-4 py-3 text-right text-sm text-gray-900">
								{trade.exitPrice ? `$${trade.exitPrice.toFixed(2)}` : '-'}
							</td>
							<td class="px-4 py-3 text-right text-sm text-gray-900">
								{trade.quantity}
							</td>
							<td class="px-4 py-3 text-right text-sm text-gray-900">
								{trade.actualRR > 0 ? trade.actualRR.toFixed(2) : '-'}
							</td>
							<td class="px-4 py-3">
								<div class="flex items-center gap-1 {getOutcomeColor(trade.outcome)}">
									<svelte:component this={getOutcomeIcon(trade.outcome)} class="h-4 w-4" />
									<span class="text-xs font-medium uppercase">{trade.outcome}</span>
								</div>
							</td>
							<td
								class="px-4 py-3 text-right text-sm font-semibold {trade.netPnl >= 0
									? 'text-profit'
									: 'text-loss'}"
							>
								{formatCurrency(trade.netPnl)}
							</td>
							<td class="px-4 py-3 text-right">
								<div class="flex items-center justify-end gap-2">
									<button
										onclick={() => openEditModal(trade)}
										class="hover:text-primary-600 p-1 text-gray-600 transition-colors"
									>
										<Edit class="h-4 w-4" />
									</button>
									<button
										onclick={() => deleteTrade(trade.id)}
										class="p-1 text-gray-600 transition-colors hover:text-red-600"
									>
										<Trash2 class="h-4 w-4" />
									</button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</div>
</div>

<!-- Add/Edit Trade Modal -->
{#if showModal}
	<div
		class="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black p-4"
	>
		<div class="my-8 w-full max-w-4xl rounded-lg bg-white">
			<div class="sticky top-0 z-10 rounded-t-lg border-b border-gray-200 bg-white p-6">
				<div class="flex items-center justify-between">
					<h2 class="text-xl font-bold text-gray-900">
						{editingTrade ? 'Edit Trade' : 'Add New Trade'}
					</h2>
					<button onclick={() => (showModal = false)} class="text-gray-400 hover:text-gray-600">
						<X class="h-6 w-6" />
					</button>
				</div>
			</div>

			<form
				onsubmit={(e) => {
					e.preventDefault();
					handleSubmit();
				}}
				class="max-h-[calc(100vh-200px)] space-y-6 overflow-y-auto p-6"
			>
				<!-- Basic Information -->
				<div>
					<h3 class="mb-4 text-lg font-semibold text-gray-900">Basic Information</h3>
					<div class="grid grid-cols-2 gap-4 md:grid-cols-3">
						<div>
							<label class="label">Instrument *</label>
							<select bind:value={formData.instrumentId} required class="select">
								<option value="">Select Instrument...</option>
								{#each instruments as instrument}
									<option value={instrument.id}>{instrument.symbol} - {instrument.name}</option>
								{/each}
							</select>
							<p class="mt-1 text-xs text-gray-500">The symbol/asset you traded</p>
						</div>

						<div>
							<label class="label">Strategy</label>
							<select bind:value={formData.strategyId} class="select">
								<option value="">Select...</option>
								{#each strategies as strategy}
									<option value={strategy.id}>{strategy.name}</option>
								{/each}
							</select>
						</div>

						<div>
							<label class="label">Type *</label>
							<select bind:value={formData.type} required class="select">
								<option value="long">Long</option>
								<option value="short">Short</option>
							</select>
						</div>

						<div>
							<label class="label">Status *</label>
							<select bind:value={formData.status} required class="select">
								<option value="open">Open</option>
								<option value="closed">Closed</option>
								<option value="partial">Partial</option>
							</select>
						</div>

						<div>
							<label class="label">Emotion</label>
							<select bind:value={formData.emotion} class="select">
								<option value="confident">Confident</option>
								<option value="fearful">Fearful</option>
								<option value="greedy">Greedy</option>
								<option value="neutral">Neutral</option>
								<option value="disciplined">Disciplined</option>
								<option value="revenge">Revenge</option>
								<option value="fomo">FOMO</option>
							</select>
						</div>
					</div>
				</div>

				<!-- Trade Details -->
				<div>
					<h3 class="mb-4 text-lg font-semibold text-gray-900">Trade Details</h3>
					<div class="grid grid-cols-2 gap-4 md:grid-cols-4">
						<div>
							<label class="label">Entry Price *</label>
							<input
								type="number"
								step="0.01"
								bind:value={formData.entryPrice}
								required
								class="input"
							/>
						</div>

						<div>
							<label class="label">Exit Price</label>
							<input type="number" step="0.01" bind:value={formData.exitPrice} class="input" />
						</div>

						<div>
							<label class="label">Stop Loss *</label>
							<input
								type="number"
								step="0.01"
								bind:value={formData.stopLoss}
								required
								class="input"
							/>
						</div>

						<div>
							<label class="label">Take Profit *</label>
							<input
								type="number"
								step="0.01"
								bind:value={formData.takeProfit}
								required
								class="input"
							/>
						</div>

						<div>
							<label class="label">Lot Size *</label>
							<input
								type="number"
								step="0.01"
								bind:value={formData.lotSize}
								required
								class="input"
							/>
						</div>

						<div>
							<label class="label">Quantity *</label>
							<input
								type="number"
								step="0.01"
								bind:value={formData.quantity}
								required
								class="input"
							/>
						</div>

						<div>
							<label class="label">Fees</label>
							<input type="number" step="0.01" bind:value={formData.fees} class="input" />
						</div>

						<div>
							<label class="label">Commissions</label>
							<input type="number" step="0.01" bind:value={formData.commissions} class="input" />
						</div>

						<div>
							<label class="label">Slippage</label>
							<input type="number" step="0.01" bind:value={formData.slippage} class="input" />
						</div>

						<div>
							<label class="label">Entry Date *</label>
							<input type="date" bind:value={formData.entryDate} required class="input" />
						</div>

						<div>
							<label class="label">Exit Date</label>
							<input type="date" bind:value={formData.exitDate} class="input" />
						</div>
					</div>

					<!-- Calculated Values -->
					{#if formData.entryPrice && formData.exitPrice}
						<div class="mt-4 rounded-lg bg-gray-50 p-4">
							<div class="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
								<div>
									<span class="text-gray-600">Gross P&L:</span>
									<span
										class="ml-2 font-semibold {calculatedPnL >= 0 ? 'text-profit' : 'text-loss'}"
									>
										{formatCurrency(calculatedPnL)}
									</span>
								</div>
								<div>
									<span class="text-gray-600">Net P&L:</span>
									<span
										class="ml-2 font-semibold {calculatedNetPnL >= 0 ? 'text-profit' : 'text-loss'}"
									>
										{formatCurrency(calculatedNetPnL)}
									</span>
								</div>
								<div>
									<span class="text-gray-600">Expected R:R:</span>
									<span class="ml-2 font-semibold text-gray-900">
										{expectedRR.toFixed(2)}
									</span>
								</div>
								<div>
									<span class="text-gray-600">Actual R:R:</span>
									<span class="ml-2 font-semibold text-gray-900">
										{calculatedRR.toFixed(2)}
									</span>
								</div>
							</div>
						</div>
					{/if}
				</div>

				<!-- Context -->
				<div>
					<h3 class="mb-4 text-lg font-semibold text-gray-900">Trade Context</h3>
					<div class="grid grid-cols-2 gap-4 md:grid-cols-3">
						<div>
							<label class="label">Time of Day</label>
							<select bind:value={formData.timeOfDay} class="select">
								<option value="premarket">Pre-market</option>
								<option value="morning">Morning</option>
								<option value="midday">Midday</option>
								<option value="afternoon">Afternoon</option>
								<option value="afterhours">After Hours</option>
							</select>
						</div>

						<div>
							<label class="label">Market Condition</label>
							<select bind:value={formData.marketCondition} class="select">
								<option value="trending">Trending</option>
								<option value="ranging">Ranging</option>
								<option value="volatile">Volatile</option>
								<option value="quiet">Quiet</option>
							</select>
						</div>

						<div>
							<label class="label">Session Quality</label>
							<select bind:value={formData.sessionQuality} class="select">
								<option value={1}>⭐ Poor</option>
								<option value={2}>⭐⭐ Below Average</option>
								<option value={3}>⭐⭐⭐ Average</option>
								<option value={4}>⭐⭐⭐⭐ Good</option>
								<option value={5}>⭐⭐⭐⭐⭐ Excellent</option>
							</select>
						</div>

						<div class="col-span-full">
							<label class="flex items-center gap-2">
								<input
									type="checkbox"
									bind:checked={formData.followedPlan}
									class="text-primary-600 focus:ring-primary-500 h-4 w-4 rounded border-gray-300"
								/>
								<span class="text-sm font-medium text-gray-700">I followed my trading plan</span>
							</label>
						</div>
					</div>
				</div>

				<!-- Chart Images -->
				<div>
					<h3 class="mb-4 text-lg font-semibold text-gray-900">Chart Images</h3>
					<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
						<div>
							<label class="label">Before Chart URL (TradingView)</label>
							<div class="flex gap-2">
								<input
									type="url"
									bind:value={formData.chartBeforeUrl}
									onblur={() => handleChartUrlBlur('before')}
									class="input"
									placeholder="https://www.tradingview.com/chart/..."
								/>
								{#if formData.chartBeforeUrl}
									<ImageIcon class="text-primary-600 h-10 w-10" />
								{/if}
							</div>
						</div>

						<div>
							<label class="label">After Chart URL (TradingView)</label>
							<div class="flex gap-2">
								<input
									type="url"
									bind:value={formData.chartAfterUrl}
									onblur={() => handleChartUrlBlur('after')}
									class="input"
									placeholder="https://www.tradingview.com/chart/..."
								/>
								{#if formData.chartAfterUrl}
									<ImageIcon class="text-primary-600 h-10 w-10" />
								{/if}
							</div>
						</div>
					</div>
				</div>

				<!-- Notes -->
				<div>
					<h3 class="mb-4 text-lg font-semibold text-gray-900">Notes & Reflections</h3>
					<div class="space-y-4">
						<div>
							<label class="label">Pre-Trade Notes</label>
							<textarea
								bind:value={formData.preTradeNotes}
								rows="2"
								class="input"
								placeholder="What was your analysis before entering?"
							></textarea>
						</div>

						<div>
							<label class="label">Post-Trade Notes</label>
							<textarea
								bind:value={formData.postTradeNotes}
								rows="2"
								class="input"
								placeholder="What happened during the trade?"
							></textarea>
						</div>

						<div>
							<label class="label">General Notes</label>
							<textarea
								bind:value={formData.notes}
								rows="2"
								class="input"
								placeholder="Any additional observations..."
							></textarea>
						</div>

						<div>
							<label class="label">Mistakes Made</label>
							<textarea
								bind:value={formData.mistakes}
								rows="2"
								class="input"
								placeholder="What went wrong?"
							></textarea>
						</div>

						<div>
							<label class="label">Lessons Learned</label>
							<textarea
								bind:value={formData.lessonsLearned}
								rows="2"
								class="input"
								placeholder="What will you do differently next time?"
							></textarea>
						</div>

						<div>
							<label class="label">Tags (comma separated)</label>
							<input
								type="text"
								bind:value={formData.tags}
								class="input"
								placeholder="earnings, gap-up, momentum"
							/>
						</div>
					</div>
				</div>

				<!-- Actions -->
				<div class="sticky bottom-0 flex gap-3 border-t border-gray-200 bg-white pt-4">
					<button type="submit" class="btn btn-primary flex-1">
						{editingTrade ? 'Update Trade' : 'Add Trade'}
					</button>
					<button
						type="button"
						onclick={() => (showModal = false)}
						class="btn btn-secondary flex-1"
					>
						Cancel
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
