import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as db from '$lib/server/db';

export const GET: RequestHandler = async () => {
  const instruments = await db.getInstruments();
  return json(instruments);
};

export const POST: RequestHandler = async ({ request }) => {
  const data = await request.json();
  const instrument = await db.createInstrument(data);
  return json(instrument);
};

export const PUT: RequestHandler = async ({ request }) => {
  const { id, ...updates } = await request.json();
  const instrument = await db.updateInstrument(id, updates);
  return json(instrument);
};

export const DELETE: RequestHandler = async ({ request }) => {
  const { id } = await request.json();
  const success = await db.deleteInstrument(id);
  return json({ success });
};
