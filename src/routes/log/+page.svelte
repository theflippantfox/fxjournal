<script lang="ts">
	import { onMount } from 'svelte';
	import { selectedAccountId } from '$lib/stores';
	import { formatCurrency } from '$lib/utils/analytics';
	import { Plus, Edit, Trash2, Filter, Search } from 'lucide-svelte';
	import type { Trade } from '$lib/types';

	let trades = $state<Trade[]>([]);
	let filteredTrades = $state<Trade[]>([]);
	let showModal = $state(false);
	let editingTrade = $state<Trade | null>(null);
	let searchQuery = $state('');
	let filterType = $state<'all' | 'long' | 'short'>('all');
	
	let formData = $state({
		symbol: '',
		type: 'long' as 'long' | 'short',
		entryPrice: '',
		exitPrice: '',
		quantity: '',
		entryDate: '',
		exitDate: '',
		fees: '',
		notes: '',
		tags: '',
		setup: '',
		emotion: 'neutral' as 'confident' | 'fearful' | 'greedy' | 'neutral' | 'disciplined',
		mistakes: ''
	});

	$effect(() => {
		loadTrades($selectedAccountId);
	});

	$effect(() => {
		filterTrades();
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

	function filterTrades() {
		let result = trades;

		if (filterType !== 'all') {
			result = result.filter(t => t.type === filterType);
		}

		if (searchQuery) {
			result = result.filter(t => 
				t.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
				t.setup.toLowerCase().includes(searchQuery.toLowerCase())
			);
		}

		filteredTrades = result.sort((a, b) => 
			new Date(b.exitDate).getTime() - new Date(a.exitDate).getTime()
		);
	}

	function openAddModal() {
		editingTrade = null;
		formData = {
			symbol: '',
			type: 'long',
			entryPrice: '',
			exitPrice: '',
			quantity: '',
			entryDate: '',
			exitDate: '',
			fees: '',
			notes: '',
			tags: '',
			setup: '',
			emotion: 'neutral',
			mistakes: ''
		};
		showModal = true;
	}

	function openEditModal(trade: Trade) {
		editingTrade = trade;
		formData = {
			symbol: trade.symbol,
			type: trade.type,
			entryPrice: trade.entryPrice.toString(),
			exitPrice: trade.exitPrice.toString(),
			quantity: trade.quantity.toString(),
			entryDate: trade.entryDate.split('T')[0],
			exitDate: trade.exitDate.split('T')[0],
			fees: trade.fees.toString(),
			notes: trade.notes,
			tags: trade.tags.join(', '),
			setup: trade.setup,
			emotion: trade.emotion,
			mistakes: trade.mistakes
		};
		showModal = true;
	}

	async function handleSubmit() {
		const entryPrice = parseFloat(formData.entryPrice);
		const exitPrice = parseFloat(formData.exitPrice);
		const quantity = parseFloat(formData.quantity);
		const fees = parseFloat(formData.fees || '0');

		const priceDiff = formData.type === 'long' 
			? exitPrice - entryPrice 
			: entryPrice - exitPrice;
		
		const pnl = priceDiff * quantity;
		const pnlPercentage = (priceDiff / entryPrice) * 100;

		const tradeData = {
			accountId: $selectedAccountId,
			symbol: formData.symbol.toUpperCase(),
			type: formData.type,
			entryPrice,
			exitPrice,
			quantity,
			entryDate: new Date(formData.entryDate).toISOString(),
			exitDate: new Date(formData.exitDate).toISOString(),
			pnl,
			pnlPercentage,
			fees,
			notes: formData.notes,
			tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
			setup: formData.setup,
			emotion: formData.emotion,
			mistakes: formData.mistakes
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
</script>

<svelte:head>
	<title>Trade Log - TradeJournal</title>
</svelte:head>

<div class="p-8">
	<!-- Header -->
	<div class="flex items-center justify-between mb-8">
		<div>
			<h1 class="text-3xl font-bold text-gray-900 mb-2">Trade Log</h1>
			<p class="text-gray-600">Track and manage all your trades</p>
		</div>
		<button onclick={openAddModal} class="btn btn-primary flex items-center gap-2">
			<Plus class="w-5 h-5" />
			Add Trade
		</button>
	</div>

	<!-- Filters -->
	<div class="card mb-6">
		<div class="flex flex-col md:flex-row gap-4">
			<div class="flex-1 relative">
				<Search class="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Search by symbol or setup..."
					class="input pl-10"
				/>
			</div>
			<div class="flex gap-2">
				<button
					onclick={() => filterType = 'all'}
					class="px-4 py-2 rounded-lg font-medium transition-colors {filterType === 'all' ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-700'}"
				>
					All
				</button>
				<button
					onclick={() => filterType = 'long'}
					class="px-4 py-2 rounded-lg font-medium transition-colors {filterType === 'long' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'}"
				>
					Long
				</button>
				<button
					onclick={() => filterType = 'short'}
					class="px-4 py-2 rounded-lg font-medium transition-colors {filterType === 'short' ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-700'}"
				>
					Short
				</button>
			</div>
		</div>
	</div>

	<!-- Trades Table -->
	<div class="card overflow-x-auto">
		{#if filteredTrades.length === 0}
			<div class="text-center py-12 text-gray-500">
				No trades found. Click "Add Trade" to get started.
			</div>
		{:else}
			<table class="w-full">
				<thead>
					<tr class="border-b border-gray-200">
						<th class="text-left py-3 px-4 text-sm font-medium text-gray-600">Date</th>
						<th class="text-left py-3 px-4 text-sm font-medium text-gray-600">Symbol</th>
						<th class="text-left py-3 px-4 text-sm font-medium text-gray-600">Type</th>
						<th class="text-left py-3 px-4 text-sm font-medium text-gray-600">Setup</th>
						<th class="text-right py-3 px-4 text-sm font-medium text-gray-600">Entry</th>
						<th class="text-right py-3 px-4 text-sm font-medium text-gray-600">Exit</th>
						<th class="text-right py-3 px-4 text-sm font-medium text-gray-600">Qty</th>
						<th class="text-right py-3 px-4 text-sm font-medium text-gray-600">P&L</th>
						<th class="text-right py-3 px-4 text-sm font-medium text-gray-600">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each filteredTrades as trade}
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
							<td class="py-3 px-4 text-sm text-gray-600">
								{trade.setup || '-'}
							</td>
							<td class="py-3 px-4 text-sm text-gray-900 text-right">
								${trade.entryPrice.toFixed(2)}
							</td>
							<td class="py-3 px-4 text-sm text-gray-900 text-right">
								${trade.exitPrice.toFixed(2)}
							</td>
							<td class="py-3 px-4 text-sm text-gray-900 text-right">
								{trade.quantity}
							</td>
							<td class="py-3 px-4 text-sm font-semibold text-right {trade.pnl >= 0 ? 'text-profit' : 'text-loss'}">
								{formatCurrency(trade.pnl)}
							</td>
							<td class="py-3 px-4 text-right">
								<div class="flex items-center justify-end gap-2">
									<button
										onclick={() => openEditModal(trade)}
										class="p-1 text-gray-600 hover:text-primary-600 transition-colors"
									>
										<Edit class="w-4 h-4" />
									</button>
									<button
										onclick={() => deleteTrade(trade.id)}
										class="p-1 text-gray-600 hover:text-red-600 transition-colors"
									>
										<Trash2 class="w-4 h-4" />
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
	<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
		<div class="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
			<div class="p-6 border-b border-gray-200">
				<h2 class="text-xl font-bold text-gray-900">
					{editingTrade ? 'Edit Trade' : 'Add New Trade'}
				</h2>
			</div>

			<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="p-6 space-y-4">
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label class="label">Symbol</label>
						<input
							type="text"
							bind:value={formData.symbol}
							required
							class="input"
							placeholder="AAPL"
						/>
					</div>

					<div>
						<label class="label">Type</label>
						<select bind:value={formData.type} required class="select">
							<option value="long">Long</option>
							<option value="short">Short</option>
						</select>
					</div>
				</div>

				<div class="grid grid-cols-3 gap-4">
					<div>
						<label class="label">Entry Price</label>
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
						<input
							type="number"
							step="0.01"
							bind:value={formData.exitPrice}
							required
							class="input"
						/>
					</div>

					<div>
						<label class="label">Quantity</label>
						<input
							type="number"
							step="0.01"
							bind:value={formData.quantity}
							required
							class="input"
						/>
					</div>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div>
						<label class="label">Entry Date</label>
						<input
							type="date"
							bind:value={formData.entryDate}
							required
							class="input"
						/>
					</div>

					<div>
						<label class="label">Exit Date</label>
						<input
							type="date"
							bind:value={formData.exitDate}
							required
							class="input"
						/>
					</div>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div>
						<label class="label">Setup</label>
						<input
							type="text"
							bind:value={formData.setup}
							class="input"
							placeholder="Breakout, Pullback, etc."
						/>
					</div>

					<div>
						<label class="label">Emotion</label>
						<select bind:value={formData.emotion} class="select">
							<option value="confident">Confident</option>
							<option value="fearful">Fearful</option>
							<option value="greedy">Greedy</option>
							<option value="neutral">Neutral</option>
							<option value="disciplined">Disciplined</option>
						</select>
					</div>
				</div>

				<div>
					<label class="label">Fees</label>
					<input
						type="number"
						step="0.01"
						bind:value={formData.fees}
						class="input"
						placeholder="0.00"
					/>
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

				<div>
					<label class="label">Notes</label>
					<textarea
						bind:value={formData.notes}
						rows="3"
						class="input"
						placeholder="What went well? What could be improved?"
					></textarea>
				</div>

				<div>
					<label class="label">Mistakes / Lessons</label>
					<textarea
						bind:value={formData.mistakes}
						rows="2"
						class="input"
						placeholder="Did you follow your trading plan?"
					></textarea>
				</div>

				<div class="flex gap-3 pt-4">
					<button type="submit" class="btn btn-primary flex-1">
						{editingTrade ? 'Update Trade' : 'Add Trade'}
					</button>
					<button
						type="button"
						onclick={() => showModal = false}
						class="btn btn-secondary flex-1"
					>
						Cancel
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
