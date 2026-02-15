<script lang="ts">
	import './layout.css';
	import { page } from '$app/stores';
	import { selectedAccountId, accounts } from '$lib/stores';
	import { onMount } from 'svelte';
	import { 
		LayoutDashboard, 
		BookOpen, 
		BarChart3, 
		Settings, 
		TrendingUp,
		ChevronDown 
	} from 'lucide-svelte';

	let showAccountDropdown = $state(false);
	let currentAccounts = $state<any[]>([]);
	let currentSelectedId = $state('');

	onMount(async () => {
		const res = await fetch('/api/accounts');
		const data = await res.json();
		accounts.set(data);
		currentAccounts = data;
		
		if (data.length > 0 && !currentSelectedId) {
			selectedAccountId.set(data[0].id);
			currentSelectedId = data[0].id;
		}
	});

	accounts.subscribe(value => {
		currentAccounts = value;
	});

	selectedAccountId.subscribe(value => {
		currentSelectedId = value;
	});

	const selectedAccount = $derived(
		currentAccounts.find(acc => acc.id === currentSelectedId)
	);

	const navigation = [
		{ name: 'Dashboard', href: '/', icon: LayoutDashboard },
		{ name: 'Trade Log', href: '/log', icon: BookOpen },
		{ name: 'Analytics', href: '/analytics', icon: BarChart3 },
		{ name: 'Settings', href: '/settings', icon: Settings }
	];

	function selectAccount(id: string) {
		selectedAccountId.set(id);
		showAccountDropdown = false;
	}
</script>

<div class="flex h-screen bg-gray-50">
	<!-- Sidebar -->
	<div class="w-64 bg-white border-r border-gray-200 flex flex-col">
		<!-- Logo -->
		<div class="p-6 border-b border-gray-200">
			<div class="flex items-center gap-2">
				<TrendingUp class="w-8 h-8 text-primary-600" />
				<h1 class="text-xl font-bold text-gray-900">TradeJournal</h1>
			</div>
		</div>

		<!-- Account Selector -->
		<div class="p-4 border-b border-gray-200">
			<button
				onclick={() => showAccountDropdown = !showAccountDropdown}
				class="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
			>
				<div class="flex flex-col items-start">
					<span class="text-xs text-gray-500">Account</span>
					<span class="text-sm font-medium text-gray-900">
						{selectedAccount?.name || 'Select Account'}
					</span>
				</div>
				<ChevronDown class="w-4 h-4 text-gray-500" />
			</button>

			{#if showAccountDropdown}
				<div class="absolute left-4 right-4 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
					{#each currentAccounts as account}
						<button
							onclick={() => selectAccount(account.id)}
							class="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
						>
							<div class="flex flex-col">
								<span class="text-sm font-medium text-gray-900">{account.name}</span>
								<span class="text-xs text-gray-500">{account.entity} • {account.type}</span>
							</div>
						</button>
					{/each}
					<a
						href="/settings"
						class="block w-full px-4 py-3 text-sm text-primary-600 hover:bg-gray-50 transition-colors"
						onclick={() => showAccountDropdown = false}
					>
						+ Add New Account
					</a>
				</div>
			{/if}
		</div>

		<!-- Navigation -->
		<nav class="flex-1 p-4 space-y-1">
			{#each navigation as item}
				<a
					href={item.href}
					class="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors {$page.url.pathname === item.href
						? 'bg-primary-50 text-primary-700'
						: 'text-gray-700 hover:bg-gray-50'}"
				>
					<svelte:component this={item.icon} class="w-5 h-5" />
					<span class="text-sm font-medium">{item.name}</span>
				</a>
			{/each}
		</nav>

		<!-- Footer -->
		<div class="p-4 border-t border-gray-200">
			<div class="text-xs text-gray-500">
				Version 1.0.0
			</div>
		</div>
	</div>

	<!-- Main Content -->
	<div class="flex-1 overflow-auto">
		<slot />
	</div>
</div>

<svelte:window onclick={(e) => {
	if (!(e.target as Element).closest('.account-dropdown')) {
		showAccountDropdown = false;
	}
}} />
