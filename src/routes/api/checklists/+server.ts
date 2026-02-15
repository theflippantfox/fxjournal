import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as db from '$lib/server/db';

export const GET: RequestHandler = async () => {
  const checklists = await db.getChecklists();
  return json(checklists);
};

export const POST: RequestHandler = async ({ request }) => {
  const data = await request.json();
  const checklist = await db.createChecklist(data);
  return json(checklist);
};

export const PUT: RequestHandler = async ({ request }) => {
  const { id, ...updates } = await request.json();
  const checklist = await db.updateChecklist(id, updates);
  return json(checklist);
};

export const DELETE: RequestHandler = async ({ request }) => {
  const { id } = await request.json();
  const success = await db.deleteChecklist(id);
  return json({ success });
};
