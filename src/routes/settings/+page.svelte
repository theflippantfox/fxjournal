<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { accounts, theme as themeStore } from '$lib/stores';
	import {
		Plus,
		Edit,
		Trash2,
		Save,
		DollarSign,
		Info,
		Calculator,
		TrendingUp
	} from 'lucide-svelte';
	import type {
		Account,
		Settings,
		Instrument,
		Strategy,
		ChecklistTemplate,
		ChecklistItem
	} from '$lib/types';

	let currentTab = $state('accounts');
	let currentAccounts = $state<Account[]>([]);
	let instruments = $state<Instrument[]>([]);
	let strategies = $state<Strategy[]>([]);
	let checklists = $state<ChecklistTemplate[]>([]);
	let settings = $state<Settings | null>(null);

	// Modal states
	let showAccountModal = $state(false);
	let showInstrumentModal = $state(false);
	let showStrategyModal = $state(false);
	let showChecklistModal = $state(false);

	let editingAccount = $state<Account | null>(null);
	let editingInstrument = $state<Instrument | null>(null);
	let editingStrategy = $state<Strategy | null>(null);
	let editingChecklist = $state<ChecklistTemplate | null>(null);

	// Form states
	let accountForm = $state({
		name: '',
		entity: '',
		type: 'live' as 'live' | 'demo' | 'paper',
		balance: '',
		investedAmount: ''
	});

	let instrumentForm = $state({
		symbol: '',
		name: '',
		type: 'stock' as 'stock' | 'forex' | 'crypto' | 'futures' | 'options' | 'index',
		exchange: '',
		tickSize: '0.01',
		lotSize: '1',
		currency: 'USD',
		notes: '',
		pipValue: '',
		contractSize: '',
		marginRequirement: '',
		tradingHours: '',
		pointValue: '',
		spread: ''
	});

	// Profit calculator states
	let calcPositionSize = $state(1);
	let calcPipMove = $state(10);

	const calcProfit = $derived(() => {
		if (!instrumentForm.pipValue) return 0;
		return calcPositionSize * calcPipMove * parseFloat(instrumentForm.pipValue || '0');
	});

	let strategyForm = $state({
		name: '',
		description: '',
		setup: '',
		entry: '',
		exit: '',
		stopLoss: '',
		targetRR: '2',
		timeframes: '',
		markets: '',
		notes: '',
		active: true
	});

	let checklistForm = $state({
		name: '',
		items: [] as ChecklistItem[]
	});

	let newChecklistItem = $state({
		text: '',
		category: 'pre-trade' as 'pre-trade' | 'during-trade' | 'post-trade',
		required: false
	});

	onMount(async () => {
		const urlParams = new URLSearchParams($page.url.search);
		const tab = urlParams.get('tab');
		const action = urlParams.get('action');

		if (tab) currentTab = tab;
		if (action === 'add' && tab === 'accounts') {
			openAddAccountModal();
		}

		await Promise.all([
			loadAccounts(),
			loadInstruments(),
			loadStrategies(),
			loadChecklists(),
			loadSettings()
		]);

		themeStore.subscribe((value) => {
			if (settings && (value === 'light' || value === 'dark')) {
				settings.theme = value;
			}
		});
	});

	async function loadAccounts() {
		try {
			const res = await fetch('/api/accounts');
			const data = await res.json();
			accounts.set(data);
			currentAccounts = data;
		} catch (error) {
			console.error('Error loading accounts:', error);
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

	async function loadSettings() {
		try {
			const res = await fetch('/api/settings');
			settings = await res.json();
		} catch (error) {
			console.error('Error loading settings:', error);
		}
	}

	// Account functions
	function openAddAccountModal() {
		editingAccount = null;
		accountForm = {
			name: '',
			entity: '',
			type: 'live',
			balance: '',
			investedAmount: ''
		};
		showAccountModal = true;
	}

	function openEditAccountModal(account: Account) {
		editingAccount = account;
		accountForm = {
			name: account.name,
			entity: account.entity,
			type: account.type,
			balance: account.balance.toString(),
			investedAmount: account.investedAmount.toString()
		};
		showAccountModal = true;
	}

	async function handleAccountSubmit() {
		const accountData = {
			name: accountForm.name,
			entity: accountForm.entity,
			type: accountForm.type,
			balance: parseFloat(accountForm.balance),
			investedAmount: parseFloat(accountForm.investedAmount),
			totalPnl: 0
		};

		try {
			if (editingAccount) {
				await fetch('/api/accounts', {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ id: editingAccount.id, ...accountData })
				});
			} else {
				await fetch('/api/accounts', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(accountData)
				});
			}

			showAccountModal = false;
			await loadAccounts();
		} catch (error) {
			console.error('Error saving account:', error);
		}
	}

	async function deleteAccount(id: string) {
		if (!confirm('Are you sure? This will delete all trades associated with this account.')) {
			return;
		}

		try {
			await fetch('/api/accounts', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id })
			});

			await loadAccounts();
		} catch (error) {
			console.error('Error deleting account:', error);
		}
	}

	// Instrument functions
	function openAddInstrumentModal() {
		editingInstrument = null;
		instrumentForm = {
			symbol: '',
			name: '',
			type: 'stock',
			exchange: '',
			tickSize: '0.01',
			lotSize: '1',
			currency: 'USD',
			notes: '',
			pipValue: '',
			contractSize: '',
			marginRequirement: '',
			tradingHours: '',
			pointValue: '',
			spread: ''
		};
		calcPositionSize = 1;
		calcPipMove = 10;
		showInstrumentModal = true;
	}

	function openEditInstrumentModal(instrument: Instrument) {
		editingInstrument = instrument;
		instrumentForm = {
			symbol: instrument.symbol,
			name: instrument.name,
			type: instrument.type,
			exchange: instrument.exchange,
			tickSize: instrument.tickSize.toString(),
			lotSize: instrument.lotSize.toString(),
			currency: instrument.currency,
			notes: instrument.notes,
			pipValue: instrument.pipValue?.toString() || '',
			contractSize: instrument.contractSize?.toString() || '',
			marginRequirement: instrument.marginRequirement?.toString() || '',
			tradingHours: instrument.tradingHours || '',
			pointValue: instrument.pointValue?.toString() || '',
			spread: instrument.spread?.toString() || ''
		};
		showInstrumentModal = true;
	}

	async function handleInstrumentSubmit() {
		const instrumentData = {
			symbol: instrumentForm.symbol.toUpperCase(),
			name: instrumentForm.name,
			type: instrumentForm.type,
			exchange: instrumentForm.exchange,
			tickSize: parseFloat(instrumentForm.tickSize),
			lotSize: parseFloat(instrumentForm.lotSize),
			currency: instrumentForm.currency,
			notes: instrumentForm.notes,
			pipValue: instrumentForm.pipValue ? parseFloat(instrumentForm.pipValue) : undefined,
			contractSize: instrumentForm.contractSize
				? parseFloat(instrumentForm.contractSize)
				: undefined,
			marginRequirement: instrumentForm.marginRequirement
				? parseFloat(instrumentForm.marginRequirement)
				: undefined,
			tradingHours: instrumentForm.tradingHours || undefined,
			pointValue: instrumentForm.pointValue ? parseFloat(instrumentForm.pointValue) : undefined,
			spread: instrumentForm.spread ? parseFloat(instrumentForm.spread) : undefined
		};

		try {
			if (editingInstrument) {
				await fetch('/api/instruments', {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ id: editingInstrument.id, ...instrumentData })
				});
			} else {
				await fetch('/api/instruments', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(instrumentData)
				});
			}

			showInstrumentModal = false;
			await loadInstruments();
		} catch (error) {
			console.error('Error saving instrument:', error);
		}
	}

	async function deleteInstrument(id: string) {
		if (!confirm('Are you sure you want to delete this instrument?')) return;

		try {
			await fetch('/api/instruments', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id })
			});

			await loadInstruments();
		} catch (error) {
			console.error('Error deleting instrument:', error);
		}
	}

	// Strategy functions
	function openAddStrategyModal() {
		editingStrategy = null;
		strategyForm = {
			name: '',
			description: '',
			setup: '',
			entry: '',
			exit: '',
			stopLoss: '',
			targetRR: '2',
			timeframes: '',
			markets: '',
			notes: '',
			active: true
		};
		showStrategyModal = true;
	}

	function openEditStrategyModal(strategy: Strategy) {
		editingStrategy = strategy;
		strategyForm = {
			name: strategy.name,
			description: strategy.description,
			setup: strategy.setup,
			entry: strategy.entry,
			exit: strategy.exit,
			stopLoss: strategy.stopLoss,
			targetRR: strategy.targetRR.toString(),
			timeframes: strategy.timeframes.join(', '),
			markets: strategy.markets.join(', '),
			notes: strategy.notes,
			active: strategy.active
		};
		showStrategyModal = true;
	}

	async function handleStrategySubmit() {
		const strategyData = {
			name: strategyForm.name,
			description: strategyForm.description,
			setup: strategyForm.setup,
			entry: strategyForm.entry,
			exit: strategyForm.exit,
			stopLoss: strategyForm.stopLoss,
			targetRR: parseFloat(strategyForm.targetRR),
			timeframes: strategyForm.timeframes
				.split(',')
				.map((t) => t.trim())
				.filter(Boolean),
			markets: strategyForm.markets
				.split(',')
				.map((m) => m.trim())
				.filter(Boolean),
			notes: strategyForm.notes,
			active: strategyForm.active,
			winRate: 0,
			totalTrades: 0,
			avgPnl: 0
		};

		try {
			if (editingStrategy) {
				await fetch('/api/strategies', {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ id: editingStrategy.id, ...strategyData })
				});
			} else {
				await fetch('/api/strategies', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(strategyData)
				});
			}

			showStrategyModal = false;
			await loadStrategies();
		} catch (error) {
			console.error('Error saving strategy:', error);
		}
	}

	async function deleteStrategy(id: string) {
		if (!confirm('Are you sure you want to delete this strategy?')) return;

		try {
			await fetch('/api/strategies', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id })
			});

			await loadStrategies();
		} catch (error) {
			console.error('Error deleting strategy:', error);
		}
	}

	// Checklist functions
	function openAddChecklistModal() {
		editingChecklist = null;
		checklistForm = {
			name: '',
			items: []
		};
		showChecklistModal = true;
	}

	function openEditChecklistModal(checklist: ChecklistTemplate) {
		editingChecklist = checklist;
		checklistForm = {
			name: checklist.name,
			items: [...checklist.items]
		};
		showChecklistModal = true;
	}

	function addChecklistItem() {
		if (!newChecklistItem.text.trim()) return;

		checklistForm.items.push({
			id: Date.now().toString(),
			text: newChecklistItem.text,
			category: newChecklistItem.category,
			required: newChecklistItem.required
		});

		newChecklistItem = {
			text: '',
			category: 'pre-trade',
			required: false
		};
	}

	function removeChecklistItem(id: string) {
		checklistForm.items = checklistForm.items.filter((item) => item.id !== id);
	}

	async function handleChecklistSubmit() {
		try {
			if (editingChecklist) {
				await fetch('/api/checklists', {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ id: editingChecklist.id, ...checklistForm })
				});
			} else {
				await fetch('/api/checklists', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(checklistForm)
				});
			}

			showChecklistModal = false;
			await loadChecklists();
		} catch (error) {
			console.error('Error saving checklist:', error);
		}
	}

	async function deleteChecklist(id: string) {
		if (!confirm('Are you sure you want to delete this checklist?')) return;

		try {
			await fetch('/api/checklists', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id })
			});

			await loadChecklists();
		} catch (error) {
			console.error('Error deleting checklist:', error);
		}
	}

	async function saveSettings() {
		if (!settings) return;

		try {
			await fetch('/api/settings', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(settings)
			});

			if (settings.theme === 'light' || settings.theme === 'dark') {
				themeStore.set(settings.theme);
			}

			alert('Settings saved successfully!');
		} catch (error) {
			console.error('Error saving settings:', error);
		}
	}

	function formatCurrency(value: number) {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
	}
</script>

<svelte:head>
	<title>Settings - TradeJournal</title>
</svelte:head>

<div class="p-8">
	<!-- Header -->
	<div class="mb-8">
		<h1 class="mb-2 text-3xl font-bold text-gray-900">Settings</h1>
		<p class="text-gray-600">Manage your accounts, instruments, strategies, and preferences</p>
	</div>

	<!-- Tabs -->
	<div class="mb-6 border-b border-gray-200">
		<nav class="flex space-x-8">
			<button
				onclick={() => (currentTab = 'accounts')}
				class="border-b-2 px-1 py-4 text-sm font-medium transition-colors {currentTab === 'accounts'
					? 'border-primary-600 text-primary-600'
					: 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}"
			>
				Accounts
			</button>
			<button
				onclick={() => (currentTab = 'instruments')}
				class="border-b-2 px-1 py-4 text-sm font-medium transition-colors {currentTab ===
				'instruments'
					? 'border-primary-600 text-primary-600'
					: 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}"
			>
				Instruments
			</button>
			<button
				onclick={() => (currentTab = 'strategies')}
				class="border-b-2 px-1 py-4 text-sm font-medium transition-colors {currentTab ===
				'strategies'
					? 'border-primary-600 text-primary-600'
					: 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}"
			>
				Strategies
			</button>
			<button
				onclick={() => (currentTab = 'checklists')}
				class="border-b-2 px-1 py-4 text-sm font-medium transition-colors {currentTab ===
				'checklists'
					? 'border-primary-600 text-primary-600'
					: 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}"
			>
				Checklists
			</button>
			<button
				onclick={() => (currentTab = 'general')}
				class="border-b-2 px-1 py-4 text-sm font-medium transition-colors {currentTab === 'general'
					? 'border-primary-600 text-primary-600'
					: 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}"
			>
				General
			</button>
		</nav>
	</div>

	<!-- Accounts Tab -->
	{#if currentTab === 'accounts'}
		<div class="card">
			<div class="mb-6 flex items-center justify-between">
				<h2 class="text-xl font-semibold text-gray-900">Trading Accounts</h2>
				<button onclick={openAddAccountModal} class="btn btn-primary flex items-center gap-2">
					<Plus class="h-5 w-5" />
					Add Account
				</button>
			</div>

			{#if currentAccounts.length === 0}
				<div class="py-12 text-center text-gray-500">
					No accounts yet. Click "Add Account" to create your first one.
				</div>
			{:else}
				<div class="space-y-4">
					{#each currentAccounts as account}
						<div class="rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50">
							<div class="flex items-center justify-between">
								<div class="flex-1">
									<div class="mb-2 flex items-center gap-3">
										<h3 class="text-lg font-semibold text-gray-900">{account.name}</h3>
										<span
											class="inline-flex items-center rounded px-2 py-1 text-xs font-medium {account.type ===
											'live'
												? 'bg-green-100 text-green-800'
												: account.type === 'demo'
													? 'bg-blue-100 text-blue-800'
													: 'bg-gray-100 text-gray-800'}"
										>
											{account.type.toUpperCase()}
										</span>
									</div>
									<div class="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
										<div>
											<span class="text-gray-600">Entity:</span>
											<span class="ml-1 font-medium text-gray-900">{account.entity}</span>
										</div>
										<div>
											<span class="text-gray-600">Balance:</span>
											<span class="ml-1 font-medium text-gray-900">
												{formatCurrency(account.balance)}
											</span>
										</div>
										<div>
											<span class="text-gray-600">Invested:</span>
											<span class="ml-1 font-medium text-gray-900">
												{formatCurrency(account.investedAmount)}
											</span>
										</div>
										<div>
											<span class="text-gray-600">Total P&L:</span>
											<span
												class="font-medium {account.totalPnl >= 0
													? 'text-profit'
													: 'text-loss'} ml-1"
											>
												{formatCurrency(account.totalPnl)}
											</span>
										</div>
									</div>
								</div>
								<div class="ml-4 flex items-center gap-2">
									<button
										onclick={() => openEditAccountModal(account)}
										class="hover:text-primary-600 p-2 text-gray-600 transition-colors"
									>
										<Edit class="h-5 w-5" />
									</button>
									<button
										onclick={() => deleteAccount(account.id)}
										class="p-2 text-gray-600 transition-colors hover:text-red-600"
									>
										<Trash2 class="h-5 w-5" />
									</button>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Enhanced Instruments Tab -->
	{#if currentTab === 'instruments'}
		<div class="card">
			<div class="mb-6 flex items-center justify-between">
				<div>
					<h2 class="text-xl font-semibold text-gray-900">Instruments</h2>
					<p class="mt-1 text-sm text-gray-500">
						Manage trading instruments with detailed specifications
					</p>
				</div>
				<button onclick={openAddInstrumentModal} class="btn btn-primary flex items-center gap-2">
					<Plus class="h-5 w-5" />
					Add Instrument
				</button>
			</div>

			{#if instruments.length === 0}
				<div class="py-12 text-center">
					<p class="mb-4 text-gray-500">
						No instruments yet. Add instruments to track what you're trading.
					</p>
					<p class="text-sm text-gray-400">
						Instruments include stocks, forex pairs, cryptocurrencies, futures, and more.
					</p>
				</div>
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full">
						<thead>
							<tr class="border-b border-gray-200">
								<th class="px-4 py-3 text-left text-sm font-medium text-gray-600">Symbol</th>
								<th class="px-4 py-3 text-left text-sm font-medium text-gray-600">Name</th>
								<th class="px-4 py-3 text-left text-sm font-medium text-gray-600">Type</th>
								<th class="px-4 py-3 text-left text-sm font-medium text-gray-600">Exchange</th>
								<th class="px-4 py-3 text-right text-sm font-medium text-gray-600">
									<span class="flex items-center justify-end gap-1">
										Pip Value
										<Info class="h-3 w-3 text-gray-400" />
									</span>
								</th>
								<th class="px-4 py-3 text-right text-sm font-medium text-gray-600">Actions</th>
							</tr>
						</thead>
						<tbody>
							{#each instruments as instrument}
								<tr class="border-b border-gray-100 hover:bg-gray-50">
									<td class="px-4 py-3 text-sm font-medium text-gray-900">{instrument.symbol}</td>
									<td class="px-4 py-3 text-sm text-gray-900">{instrument.name}</td>
									<td class="px-4 py-3">
										<span
											class="inline-flex items-center rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800"
										>
											{instrument.type.toUpperCase()}
										</span>
									</td>
									<td class="px-4 py-3 text-sm text-gray-900">{instrument.exchange}</td>
									<td class="px-4 py-3 text-right text-sm text-gray-900">
										{instrument.pipValue ? `$${instrument.pipValue}` : '-'}
									</td>
									<td class="px-4 py-3 text-right">
										<div class="flex items-center justify-end gap-2">
											<button
												onclick={() => openEditInstrumentModal(instrument)}
												class="hover:text-primary-600 p-1 text-gray-600 transition-colors"
											>
												<Edit class="h-4 w-4" />
											</button>
											<button
												onclick={() => deleteInstrument(instrument.id)}
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
				</div>
			{/if}
		</div>
	{/if}

	<!-- Strategies Tab -->
	{#if currentTab === 'strategies'}
		<div class="card">
			<div class="mb-6 flex items-center justify-between">
				<h2 class="text-xl font-semibold text-gray-900">Trading Strategies</h2>
				<button onclick={openAddStrategyModal} class="btn btn-primary flex items-center gap-2">
					<Plus class="h-5 w-5" />
					Add Strategy
				</button>
			</div>

			{#if strategies.length === 0}
				<div class="py-12 text-center text-gray-500">
					No strategies yet. Define your trading strategies to track performance.
				</div>
			{:else}
				<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
					{#each strategies as strategy}
						<div class="rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50">
							<div class="mb-3 flex items-start justify-between">
								<div>
									<h3 class="text-lg font-semibold text-gray-900">{strategy.name}</h3>
									<p class="mt-1 text-sm text-gray-600">{strategy.description}</p>
								</div>
								<div class="flex items-center gap-2">
									<button
										onclick={() => openEditStrategyModal(strategy)}
										class="hover:text-primary-600 p-1 text-gray-600 transition-colors"
									>
										<Edit class="h-4 w-4" />
									</button>
									<button
										onclick={() => deleteStrategy(strategy.id)}
										class="p-1 text-gray-600 transition-colors hover:text-red-600"
									>
										<Trash2 class="h-4 w-4" />
									</button>
								</div>
							</div>
							<div class="space-y-2 text-sm">
								<div>
									<span class="font-medium text-gray-700">Target R:R:</span>
									<span class="ml-2 text-gray-900">{strategy.targetRR}</span>
								</div>
								<div>
									<span class="font-medium text-gray-700">Timeframes:</span>
									<span class="ml-2 text-gray-900">{strategy.timeframes.join(', ')}</span>
								</div>
								<div>
									<span class="font-medium text-gray-700">Markets:</span>
									<span class="ml-2 text-gray-900">{strategy.markets.join(', ')}</span>
								</div>
								<div class="border-t border-gray-200 pt-2">
									<span class="font-medium text-gray-700">Status:</span>
									<span
										class="ml-2 inline-flex items-center rounded px-2 py-1 text-xs font-medium {strategy.active
											? 'bg-green-100 text-green-800'
											: 'bg-gray-100 text-gray-800'}"
									>
										{strategy.active ? 'ACTIVE' : 'INACTIVE'}
									</span>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Checklists Tab -->
	{#if currentTab === 'checklists'}
		<div class="card">
			<div class="mb-6 flex items-center justify-between">
				<h2 class="text-xl font-semibold text-gray-900">Trade Checklists</h2>
				<button onclick={openAddChecklistModal} class="btn btn-primary flex items-center gap-2">
					<Plus class="h-5 w-5" />
					Add Checklist
				</button>
			</div>

			{#if checklists.length === 0}
				<div class="py-12 text-center text-gray-500">
					No checklists yet. Create checklists to ensure consistent trade execution.
				</div>
			{:else}
				<div class="space-y-4">
					{#each checklists as checklist}
						<div class="rounded-lg border border-gray-200 p-4">
							<div class="mb-3 flex items-start justify-between">
								<h3 class="text-lg font-semibold text-gray-900">{checklist.name}</h3>
								<div class="flex items-center gap-2">
									<button
										onclick={() => openEditChecklistModal(checklist)}
										class="hover:text-primary-600 p-1 text-gray-600 transition-colors"
									>
										<Edit class="h-4 w-4" />
									</button>
									<button
										onclick={() => deleteChecklist(checklist.id)}
										class="p-1 text-gray-600 transition-colors hover:text-red-600"
									>
										<Trash2 class="h-4 w-4" />
									</button>
								</div>
							</div>
							<div class="space-y-2">
								{#each checklist.items as item}
									<div class="flex items-center gap-2 text-sm">
										<span
											class="inline-flex items-center rounded px-2 py-1 text-xs font-medium {item.category ===
											'pre-trade'
												? 'bg-blue-100 text-blue-800'
												: item.category === 'during-trade'
													? 'bg-yellow-100 text-yellow-800'
													: 'bg-green-100 text-green-800'}"
										>
											{item.category}
										</span>
										<span class="text-gray-900">{item.text}</span>
										{#if item.required}
											<span class="text-xs text-red-600">*</span>
										{/if}
									</div>
								{/each}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- General Settings Tab -->
	{#if currentTab === 'general' && settings}
		<div class="card">
			<h2 class="mb-6 text-xl font-semibold text-gray-900">General Settings</h2>

			<div class="max-w-2xl space-y-6">
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label class="label">Currency</label>
						<select bind:value={settings.currency} class="select">
							<option value="USD">USD ($)</option>
							<option value="EUR">EUR (€)</option>
							<option value="GBP">GBP (£)</option>
							<option value="JPY">JPY (¥)</option>
							<option value="INR">INR (₹)</option>
						</select>
					</div>

					<div>
						<label class="label">Timezone</label>
						<select bind:value={settings.timezone} class="select">
							<option value="UTC">UTC</option>
							<option value="America/New_York">Eastern Time (ET)</option>
							<option value="America/Chicago">Central Time (CT)</option>
							<option value="America/Denver">Mountain Time (MT)</option>
							<option value="America/Los_Angeles">Pacific Time (PT)</option>
							<option value="Europe/London">London</option>
							<option value="Asia/Tokyo">Tokyo</option>
							<option value="Asia/Kolkata">India</option>
						</select>
					</div>

					<div>
						<label class="label">Theme</label>
						<select
							bind:value={settings.theme}
							onchange={() => {
								if (settings.theme === 'light' || settings.theme === 'dark') {
									themeStore.set(settings.theme);
								}
							}}
							class="select"
						>
							<option value="light">Light</option>
							<option value="dark">Dark</option>
							<option value="auto">Auto (System)</option>
						</select>
						<p class="mt-1 text-xs text-gray-500">
							You can also use the theme toggle in the sidebar
						</p>
					</div>
				</div>

				<div>
					<h3 class="mb-4 text-lg font-semibold text-gray-900">Risk Management</h3>
					<div class="grid grid-cols-2 gap-4">
						<div>
							<label class="label">Default Lot Size</label>
							<input type="number" step="0.01" bind:value={settings.defaultLotSize} class="input" />
						</div>

						<div>
							<label class="label">Default R:R Ratio</label>
							<input type="number" step="0.1" bind:value={settings.defaultRR} class="input" />
						</div>

						<div>
							<label class="label">Risk Per Trade (%)</label>
							<input type="number" step="0.1" bind:value={settings.riskPerTrade} class="input" />
						</div>

						<div>
							<label class="label">Max Daily Loss (%)</label>
							<input type="number" step="0.1" bind:value={settings.maxDailyLoss} class="input" />
						</div>
					</div>
				</div>

				<div>
					<h3 class="mb-4 text-lg font-semibold text-gray-900">Trading Hours</h3>
					<div class="grid grid-cols-2 gap-4">
						<div>
							<label class="label">Start Time</label>
							<input type="time" bind:value={settings.tradingHours.start} class="input" />
						</div>

						<div>
							<label class="label">End Time</label>
							<input type="time" bind:value={settings.tradingHours.end} class="input" />
						</div>
					</div>
				</div>

				<button onclick={saveSettings} class="btn btn-primary flex items-center gap-2">
					<Save class="h-5 w-5" />
					Save Settings
				</button>
			</div>
		</div>
	{/if}
</div>

<!-- Account Modal -->
{#if showAccountModal}
	<div class="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black p-4">
		<div class="w-full max-w-md rounded-lg bg-white">
			<div class="border-b border-gray-200 p-6">
				<h2 class="text-xl font-bold text-gray-900">
					{editingAccount ? 'Edit Account' : 'Add New Account'}
				</h2>
			</div>

			<form
				onsubmit={(e) => {
					e.preventDefault();
					handleAccountSubmit();
				}}
				class="space-y-4 p-6"
			>
				<div>
					<label class="label">Account Name</label>
					<input
						type="text"
						bind:value={accountForm.name}
						required
						class="input"
						placeholder="My Trading Account"
					/>
				</div>

				<div>
					<label class="label">Entity / Broker</label>
					<input
						type="text"
						bind:value={accountForm.entity}
						required
						class="input"
						placeholder="Interactive Brokers, TD Ameritrade, etc."
					/>
				</div>

				<div>
					<label class="label">Account Type</label>
					<select bind:value={accountForm.type} required class="select">
						<option value="live">Live</option>
						<option value="demo">Demo</option>
						<option value="paper">Paper</option>
					</select>
				</div>

				<div>
					<label class="label">Current Balance</label>
					<div class="relative">
						<DollarSign
							class="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 transform text-gray-400"
						/>
						<input
							type="number"
							step="0.01"
							bind:value={accountForm.balance}
							required
							class="input pl-10"
							placeholder="10000.00"
						/>
					</div>
				</div>

				<div>
					<label class="label">Invested Amount</label>
					<div class="relative">
						<DollarSign
							class="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 transform text-gray-400"
						/>
						<input
							type="number"
							step="0.01"
							bind:value={accountForm.investedAmount}
							required
							class="input pl-10"
							placeholder="10000.00"
						/>
					</div>
				</div>

				<div class="flex gap-3 pt-4">
					<button type="submit" class="btn btn-primary flex-1">
						{editingAccount ? 'Update Account' : 'Create Account'}
					</button>
					<button
						type="button"
						onclick={() => (showAccountModal = false)}
						class="btn btn-secondary flex-1"
					>
						Cancel
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Enhanced Instrument Modal -->
{#if showInstrumentModal}
	<div
		class="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black p-4"
	>
		<div class="my-8 w-full max-w-4xl rounded-lg bg-white">
			<div class="sticky top-0 z-10 rounded-t-lg border-b border-gray-200 bg-white p-6">
				<div class="flex items-center justify-between">
					<div>
						<h2 class="text-xl font-bold text-gray-900">
							{editingInstrument ? 'Edit Instrument' : 'Add New Instrument'}
						</h2>
						<p class="mt-1 text-sm text-gray-500">Configure detailed instrument specifications</p>
					</div>
					<button
						onclick={() => (showInstrumentModal = false)}
						class="text-gray-400 hover:text-gray-600"
					>
						<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</button>
				</div>
			</div>

			<form
				onsubmit={(e) => {
					e.preventDefault();
					handleInstrumentSubmit();
				}}
				class="space-y-6 p-6"
			>
				<!-- Basic Information -->
				<div>
					<h3 class="mb-4 text-lg font-semibold text-gray-900">Basic Information</h3>
					<div class="grid grid-cols-2 gap-4 md:grid-cols-3">
						<div>
							<label class="label">
								Symbol
								<span class="text-red-600">*</span>
							</label>
							<input
								type="text"
								bind:value={instrumentForm.symbol}
								required
								class="input"
								placeholder="AAPL, EURUSD, BTC"
							/>
							<p class="mt-1 text-xs text-gray-500">Ticker or pair symbol</p>
						</div>

						<div>
							<label class="label">Type <span class="text-red-600">*</span></label>
							<select bind:value={instrumentForm.type} required class="select">
								<option value="stock">Stock</option>
								<option value="forex">Forex</option>
								<option value="crypto">Crypto</option>
								<option value="futures">Futures</option>
								<option value="options">Options</option>
								<option value="index">Index</option>
							</select>
						</div>

						<div>
							<label class="label">Currency <span class="text-red-600">*</span></label>
							<input
								type="text"
								bind:value={instrumentForm.currency}
								required
								class="input"
								placeholder="USD, EUR, GBP"
							/>
						</div>

						<div class="col-span-2">
							<label class="label">Name <span class="text-red-600">*</span></label>
							<input
								type="text"
								bind:value={instrumentForm.name}
								required
								class="input"
								placeholder="Apple Inc., Euro / US Dollar"
							/>
						</div>

						<div>
							<label class="label">Exchange</label>
							<input
								type="text"
								bind:value={instrumentForm.exchange}
								class="input"
								placeholder="NASDAQ, NYSE, Binance"
							/>
							<p class="mt-1 text-xs text-gray-500">Where it's traded</p>
						</div>
					</div>
				</div>

				<!-- Trading Specifications -->
				<div>
					<h3 class="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
						Trading Specifications
						<span class="text-sm font-normal text-gray-500">(Important for calculations)</span>
					</h3>
					<div class="grid grid-cols-2 gap-4 md:grid-cols-3">
						<div>
							<label class="label flex items-center gap-1">
								Tick Size
								<span class="cursor-help text-gray-400" title="Minimum price movement">
									<Info class="h-3 w-3" />
								</span>
							</label>
							<input
								type="number"
								step="0.0001"
								bind:value={instrumentForm.tickSize}
								required
								class="input"
							/>
							<p class="mt-1 text-xs text-gray-500">Min price increment (e.g., 0.01)</p>
						</div>

						<div>
							<label class="label flex items-center gap-1">
								Lot Size
								<span class="cursor-help text-gray-400" title="Standard position size">
									<Info class="h-3 w-3" />
								</span>
							</label>
							<input
								type="number"
								step="0.01"
								bind:value={instrumentForm.lotSize}
								required
								class="input"
							/>
							<p class="mt-1 text-xs text-gray-500">Standard lot (1 for stocks)</p>
						</div>

						<div>
							<label class="label flex items-center gap-1">
								Pip Value ($)
								<span class="cursor-help text-gray-400" title="Profit per pip movement">
									<Info class="h-3 w-3" />
								</span>
							</label>
							<input
								type="number"
								step="0.01"
								bind:value={instrumentForm.pipValue}
								class="input"
								placeholder="10.00"
							/>
							<p class="mt-1 text-xs text-gray-500">For forex: $10/pip standard lot</p>
						</div>

						<div>
							<label class="label flex items-center gap-1">
								Contract Size
								<span class="cursor-help text-gray-400" title="Contract multiplier">
									<Info class="h-3 w-3" />
								</span>
							</label>
							<input
								type="number"
								bind:value={instrumentForm.contractSize}
								class="input"
								placeholder="100000"
							/>
							<p class="mt-1 text-xs text-gray-500">Forex: 100,000 (standard lot)</p>
						</div>

						<div>
							<label class="label flex items-center gap-1">
								Margin Required (%)
								<span class="cursor-help text-gray-400" title="Required margin percentage">
									<Info class="h-3 w-3" />
								</span>
							</label>
							<input
								type="number"
								step="0.1"
								bind:value={instrumentForm.marginRequirement}
								class="input"
								placeholder="1.0"
							/>
							<p class="mt-1 text-xs text-gray-500">Typical: 1-5% for forex</p>
						</div>

						<div>
							<label class="label flex items-center gap-1">
								Typical Spread
								<span class="cursor-help text-gray-400" title="Average bid-ask spread">
									<Info class="h-3 w-3" />
								</span>
							</label>
							<input
								type="number"
								step="0.1"
								bind:value={instrumentForm.spread}
								class="input"
								placeholder="1.5"
							/>
							<p class="mt-1 text-xs text-gray-500">In pips/points</p>
						</div>

						<div class="col-span-2">
							<label class="label flex items-center gap-1">
								Trading Hours
								<span class="cursor-help text-gray-400" title="When market is open">
									<Info class="h-3 w-3" />
								</span>
							</label>
							<input
								type="text"
								bind:value={instrumentForm.tradingHours}
								class="input"
								placeholder="9:30-16:00 EST, 24/7, etc."
							/>
							<p class="mt-1 text-xs text-gray-500">When you can trade this</p>
						</div>

						<div>
							<label class="label flex items-center gap-1">
								Point Value ($)
								<span class="cursor-help text-gray-400" title="For futures contracts">
									<Info class="h-3 w-3" />
								</span>
							</label>
							<input
								type="number"
								step="0.01"
								bind:value={instrumentForm.pointValue}
								class="input"
								placeholder="50.00"
							/>
							<p class="mt-1 text-xs text-gray-500">Futures only</p>
						</div>
					</div>
				</div>

				<!-- Live Profit Calculator -->
				{#if instrumentForm.pipValue}
					<div
						class="rounded-lg border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-6"
					>
						<div class="mb-4 flex items-center gap-2">
							<Calculator class="h-5 w-5 text-blue-600" />
							<h4 class="font-semibold text-gray-900">Live Profit Calculator</h4>
						</div>
						<div class="mb-4 grid grid-cols-2 gap-4">
							<div>
								<label class="text-sm font-medium text-gray-700">Position Size (lots)</label>
								<input type="number" step="0.01" bind:value={calcPositionSize} class="input mt-1" />
							</div>
							<div>
								<label class="text-sm font-medium text-gray-700">Pip Movement</label>
								<input type="number" step="1" bind:value={calcPipMove} class="input mt-1" />
							</div>
						</div>
						<div class="rounded-lg border border-blue-300 bg-white p-4">
							<div class="flex items-center justify-between">
								<span class="text-sm text-gray-600">Profit/Loss:</span>
								<div class="flex items-center gap-2">
									<span
										class="text-2xl font-bold {calcProfit() >= 0 ? 'text-profit' : 'text-loss'}"
									>
										{formatCurrency(calcProfit())}
									</span>
									{#if calcProfit() >= 0}
										<TrendingUp class="text-profit h-5 w-5" />
									{:else}
										<TrendingDown class="text-loss h-5 w-5" />
									{/if}
								</div>
							</div>
							<p class="mt-2 text-xs text-gray-500">
								{calcPositionSize} lot × {calcPipMove} pips × ${instrumentForm.pipValue}/pip = {formatCurrency(
									calcProfit()
								)}
							</p>
						</div>
					</div>
				{/if}

				<!-- Notes -->
				<div>
					<label class="label">Notes</label>
					<textarea
						bind:value={instrumentForm.notes}
						rows="3"
						class="input"
						placeholder="Any additional notes about this instrument..."
					></textarea>
				</div>

				<div class="flex gap-3 border-t border-gray-200 pt-4">
					<button type="submit" class="btn btn-primary flex-1">
						{editingInstrument ? 'Update Instrument' : 'Create Instrument'}
					</button>
					<button
						type="button"
						onclick={() => (showInstrumentModal = false)}
						class="btn btn-secondary flex-1"
					>
						Cancel
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Strategy Modal (same as before) -->
{#if showStrategyModal}
	<div
		class="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black p-4"
	>
		<div class="my-8 w-full max-w-2xl rounded-lg bg-white">
			<div class="border-b border-gray-200 p-6">
				<h2 class="text-xl font-bold text-gray-900">
					{editingStrategy ? 'Edit Strategy' : 'Add New Strategy'}
				</h2>
			</div>

			<form
				onsubmit={(e) => {
					e.preventDefault();
					handleStrategySubmit();
				}}
				class="space-y-4 p-6"
			>
				<div>
					<label class="label">Strategy Name</label>
					<input
						type="text"
						bind:value={strategyForm.name}
						required
						class="input"
						placeholder="Breakout Strategy"
					/>
				</div>

				<div>
					<label class="label">Description</label>
					<textarea
						bind:value={strategyForm.description}
						rows="2"
						class="input"
						placeholder="Brief description of the strategy..."
					></textarea>
				</div>

				<div>
					<label class="label">Setup Conditions</label>
					<textarea
						bind:value={strategyForm.setup}
						rows="2"
						class="input"
						placeholder="What conditions need to be met?"
					></textarea>
				</div>

				<div>
					<label class="label">Entry Rules</label>
					<textarea
						bind:value={strategyForm.entry}
						rows="2"
						class="input"
						placeholder="When do you enter?"
					></textarea>
				</div>

				<div>
					<label class="label">Exit Rules</label>
					<textarea
						bind:value={strategyForm.exit}
						rows="2"
						class="input"
						placeholder="When do you exit?"
					></textarea>
				</div>

				<div>
					<label class="label">Stop Loss Rules</label>
					<textarea
						bind:value={strategyForm.stopLoss}
						rows="2"
						class="input"
						placeholder="Where do you place stop loss?"
					></textarea>
				</div>

				<div class="grid grid-cols-3 gap-4">
					<div>
						<label class="label">Target R:R</label>
						<input
							type="number"
							step="0.1"
							bind:value={strategyForm.targetRR}
							required
							class="input"
						/>
					</div>

					<div>
						<label class="label">Timeframes (comma separated)</label>
						<input
							type="text"
							bind:value={strategyForm.timeframes}
							class="input"
							placeholder="5m, 15m, 1h"
						/>
					</div>

					<div>
						<label class="label">Markets (comma separated)</label>
						<input
							type="text"
							bind:value={strategyForm.markets}
							class="input"
							placeholder="Stocks, Forex"
						/>
					</div>
				</div>

				<div>
					<label class="label">Additional Notes</label>
					<textarea bind:value={strategyForm.notes} rows="2" class="input"></textarea>
				</div>

				<div>
					<label class="flex items-center gap-2">
						<input
							type="checkbox"
							bind:checked={strategyForm.active}
							class="text-primary-600 focus:ring-primary-500 h-4 w-4 rounded border-gray-300"
						/>
						<span class="text-sm font-medium text-gray-700">Active Strategy</span>
					</label>
				</div>

				<div class="flex gap-3 pt-4">
					<button type="submit" class="btn btn-primary flex-1">
						{editingStrategy ? 'Update' : 'Create'}
					</button>
					<button
						type="button"
						onclick={() => (showStrategyModal = false)}
						class="btn btn-secondary flex-1"
					>
						Cancel
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Checklist Modal (same as before) -->
{#if showChecklistModal}
	<div
		class="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black p-4"
	>
		<div class="my-8 w-full max-w-2xl rounded-lg bg-white">
			<div class="border-b border-gray-200 p-6">
				<h2 class="text-xl font-bold text-gray-900">
					{editingChecklist ? 'Edit Checklist' : 'Add New Checklist'}
				</h2>
			</div>

			<form
				onsubmit={(e) => {
					e.preventDefault();
					handleChecklistSubmit();
				}}
				class="space-y-4 p-6"
			>
				<div>
					<label class="label">Checklist Name</label>
					<input
						type="text"
						bind:value={checklistForm.name}
						required
						class="input"
						placeholder="Pre-Trade Checklist"
					/>
				</div>

				<div>
					<h3 class="mb-2 font-medium text-gray-900">Checklist Items</h3>
					<div class="mb-4 space-y-2">
						{#each checklistForm.items as item}
							<div class="flex items-center gap-2 rounded bg-gray-50 p-2">
								<span
									class="inline-flex items-center rounded px-2 py-1 text-xs font-medium {item.category ===
									'pre-trade'
										? 'bg-blue-100 text-blue-800'
										: item.category === 'during-trade'
											? 'bg-yellow-100 text-yellow-800'
											: 'bg-green-100 text-green-800'}"
								>
									{item.category}
								</span>
								<span class="flex-1 text-sm">{item.text}</span>
								{#if item.required}
									<span class="text-xs text-red-600">Required</span>
								{/if}
								<button
									type="button"
									onclick={() => removeChecklistItem(item.id)}
									class="text-red-600 hover:text-red-800"
								>
									<Trash2 class="h-4 w-4" />
								</button>
							</div>
						{/each}
					</div>

					<div class="rounded-lg border border-gray-200 p-4">
						<h4 class="mb-3 text-sm font-medium text-gray-900">Add Item</h4>
						<div class="space-y-3">
							<input
								type="text"
								bind:value={newChecklistItem.text}
								class="input"
								placeholder="Check trend direction..."
							/>
							<div class="flex gap-2">
								<select bind:value={newChecklistItem.category} class="select flex-1">
									<option value="pre-trade">Pre-Trade</option>
									<option value="during-trade">During Trade</option>
									<option value="post-trade">Post-Trade</option>
								</select>
								<label class="flex items-center gap-2 px-3">
									<input
										type="checkbox"
										bind:checked={newChecklistItem.required}
										class="text-primary-600 h-4 w-4 rounded border-gray-300"
									/>
									<span class="text-sm">Required</span>
								</label>
								<button type="button" onclick={addChecklistItem} class="btn btn-secondary">
									<Plus class="h-4 w-4" />
								</button>
							</div>
						</div>
					</div>
				</div>

				<div class="flex gap-3 pt-4">
					<button type="submit" class="btn btn-primary flex-1">
						{editingChecklist ? 'Update' : 'Create'}
					</button>
					<button
						type="button"
						onclick={() => (showChecklistModal = false)}
						class="btn btn-secondary flex-1"
					>
						Cancel
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
