import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as db from '$lib/server/db';

export const GET: RequestHandler = async () => {
  const strategies = await db.getStrategies();
  return json(strategies);
};

export const POST: RequestHandler = async ({ request }) => {
  const data = await request.json();
  const strategy = await db.createStrategy(data);
  return json(strategy);
};

export const PUT: RequestHandler = async ({ request }) => {
  const { id, ...updates } = await request.json();
  const strategy = await db.updateStrategy(id, updates);
  return json(strategy);
};

export const DELETE: RequestHandler = async ({ request }) => {
  const { id } = await request.json();
  const success = await db.deleteStrategy(id);
  return json({ success });
};
