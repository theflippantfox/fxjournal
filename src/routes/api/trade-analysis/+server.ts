import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as db from '$lib/server/db';

export const GET: RequestHandler = async ({ url }) => {
  const tradeId = url.searchParams.get('tradeId');

  if (!tradeId) {
    return json({ error: 'Trade ID required' }, { status: 400 });
  }

  try {
    const trade = await db.getTrade(tradeId);

    if (!trade) {
      return json({ error: 'Trade not found' }, { status: 404 });
    }

    // Fetch related data
    const [strategies, checklists] = await Promise.all([
      db.getStrategies(),
      db.getChecklists()
    ]);

    const strategy = strategies.find(s => s.id === trade.strategyId);
    const checklist = checklists[0]; // Using first checklist

    // Analyze the trade
    const analysis = analyzeIndividualTrade(trade, strategy, checklist);

    return json({ trade, analysis });
  } catch (error) {
    console.error('Error analyzing trade:', error);
    return json({ error: 'Failed to analyze trade' }, { status: 500 });
  }
};

function analyzeIndividualTrade(trade: any, strategy: any, checklist: any) {
  const insights: any[] = [];

  // R:R Analysis
  if (trade.actualRR && trade.expectedRR) {
    const rrDiff = trade.actualRR - trade.expectedRR;
    if (rrDiff < -0.5) {
      insights.push({
        category: 'Risk Management',
        severity: 'warning',
        message: `Achieved R:R of ${trade.actualRR.toFixed(2)} is below your target of ${trade.expectedRR.toFixed(2)}. You exited ${Math.abs(rrDiff).toFixed(2)} R too early.`,
        recommendation: 'Consider using a trailing stop or scaling out partially to capture more profit.'
      });
    } else if (rrDiff > 0.5) {
      insights.push({
        category: 'Execution',
        severity: 'success',
        message: `Excellent! You achieved ${trade.actualRR.toFixed(2)} R:R, exceeding your ${trade.expectedRR.toFixed(2)} target by ${rrDiff.toFixed(2)} R.`,
        recommendation: 'Analyze what allowed you to capture more profit. Was it patience? Market conditions? Document this.'
      });
    }
  }

  // Strategy Compliance
  if (strategy) {
    if (trade.actualRR < strategy.targetRR - 0.5) {
      insights.push({
        category: 'Strategy',
        severity: 'warning',
        message: `"${strategy.name}" targets ${strategy.targetRR} R:R but you achieved ${trade.actualRR.toFixed(2)} R:R.`,
        recommendation: `Review ${strategy.name} exit rules. Are you following them consistently?`
      });
    }
  }

  // Checklist Compliance
  if (checklist && Object.keys(trade.checklistItems).length > 0) {
    const completedItems = Object.values(trade.checklistItems).filter(Boolean).length;
    const totalItems = Object.keys(trade.checklistItems).length;
    const completionRate = (completedItems / totalItems) * 100;

    if (completionRate < 80 && trade.outcome === 'loss') {
      insights.push({
        category: 'Discipline',
        severity: 'danger',
        message: `Only ${completionRate.toFixed(0)}% of checklist completed and the trade was a loss. Incomplete preparation likely contributed to the loss.`,
        recommendation: 'Never skip checklist items. Every item exists for a reason. Complete 100% before entry.'
      });
    } else if (completionRate === 100 && trade.outcome === 'win') {
      insights.push({
        category: 'Discipline',
        severity: 'success',
        message: 'Full checklist completion and successful trade. This is the way!',
        recommendation: 'This is your winning formula. Keep following your process.'
      });
    }

    // Find skipped required items
    if (checklist.items) {
      const requiredItems = checklist.items.filter((item: any) => item.required);
      requiredItems.forEach((item: any) => {
        if (!trade.checklistItems[item.id]) {
          insights.push({
            category: 'Checklist',
            severity: 'danger',
            message: `REQUIRED item skipped: "${item.text}"`,
            recommendation: 'Never skip required checklist items. They are mandatory for a reason.'
          });
        }
      });
    }
  }

  // Plan Adherence
  if (!trade.followedPlan && trade.outcome === 'loss') {
    insights.push({
      category: 'Discipline',
      severity: 'danger',
      message: 'You deviated from your plan AND lost money. Breaking rules has consequences.',
      recommendation: 'Before every trade, write down your plan. Follow it strictly. No exceptions.'
    });
  } else if (trade.followedPlan && trade.outcome === 'win') {
    insights.push({
      category: 'Discipline',
      severity: 'success',
      message: 'Followed plan and won. Your system works when you trust it.',
      recommendation: 'This proves your plan works. Keep following it.'
    });
  }

  // Emotional State
  const negativeEmotions = ['fearful', 'greedy', 'revenge', 'fomo'];
  if (negativeEmotions.includes(trade.emotion)) {
    insights.push({
      category: 'Psychology',
      severity: trade.outcome === 'loss' ? 'danger' : 'warning',
      message: `Traded while feeling ${trade.emotion}. ${trade.outcome === 'loss' ? 'Emotion likely caused this loss.' : 'Got lucky this time, but emotion-driven trades are dangerous.'}`,
      recommendation: `Next time you feel ${trade.emotion}, STOP. Walk away. Come back when you're calm and disciplined.`
    });
  } else if (trade.emotion === 'disciplined' && trade.outcome === 'win') {
    insights.push({
      category: 'Psychology',
      severity: 'success',
      message: 'Disciplined mindset led to a winning trade. Emotion control is key.',
      recommendation: 'Before every trade, check your emotional state. Only trade when calm.'
    });
  }

  // Stop Loss Analysis
  const stopDistance = Math.abs(trade.entryPrice - trade.stopLoss);
  const targetDistance = Math.abs(trade.takeProfit - trade.entryPrice);
  const actualDistance = trade.exitPrice ? Math.abs(trade.exitPrice - trade.entryPrice) : 0;

  if (trade.outcome === 'loss' && actualDistance > stopDistance * 1.2) {
    insights.push({
      category: 'Risk Management',
      severity: 'danger',
      message: 'Loss exceeded planned stop loss by 20%+. You let it run beyond your risk limit.',
      recommendation: 'ALWAYS use hard stops. Never let losses exceed your planned risk. This is non-negotiable.'
    });
  }

  // Win Size Analysis
  if (trade.outcome === 'win' && actualDistance < targetDistance * 0.5) {
    insights.push({
      category: 'Execution',
      severity: 'warning',
      message: 'Exited winner at less than 50% of target. Left significant profit on the table.',
      recommendation: 'Use trailing stops or partial exits. Let winners breathe. You\'re cutting them too soon.'
    });
  }

  // Session Quality Correlation
  if (trade.sessionQuality <= 2 && trade.outcome === 'loss') {
    insights.push({
      category: 'Preparation',
      severity: 'warning',
      message: 'Low session quality (⭐⭐ or less) correlated with loss. Poor preparation = poor results.',
      recommendation: 'Never trade when you rate session quality below ⭐⭐⭐. Wait for better conditions.'
    });
  }

  // Time of Day Analysis
  if (trade.timeOfDay === 'afterhours' && trade.outcome === 'loss') {
    insights.push({
      category: 'Timing',
      severity: 'warning',
      message: 'After-hours trading resulted in loss. Low liquidity and wide spreads are risky.',
      recommendation: 'Avoid after-hours unless you have specific edge there. Stick to regular hours.'
    });
  }

  // Market Condition Match
  if (strategy) {
    const strategyMarkets = strategy.markets || [];
    if (strategyMarkets.length > 0 && !strategyMarkets.includes(trade.marketCondition)) {
      insights.push({
        category: 'Strategy',
        severity: 'warning',
        message: `"${strategy.name}" is designed for ${strategyMarkets.join('/')} markets, but you traded in ${trade.marketCondition} conditions.`,
        recommendation: 'Only use strategies in their intended market conditions. Wrong context = poor results.'
      });
    }
  }

  // Positive Outcome Analysis
  if (insights.length === 0 && trade.outcome === 'win') {
    insights.push({
      category: 'Success',
      severity: 'success',
      message: 'Clean execution! No major issues detected. This is a model trade.',
      recommendation: 'Document what made this trade successful. Try to replicate this process.'
    });
  }

  // Calculate overall score
  const score = calculateTradeScore(trade, insights);

  return {
    insights,
    score,
    summary: generateTradeSummary(trade, insights, score)
  };
}

function calculateTradeScore(trade: any, insights: any[]): number {
  let score = 50; // Start at 50

  // Outcome (+30 for win, -30 for loss)
  if (trade.outcome === 'win') score += 30;
  if (trade.outcome === 'loss') score -= 30;

  // R:R achievement
  if (trade.actualRR >= trade.expectedRR) score += 10;
  else if (trade.actualRR < trade.expectedRR * 0.5) score -= 10;

  // Plan adherence
  if (trade.followedPlan) score += 10;
  else score -= 15;

  // Checklist completion
  if (trade.checklistCompleted) score += 10;
  else score -= 10;

  // Emotional state
  if (trade.emotion === 'disciplined') score += 5;
  if (['fearful', 'greedy', 'revenge', 'fomo'].includes(trade.emotion)) score -= 10;

  // Session quality
  score += (trade.sessionQuality - 3) * 3;

  // Severity of issues
  const dangerCount = insights.filter(i => i.severity === 'danger').length;
  const warningCount = insights.filter(i => i.severity === 'warning').length;
  score -= dangerCount * 5;
  score -= warningCount * 2;

  return Math.max(0, Math.min(100, score));
}

function generateTradeSummary(trade: any, insights: any[], score: number): string {
  if (score >= 80) {
    return `Excellent trade execution (${score}/100). ${trade.outcome === 'win' ? 'Well-deserved win' : 'Even losses can be executed well'}. This is the standard to maintain.`;
  } else if (score >= 60) {
    return `Good trade execution (${score}/100). ${insights.length} area(s) for improvement identified. Review and adjust.`;
  } else if (score >= 40) {
    return `Average execution (${score}/100). Multiple issues detected. This trade needs careful review.`;
  } else {
    return `Poor execution (${score}/100). Significant problems identified. Use this as a learning opportunity.`;
  }
}
