import { json } from '@sveltejs/kit';
import { getInstruments } from '$lib/server/supabase';

export async function GET() {
  const data = await getInstruments();
  return json(data);
}
