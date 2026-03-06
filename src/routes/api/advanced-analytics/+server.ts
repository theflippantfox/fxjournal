import { json } from '@sveltejs/kit';
import { getTrades } from '$lib/server/supabase';
import { getAccounts } from '$lib/server/supabase';
import { computeAdvancedAnalytics } from '$lib/utils/advancedAnalytics';

export async function GET({ url }) {
  const accountId = url.searchParams.get('accountId') ?? '';
  const [trades, accounts] = await Promise.all([getTrades(accountId), getAccounts()]);
  const account = accounts.find(a => a.id === accountId);
  const initialBalance = account?.initial_balance ?? 10000;
  const result = computeAdvancedAnalytics(trades, initialBalance);
  return json(result);
}
