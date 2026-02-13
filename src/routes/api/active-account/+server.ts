// src/routes/api/active-account/+server.ts
import { json } from '@sveltejs/kit';
import { storage } from '$lib/server/storage';
import type { RequestHandler } from './$types';

// GET active account ID
export const GET: RequestHandler = async () => {
  try {
    const data = await storage.getActiveAccountId();
    return json(data);
  } catch (error) {
    console.error('Error fetching active account:', error);
    return json({ error: 'Failed to fetch active account' }, { status: 500 });
  }
};

// POST update active account ID
export const POST: RequestHandler = async ({ request }) => {
  try {
    const { id } = await request.json();
    await storage.saveActiveAccountId(id);
    return json({ success: true });
  } catch (error) {
    console.error('Error saving active account:', error);
    return json({ error: 'Failed to save active account' }, { status: 500 });
  }
};
