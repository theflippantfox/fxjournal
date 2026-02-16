<script lang="ts">
	import './layout.css';
	import { page } from '$app/stores';
	import { selectedAccountId, accounts, theme } from '$lib/stores';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import {
		LayoutDashboard,
		BookOpen,
		BarChart3,
		Settings,
		TrendingUp,
		ChevronDown,
		Plus,
		Moon,
		Sun,
		Calendar
	} from 'lucide-svelte';

	let showAccountDropdown = $state(false);
	let currentAccounts = $state<any[]>([]);
	let currentSelectedId = $state('');
	let currentTheme = $state<'light' | 'dark'>('light');

	onMount(async () => {
		// Initialize theme
		theme.init();

		const res = await fetch('/api/accounts');
		const data = await res.json();
		accounts.set(data);
		currentAccounts = data;

		if (data.length > 0 && !currentSelectedId) {
			selectedAccountId.set(data[0].id);
			currentSelectedId = data[0].id;
		}
	});

	accounts.subscribe((value) => {
		currentAccounts = value;
	});

	selectedAccountId.subscribe((value) => {
		currentSelectedId = value;
	});

	theme.subscribe((value) => {
		currentTheme = value;
	});

	const selectedAccount = $derived(currentAccounts.find((acc) => acc.id === currentSelectedId));

	const navigation = [
		{ name: 'Dashboard', href: '/', icon: LayoutDashboard },
		{ name: 'Trade Log', href: '/log', icon: BookOpen },
		{ name: 'Analytics', href: '/analytics', icon: BarChart3 },
		{ name: 'Calendar', href: '/calendar', icon: Calendar },
		{ name: 'Settings', href: '/settings', icon: Settings }
	];

	function selectAccount(id: string) {
		selectedAccountId.set(id);
		currentSelectedId = id;
		showAccountDropdown = false;
	}

	function handleAddAccount() {
		showAccountDropdown = false;
		goto('/settings?tab=accounts&action=add');
	}

	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.account-dropdown-container')) {
			showAccountDropdown = false;
		}
	}

	function toggleTheme() {
		theme.toggle();
	}
</script>

<svelte:window onclick={handleClickOutside} />

<div class="flex h-screen bg-gray-50">
	<!-- Sidebar -->
	<div class="flex w-64 flex-col border-r border-gray-200 bg-white">
		<!-- Logo -->
		<div class="border-b border-gray-200 p-6">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					<TrendingUp class="text-primary-600 h-8 w-8" />
					<h1 class="text-xl font-bold text-gray-900">TradeJournal</h1>
				</div>
				<!-- Theme Toggle -->
				<button
					onclick={toggleTheme}
					class="rounded-lg p-2 transition-colors hover:bg-gray-100"
					title="Toggle theme"
				>
					{#if currentTheme === 'dark'}
						<Sun class="h-5 w-5 text-gray-600" />
					{:else}
						<Moon class="h-5 w-5 text-gray-600" />
					{/if}
				</button>
			</div>
		</div>

		<!-- Account Selector -->
		<div class="border-b border-gray-200 p-4">
			<div class="account-dropdown-container relative">
				<button
					onclick={(e) => {
						e.stopPropagation();
						showAccountDropdown = !showAccountDropdown;
					}}
					class="flex w-full items-center justify-between rounded-lg bg-gray-50 p-3 transition-colors hover:bg-gray-100"
				>
					<div class="flex flex-col items-start">
						<span class="text-xs text-gray-500">Account</span>
						<span class="text-sm font-medium text-gray-900">
							{selectedAccount?.name || 'Select Account'}
						</span>
					</div>
					<ChevronDown
						class="h-4 w-4 text-gray-500 transition-transform {showAccountDropdown
							? 'rotate-180'
							: ''}"
					/>
				</button>

				{#if showAccountDropdown}
					<div
						class="absolute right-0 left-0 z-50 mt-2 max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg"
					>
						{#each currentAccounts as account}
							<button
								onclick={(e) => {
									e.stopPropagation();
									selectAccount(account.id);
								}}
								class="w-full border-b border-gray-100 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-gray-50 {account.id ===
								currentSelectedId
									? 'bg-blue-50'
									: ''}"
							>
								<div class="flex flex-col">
									<span class="text-sm font-medium text-gray-900">{account.name}</span>
									<span class="text-xs text-gray-500">{account.entity} • {account.type}</span>
								</div>
							</button>
						{/each}
						<button
							onclick={(e) => {
								e.stopPropagation();
								handleAddAccount();
							}}
							class="text-primary-600 flex w-full items-center gap-2 border-t border-gray-200 px-4 py-3 text-sm transition-colors hover:bg-gray-50"
						>
							<Plus class="h-4 w-4" />
							Add New Account
						</button>
					</div>
				{/if}
			</div>
		</div>

		<!-- Navigation -->
		<nav class="flex-1 space-y-1 p-4">
			{#each navigation as item}
				<a
					href={item.href}
					class="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors {$page.url
						.pathname === item.href
						? 'bg-primary-50 text-primary-700'
						: 'text-gray-700 hover:bg-gray-50'}"
				>
					<svelte:component this={item.icon} class="h-5 w-5" />
					<span class="text-sm font-medium">{item.name}</span>
				</a>
			{/each}
		</nav>

		<!-- Footer -->
		<div class="border-t border-gray-200 p-4">
			<div class="text-xs text-gray-500">Version 1.0.0</div>
		</div>
	</div>

	<!-- Main Content -->
	<div class="flex-1 overflow-auto">
		<slot />
	</div>
</div>
