<script lang="ts">
	import { onMount } from 'svelte';
	import { accounts, selectedAccountId } from '$lib/stores';
	import {
		Plus,
		Edit,
		Trash2,
		Search,
		Filter,
		X,
		Save,
		Sparkles,
		TrendingUp,
		TrendingDown,
		CheckCircle,
		XCircle,
		Minus,
		Info,
		AlertCircle,
		Calendar,
		DollarSign
	} from 'lucide-svelte';
	import type { Trade, Instrument, Strategy, ChecklistTemplate } from '$lib/types';
	import { generateAIAnalysis } from '$lib/utils/aiAnalyzer';
	import type { AIInsight } from '$lib/utils/aiAnalyzer';
	import { calculateAnalytics } from '$lib/utils/analytics';

	let trades = $state<Trade[]>([]);
	let instruments = $state<Instrument[]>([]);
	let strategies = $state<Strategy[]>([]);
	let checklists = $state<ChecklistTemplate[]>([]);
	let loading = $state(true);

	// Modal states
	let showTradeModal = $state(false);
	let showAnalysisModal = $state(false);
	let showFilterPanel = $state(false);
	let editingTrade = $state<Trade | null>(null);
	let analyzingTrade = $state<Trade | null>(null);
	let tradeAnalysis = $state<any>(null);
	let loadingAnalysis = $state(false);

	// Form state
	let formData = $state({
		instrumentId: '',
		strategyId: '',
		type: 'long' as 'long' | 'short',
		status: 'open' as 'open' | 'closed' | 'partial',
		entryPrice: '',
		exitPrice: '',
		stopLoss: '',
		takeProfit: '',
		quantity: '1',
		lotSize: '1',
		fees: '0',
		commissions: '0',
		slippage: '0',
		entryDate: '',
		exitDate: '',
		timeOfDay: '' as '' | 'premarket' | 'morning' | 'midday' | 'afternoon' | 'afterhours',
		marketCondition: '' as '' | 'trending' | 'ranging' | 'volatile' | 'quiet',
		sessionQuality: 3,
		emotion: 'neutral' as
			| 'confident'
			| 'fearful'
			| 'greedy'
			| 'neutral'
			| 'disciplined'
			| 'revenge'
			| 'fomo',
		followedPlan: true,
		chartBeforeUrl: '',
		chartAfterUrl: '',
		preTradeNotes: '',
		postTradeNotes: '',
		notes: '',
		mistakes: '',
		lessonsLearned: '',
		tags: ''
	});

	// Checklist state
	let checklistItems = $state<{ [key: string]: boolean }>({});

	// Auto-calculated values
	let selectedInstrument = $derived(instruments.find((i) => i.id === formData.instrumentId));

	let autoCalculations = $derived(
		(() => {
			const entry = parseFloat(formData.entryPrice) || 0;
			const exit = parseFloat(formData.exitPrice) || 0;
			const stop = parseFloat(formData.stopLoss) || 0;
			const target = parseFloat(formData.takeProfit) || 0;
			const qty = parseFloat(formData.quantity) || 0;
			const lot = parseFloat(formData.lotSize) || 1;
			const fees = parseFloat(formData.fees) || 0;
			const comm = parseFloat(formData.commissions) || 0;
			const slip = parseFloat(formData.slippage) || 0;

			// Calculate pip value if available
			const pipValue = selectedInstrument?.pipValue || 1;
			const contractSize = selectedInstrument?.contractSize || 1;

			// Gross P&L
			let grossPnl = 0;
			if (entry && exit) {
				if (formData.type === 'long') {
					grossPnl = (exit - entry) * qty * lot * pipValue;
				} else {
					grossPnl = (entry - exit) * qty * lot * pipValue;
				}
			}

			// Net P&L
			const netPnl = grossPnl - fees - comm - slip;

			// Expected R:R
			let expectedRR = 0;
			if (entry && stop && target) {
				const risk = Math.abs(entry - stop);
				const reward = Math.abs(target - entry);
				expectedRR = risk > 0 ? reward / risk : 0;
			}

			// Actual R:R
			let actualRR = 0;
			if (entry && stop && exit) {
				const risk = Math.abs(entry - stop);
				const actualReward = formData.type === 'long' ? exit - entry : entry - exit;
				actualRR = risk > 0 ? actualReward / risk : 0;
			}

			// Outcome
			let outcome: 'win' | 'loss' | 'breakeven' | 'pending' = 'pending';
			if (formData.status === 'closed' && exit) {
				if (netPnl > 5) outcome = 'win';
				else if (netPnl < -5) outcome = 'loss';
				else outcome = 'breakeven';
			}

			return { grossPnl, netPnl, expectedRR, actualRR, outcome };
		})()
	);

	// Filters
	let filters = $state({
		search: '',
		type: 'all' as 'all' | 'long' | 'short',
		outcome: 'all' as 'all' | 'win' | 'loss' | 'breakeven' | 'pending',
		status: 'all' as 'all' | 'open' | 'closed' | 'partial',
		strategyId: '',
		dateFrom: '',
		dateTo: '',
		instrumentId: ''
	});

	const activeFilterCount = $derived(
		(() => {
			let count = 0;
			if (filters.search) count++;
			if (filters.type !== 'all') count++;
			if (filters.outcome !== 'all') count++;
			if (filters.status !== 'all') count++;
			if (filters.strategyId) count++;
			if (filters.dateFrom) count++;
			if (filters.dateTo) count++;
			if (filters.instrumentId) count++;
			return count;
		})()
	);

	const filteredTrades = $derived(
		(() => {
			return trades.filter((trade) => {
				// Search
				if (filters.search) {
					const search = filters.search.toLowerCase();
					const matchesSearch =
						trade.symbol.toLowerCase().includes(search) ||
						trade.notes?.toLowerCase().includes(search) ||
						trade.preTradeNotes?.toLowerCase().includes(search) ||
						trade.postTradeNotes?.toLowerCase().includes(search);
					if (!matchesSearch) return false;
				}

				// Type
				if (filters.type !== 'all' && trade.type !== filters.type) return false;

				// Outcome
				if (filters.outcome !== 'all' && trade.outcome !== filters.outcome) return false;

				// Status
				if (filters.status !== 'all' && trade.status !== filters.status) return false;

				// Strategy
				if (filters.strategyId && trade.strategyId !== filters.strategyId) return false;

				// Instrument
				if (filters.instrumentId && trade.instrumentId !== filters.instrumentId) return false;

				// Date range
				if (filters.dateFrom) {
					const tradeDate = new Date(trade.entryDate);
					const fromDate = new Date(filters.dateFrom);
					if (tradeDate < fromDate) return false;
				}
				if (filters.dateTo) {
					const tradeDate = new Date(trade.exitDate || trade.entryDate);
					const toDate = new Date(filters.dateTo);
					if (tradeDate > toDate) return false;
				}

				return true;
			});
		})()
	);

	onMount(async () => {
		await loadData();
	});

	async function loadData() {
		loading = true;
		try {
			const [tradesRes, instrumentsRes, strategiesRes, checklistsRes] = await Promise.all([
				fetch(`/api/trades?accountId=${$selectedAccountId}`),
				fetch('/api/instruments'),
				fetch('/api/strategies'),
				fetch('/api/checklists')
			]);

			trades = await tradesRes.json();
			instruments = await instrumentsRes.json();
			strategies = await strategiesRes.json();
			checklists = await checklistsRes.json();
		} catch (error) {
			console.error('Error loading data:', error);
		} finally {
			loading = false;
		}
	}

	function openAddTradeModal() {
		editingTrade = null;
		const now = new Date();
		const dateStr = now.toISOString().slice(0, 16);

		formData = {
			instrumentId: '',
			strategyId: '',
			type: 'long',
			status: 'open',
			entryPrice: '',
			exitPrice: '',
			stopLoss: '',
			takeProfit: '',
			quantity: '1',
			lotSize: '1',
			fees: '0',
			commissions: '0',
			slippage: '0',
			entryDate: dateStr,
			exitDate: '',
			timeOfDay: '',
			marketCondition: '',
			sessionQuality: 3,
			emotion: 'neutral',
			followedPlan: true,
			chartBeforeUrl: '',
			chartAfterUrl: '',
			preTradeNotes: '',
			postTradeNotes: '',
			notes: '',
			mistakes: '',
			lessonsLearned: '',
			tags: ''
		};

		// Reset checklist
		checklistItems = {};
		if (checklists.length > 0 && checklists[0].items) {
			checklists[0].items.forEach((item) => {
				checklistItems[item.id] = false;
			});
		}

		showTradeModal = true;
	}

	function openEditTradeModal(trade: Trade) {
		editingTrade = trade;
		formData = {
			instrumentId: trade.instrumentId,
			strategyId: trade.strategyId || '',
			type: trade.type,
			status: trade.status,
			entryPrice: trade.entryPrice.toString(),
			exitPrice: trade.exitPrice?.toString() || '',
			stopLoss: trade.stopLoss.toString(),
			takeProfit: trade.takeProfit.toString(),
			quantity: trade.quantity.toString(),
			lotSize: trade.lotSize.toString(),
			fees: trade.fees.toString(),
			commissions: trade.commissions.toString(),
			slippage: trade.slippage.toString(),
			entryDate: trade.entryDate.slice(0, 16),
			exitDate: trade.exitDate?.slice(0, 16) || '',
			timeOfDay: trade.timeOfDay,
			marketCondition: trade.marketCondition,
			sessionQuality: trade.sessionQuality,
			emotion: trade.emotion,
			followedPlan: trade.followedPlan,
			chartBeforeUrl: trade.chartBeforeUrl || '',
			chartAfterUrl: trade.chartAfterUrl || '',
			preTradeNotes: trade.preTradeNotes || '',
			postTradeNotes: trade.postTradeNotes || '',
			notes: trade.notes || '',
			mistakes: trade.mistakes || '',
			lessonsLearned: trade.lessonsLearned || '',
			tags: trade.tags.join(', ')
		};

		checklistItems = { ...trade.checklistItems };

		showTradeModal = true;
	}

	async function handleSubmit() {
		if (!selectedInstrument) {
			alert('Please select an instrument');
			return;
		}

		const calc = autoCalculations;
		const checklistCompleted =
			checklists.length > 0
				? Object.keys(checklistItems).length > 0 && Object.values(checklistItems).every(Boolean)
				: false;

		const tradeData = {
			accountId: $selectedAccountId,
			symbol: selectedInstrument.symbol,
			instrumentId: formData.instrumentId,
			strategyId: formData.strategyId || undefined,
			type: formData.type,
			status: formData.status,
			entryPrice: parseFloat(formData.entryPrice),
			exitPrice: formData.exitPrice ? parseFloat(formData.exitPrice) : undefined,
			stopLoss: parseFloat(formData.stopLoss),
			takeProfit: parseFloat(formData.takeProfit),
			quantity: parseFloat(formData.quantity),
			lotSize: parseFloat(formData.lotSize),
			fees: parseFloat(formData.fees),
			commissions: parseFloat(formData.commissions),
			slippage: parseFloat(formData.slippage),
			grossPnl: calc.grossPnl,
			netPnl: calc.netPnl,
			expectedRR: calc.expectedRR,
			actualRR: calc.actualRR,
			outcome: calc.outcome,
			entryDate: formData.entryDate,
			exitDate: formData.exitDate || undefined,
			timeOfDay: formData.timeOfDay || undefined,
			marketCondition: formData.marketCondition || undefined,
			sessionQuality: formData.sessionQuality,
			emotion: formData.emotion,
			followedPlan: formData.followedPlan,
			chartBeforeUrl: formData.chartBeforeUrl || undefined,
			chartAfterUrl: formData.chartAfterUrl || undefined,
			preTradeNotes: formData.preTradeNotes || undefined,
			postTradeNotes: formData.postTradeNotes || undefined,
			notes: formData.notes || undefined,
			mistakes: formData.mistakes || undefined,
			lessonsLearned: formData.lessonsLearned || undefined,
			tags: formData.tags
				.split(',')
				.map((t) => t.trim())
				.filter(Boolean),
			checklistItems,
			checklistCompleted
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

			showTradeModal = false;
			await loadData();
		} catch (error) {
			console.error('Error saving trade:', error);
			alert('Error saving trade. Please try again.');
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

			await loadData();
		} catch (error) {
			console.error('Error deleting trade:', error);
		}
	}

	async function analyzeTrade(trade: Trade) {
		analyzingTrade = trade;
		loadingAnalysis = true;
		showAnalysisModal = true;
		tradeAnalysis = null;

		try {
			tradeAnalysis = await generateAIAnalysis(
				trades,
				accounts,
				strategies,
				checklists,
				calculateAnalytics(trades)
			);
		} catch (error) {
			console.error('Error analyzing trade:', error);
			alert('Error analyzing trade. Please try again.');
		} finally {
			loadingAnalysis = false;
		}
	}

	function clearFilters() {
		filters = {
			search: '',
			type: 'all',
			outcome: 'all',
			status: 'all',
			strategyId: '',
			dateFrom: '',
			dateTo: '',
			instrumentId: ''
		};
	}

	function formatCurrency(value: number) {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
	}

	function getOutcomeIcon(outcome: string) {
		switch (outcome) {
			case 'win':
				return CheckCircle;
			case 'loss':
				return XCircle;
			case 'breakeven':
				return Minus;
			default:
				return AlertCircle;
		}
	}

	function getOutcomeColor(outcome: string) {
		switch (outcome) {
			case 'win':
				return 'text-profit';
			case 'loss':
				return 'text-loss';
			case 'breakeven':
				return 'text-gray-600';
			default:
				return 'text-yellow-600';
		}
	}
</script>

<svelte:head>
	<title>Trade Log - TradeJournal</title>
</svelte:head>

<div>
	<div class="p-8">
		<!-- Header -->
		<div class="mb-8">
			<div class="flex items-center justify-between">
				<div>
					<h1 class="mb-2 text-3xl font-bold text-gray-900">Trade Log</h1>
					<p class="text-gray-600">Track and analyze all your trades</p>
				</div>
				<button
					type="button"
					onclick={openAddTradeModal}
					class="btn btn-primary flex items-center gap-2"
				>
					<Plus class="h-5 w-5" />
					Add Trade
				</button>
			</div>
		</div>

		<!-- Filters Bar -->
		<div class="card mb-6">
			<div class="flex flex-wrap items-center gap-4">
				<!-- Search -->
				<div class="min-w-[200px] flex-1">
					<div class="relative">
						<Search
							class="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 transform text-gray-400"
						/>
						<input
							type="text"
							bind:value={filters.search}
							placeholder="Search by symbol or notes..."
							class="input pl-10"
						/>
					</div>
				</div>

				<!-- Advanced Filters Toggle -->
				<button
					type="button"
					onclick={() => (showFilterPanel = !showFilterPanel)}
					class="btn btn-secondary flex items-center gap-2"
				>
					<Filter class="h-4 w-4" />
					Filters
					{#if activeFilterCount > 0}
						<span
							class="bg-primary-600 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold text-white"
						>
							{activeFilterCount}
						</span>
					{/if}
				</button>

				{#if activeFilterCount > 0}
					<button
						type="button"
						onclick={clearFilters}
						class="text-sm text-gray-600 hover:text-gray-800"
					>
						Clear all
					</button>
				{/if}
			</div>

			<!-- Advanced Filter Panel -->
			{#if showFilterPanel}
				<div class="mt-4 border-t border-gray-200 pt-4">
					<div class="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
						<div>
							<label class="label">Type</label>
							<select bind:value={filters.type} class="select">
								<option value="all">All Types</option>
								<option value="long">Long</option>
								<option value="short">Short</option>
							</select>
						</div>

						<div>
							<label class="label">Status</label>
							<select bind:value={filters.status} class="select">
								<option value="all">All Status</option>
								<option value="open">Open</option>
								<option value="closed">Closed</option>
								<option value="partial">Partial</option>
							</select>
						</div>

						<div>
							<label class="label">Outcome</label>
							<select bind:value={filters.outcome} class="select">
								<option value="all">All Outcomes</option>
								<option value="win">Wins</option>
								<option value="loss">Losses</option>
								<option value="breakeven">Breakeven</option>
								<option value="pending">Pending</option>
							</select>
						</div>

						<div>
							<label class="label">Instrument</label>
							<select bind:value={filters.instrumentId} class="select">
								<option value="">All Instruments</option>
								{#each instruments as instrument}
									<option value={instrument.id}>{instrument.symbol}</option>
								{/each}
							</select>
						</div>

						<div>
							<label class="label">Strategy</label>
							<select bind:value={filters.strategyId} class="select">
								<option value="">All Strategies</option>
								{#each strategies as strategy}
									<option value={strategy.id}>{strategy.name}</option>
								{/each}
							</select>
						</div>

						<div>
							<label class="label">From Date</label>
							<input type="date" bind:value={filters.dateFrom} class="input" />
						</div>

						<div>
							<label class="label">To Date</label>
							<input type="date" bind:value={filters.dateTo} class="input" />
						</div>
					</div>
				</div>
			{/if}
		</div>

		<!-- Trades Table -->
		<div class="card">
			{#if loading}
				<div class="py-12 text-center text-gray-500">Loading trades...</div>
			{:else if filteredTrades.length === 0}
				<div class="py-12 text-center">
					<p class="mb-4 text-gray-500">
						{activeFilterCount > 0 ? 'No trades match your filters' : 'No trades yet'}
					</p>
					{#if activeFilterCount === 0}
						<button type="button" onclick={openAddTradeModal} class="btn btn-primary">
							Add Your First Trade
						</button>
					{:else}
						<button type="button" onclick={clearFilters} class="btn btn-secondary">
							Clear Filters
						</button>
					{/if}
				</div>
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full">
						<thead>
							<tr class="border-b border-gray-200">
								<th class="px-4 py-3 text-left text-sm font-medium text-gray-600">Date</th>
								<th class="px-4 py-3 text-left text-sm font-medium text-gray-600">Instrument</th>
								<th class="px-4 py-3 text-left text-sm font-medium text-gray-600">Type</th>
								<th class="px-4 py-3 text-left text-sm font-medium text-gray-600">Status</th>
								<th class="px-4 py-3 text-right text-sm font-medium text-gray-600">Entry</th>
								<th class="px-4 py-3 text-right text-sm font-medium text-gray-600">Exit</th>
								<th class="px-4 py-3 text-right text-sm font-medium text-gray-600">Qty</th>
								<th class="px-4 py-3 text-right text-sm font-medium text-gray-600">R:R</th>
								<th class="px-4 py-3 text-left text-sm font-medium text-gray-600">Outcome</th>
								<th class="px-4 py-3 text-right text-sm font-medium text-gray-600">Net P&L</th>
								<th class="px-4 py-3 text-right text-sm font-medium text-gray-600">Actions</th>
							</tr>
						</thead>
						<tbody>
							{#each filteredTrades as trade}
								<tr class="border-b border-gray-100 transition-colors hover:bg-gray-50">
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
										<div class="flex items-center gap-1">
											<svelte:component
												this={getOutcomeIcon(trade.outcome)}
												class="h-4 w-4 {getOutcomeColor(trade.outcome)}"
											/>
											<span class="text-xs font-medium {getOutcomeColor(trade.outcome)}">
												{trade.outcome.toUpperCase()}
											</span>
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
												type="button"
												onclick={() => analyzeTrade(trade)}
												class="p-1 text-purple-600 transition-colors hover:text-purple-800"
												title="AI Analysis"
											>
												<Sparkles class="h-4 w-4" />
											</button>
											<button
												type="button"
												onclick={() => openEditTradeModal(trade)}
												class="hover:text-primary-600 p-1 text-gray-600 transition-colors"
												title="Edit"
											>
												<Edit class="h-4 w-4" />
											</button>
											<button
												type="button"
												onclick={() => deleteTrade(trade.id)}
												class="p-1 text-gray-600 transition-colors hover:text-red-600"
												title="Delete"
											>
												<Trash2 class="h-4 w-4" />
											</button>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<div class="mt-4 text-sm text-gray-600">
					Showing {filteredTrades.length} of {trades.length} trades
				</div>
			{/if}
		</div>
	</div>

	<!-- Trade Modal -->
	{#if showTradeModal}
		<div class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
			<div class="my-8 w-full max-w-5xl rounded-lg bg-white">
				<!-- Modal Header -->
				<div class="sticky top-0 z-10 rounded-t-lg border-b border-gray-200 bg-white p-6">
					<div class="flex items-center justify-between">
						<div>
							<h2 class="text-xl font-bold text-gray-900">
								{editingTrade ? 'Edit Trade' : 'Add New Trade'}
							</h2>
							<p class="mt-1 text-sm text-gray-500">
								{selectedInstrument
									? `Trading ${selectedInstrument.symbol}`
									: 'Select an instrument to begin'}
							</p>
						</div>
						<button
							type="button"
							onclick={() => (showTradeModal = false)}
							class="text-gray-400 hover:text-gray-600"
						>
							<X class="h-6 w-6" />
						</button>
					</div>
				</div>

				<form
					onsubmit={(e) => {
						e.preventDefault();
						handleSubmit();
					}}
					class="space-y-6 p-6"
				>
					<!-- Instrument Selection (First & Most Important) -->
					<div class="rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
						<h3 class="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
							<Info class="h-5 w-5 text-blue-600" />
							Step 1: Select Instrument
						</h3>
						<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
							<div>
								<label class="label">Instrument *</label>
								<select bind:value={formData.instrumentId} required class="select">
									<option value="">Choose what you're trading...</option>
									{#each instruments as instrument}
										<option value={instrument.id}>
											{instrument.symbol} - {instrument.name} ({instrument.type})
										</option>
									{/each}
								</select>
								<p class="mt-1 text-xs text-blue-700">
									All instrument details are pulled automatically from Settings
								</p>
							</div>

							{#if selectedInstrument}
								<div class="rounded-lg border border-blue-200 bg-white p-3">
									<div class="space-y-1 text-xs text-gray-600">
										<div><span class="font-medium">Type:</span> {selectedInstrument.type}</div>
										<div>
											<span class="font-medium">Exchange:</span>
											{selectedInstrument.exchange || 'N/A'}
										</div>
										{#if selectedInstrument.pipValue}
											<div>
												<span class="font-medium">Pip Value:</span> ${selectedInstrument.pipValue}
											</div>
										{/if}
										{#if selectedInstrument.contractSize}
											<div>
												<span class="font-medium">Contract:</span>
												{selectedInstrument.contractSize}
											</div>
										{/if}
									</div>
								</div>
							{/if}
						</div>
					</div>

					<!-- Basic Trade Info -->
					<div>
						<h3 class="mb-4 text-lg font-semibold text-gray-900">Trade Details</h3>
						<div class="grid grid-cols-2 gap-4 md:grid-cols-4">
							<div>
								<label class="label">Type *</label>
								<select bind:value={formData.type} required class="select">
									<option value="long">Long (Buy)</option>
									<option value="short">Short (Sell)</option>
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
								<label class="label">Strategy</label>
								<select bind:value={formData.strategyId} class="select">
									<option value="">None</option>
									{#each strategies as strategy}
										<option value={strategy.id}>{strategy.name}</option>
									{/each}
								</select>
							</div>

							<div>
								<label class="label">Emotion</label>
								<select bind:value={formData.emotion} class="select">
									<option value="disciplined">Disciplined</option>
									<option value="confident">Confident</option>
									<option value="neutral">Neutral</option>
									<option value="fearful">Fearful</option>
									<option value="greedy">Greedy</option>
									<option value="revenge">Revenge</option>
									<option value="fomo">FOMO</option>
								</select>
							</div>
						</div>
					</div>

					<!-- Prices -->
					<div>
						<h3 class="mb-4 text-lg font-semibold text-gray-900">Price Levels</h3>
						<div class="grid grid-cols-2 gap-4 md:grid-cols-4">
							<div>
								<label class="label">Entry Price *</label>
								<input
									type="number"
									step="0.0001"
									bind:value={formData.entryPrice}
									required
									class="input"
									placeholder="0.00"
								/>
							</div>

							<div>
								<label class="label">Stop Loss *</label>
								<input
									type="number"
									step="0.0001"
									bind:value={formData.stopLoss}
									required
									class="input"
									placeholder="0.00"
								/>
							</div>

							<div>
								<label class="label">Take Profit *</label>
								<input
									type="number"
									step="0.0001"
									bind:value={formData.takeProfit}
									required
									class="input"
									placeholder="0.00"
								/>
							</div>

							<div>
								<label class="label">Exit Price</label>
								<input
									type="number"
									step="0.0001"
									bind:value={formData.exitPrice}
									class="input"
									placeholder="0.00"
								/>
							</div>
						</div>
					</div>

					<!-- Position Size & Costs -->
					<div>
						<h3 class="mb-4 text-lg font-semibold text-gray-900">Position & Costs</h3>
						<div class="grid grid-cols-2 gap-4 md:grid-cols-5">
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
								<label class="label">Lot Size</label>
								<input type="number" step="0.01" bind:value={formData.lotSize} class="input" />
							</div>

							<div>
								<label class="label">Fees ($)</label>
								<input type="number" step="0.01" bind:value={formData.fees} class="input" />
							</div>

							<div>
								<label class="label">Commissions ($)</label>
								<input type="number" step="0.01" bind:value={formData.commissions} class="input" />
							</div>

							<div>
								<label class="label">Slippage ($)</label>
								<input type="number" step="0.01" bind:value={formData.slippage} class="input" />
							</div>
						</div>
					</div>

					<!-- Auto-Calculated Values Display -->
					<div
						class="rounded-lg border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-4"
					>
						<h3 class="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
							<Calculator class="h-5 w-5 text-green-600" />
							Auto-Calculated Values
						</h3>
						<div class="grid grid-cols-2 gap-4 md:grid-cols-4">
							<div class="rounded-lg bg-white p-3">
								<div class="text-xs text-gray-600">Gross P&L</div>
								<div
									class="text-lg font-bold {autoCalculations.grossPnl >= 0
										? 'text-profit'
										: 'text-loss'}"
								>
									{formatCurrency(autoCalculations.grossPnl)}
								</div>
							</div>

							<div class="rounded-lg bg-white p-3">
								<div class="text-xs text-gray-600">Net P&L</div>
								<div
									class="text-lg font-bold {autoCalculations.netPnl >= 0
										? 'text-profit'
										: 'text-loss'}"
								>
									{formatCurrency(autoCalculations.netPnl)}
								</div>
							</div>

							<div class="rounded-lg bg-white p-3">
								<div class="text-xs text-gray-600">Expected R:R</div>
								<div class="text-lg font-bold text-gray-900">
									{autoCalculations.expectedRR.toFixed(2)}
								</div>
							</div>

							<div class="rounded-lg bg-white p-3">
								<div class="text-xs text-gray-600">Actual R:R</div>
								<div class="text-lg font-bold text-gray-900">
									{autoCalculations.actualRR > 0 ? autoCalculations.actualRR.toFixed(2) : '-'}
								</div>
							</div>
						</div>

						<div class="mt-3 flex items-center justify-between">
							<div class="text-sm text-gray-700">
								<span class="font-medium">Outcome:</span>
								<span
									class="ml-2 inline-flex items-center gap-1 font-bold {getOutcomeColor(
										autoCalculations.outcome
									)}"
								>
									<svelte:component
										this={getOutcomeIcon(autoCalculations.outcome)}
										class="h-4 w-4"
									/>
									{autoCalculations.outcome.toUpperCase()}
								</span>
							</div>
							<p class="text-xs text-gray-600 italic">
								All values calculated automatically based on instrument specs
							</p>
						</div>
					</div>

					<!-- Dates & Context -->
					<div>
						<h3 class="mb-4 text-lg font-semibold text-gray-900">Timing & Context</h3>
						<div class="grid grid-cols-2 gap-4 md:grid-cols-3">
							<div>
								<label class="label">Entry Date/Time *</label>
								<input
									type="datetime-local"
									bind:value={formData.entryDate}
									required
									class="input"
								/>
							</div>

							<div>
								<label class="label">Exit Date/Time</label>
								<input type="datetime-local" bind:value={formData.exitDate} class="input" />
							</div>

							<div>
								<label class="label">Time of Day</label>
								<select bind:value={formData.timeOfDay} class="select">
									<option value="">Not specified</option>
									<option value="premarket">Pre-Market</option>
									<option value="morning">Morning</option>
									<option value="midday">Midday</option>
									<option value="afternoon">Afternoon</option>
									<option value="afterhours">After Hours</option>
								</select>
							</div>

							<div>
								<label class="label">Market Condition</label>
								<select bind:value={formData.marketCondition} class="select">
									<option value="">Not specified</option>
									<option value="trending">Trending</option>
									<option value="ranging">Ranging</option>
									<option value="volatile">Volatile</option>
									<option value="quiet">Quiet</option>
								</select>
							</div>

							<div>
								<label class="label">Session Quality</label>
								<div class="flex items-center gap-2">
									{#each [1, 2, 3, 4, 5] as star}
										<button
											type="button"
											onclick={() => (formData.sessionQuality = star)}
											class="text-2xl {formData.sessionQuality >= star
												? 'text-yellow-400'
												: 'text-gray-300'}"
										>
											★
										</button>
									{/each}
								</div>
							</div>

							<div>
								<label class="mt-7 flex items-center gap-2">
									<input
										type="checkbox"
										bind:checked={formData.followedPlan}
										class="text-primary-600 focus:ring-primary-500 h-4 w-4 rounded border-gray-300"
									/>
									<span class="text-sm font-medium text-gray-700">Followed Plan</span>
								</label>
							</div>
						</div>
					</div>

					<!-- Checklist -->
					{#if checklists.length > 0 && checklists[0].items}
						<div
							class="rounded-lg border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-4"
						>
							<h3 class="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
								<CheckCircle class="h-5 w-5 text-blue-600" />
								Pre-Trade Checklist
							</h3>
							<p class="mb-4 text-sm text-gray-700">
								Complete all items before entering the trade. Studies show this improves win rate by
								15-20%!
							</p>
							<div class="space-y-2">
								{#each checklists[0].items as item}
									<label
										class="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 bg-white p-3 transition-shadow hover:shadow-sm"
									>
										<input
											type="checkbox"
											bind:checked={checklistItems[item.id]}
											class="text-primary-600 focus:ring-primary-500 mt-0.5 h-5 w-5 rounded border-gray-300"
										/>
										<div class="flex-1">
											<div class="flex flex-wrap items-center gap-2">
												<span class="text-sm font-medium text-gray-900">{item.text}</span>
												{#if item.required}
													<span
														class="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700"
													>
														REQUIRED
													</span>
												{/if}
												<span
													class="rounded-full px-2 py-0.5 text-xs {item.category === 'pre-trade'
														? 'bg-blue-100 text-blue-700'
														: item.category === 'during-trade'
															? 'bg-yellow-100 text-yellow-700'
															: 'bg-green-100 text-green-700'}"
												>
													{item.category.replace('-', ' ')}
												</span>
											</div>
										</div>
									</label>
								{/each}
							</div>

							<!-- Progress Bar -->
							<div class="mt-4 rounded-lg border border-blue-200 bg-white p-3">
								<div class="mb-2 flex items-center justify-between text-sm">
									<span class="font-medium text-gray-700">Completion:</span>
									<span class="text-primary-600 font-bold">
										{Object.values(checklistItems).filter(Boolean).length} / {checklists[0].items
											.length}
									</span>
								</div>
								<div class="h-2 w-full rounded-full bg-gray-200">
									<div
										class="bg-primary-600 h-2 rounded-full transition-all duration-300"
										style="width: {(Object.values(checklistItems).filter(Boolean).length /
											checklists[0].items.length) *
											100}%"
									></div>
								</div>
							</div>
						</div>
					{/if}

					<!-- Notes Section -->
					<div>
						<h3 class="mb-4 text-lg font-semibold text-gray-900">Notes & Reflections</h3>
						<div class="space-y-4">
							<div>
								<label class="label">Pre-Trade Notes</label>
								<textarea
									bind:value={formData.preTradeNotes}
									rows="2"
									class="input"
									placeholder="What was your thesis? Why did you enter?"
								></textarea>
							</div>

							<div>
								<label class="label">Post-Trade Notes</label>
								<textarea
									bind:value={formData.postTradeNotes}
									rows="2"
									class="input"
									placeholder="What happened? How did it play out?"
								></textarea>
							</div>

							<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
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
										placeholder="What will you do differently?"
									></textarea>
								</div>
							</div>

							<div>
								<label class="label">Tags (comma separated)</label>
								<input
									type="text"
									bind:value={formData.tags}
									class="input"
									placeholder="breakout, earnings, news, etc."
								/>
							</div>
						</div>
					</div>

					<!-- Form Actions -->
					<div class="flex gap-3 border-t border-gray-200 pt-4">
						<button
							type="submit"
							class="btn btn-primary flex flex-1 items-center justify-center gap-2"
						>
							<Save class="h-5 w-5" />
							{editingTrade ? 'Update Trade' : 'Save Trade'}
						</button>
						<button
							type="button"
							onclick={() => (showTradeModal = false)}
							class="btn btn-secondary flex-1"
						>
							Cancel
						</button>
					</div>
				</form>
			</div>
		</div>
	{/if}

	<!-- AI Analysis Modal -->
	{#if showAnalysisModal && analyzingTrade}
		<div class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
			<div class="my-8 w-full max-w-3xl rounded-lg bg-white">
				<div class="border-b border-gray-200 p-6">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<Sparkles class="h-6 w-6 text-purple-600" />
							<h2 class="text-xl font-bold text-gray-900">AI Trade Analysis</h2>
						</div>
						<button
							onclick={() => (showAnalysisModal = false)}
							class="text-gray-400 hover:text-gray-600"
						>
							<X class="h-6 w-6" />
						</button>
					</div>
					<p class="mt-1 text-sm text-gray-600">
						{analyzingTrade.symbol} - {new Date(analyzingTrade.entryDate).toLocaleDateString()}
					</p>
				</div>

				<div class="max-h-[70vh] overflow-y-auto p-6">
					{#if loadingAnalysis}
						<div class="flex flex-col items-center justify-center py-12">
							<Sparkles class="mb-3 h-12 w-12 animate-pulse text-purple-600" />
							<p class="text-gray-600">Analyzing your trade...</p>
							<p class="mt-1 text-sm text-gray-500">This may take a few seconds</p>
						</div>
					{:else if tradeAnalysis}
						<!-- Trade Score -->
						<div
							class="mb-6 rounded-lg p-4 {tradeAnalysis.score >= 80
								? 'border-2 border-green-500 bg-green-50'
								: tradeAnalysis.score >= 60
									? 'border-2 border-blue-500 bg-blue-50'
									: tradeAnalysis.score >= 40
										? 'border-2 border-yellow-500 bg-yellow-50'
										: 'border-2 border-red-500 bg-red-50'}"
						>
							<div class="mb-2 flex items-center justify-between">
								<span class="text-sm font-semibold text-gray-700">Trade Execution Score</span>
								<span
									class="text-4xl font-bold {tradeAnalysis.score >= 80
										? 'text-green-600'
										: tradeAnalysis.score >= 60
											? 'text-blue-600'
											: tradeAnalysis.score >= 40
												? 'text-yellow-600'
												: 'text-red-600'}">{tradeAnalysis.score}/100</span
								>
							</div>
							<p class="text-sm text-gray-700">{tradeAnalysis.summary}</p>
						</div>

						<!-- Insights -->
						<h3 class="mb-3 font-semibold text-gray-900">Detailed Analysis & Recommendations</h3>
						<div class="space-y-3">
							{#each tradeAnalysis.insights as insight}
								<div
									class="rounded-lg border-l-4 p-4 {insight.severity === 'danger'
										? 'border-red-500 bg-red-50'
										: insight.severity === 'warning'
											? 'border-yellow-500 bg-yellow-50'
											: 'border-green-500 bg-green-50'}"
								>
									<div class="mb-2 flex items-start justify-between">
										<span class="text-sm font-semibold text-gray-900">{insight.category}</span>
										<span
											class="rounded-full px-2 py-1 text-xs {insight.severity === 'danger'
												? 'bg-red-100 text-red-700'
												: insight.severity === 'warning'
													? 'bg-yellow-100 text-yellow-700'
													: 'bg-green-100 text-green-700'}"
										>
											{insight.severity.toUpperCase()}
										</span>
									</div>
									<p class="mb-2 text-sm text-gray-700">{insight.message}</p>
									<div class="mt-2 rounded bg-white/70 p-2">
										<p class="text-sm font-medium text-gray-900">
											💡 Action: {insight.recommendation}
										</p>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>

				<div class="border-t border-gray-200 p-6">
					<button onclick={() => (showAnalysisModal = false)} class="btn btn-secondary w-full">
						Close Analysis
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
