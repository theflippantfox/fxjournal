// src/lib/server/db.ts
import { createClient } from '@supabase/supabase-js';
import {
  PUBLIC_SUPABASE_URL,
  PUBLIC_SUPABASE_ANON_KEY
} from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import type { Account, Trade, Instrument, Strategy } from '$lib/types';

// Server-side admin client (uses service role key)
export const supabaseAdmin = createClient(
  PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

// ===== ACCOUNTS =====
export async function getAccounts(): Promise<Account[]> {
  const { data, error } = await supabaseAdmin
    .from('accounts')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function createAccount(account: Omit<Account, 'id' | 'created_at'>): Promise<Account> {
  const { data, error } = await supabaseAdmin
    .from('accounts')
    .insert(account)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateAccount(id: string, updates: Partial<Account>): Promise<void> {
  const { error } = await supabaseAdmin
    .from('accounts')
    .update(updates)
    .eq('id', id);
  if (error) throw error;
}

export async function deleteAccount(id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('accounts')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ===== TRADES =====
export async function getTrades(accountId: string): Promise<Trade[]> {
  const { data, error } = await supabaseAdmin
    .from('trades')
    .select('*')
    .eq('account_id', accountId)
    .order('entry_date', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createTrade(trade: Omit<Trade, 'id' | 'created_at' | 'updated_at'>): Promise<Trade> {
  const calculated = calculateTradeMetrics(trade);
  const { data, error } = await supabaseAdmin
    .from('trades')
    .insert({ ...trade, ...calculated })
    .select()
    .single();
  if (error) throw error;

  // Update account balance
  if (data.status === 'closed' && data.net_pnl != null) {
    await updateAccountBalance(data.account_id, data.net_pnl);
  }

  // Update strategy stats if applicable
  if (data.strategy_id && data.status === 'closed') {
    await updateStrategyStats(data.strategy_id, data.account_id);
  }

  return data;
}

export async function updateTrade(id: string, updates: Partial<Trade>): Promise<Trade> {
  const existing = await supabaseAdmin
    .from('trades')
    .select('*')
    .eq('id', id)
    .single();

  if (existing.error) throw existing.error;

  const merged = { ...existing.data, ...updates };
  const calculated = calculateTradeMetrics(merged);
  const finalUpdate = { ...updates, ...calculated, updated_at: new Date().toISOString() };

  const { data, error } = await supabaseAdmin
    .from('trades')
    .update(finalUpdate)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;

  // Recalculate account balance
  await recalculateAccountBalance(data.account_id);

  // Update strategy stats
  if (data.strategy_id) {
    await updateStrategyStats(data.strategy_id, data.account_id);
  }

  return data;
}

export async function deleteTrade(id: string): Promise<void> {
  const { data: trade } = await supabaseAdmin
    .from('trades')
    .select('account_id, strategy_id')
    .eq('id', id)
    .single();

  const { error } = await supabaseAdmin
    .from('trades')
    .delete()
    .eq('id', id);
  if (error) throw error;

  if (trade) {
    await recalculateAccountBalance(trade.account_id);
    if (trade.strategy_id) {
      await updateStrategyStats(trade.strategy_id, trade.account_id);
    }
  }
}

// ===== INSTRUMENTS =====
export async function getInstruments(): Promise<Instrument[]> {
  const { data, error } = await supabaseAdmin
    .from('instruments')
    .select('*')
    .order('type', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function createInstrument(instrument: Omit<Instrument, 'id'>): Promise<Instrument> {
  const { data, error } = await supabaseAdmin
    .from('instruments')
    .insert(instrument)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ===== STRATEGIES =====
export async function getStrategies(): Promise<Strategy[]> {
  const { data, error } = await supabaseAdmin
    .from('strategies')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function createStrategy(strategy: Omit<Strategy, 'id' | 'created_at'>): Promise<Strategy> {
  const { data, error } = await supabaseAdmin
    .from('strategies')
    .insert(strategy)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateStrategy(id: string, updates: Partial<Strategy>): Promise<void> {
  const { error } = await supabaseAdmin
    .from('strategies')
    .update(updates)
    .eq('id', id);
  if (error) throw error;
}

export async function deleteStrategy(id: string): Promise<void> {
  // Nullify strategy_id on trades
  await supabaseAdmin
    .from('trades')
    .update({ strategy_id: null })
    .eq('strategy_id', id);

  const { error } = await supabaseAdmin
    .from('strategies')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ===== CALCULATIONS =====
export function calculateTradeMetrics(trade: Partial<Trade>): Partial<Trade> {
  const updates: Partial<Trade> = {};
  
  const entryPrice = trade.entry_price ?? 0;
  const exitPrice = trade.exit_price;
  const stopLoss = trade.stop_loss ?? 0;
  const takeProfit = trade.take_profit ?? 0;
  const quantity = trade.quantity ?? 0;
  const lotSize = trade.lot_size ?? 1;
  const pipValue = 10; // Default pip value; ideally from instrument

  const risk = Math.abs(entryPrice - stopLoss) * quantity * lotSize;
  const reward = Math.abs(takeProfit - entryPrice) * quantity * lotSize;
  updates.expected_rr = risk > 0 ? reward / risk : 0;

  if (exitPrice != null && trade.status === 'closed') {
    let grossPnl: number;
    if (trade.type === 'long') {
      grossPnl = (exitPrice - entryPrice) * quantity * lotSize;
    } else {
      grossPnl = (entryPrice - exitPrice) * quantity * lotSize;
    }
    updates.gross_pnl = grossPnl;
    updates.net_pnl = grossPnl - (trade.fees ?? 0) - (trade.commissions ?? 0) - (trade.slippage ?? 0);
    
    updates.actual_rr = risk > 0 ? updates.net_pnl / risk : 0;

    const netPnl = updates.net_pnl;
    if (netPnl > 5) updates.outcome = 'win';
    else if (netPnl < -5) updates.outcome = 'loss';
    else updates.outcome = 'breakeven';
  } else if (trade.status !== 'closed') {
    updates.outcome = 'pending';
  }

  return updates;
}

async function updateAccountBalance(accountId: string, pnlDelta: number): Promise<void> {
  const { data: account } = await supabaseAdmin
    .from('accounts')
    .select('current_balance')
    .eq('id', accountId)
    .single();
  
  if (account) {
    await supabaseAdmin
      .from('accounts')
      .update({ current_balance: account.current_balance + pnlDelta })
      .eq('id', accountId);
  }
}

async function recalculateAccountBalance(accountId: string): Promise<void> {
  const { data: account } = await supabaseAdmin
    .from('accounts')
    .select('initial_balance')
    .eq('id', accountId)
    .single();

  if (!account) return;

  const { data: trades } = await supabaseAdmin
    .from('trades')
    .select('net_pnl')
    .eq('account_id', accountId)
    .eq('status', 'closed')
    .not('net_pnl', 'is', null);

  const totalPnl = (trades || []).reduce((sum: number, t: { net_pnl: number }) => sum + (t.net_pnl || 0), 0);
  
  await supabaseAdmin
    .from('accounts')
    .update({ current_balance: account.initial_balance + totalPnl })
    .eq('id', accountId);
}

async function updateStrategyStats(strategyId: string, accountId: string): Promise<void> {
  const { data: trades } = await supabaseAdmin
    .from('trades')
    .select('net_pnl, outcome')
    .eq('strategy_id', strategyId)
    .eq('account_id', accountId)
    .eq('status', 'closed');

  if (!trades || trades.length === 0) return;

  const totalTrades = trades.length;
  const winners = trades.filter((t: { outcome: string }) => t.outcome === 'win').length;
  const winRate = (winners / totalTrades) * 100;
  const avgPnl = trades.reduce((s: number, t: { net_pnl: number }) => s + (t.net_pnl || 0), 0) / totalTrades;

  await supabaseAdmin
    .from('strategies')
    .update({ win_rate: winRate, total_trades: totalTrades, avg_pnl: avgPnl })
    .eq('id', strategyId);
}
