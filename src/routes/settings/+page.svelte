<script lang="ts">
	import { onMount } from 'svelte';
	import { accounts } from '$lib/stores';
	import { Plus, Edit, Trash2, DollarSign } from 'lucide-svelte';
	import type { Account, Settings } from '$lib/types';

	let currentAccounts = $state<Account[]>([]);
	let settings = $state<Settings | null>(null);
	let showAccountModal = $state(false);
	let editingAccount = $state<Account | null>(null);
	
	let accountForm = $state({
		name: '',
		entity: '',
		type: 'live' as 'live' | 'demo' | 'paper',
		balance: '',
		investedAmount: ''
	});

	onMount(async () => {
		await loadAccounts();
		await loadSettings();
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

	async function loadSettings() {
		try {
			const res = await fetch('/api/settings');
			settings = await res.json();
		} catch (error) {
			console.error('Error loading settings:', error);
		}
	}

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

	async function saveSettings() {
		if (!settings) return;

		try {
			await fetch('/api/settings', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(settings)
			});

			alert('Settings saved successfully!');
		} catch (error) {
			console.error('Error saving settings:', error);
		}
	}
</script>

<svelte:head>
	<title>Settings - TradeJournal</title>
</svelte:head>

<div class="p-8">
	<!-- Header -->
	<div class="mb-8">
		<h1 class="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
		<p class="text-gray-600">Manage your accounts and preferences</p>
	</div>

	<!-- Accounts Section -->
	<div class="card mb-6">
		<div class="flex items-center justify-between mb-6">
			<h2 class="text-xl font-semibold text-gray-900">Trading Accounts</h2>
			<button onclick={openAddAccountModal} class="btn btn-primary flex items-center gap-2">
				<Plus class="w-5 h-5" />
				Add Account
			</button>
		</div>

		{#if currentAccounts.length === 0}
			<div class="text-center py-12 text-gray-500">
				No accounts yet. Click "Add Account" to create your first one.
			</div>
		{:else}
			<div class="space-y-4">
				{#each currentAccounts as account}
					<div class="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
						<div class="flex items-center justify-between">
							<div class="flex-1">
								<div class="flex items-center gap-3 mb-2">
									<h3 class="text-lg font-semibold text-gray-900">{account.name}</h3>
									<span class="inline-flex items-center px-2 py-1 rounded text-xs font-medium {
										account.type === 'live' ? 'bg-green-100 text-green-800' :
										account.type === 'demo' ? 'bg-blue-100 text-blue-800' :
										'bg-gray-100 text-gray-800'
									}">
										{account.type.toUpperCase()}
									</span>
								</div>
								<div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
									<div>
										<span class="text-gray-600">Entity:</span>
										<span class="font-medium text-gray-900 ml-1">{account.entity}</span>
									</div>
									<div>
										<span class="text-gray-600">Balance:</span>
										<span class="font-medium text-gray-900 ml-1">
											${account.balance.toLocaleString()}
										</span>
									</div>
									<div>
										<span class="text-gray-600">Invested:</span>
										<span class="font-medium text-gray-900 ml-1">
											${account.investedAmount.toLocaleString()}
										</span>
									</div>
									<div>
										<span class="text-gray-600">Total P&L:</span>
										<span class="font-medium {account.totalPnl >= 0 ? 'text-profit' : 'text-loss'} ml-1">
											${account.totalPnl.toLocaleString()}
										</span>
									</div>
								</div>
							</div>
							<div class="flex items-center gap-2 ml-4">
								<button
									onclick={() => openEditAccountModal(account)}
									class="p-2 text-gray-600 hover:text-primary-600 transition-colors"
								>
									<Edit class="w-5 h-5" />
								</button>
								<button
									onclick={() => deleteAccount(account.id)}
									class="p-2 text-gray-600 hover:text-red-600 transition-colors"
								>
									<Trash2 class="w-5 h-5" />
								</button>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- General Settings -->
	{#if settings}
		<div class="card">
			<h2 class="text-xl font-semibold text-gray-900 mb-6">General Settings</h2>
			
			<div class="space-y-4 max-w-xl">
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
					<select bind:value={settings.theme} class="select">
						<option value="light">Light</option>
						<option value="dark">Dark</option>
						<option value="auto">Auto</option>
					</select>
				</div>

				<button onclick={saveSettings} class="btn btn-primary">
					Save Settings
				</button>
			</div>
		</div>
	{/if}
</div>

<!-- Add/Edit Account Modal -->
{#if showAccountModal}
	<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
		<div class="bg-white rounded-lg max-w-md w-full">
			<div class="p-6 border-b border-gray-200">
				<h2 class="text-xl font-bold text-gray-900">
					{editingAccount ? 'Edit Account' : 'Add New Account'}
				</h2>
			</div>

			<form onsubmit={(e) => { e.preventDefault(); handleAccountSubmit(); }} class="p-6 space-y-4">
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
						<DollarSign class="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
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
						<DollarSign class="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
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
						onclick={() => showAccountModal = false}
						class="btn btn-secondary flex-1"
					>
						Cancel
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
