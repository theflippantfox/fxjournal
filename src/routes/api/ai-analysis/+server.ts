import { json } from '@sveltejs/kit';
import { analyzeBulkTrades } from '$lib/utils/geminiAnalyzer';
import { getTrades, getStrategies, getTraderMemory, upsertTraderMemory, saveAnalysisHistory } from '$lib/server/supabase';

export async function POST({ request, url }) {
  const { accountId } = await request.json();

  const [trades, strategies, memory] = await Promise.all([
    getTrades(accountId),
    getStrategies().catch(() => []),
    getTraderMemory(accountId).catch(() => null)
  ]);

  // Fetch CMPs for all open trades
  const openTrades = (trades as any[]).filter(t => t.status === 'open');
  let livePrices: Record<string, any> = {};
  if (openTrades.length) {
    const symbols = [...new Set(openTrades.map((t: any) => t.symbol))].join(',');
    try {
      const res = await fetch(`${url.origin}/api/live-price?symbols=${encodeURIComponent(symbols)}`, {
        signal: AbortSignal.timeout(8000)
      });
      if (res.ok) livePrices = await res.json();
    } catch { /* silent */ }
  }

  const result = await analyzeBulkTrades(trades as any[], strategies ?? [], memory, livePrices);

  const mu = result.memory_update ?? {};
  if (accountId && mu.pattern_summary) {
    Promise.all([
      upsertTraderMemory(accountId, {
        pattern_summary: mu.pattern_summary,
        coach_notes: mu.coach_notes,
        strengths: mu.strengths ?? [],
        weakness_patterns: mu.weakness_patterns ?? [],
        most_common_mistake: mu.most_common_mistake,
        emotion_performance: mu.emotion_performance ?? {},
        strategy_adherence: mu.strategy_adherence ?? {},
        analysis_count: (memory?.analysis_count ?? 0) + 1,
        last_analyzed_at: new Date().toISOString(),
        trade_count_at_last_analysis: (trades as any[]).length
      }),
      saveAnalysisHistory({
        account_id: accountId,
        trade_id: null,
        analysis_type: 'bulk',
        score: result.score ?? 0,
        summary: result.summary ?? '',
        full_response: result,
        trades_analyzed: (trades as any[]).filter((t: any) => t.status === 'closed').length
      })
    ]).catch(e => console.error('Memory persist error:', e));
  }

  return json(result);
}
