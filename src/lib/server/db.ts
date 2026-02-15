import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import type { Account, Trade, Settings } from '$lib/types';

const DATA_DIR = join(process.cwd(), 'data');

async function ensureDataDir() {
	if (!existsSync(DATA_DIR)) {
		await mkdir(DATA_DIR, { recursive: true });
	}
}

async function readJSON<T>(filename: string, defaultValue: T): Promise<T> {
	await ensureDataDir();
	const filepath = join(DATA_DIR, filename);
	
	if (!existsSync(filepath)) {
		await writeFile(filepath, JSON.stringify(defaultValue, null, 2));
		return defaultValue;
	}
	
	const data = await readFile(filepath, 'utf-8');
	return JSON.parse(data);
}

async function writeJSON<T>(filename: string, data: T): Promise<void> {
	await ensureDataDir();
	const filepath = join(DATA_DIR, filename);
	await writeFile(filepath, JSON.stringify(data, null, 2));
}

// Accounts
export async function getAccounts(): Promise<Account[]> {
	return await readJSON<Account[]>('accounts.json', []);
}

export async function saveAccounts(accounts: Account[]): Promise<void> {
	await writeJSON('accounts.json', accounts);
}

export async function getAccount(id: string): Promise<Account | null> {
	const accounts = await getAccounts();
	return accounts.find(acc => acc.id === id) || null;
}

export async function createAccount(account: Omit<Account, 'id' | 'createdAt'>): Promise<Account> {
	const accounts = await getAccounts();
	const newAccount: Account = {
		...account,
		id: Date.now().toString(),
		createdAt: new Date().toISOString()
	};
	accounts.push(newAccount);
	await saveAccounts(accounts);
	return newAccount;
}

export async function updateAccount(id: string, updates: Partial<Account>): Promise<Account | null> {
	const accounts = await getAccounts();
	const index = accounts.findIndex(acc => acc.id === id);
	
	if (index === -1) return null;
	
	accounts[index] = { ...accounts[index], ...updates };
	await saveAccounts(accounts);
	return accounts[index];
}

export async function deleteAccount(id: string): Promise<boolean> {
	const accounts = await getAccounts();
	const filteredAccounts = accounts.filter(acc => acc.id !== id);
	
	if (filteredAccounts.length === accounts.length) return false;
	
	await saveAccounts(filteredAccounts);
	
	// Also delete trades for this account
	const trades = await getTrades();
	const filteredTrades = trades.filter(trade => trade.accountId !== id);
	await saveTrades(filteredTrades);
	
	return true;
}

// Trades
export async function getTrades(accountId?: string): Promise<Trade[]> {
	const trades = await readJSON<Trade[]>('trades.json', []);
	if (accountId) {
		return trades.filter(trade => trade.accountId === accountId);
	}
	return trades;
}

export async function saveTrades(trades: Trade[]): Promise<void> {
	await writeJSON('trades.json', trades);
}

export async function getTrade(id: string): Promise<Trade | null> {
	const trades = await getTrades();
	return trades.find(trade => trade.id === id) || null;
}

export async function createTrade(trade: Omit<Trade, 'id'>): Promise<Trade> {
	const trades = await getTrades();
	const newTrade: Trade = {
		...trade,
		id: Date.now().toString()
	};
	trades.push(newTrade);
	await saveTrades(trades);
	
	// Update account PnL
	await updateAccountPnL(trade.accountId);
	
	return newTrade;
}

export async function updateTrade(id: string, updates: Partial<Trade>): Promise<Trade | null> {
	const trades = await getTrades();
	const index = trades.findIndex(trade => trade.id === id);
	
	if (index === -1) return null;
	
	const oldAccountId = trades[index].accountId;
	trades[index] = { ...trades[index], ...updates };
	await saveTrades(trades);
	
	// Update account PnL
	await updateAccountPnL(oldAccountId);
	if (updates.accountId && updates.accountId !== oldAccountId) {
		await updateAccountPnL(updates.accountId);
	}
	
	return trades[index];
}

export async function deleteTrade(id: string): Promise<boolean> {
	const trades = await getTrades();
	const trade = trades.find(t => t.id === id);
	const filteredTrades = trades.filter(t => t.id !== id);
	
	if (filteredTrades.length === accounts.length) return false;
	
	await saveTrades(filteredTrades);
	
	// Update account PnL
	if (trade) {
		await updateAccountPnL(trade.accountId);
	}
	
	return true;
}

async function updateAccountPnL(accountId: string): Promise<void> {
	const trades = await getTrades(accountId);
	const totalPnl = trades.reduce((sum, trade) => sum + trade.pnl - trade.fees, 0);
	
	await updateAccount(accountId, { totalPnl });
}

// Settings
export async function getSettings(): Promise<Settings> {
	return await readJSON<Settings>('settings.json', {
		currency: 'USD',
		timezone: 'UTC',
		defaultAccount: '',
		theme: 'light'
	});
}

export async function saveSettings(settings: Settings): Promise<void> {
	await writeJSON('settings.json', settings);
}
