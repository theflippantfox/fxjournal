// src/routes/api/instruments/+server.ts
import { json } from '@sveltejs/kit';
import { storage } from '$lib/server/storage';
import type { RequestHandler } from './$types';

// GET all instruments
export const GET: RequestHandler = async () => {
  try {
    const instruments = await storage.getInstruments();
    return json(instruments);
  } catch (error) {
    console.error('Error fetching instruments:', error);
    return json({ error: 'Failed to fetch instruments' }, { status: 500 });
  }
};

// POST update instruments list
export const POST: RequestHandler = async ({ request }) => {
  try {
    const instruments = await request.json();
    await storage.saveInstruments(instruments);
    return json({ success: true });
  } catch (error) {
    console.error('Error saving instruments:', error);
    return json({ error: 'Failed to save instruments' }, { status: 500 });
  }
};
