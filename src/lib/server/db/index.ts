import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

if (!env.SQLITE_URL) throw new Error('SQLITE_URL is not set');

const client = new Database(env.SQLITE_URL);

export const db = drizzle(client, { schema });
