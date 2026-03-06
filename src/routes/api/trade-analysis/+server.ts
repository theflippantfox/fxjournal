import { json } from '@sveltejs/kit';
import { analyzeSingleTrade } from '$lib/utils/geminiAnalyzer';
import { getStrategies, getTraderMemory, upsertTraderMemory, saveAnalysisHistory } from '$lib/server/supabase';

async function fetchCMP(symbol: string, origin: string): Promise<{ price: number; change: number; changePct: number } | null> {
  try {
    const res = await fetch(`${origin}/api/live-price?symbols=${encodeURIComponent(symbol)}`, {
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data[symbol] ?? null;
  } catch {
    return null;
  }
}

export async function POST({ request, url }) {
  const { trade, accountId } = await request.json();

  // Fetch CMP for open trades + strategy + memory all in parallel
  const [strategies, memory, cmp] = await Promise.all([
    getStrategies().catch(() => []),
    accountId ? getTraderMemory(accountId) : Promise.resolve(null),
    trade.status === 'open' && trade.symbol
      ? fetchCMP(trade.symbol, url.origin)
      : Promise.resolve(null)
  ]);

  const strategy = (strategies ?? []).find((s: any) => s.id === trade.strategy_id) ?? null;
  const result = await analyzeSingleTrade(trade, strategy, memory, cmp);

  // Persist memory + history in background
  if (accountId) {
    const mu = result.memory_update ?? {};
    const existingWeaknesses: any[] = memory?.weakness_patterns ?? [];
    const newWeaknesses: any[] = Array.isArray(mu.weakness_patterns) ? mu.weakness_patterns : [];
    const merged = [...existingWeaknesses];
    for (const nw of newWeaknesses) {
      if (!merged.find((w: any) => w.pattern === nw.pattern)) merged.push(nw);
    }

    Promise.all([
      upsertTraderMemory(accountId, {
        coach_notes: mu.coach_note || memory?.coach_notes || null,
        strengths: memory?.strengths ?? [],
        weakness_patterns: merged,
        most_common_mistake: mu.new_pattern || memory?.most_common_mistake || null,
        emotion_performance: memory?.emotion_performance ?? {},
        strategy_adherence: memory?.strategy_adherence ?? {},
        analysis_count: (memory?.analysis_count ?? 0) + 1,
        last_analyzed_at: new Date().toISOString(),
        trade_count_at_last_analysis: memory?.trade_count_at_last_analysis ?? 0
      }),
      saveAnalysisHistory({
        account_id: accountId,
        trade_id: trade.id ?? null,
        analysis_type: 'single',
        score: result.score ?? 0,
        summary: result.summary ?? '',
        full_response: result,
        trades_analyzed: 1
      })
    ]).catch(e => console.error('Background persist error:', e));
  }

  return json(result);
}
