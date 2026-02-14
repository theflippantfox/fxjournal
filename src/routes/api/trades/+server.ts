// src/routes/api/trades/+server.ts
import { json } from '@sveltejs/kit';
import { storage } from '$lib/server/storage';
import type { RequestHandler } from './$types';

async function syncAccountBalance(accountId: string) {
  const trades = await storage.getTrades();
  const accounts = await storage.getAccounts();
  const accountIndex = accounts.findIndex((a: any) => a.id === accountId);
  
  if (accountIndex !== -1) {
    const account = accounts[accountIndex];
    const accountTrades = trades.filter((t: any) => t.accountId === accountId);
    const totalPnl = accountTrades.reduce((sum: number, t: any) => sum + (t.pnl || 0), 0);
    
    // Update balance: Initial Balance + Total P&L
    // We assume the user might have an initial balance set
    const initialBalance = account.initialBalance || 0;
    account.balance = initialBalance + totalPnl;
    
    await storage.saveAccounts(accounts);
  }
}

// GET all trades
export const GET: RequestHandler = async () => {
  try {
    const trades = await storage.getTrades();
    return json(trades);
  } catch (error) {
    console.error('Error fetching trades:', error);
    return json({ error: 'Failed to fetch trades' }, { status: 500 });
  }
};

// POST new trade or update existing
export const POST: RequestHandler = async ({ request }) => {
  try {
    const trade = await request.json();
    const trades = await storage.getTrades();
    
    const existingIndex = trades.findIndex((t: any) => t.id === trade.id);
    
    if (existingIndex !== -1) {
      trades[existingIndex] = trade;
    } else {
      trades.push(trade);
    }
    
    await storage.saveTrades(trades);
    
    // Sync account balance
    if (trade.accountId) {
      await syncAccountBalance(trade.accountId);
    }
    
    return json({ success: true, trade });
  } catch (error) {
    console.error('Error saving trade:', error);
    return json({ error: 'Failed to save trade' }, { status: 500 });
  }
};

// DELETE trade
export const DELETE: RequestHandler = async ({ url }) => {
  try {
    const id = url.searchParams.get('id');
    if (!id) {
      return json({ error: 'Trade ID required' }, { status: 400 });
    }
    
    const trades = await storage.getTrades();
    const tradeToDelete = trades.find((t: any) => t.id === id);
    const filteredTrades = trades.filter((t: any) => t.id !== id);
    
    await storage.saveTrades(filteredTrades);
    
    // Sync account balance
    if (tradeToDelete && tradeToDelete.accountId) {
      await syncAccountBalance(tradeToDelete.accountId);
    }
    
    return json({ success: true });
  } catch (error) {
    console.error('Error deleting trade:', error);
    return json({ error: 'Failed to delete trade' }, { status: 500 });
  }
};
