import { defineConfig } from 'drizzle-kit';

if (!process.env.SQLITE_URL) throw new Error('SQLITE_URL is not set');

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	dialect: 'sqlite',
	dbCredentials: { url: process.env.SQLITE_URL },
	verbose: true,
	strict: true
});
