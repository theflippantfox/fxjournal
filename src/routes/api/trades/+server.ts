// src/routes/api/trades/+server.ts
import { json } from '@sveltejs/kit';
import { storage } from '$lib/server/storage';
import type { RequestHandler } from './$types';

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
      // Update existing trade
      trades[existingIndex] = trade;
    } else {
      // Add new trade
      trades.push(trade);
    }
    
    await storage.saveTrades(trades);
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
    const filteredTrades = trades.filter((t: any) => t.id !== id);
    
    await storage.saveTrades(filteredTrades);
    return json({ success: true });
  } catch (error) {
    console.error('Error deleting trade:', error);
    return json({ error: 'Failed to delete trade' }, { status: 500 });
  }
};
