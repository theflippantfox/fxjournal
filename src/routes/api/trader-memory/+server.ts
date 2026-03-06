import { json } from '@sveltejs/kit';
import { getTraderMemory } from '$lib/server/supabase';

export async function GET({ url }) {
  const accountId = url.searchParams.get('accountId');
  if (!accountId) return json(null);
  const memory = await getTraderMemory(accountId).catch(() => null);
  return json(memory);
}
