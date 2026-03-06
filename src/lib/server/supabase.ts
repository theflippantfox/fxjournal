import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';

// This runs at runtime (in Cloudflare Worker), so env vars are available
export const supabase = createClient(
  env.PUBLIC_SUPABASE_URL ?? '',
  env.PUBLIC_SUPABASE_ANON_KEY ?? ''
);

// ─── Accounts ──────────────────────────────────────────────────────────────

export async function getAccounts() {
  const { data, error } = await supabase.from('accounts').select('*').order('created_at');
  if (error) throw error;
  return data;
}

export async function createAccount(account: Omit<any, 'id' | 'created_at'>) {
  const { data, error } = await supabase.from('accounts').insert(account).select().single();
  if (error) throw error;
  return data;
}

export async function updateAccount(id: string, updates: Partial<any>) {
  const { data, error } = await supabase.from('accounts').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteAccount(id: string) {
  const { error } = await supabase.from('accounts').delete().eq('id', id);
  if (error) throw error;
  return true;
}

// ─── Trades ────────────────────────────────────────────────────────────────

export async function getTrades(accountId: string) {
  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .eq('account_id', accountId)
    .order('entry_date', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createTrade(trade: Omit<any, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase.from('trades').insert(trade).select().single();
  if (error) throw error;
  return data;
}

export async function updateTrade(id: string, updates: Partial<any>) {
  const { data, error } = await supabase
    .from('trades')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTrade(id: string) {
  const { error } = await supabase.from('trades').delete().eq('id', id);
  if (error) throw error;
  return true;
}

// ─── Instruments ────────────────────────────────────────────────────────────

export async function getInstruments() {
  const { data, error } = await supabase.from('instruments').select('*').order('symbol');
  if (error) throw error;
  return data;
}

// ─── Strategies ─────────────────────────────────────────────────────────────

export async function getStrategies() {
  const { data, error } = await supabase.from('strategies').select('*').order('name');
  if (error) throw error;
  return data;
}

export async function createStrategy(strategy: Omit<any, 'id' | 'created_at'>) {
  const { data, error } = await supabase.from('strategies').insert(strategy).select().single();
  if (error) throw error;
  return data;
}

export async function updateStrategy(id: string, updates: Partial<any>) {
  const { data, error } = await supabase.from('strategies').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteStrategy(id: string) {
  const { error } = await supabase.from('strategies').delete().eq('id', id);
  if (error) throw error;
  return true;
}

// ─── Trader Memory ────────────────────────────────────────────────────────────

export async function getTraderMemory(accountId: string) {
  try {
    const { data } = await supabase
      .from('trader_memory')
      .select('*')
      .eq('account_id', accountId)
      .single();
    return data ?? null;
  } catch {
    return null;
  }
}

export async function upsertTraderMemory(accountId: string, updates: Record<string, any>) {
  try {
    const { data } = await supabase
      .from('trader_memory')
      .upsert({ account_id: accountId, ...updates, updated_at: new Date().toISOString() }, { onConflict: 'account_id' })
      .select()
      .single();
    return data ?? null;
  } catch {
    return null;
  }
}

export async function saveAnalysisHistory(entry: {
  account_id: string;
  trade_id?: string | null;
  analysis_type: 'single' | 'bulk';
  score: number;
  summary: string;
  full_response: any;
  trades_analyzed: number;
}) {
  try {
    const { data } = await supabase
      .from('ai_analysis_history')
      .insert(entry)
      .select()
      .single();
    return data ?? null;
  } catch {
    return null;
  }
}

export async function getStrategiesForAccount(_accountId: string) {
  return getStrategies();
}
