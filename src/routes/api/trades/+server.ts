import { json } from '@sveltejs/kit';
import { getTrades, createTrade, updateTrade, deleteTrade } from '$lib/server/supabase';
import { determineOutcome } from '$lib/utils/calculations';

// Whitelist of valid trades table columns
const TRADE_COLUMNS = new Set([
  'account_id', 'symbol', 'instrument_id', 'strategy_id', 'type', 'status', 'outcome',
  'entry_price', 'exit_price', 'stop_loss', 'take_profit', 'quantity', 'lot_size',
  'fees', 'commissions', 'slippage', 'gross_pnl', 'net_pnl', 'expected_rr', 'actual_rr',
  'entry_date', 'exit_date', 'time_of_day', 'market_condition', 'session_quality',
  'emotion', 'followed_plan', 'chart_before_url', 'chart_after_url',
  'pre_trade_notes', 'post_trade_notes', 'notes', 'mistakes', 'lessons_learned',
  'tags', 'checklist_items', 'checklist_completed', 'live_pnl', 'leverage', 'margin_used'
]);

function sanitize(obj: Record<string, any>) {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => TRADE_COLUMNS.has(k)));
}

export async function GET({ url }) {
  const accountId = url.searchParams.get('accountId') ?? '';
  const data = await getTrades(accountId);
  return json(data);
}

export async function POST({ request }) {
  const body = sanitize(await request.json());
  body.outcome = determineOutcome(body.net_pnl ?? 0, body.status);
  const trade = await createTrade(body);
  return json(trade);
}

export async function PUT({ request }) {
  const { id, ...rest } = await request.json();
  const updates = sanitize(rest);
  updates.outcome = determineOutcome(updates.net_pnl ?? 0, updates.status);
  const trade = await updateTrade(id, updates);
  return json(trade);
}

export async function DELETE({ request }) {
  const { id } = await request.json();
  await deleteTrade(id);
  return json({ success: true });
}
