import type { Trade } from '$lib/types';

import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '$env/dynamic/private';

const GEMINI_API_KEY = env.GEMINI_API_KEY || ''

function getModel() {
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  return genAI.getGenerativeModel({ model: 'gemma-3-27b-it' });
}

function safeJSON(text: string) {
  const clean = text.replace(/```json\n?|\n?```/g, '').trim();
  const match = clean.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON in response');
  return JSON.parse(match[0]);
}

function inr(n: number) {
  return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// ─── Build trade context with optional live CMP ───────────────────────────────
function buildTradeContext(
  trade: Trade,
  strategy: any | null,
  cmp: { price: number; change: number; changePct: number } | null
): string {
  const checklist = strategy?.checklist_items ?? [];
  const checklistState = trade.checklist_items ?? {};
  const checklistLines = checklist.length
    ? checklist.map((item: any) => {
      const done = checklistState[item.id] ?? false;
      return `    [${done ? '✓' : '✗'}] ${item.text}${item.required ? ' [REQUIRED]' : ''} (${item.category})`;
    }).join('\n')
    : '    No checklist defined for this strategy';

  const costs = (trade.fees ?? 0) + (trade.commissions ?? 0) + (trade.slippage ?? 0);
  const leverage = (trade as any).leverage ?? 1;
  const qty = trade.quantity ?? 1;
  const riskAmt = trade.entry_price && trade.stop_loss
    ? Math.abs((trade.entry_price - trade.stop_loss) * qty * leverage)
    : null;

  // Live CMP block for open trades
  let floatingSection = '';
  if (trade.status === 'open' && cmp) {
    const priceDiff = trade.type === 'long'
      ? cmp.price - (trade.entry_price ?? 0)
      : (trade.entry_price ?? 0) - cmp.price;
    const floatPnL = priceDiff * qty * leverage;
    const floatPct = trade.entry_price ? (priceDiff / trade.entry_price) * 100 * leverage : 0;
    const distToStop = trade.stop_loss ? Math.abs(cmp.price - trade.stop_loss) : null;
    const distToTarget = trade.take_profit ? Math.abs(cmp.price - trade.take_profit) : null;
    const stopIntact = trade.stop_loss
      ? (trade.type === 'long' ? cmp.price > trade.stop_loss : cmp.price < trade.stop_loss)
      : false;

    floatingSection = `
LIVE MARKET DATA (fetched at analysis time):
  CMP: ${inr(cmp.price)} | Day change: ${cmp.change >= 0 ? '+' : ''}${inr(cmp.change)} (${cmp.changePct >= 0 ? '+' : ''}${cmp.changePct.toFixed(2)}%)
  Floating P&L: ${floatPnL >= 0 ? '+' : ''}${inr(floatPnL)} (${floatPct >= 0 ? '+' : ''}${floatPct.toFixed(2)}% return on margin)
  Move from entry: ${priceDiff >= 0 ? '+' : ''}${inr(priceDiff)} (${(priceDiff / (trade.entry_price ?? 1) * 100).toFixed(2)}%)
  Distance to stop: ${distToStop ? inr(distToStop) + ' away' : 'No stop set ⚠️'} | Stop intact: ${trade.stop_loss ? (stopIntact ? 'YES ✓' : 'NO — STOP HIT ⚠️') : 'N/A'}
  Distance to target: ${distToTarget ? inr(distToTarget) + ' away' : 'No target set'}
  Trade status: ${floatPnL >= 0 ? '🟢 IN PROFIT' : '🔴 IN LOSS'}
`;
  } else if (trade.status === 'open') {
    floatingSection = '\nLIVE MARKET DATA: CMP unavailable at analysis time\n';
  }

  return `
TRADE FACTS:
  Symbol: ${trade.symbol} | Direction: ${trade.type?.toUpperCase()} | Status: ${trade.status} | Outcome: ${trade.outcome}
  Entry: ${inr(trade.entry_price ?? 0)} | Exit: ${trade.exit_price ? inr(trade.exit_price) : 'Still open'}
  Stop Loss: ${trade.stop_loss ? inr(trade.stop_loss) : 'NOT SET ⚠️'} | Target: ${trade.take_profit ? inr(trade.take_profit) : 'NOT SET'}
  Qty: ${qty} | Leverage: ${leverage}x | Margin used: ${inr((trade as any).margin_used ?? 0)}
  Risk amount: ${riskAmt ? inr(riskAmt) : 'Unknown'} | Gross P&L: ${inr(trade.gross_pnl ?? 0)} | Net P&L: ${inr(trade.net_pnl ?? 0)}
  Expected R:R: ${trade.expected_rr}:1 | Actual R:R: ${trade.actual_rr}:1
  Charges (brokerage+STT+slippage): ${inr(costs)}
${floatingSection}
SESSION:
  Date/Time: ${trade.entry_date?.slice(0, 16) ?? 'Unknown'}
  Time of day: ${trade.time_of_day} | Market condition: ${trade.market_condition} | Session quality: ${trade.session_quality}/5
  Emotional state: ${trade.emotion?.toUpperCase()}
  Followed plan: ${trade.followed_plan ? 'YES' : 'NO'} | Checklist: ${trade.checklist_completed ? 'COMPLETE' : 'INCOMPLETE'}

ASSIGNED STRATEGY: ${strategy ? `"${strategy.name}"` : 'NONE ASSIGNED'}
${strategy ? `  Description: ${strategy.description ?? 'Not provided'}
  Setup rules: ${strategy.setup ?? 'Not defined'}
  Entry rules: ${strategy.entry ?? 'Not defined'}
  Exit/Target rules: ${strategy.exit ?? 'Not defined'}
  Stop loss rules: ${strategy.stop_loss ?? 'Not defined'}
  Target R:R: ${strategy.target_rr}:1
  Timeframes: ${Array.isArray(strategy.timeframes) ? strategy.timeframes.join(', ') : (strategy.timeframes ?? 'Not defined')}
  Markets: ${Array.isArray(strategy.markets) ? strategy.markets.join(', ') : (strategy.markets ?? 'Not defined')}` : '  (No strategy rules to check compliance against)'}

CHECKLIST (${checklist.filter((i: any) => checklistState[i.id]).length}/${checklist.length} complete):
${checklistLines}

TRADER NOTES:
  Pre-trade thesis: ${trade.pre_trade_notes || 'None written'}
  Post-trade review: ${trade.post_trade_notes || 'None written'}
  Mistakes: ${trade.mistakes || 'None noted'}
  Lessons learned: ${trade.lessons_learned || 'None noted'}`.trim();
}

// ─── Build stats for bulk analysis ───────────────────────────────────────────
function buildStats(trades: Trade[], strategies: any[]) {
  const closed = trades.filter(t => t.status === 'closed');
  if (!closed.length) return null;

  const wins = closed.filter(t => t.outcome === 'win');
  const losses = closed.filter(t => t.outcome === 'loss');
  const totalPnL = closed.reduce((s, t) => s + (t.net_pnl ?? 0), 0);

  const byEmotion: Record<string, { count: number; wins: number; pnl: number }> = {};
  const bySymbol: Record<string, { count: number; wins: number; pnl: number }> = {};
  const byStrategy: Record<string, { count: number; wins: number; pnl: number; checklist: number }> = {};
  const bySession: Record<string, { count: number; wins: number; pnl: number }> = {};

  for (const t of closed) {
    const e = t.emotion ?? 'neutral';
    if (!byEmotion[e]) byEmotion[e] = { count: 0, wins: 0, pnl: 0 };
    byEmotion[e].count++; byEmotion[e].pnl += t.net_pnl ?? 0;
    if (t.outcome === 'win') byEmotion[e].wins++;

    if (!bySymbol[t.symbol]) bySymbol[t.symbol] = { count: 0, wins: 0, pnl: 0 };
    bySymbol[t.symbol].count++; bySymbol[t.symbol].pnl += t.net_pnl ?? 0;
    if (t.outcome === 'win') bySymbol[t.symbol].wins++;

    const sName = strategies.find(s => s.id === t.strategy_id)?.name ?? 'No Strategy';
    if (!byStrategy[sName]) byStrategy[sName] = { count: 0, wins: 0, pnl: 0, checklist: 0 };
    byStrategy[sName].count++; byStrategy[sName].pnl += t.net_pnl ?? 0;
    if (t.outcome === 'win') byStrategy[sName].wins++;
    if (t.checklist_completed) byStrategy[sName].checklist++;

    const sess = t.time_of_day ?? 'unknown';
    if (!bySession[sess]) bySession[sess] = { count: 0, wins: 0, pnl: 0 };
    bySession[sess].count++; bySession[sess].pnl += t.net_pnl ?? 0;
    if (t.outcome === 'win') bySession[sess].wins++;
  }

  const withPlan = closed.filter(t => t.followed_plan);
  const withoutPlan = closed.filter(t => !t.followed_plan);
  const leveraged = closed.filter(t => ((t as any).leverage ?? 1) > 1);
  const noLev = closed.filter(t => ((t as any).leverage ?? 1) <= 1);

  let maxConsec = 0, cur = 0;
  for (const t of [...closed].reverse()) {
    if (t.outcome === 'loss') { cur++; maxConsec = Math.max(maxConsec, cur); } else cur = 0;
  }

  return {
    total: closed.length, wins: wins.length, losses: losses.length,
    winRate: (wins.length / closed.length * 100).toFixed(1),
    totalPnL: totalPnL.toFixed(0),
    avgPnL: (totalPnL / closed.length).toFixed(0),
    avgWin: wins.length ? (wins.reduce((s, t) => s + (t.net_pnl ?? 0), 0) / wins.length).toFixed(0) : '0',
    avgLoss: losses.length ? (Math.abs(losses.reduce((s, t) => s + (t.net_pnl ?? 0), 0)) / losses.length).toFixed(0) : '0',
    avgRR: (closed.reduce((s, t) => s + (t.actual_rr ?? 0), 0) / closed.length).toFixed(2),
    followedPlanPct: withPlan.length ? (withPlan.length / closed.length * 100).toFixed(0) : '0',
    checklistPct: (closed.filter(t => t.checklist_completed).length / closed.length * 100).toFixed(0),
    withPlanWR: withPlan.length ? (withPlan.filter(t => t.outcome === 'win').length / withPlan.length * 100).toFixed(0) : '0',
    withoutPlanWR: withoutPlan.length ? (withoutPlan.filter(t => t.outcome === 'win').length / withoutPlan.length * 100).toFixed(0) : '0',
    withPlanPnL: withPlan.reduce((s, t) => s + (t.net_pnl ?? 0), 0).toFixed(0),
    withoutPlanPnL: withoutPlan.reduce((s, t) => s + (t.net_pnl ?? 0), 0).toFixed(0),
    maxConsecLoss: maxConsec,
    leveragedCount: leveraged.length,
    leveragedWR: leveraged.length ? (leveraged.filter(t => t.outcome === 'win').length / leveraged.length * 100).toFixed(0) : '0',
    noLevWR: noLev.length ? (noLev.filter(t => t.outcome === 'win').length / noLev.length * 100).toFixed(0) : '0',
    recentWR: closed.slice(0, 10).length ? (closed.slice(0, 10).filter(t => t.outcome === 'win').length / Math.min(10, closed.length) * 100).toFixed(0) : '0',
    byEmotion, bySymbol, byStrategy, bySession,
    allMistakes: closed.map(t => t.mistakes).filter(Boolean).join(' | ').slice(0, 1000),
    recent5: closed.slice(0, 5).map(t => ({
      symbol: t.symbol, type: t.type, outcome: t.outcome, pnl: t.net_pnl,
      rr: t.actual_rr, emotion: t.emotion, plan: t.followed_plan,
      lev: (t as any).leverage ?? 1, checklist: t.checklist_completed
    }))
  };
}

// ─── SINGLE TRADE ANALYSIS ───────────────────────────────────────────────────
export async function analyzeSingleTrade(
  trade: Trade,
  strategy: any | null,
  memory: any | null,
  cmp: { price: number; change: number; changePct: number } | null = null
): Promise<any> {
  const model = getModel();

  const memCtx = memory
    ? `TRADER HISTORY (${memory.analysis_count ?? 0} analyses done):
  Coach notes: ${memory.coach_notes ?? 'First session — no history yet'}
  Known strengths: ${JSON.stringify(memory.strengths ?? [])}
  Recurring weaknesses: ${JSON.stringify(memory.weakness_patterns ?? [])}
  Most common mistake: ${memory.most_common_mistake ?? 'Not yet identified'}
  Emotion→WR history: ${JSON.stringify(memory.emotion_performance ?? {})}
  Strategy adherence history: ${JSON.stringify(memory.strategy_adherence ?? {})}`
    : 'TRADER HISTORY: First analysis — no prior data.';

  const prompt = `You are an elite prop-desk coach specialising in Indian markets (NSE/BSE/MCX/F&O). You understand SEBI leverage rules, MIS/CNC/NRML products, intraday cost structures, and retail trader psychology.

${memCtx}

Analyse this trade with surgical precision:

${buildTradeContext(trade, strategy, cmp)}

Rules:
- Check every strategy rule against what actually happened — quote the rule, describe what happened
- Go through each missed checklist item and explain its concrete impact on THIS trade
- Evaluate whether ${(trade as any).leverage ?? 1}x leverage was appropriate for this specific setup quality and market condition
- Assess stop loss placement — was it structural (logical) or arbitrary?
- Check if pre-trade thesis materialised — did the trader know what they were looking for?
- Use memory history to flag repeated patterns vs new behaviour
- For open trades: use the live CMP data above to give real-time guidance on position management
- All amounts in ₹

Respond ONLY with valid JSON, no markdown or extra text:
{
  "score": <0-100>,
  "grade": "<A+|A|B+|B|C+|C|D|F>",
  "summary": "<3-4 sentences referencing actual prices, specific rules, and what this reveals about the trader>",
  "strategy_compliance": {
    "score": <0-100>,
    "followed": ["<specific rule that was followed>"],
    "violated": ["<specific rule violated — quote it then describe what happened instead>"],
    "verdict": "<direct assessment>"
  },
  "checklist_analysis": {
    "score": <0-100>,
    "critical_misses": ["<missed item + its concrete impact on this trade>"],
    "verdict": "<how checklist adherence affected the result>"
  },
  "risk_management": {
    "score": <0-100>,
    "stop_quality": "<logical or arbitrary? reference the actual stop price>",
    "leverage_verdict": "<was ${(trade as any).leverage ?? 1}x appropriate here? why?>",
    "sizing_verdict": "<was quantity appropriate?>",
    "rr_verdict": "<${trade.expected_rr}:1 planned vs ${trade.actual_rr}:1 actual>",
    "overall": "<one-line verdict>"
  },
  "execution": {
    "score": <0-100>,
    "entry": "<quality of entry — reference price and setup>",
    "exit": "<quality of exit or current open management>",
    "timing": "<session and time-of-day appropriateness>",
    "overall": "<one-line verdict>"
  },
  "psychology": {
    "score": <0-100>,
    "state_impact": "<how did '${trade.emotion}' specifically affect decisions?>",
    "self_awareness": "<what do the notes reveal?>",
    "pattern_match": "<matches or breaks known history pattern?>",
    "overall": "<one-line verdict>"
  },
  ${trade.status === 'open' ? `"open_position_guidance": {
    "current_status": "<profit/loss with exact ₹ floating P&L>",
    "action": "<hold/tighten stop/take partial/exit — be specific>",
    "reasoning": "<why this action based on CMP vs key levels>",
    "risk_if_held": "<what is the downside if stop is hit from here>"
  },` : ''}
  "insights": [
    {
      "category": "<Risk|Strategy|Checklist|Discipline|Execution|Psychology|Leverage|Position Management>",
      "severity": "<success|warning|danger>",
      "title": "<5-7 word title>",
      "detail": "<2-3 sentences with specific numbers>",
      "action": "<one concrete specific action — not generic>"
    }
  ],
  "memory_update": {
    "new_pattern": "<new behaviour pattern this trade revealed>",
    "reinforced_pattern": "<existing pattern confirmed, or 'none' if first analysis>",
    "coach_note": "<1-2 sentence note to remember about this specific trader>"
  }
}`;

  try {
    const result = await model.generateContent(prompt);
    return safeJSON(result.response.text());
  } catch (e) {
    console.error('Gemma single error:', e);
    return singleFallback(trade);
  }
}

// ─── BULK ANALYSIS ────────────────────────────────────────────────────────────
export async function analyzeBulkTrades(
  trades: Trade[],
  strategies: any[],
  memory: any | null,
  livePrices: Record<string, any> = {}
): Promise<any> {
  const model = getModel();
  const stats = buildStats(trades, strategies);
  if (!stats) return { score: 0, summary: 'No closed trades to analyse.', insights: [] };

  // Build open positions section with live CMP
  const openTrades = trades.filter(t => t.status === 'open');
  const openPositionsSection = openTrades.length ? `
OPEN POSITIONS WITH LIVE CMP:
${openTrades.map(t => {
    const lp = livePrices[t.symbol];
    const leverage = (t as any).leverage ?? 1;
    const qty = t.quantity ?? 1;
    if (lp?.price && t.entry_price) {
      const diff = t.type === 'long' ? lp.price - t.entry_price : t.entry_price - lp.price;
      const floatPnL = diff * qty * leverage;
      const distToStop = t.stop_loss ? Math.abs(lp.price - t.stop_loss) : null;
      return `  ${t.symbol} ${t.type?.toUpperCase()} | Entry: ${inr(t.entry_price)} | CMP: ${inr(lp.price)} (${lp.changePct >= 0 ? '+' : ''}${lp.changePct?.toFixed(2)}% today) | Floating: ${floatPnL >= 0 ? '+' : ''}${inr(floatPnL)} | ${leverage}x | Stop: ${t.stop_loss ? inr(t.stop_loss) + (distToStop ? ` (${inr(distToStop)} away)` : '') : 'NOT SET ⚠️'}`;
    }
    return `  ${t.symbol} ${t.type?.toUpperCase()} | Entry: ${inr(t.entry_price ?? 0)} | CMP: unavailable | ${leverage}x`;
  }).join('\n')}
Total open: ${openTrades.length} position${openTrades.length > 1 ? 's' : ''}
` : '';

  const stratDefs = strategies.length
    ? strategies.map(s => `  "${s.name}": setup="${s.setup ?? 'not defined'}" | entry="${s.entry ?? 'not defined'}" | exit="${s.exit ?? 'not defined'}" | SL="${s.stop_loss ?? 'not defined'}" | targetRR=${s.target_rr} | ${s.checklist_items?.length ?? 0} checklist items`).join('\n')
    : '  No strategies defined';

  const memCtx = memory
    ? `EXISTING MEMORY (${memory.analysis_count ?? 0} sessions):
  Trader profile: ${memory.pattern_summary ?? 'Not established'}
  Coach notes: ${memory.coach_notes ?? 'None'}
  Strengths: ${JSON.stringify(memory.strengths ?? [])}
  Weaknesses: ${JSON.stringify(memory.weakness_patterns ?? [])}
  Emotion performance: ${JSON.stringify(memory.emotion_performance ?? {})}
  Strategy adherence: ${JSON.stringify(memory.strategy_adherence ?? {})}
  Most common mistake: ${memory.most_common_mistake ?? 'Unknown'}`
    : 'MEMORY: First analysis — build initial profile.';

  const prompt = `You are an elite trading performance coach for Indian retail traders, combining prop-desk risk management with deep psychological insight.

${memCtx}

PERFORMANCE DATA — ${stats.total} closed trades:
  Win rate: ${stats.winRate}% (${stats.wins}W/${stats.losses}L) | P&L: ₹${stats.totalPnL} | Avg: ₹${stats.avgPnL}
  Avg win: ₹${stats.avgWin} | Avg loss: ₹${stats.avgLoss} | Avg R:R: ${stats.avgRR}
  Plan followed: ${stats.followedPlanPct}% | Checklist: ${stats.checklistPct}% | Max consec losses: ${stats.maxConsecLoss}
  Recent 10 WR: ${stats.recentWR}%

PLAN ADHERENCE SPLIT:
  Followed plan → ${stats.withPlanWR}% WR | ₹${stats.withPlanPnL}
  Ignored plan  → ${stats.withoutPlanWR}% WR | ₹${stats.withoutPlanPnL}

LEVERAGE:
  ${stats.leveragedCount}/${stats.total} trades used leverage | Leveraged WR: ${stats.leveragedWR}% | No-leverage WR: ${stats.noLevWR}%

EMOTION PERFORMANCE:
${Object.entries(stats.byEmotion).map(([e, d]) => `  ${e}: ${d.count} trades | ${(d.wins / d.count * 100).toFixed(0)}% WR | ₹${d.pnl.toFixed(0)}`).join('\n')}

SYMBOL PERFORMANCE:
${Object.entries(stats.bySymbol).map(([s, d]) => `  ${s}: ${d.count} trades | ${(d.wins / d.count * 100).toFixed(0)}% WR | ₹${d.pnl.toFixed(0)}`).join('\n')}

STRATEGY PERFORMANCE:
${Object.entries(stats.byStrategy).map(([n, d]) => `  "${n}": ${d.count} trades | ${(d.wins / d.count * 100).toFixed(0)}% WR | ₹${d.pnl.toFixed(0)} | ${(d.checklist / d.count * 100).toFixed(0)}% checklist`).join('\n')}

SESSION PERFORMANCE:
${Object.entries(stats.bySession).map(([s, d]) => `  ${s}: ${d.count} trades | ${(d.wins / d.count * 100).toFixed(0)}% WR | ₹${d.pnl.toFixed(0)}`).join('\n')}

DEFINED STRATEGIES:
${stratDefs}

MISTAKE LOG: ${stats.allMistakes || 'None recorded'}

LAST 5 TRADES:
${stats.recent5.map(t => `  ${t.symbol} ${t.type} → ${t.outcome} | ₹${t.pnl} | RR:${t.rr} | ${t.emotion} | plan:${t.plan} | ${t.lev}x | checklist:${t.checklist}`).join('\n')}
${openPositionsSection}
Find the trader's true edge. Identify the biggest money leak. Assess strategy compliance. Expose psychological patterns. Judge leverage. Give a 30-day plan with measurable targets. Be direct, data-driven, use ₹ amounts.

Respond ONLY with valid JSON, no markdown or extra text:
{
  "score": <0-100>,
  "grade": "<A+|A|B+|B|C+|C|D|F>",
  "summary": "<4-5 sentences — data-driven, specific, with actual ₹ numbers>",
  "edge_analysis": "<what is this trader's actual statistical edge? honest if none yet>",
  "biggest_leak": "<single biggest P&L leak with ₹ estimate>",
  "module_scores": {
    "Risk Management": <0-100>,
    "Strategy Compliance": <0-100>,
    "Discipline": <0-100>,
    "Execution Timing": <0-100>,
    "Consistency": <0-100>,
    "Emotional Control": <0-100>,
    "Leverage Management": <0-100>,
    "Learning Velocity": <0-100>,
    "Checklist Adherence": <0-100>
  },
  "strengths": [{ "title": "<strength>", "evidence": "<data proving it>" }],
  "weaknesses": [{ "title": "<weakness>", "evidence": "<data>", "cost": "<₹ estimate>" }],
  "strategy_report": [{
    "name": "<strategy name>",
    "working": <true|false>,
    "compliance": "<how well followed>",
    "when_followed_result": "<what happens when all rules followed>",
    "recommendation": "<specific change>"
  }],
  "psychology_profile": {
    "peak_state": "<best conditions>",
    "danger_state": "<most damaging conditions>",
    "key_pattern": "<most important psychological observation>",
    "intervention": "<specific technique to implement>"
  },
  "leverage_report": {
    "pattern": "<how leverage is being used>",
    "verdict": "<appropriate for skill level?>",
    "guidance": "<specific leverage rules for their strategies>"
  },
  "insights": [{
    "category": "<module>",
    "severity": "<success|warning|danger>",
    "title": "<5-7 words>",
    "detail": "<specific finding with numbers>",
    "action": "<concrete measurable action>"
  }],
  "plan_30_days": ["<specific measurable action with target>"],
  "memory_update": {
    "pattern_summary": "<2-3 sentence trader profile>",
    "strengths": ["<confirmed strength with evidence>"],
    "weakness_patterns": [{ "pattern": "<weakness>", "frequency": "<how often>", "trigger": "<cause>", "cost": "<₹ impact>" }],
    "emotion_performance": { "<emotion>": { "win_rate": <0-100>, "avg_pnl": <number>, "trade_count": <number> } },
    "strategy_adherence": { "<strategy>": { "compliance_pct": <0-100>, "followed_verdict": "<result when followed>", "common_violation": "<rule most broken>" } },
    "most_common_mistake": "<plain language description>",
    "coach_notes": "<2-3 sentence note to improve future advice precision>"
  }
}`;

  try {
    const result = await model.generateContent(prompt);
    return safeJSON(result.response.text());
  } catch (e) {
    console.error('Gemma bulk error:', e);
    return bulkFallback(trades);
  }
}

// ─── Fallbacks ────────────────────────────────────────────────────────────────
function singleFallback(trade: Trade): any {
  const s = (trade.followed_plan ? 55 : 30) + (trade.outcome === 'win' ? 20 : 0)
    + (trade.stop_loss ? 10 : -15) + (trade.checklist_completed ? 10 : 0);
  return {
    score: Math.max(0, Math.min(100, s)),
    grade: s >= 80 ? 'A' : s >= 60 ? 'B' : s >= 40 ? 'C' : 'D',
    summary: `API unavailable — estimated score ${s}/100. Plan: ${trade.followed_plan}. Stop: ${!!trade.stop_loss}. Outcome: ${trade.outcome}.`,
    strategy_compliance: { score: trade.followed_plan ? 70 : 25, followed: [], violated: [], verdict: trade.followed_plan ? 'Plan followed' : 'Plan not followed' },
    checklist_analysis: { score: trade.checklist_completed ? 100 : 0, critical_misses: [], verdict: 'API unavailable' },
    risk_management: { score: trade.stop_loss ? 60 : 15, stop_quality: trade.stop_loss ? 'Set' : 'NOT SET', leverage_verdict: `${(trade as any).leverage ?? 1}x`, sizing_verdict: 'Unknown', rr_verdict: `${trade.expected_rr}:1 planned`, overall: 'API unavailable' },
    execution: { score: 50, entry: 'Unknown', exit: 'Unknown', timing: trade.time_of_day ?? 'Unknown', overall: 'API unavailable' },
    psychology: { score: trade.emotion === 'disciplined' ? 80 : trade.emotion === 'revenge' ? 15 : 50, state_impact: `Traded in ${trade.emotion} state`, self_awareness: 'Unknown', pattern_match: 'Unknown', overall: 'API unavailable' },
    insights: [{ category: 'System', severity: 'warning', title: 'API unavailable', detail: 'Could not connect. Check GEMINI_API_KEY.', action: 'Verify key in .env and retry' }],
    memory_update: { new_pattern: '', reinforced_pattern: '', coach_note: '' }
  };
}

function bulkFallback(trades: Trade[]): any {
  const closed = trades.filter(t => t.status === 'closed');
  const wr = closed.length ? closed.filter(t => t.outcome === 'win').length / closed.length * 100 : 0;
  return {
    score: Math.round(wr * 0.5 + 40), grade: wr >= 60 ? 'B' : 'C',
    summary: `API unavailable. ${closed.length} trades — ${wr.toFixed(1)}% win rate.`,
    edge_analysis: 'API unavailable', biggest_leak: 'API unavailable',
    module_scores: Object.fromEntries(['Risk Management', 'Strategy Compliance', 'Discipline', 'Execution Timing', 'Consistency', 'Emotional Control', 'Leverage Management', 'Learning Velocity', 'Checklist Adherence'].map(k => [k, 50])),
    strengths: [], weaknesses: [], strategy_report: [],
    psychology_profile: { peak_state: 'Unknown', danger_state: 'Unknown', key_pattern: 'Unknown', intervention: 'API unavailable' },
    leverage_report: { pattern: 'Unknown', verdict: 'Unknown', guidance: 'API unavailable' },
    insights: [{ category: 'System', severity: 'warning', title: 'API unavailable', detail: 'Check GEMINI_API_KEY in .env', action: 'Verify and retry' }],
    plan_30_days: [],
    memory_update: { pattern_summary: '', strengths: [], weakness_patterns: [], emotion_performance: {}, strategy_adherence: {}, most_common_mistake: '', coach_notes: '' }
  };
}
