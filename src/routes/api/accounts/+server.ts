import { json } from '@sveltejs/kit';
import { getAccounts, createAccount, updateAccount, deleteAccount } from '$lib/server/supabase';

export async function GET() {
  const data = await getAccounts();
  return json(data);
}

export async function POST({ request }) {
  const body = await request.json();
  const account = await createAccount(body);
  return json(account);
}

export async function PUT({ request }) {
  const { id, ...updates } = await request.json();
  const account = await updateAccount(id, updates);
  return json(account);
}

export async function DELETE({ request }) {
  const { id } = await request.json();
  await deleteAccount(id);
  return json({ success: true });
}
