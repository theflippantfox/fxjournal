// src/routes/api/accounts/+server.ts
import { json } from '@sveltejs/kit';
import { storage } from '$lib/server/storage';
import type { RequestHandler } from './$types';

// GET all accounts
export const GET: RequestHandler = async () => {
  try {
    const accounts = await storage.getAccounts();
    return json(accounts);
  } catch (error) {
    console.error('Error fetching accounts:', error);
    return json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }
};

// POST new account or update existing
export const POST: RequestHandler = async ({ request }) => {
  try {
    const account = await request.json();
    const accounts = await storage.getAccounts();
    
    const existingIndex = accounts.findIndex((a: any) => a.id === account.id);
    
    if (existingIndex !== -1) {
      // If updating, preserve initialBalance if not provided
      const existing = accounts[existingIndex];
      account.initialBalance = account.initialBalance ?? existing.initialBalance ?? account.balance;
      accounts[existingIndex] = account;
    } else {
      // New account: set initialBalance to starting balance
      account.initialBalance = account.initialBalance ?? account.balance;
      accounts.push(account);
    }
    
    await storage.saveAccounts(accounts);
    return json({ success: true, account });
  } catch (error) {
    console.error('Error saving account:', error);
    return json({ error: 'Failed to save account' }, { status: 500 });
  }
};

// DELETE account
export const DELETE: RequestHandler = async ({ url }) => {
  try {
    const id = url.searchParams.get('id');
    if (!id) {
      return json({ error: 'Account ID required' }, { status: 400 });
    }
    
    const accounts = await storage.getAccounts();
    const filteredAccounts = accounts.filter((a: any) => a.id !== id);
    
    await storage.saveAccounts(filteredAccounts);
    return json({ success: true });
  } catch (error) {
    console.error('Error deleting account:', error);
    return json({ error: 'Failed to delete account' }, { status: 500 });
  }
};
