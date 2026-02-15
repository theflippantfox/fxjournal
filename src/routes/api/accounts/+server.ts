import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as db from '$lib/server/db';

export const GET: RequestHandler = async () => {
	const accounts = await db.getAccounts();
	return json(accounts);
};

export const POST: RequestHandler = async ({ request }) => {
	const data = await request.json();
	const account = await db.createAccount(data);
	return json(account);
};

export const PUT: RequestHandler = async ({ request }) => {
	const { id, ...updates } = await request.json();
	const account = await db.updateAccount(id, updates);
	return json(account);
};

export const DELETE: RequestHandler = async ({ request }) => {
	const { id } = await request.json();
	const success = await db.deleteAccount(id);
	return json({ success });
};
