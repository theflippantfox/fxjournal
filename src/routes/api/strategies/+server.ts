import { json } from '@sveltejs/kit';
import { getStrategies, createStrategy, updateStrategy, deleteStrategy } from '$lib/server/supabase';

export async function GET() {
  const data = await getStrategies();
  return json(data);
}

export async function POST({ request }) {
  const body = await request.json();
  const strategy = await createStrategy(body);
  return json(strategy);
}

export async function PUT({ request }) {
  const { id, ...updates } = await request.json();
  const strategy = await updateStrategy(id, updates);
  return json(strategy);
}

export async function DELETE({ request }) {
  const { id } = await request.json();
  await deleteStrategy(id);
  return json({ success: true });
}
