import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as db from '$lib/server/db';

export const GET: RequestHandler = async () => {
  const settings = await db.getSettings();
  return json(settings);
};

export const POST: RequestHandler = async ({ request }) => {
  const settings = await request.json();
  await db.saveSettings(settings);
  return json(settings);
};
