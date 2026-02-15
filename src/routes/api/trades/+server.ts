import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as db from '$lib/server/db';

export const GET: RequestHandler = async ({ url }) => {
	const accountId = url.searchParams.get('accountId');
	const trades = await db.getTrades(accountId || undefined);
	return json(trades);
};

export const POST: RequestHandler = async ({ request }) => {
	const data = await request.json();
	const trade = await db.createTrade(data);
	return json(trade);
};

export const PUT: RequestHandler = async ({ request }) => {
	const { id, ...updates } = await request.json();
	const trade = await db.updateTrade(id, updates);
	return json(trade);
};

export const DELETE: RequestHandler = async ({ request }) => {
	const { id } = await request.json();
	const success = await db.deleteTrade(id);
	return json({ success });
};
