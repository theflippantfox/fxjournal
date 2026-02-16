import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as db from '$lib/server/db';
import { calculateAnalytics } from '$lib/utils/analytics';
import { generateAIAnalysis } from '$lib/utils/aiAnalyzer';

export const GET: RequestHandler = async ({ url }) => {
  const accountId = url.searchParams.get('accountId');

  if (!accountId) {
    return json({ error: 'Account ID required' }, { status: 400 });
  }

  try {
    // Fetch all required data
    const [account, trades, strategies, checklists] = await Promise.all([
      db.getAccount(accountId),
      db.getTrades(accountId),
      db.getStrategies(),
      db.getChecklists()
    ]);

    if (!account) {
      return json({ error: 'Account not found' }, { status: 404 });
    }

    // Calculate analytics
    const analytics = calculateAnalytics(trades);

    // Generate AI insights
    const insights = await generateAIAnalysis(
      trades,
      account,
      strategies,
      checklists,
      analytics
    );

    return json({ insights });
  } catch (error) {
    console.error('Error generating AI analysis:', error);
    return json({ error: 'Failed to generate analysis' }, { status: 500 });
  }
};
