import type { Trade, Account, Strategy, ChecklistTemplate, AnalyticsData } from '$lib/types';

export interface AIInsight {
  type: 'success' | 'warning' | 'danger' | 'info' | 'strategy' | 'checklist' | 'discipline';
  category: string;
  title: string;
  message: string;
  severity: 'high' | 'medium' | 'low';
  actionable: string;
  relatedTrades?: string[];
  metrics?: { [key: string]: any };
}

export class TradingAIAnalyzer {
  private trades: Trade[];
  private account: Account;
  private strategies: Strategy[];
  private checklists: ChecklistTemplate[];
  private analytics: AnalyticsData;

  constructor(
    trades: Trade[],
    account: Account,
    strategies: Strategy[],
    checklists: ChecklistTemplate[],
    analytics: AnalyticsData
  ) {
    this.trades = trades;
    this.account = account;
    this.strategies = strategies;
    this.checklists = checklists;
    this.analytics = analytics;
  }

  /**
   * Main analysis function - generates all insights
   */
  public generateInsights(): AIInsight[] {
    const insights: AIInsight[] = [];

    // Run all analysis modules
    insights.push(...this.analyzePerformanceMetrics());
    insights.push(...this.analyzeStrategyCompliance());
    insights.push(...this.analyzeChecklistAdherence());
    insights.push(...this.analyzeRiskManagement());
    insights.push(...this.analyzePsychologicalPatterns());
    insights.push(...this.analyzeTimeBasedPerformance());
    insights.push(...this.analyzeMarketConditions());
    insights.push(...this.analyzeRecentTrends());
    insights.push(...this.analyzeIndividualTrades());

    // Sort by severity
    return insights.sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  /**
   * Analyze overall performance metrics
   */
  private analyzePerformanceMetrics(): AIInsight[] {
    const insights: AIInsight[] = [];
    const { winRate, profitFactor, avgRR, expectancy, totalTrades } = this.analytics;

    // Win Rate Analysis
    if (totalTrades >= 20) {
      if (winRate >= 60) {
        insights.push({
          type: 'success',
          category: 'Performance',
          title: 'Excellent Win Rate',
          message: `Your win rate of ${winRate.toFixed(1)}% is above the 60% benchmark. This indicates strong trade selection and entry timing.`,
          severity: 'low',
          actionable: 'Maintain your current approach and continue documenting what makes your winning trades successful.',
          metrics: { winRate, benchmark: 60 }
        });
      } else if (winRate < 40) {
        insights.push({
          type: 'danger',
          category: 'Performance',
          title: 'Low Win Rate Alert',
          message: `Your win rate of ${winRate.toFixed(1)}% is below the 40% threshold. This suggests issues with trade selection or timing.`,
          severity: 'high',
          actionable: 'Review your losing trades. Are you entering too early/late? Is your stop-loss placement appropriate? Consider tightening your entry criteria.',
          metrics: { winRate, benchmark: 40 }
        });
      } else if (winRate < 50) {
        insights.push({
          type: 'warning',
          category: 'Performance',
          title: 'Below-Average Win Rate',
          message: `Win rate of ${winRate.toFixed(1)}% is below 50%. While not critical, there's room for improvement.`,
          severity: 'medium',
          actionable: 'Analyze your setup quality. Are you forcing trades? Consider being more selective with entries.',
          metrics: { winRate, benchmark: 50 }
        });
      }
    }

    // Profit Factor Analysis
    if (totalTrades >= 10) {
      if (profitFactor >= 2.5) {
        insights.push({
          type: 'success',
          category: 'Risk Management',
          title: 'Superior Profit Factor',
          message: `Profit factor of ${profitFactor.toFixed(2)} is excellent. Your average win significantly outweighs your average loss.`,
          severity: 'low',
          actionable: "Document your winning trades to understand what's working.Consider slightly increasing position size if risk allows.",
          metrics: { profitFactor, benchmark: 2.5 }
        });
      } else if (profitFactor < 1.5) {
        insights.push({
          type: 'danger',
          category: 'Risk Management',
          title: 'Low Profit Factor',
          message: `Profit factor of ${profitFactor.toFixed(2)} indicates your losses are eating into profits significantly.`,
          severity: 'high',
          actionable: 'Focus on two things: 1) Let winners run longer, 2) Cut losses quicker. Review your exit strategy.',
          metrics: { profitFactor, benchmark: 1.5 }
        });
      }
    }

    // R:R Analysis
    if (totalTrades >= 10) {
      if (avgRR >= 2) {
        insights.push({
          type: 'success',
          category: 'Risk Management',
          title: 'Excellent Risk-Reward',
          message: `Average R:R of ${avgRR.toFixed(2)} shows effective risk management. You're achieving good reward for risk taken.`,
          severity: 'low',
          actionable: 'Your risk management is solid. Ensure you maintain this discipline as you scale.',
          metrics: { avgRR, benchmark: 2 }
        });
      } else if (avgRR < 1) {
        insights.push({
          type: 'danger',
          category: 'Risk Management',
          title: 'Poor Risk-Reward Ratio',
          message: `Average R:R of ${avgRR.toFixed(2)} means you're risking more than you're making. This is unsustainable.`,
          severity: 'high',
          actionable: 'Immediate action needed: Either widen your targets, tighten your stops, or both. Never risk more than you aim to make.',
          metrics: { avgRR, benchmark: 1 }
        });
      }
    }

    // Expectancy Analysis
    if (totalTrades >= 20) {
      if (expectancy > 0) {
        const perTradeROI = (expectancy / this.account.balance) * 100;
        insights.push({
          type: 'success',
          category: 'Performance',
          title: 'Positive Expectancy',
          message: `Your system has positive expectancy of ${this.formatCurrency(expectancy)} per trade (${perTradeROI.toFixed(2)}% ROI).`,
          severity: 'low',
          actionable: 'Your edge is proven. Focus on consistency and proper position sizing to maximize this edge.',
          metrics: { expectancy, perTradeROI }
        });
      } else {
        insights.push({
          type: 'danger',
          category: 'Performance',
          title: 'Negative Expectancy',
          message: `Negative expectancy of ${this.formatCurrency(expectancy)} per trade means you're expected to lose money over time.`,
          severity: 'high',
          actionable: 'Stop trading this system immediately. You need to either: 1) Completely revise your strategy, 2) Get mentorship, or 3) Paper trade until profitable.',
          metrics: { expectancy }
        });
      }
    }

    return insights;
  }

  /**
   * Analyze strategy rule compliance
   */
  private analyzeStrategyCompliance(): AIInsight[] {
    const insights: AIInsight[] = [];

    for (const strategy of this.strategies) {
      const strategyTrades = this.trades.filter(t => t.strategyId === strategy.id);
      if (strategyTrades.length < 5) continue;

      const wins = strategyTrades.filter(t => t.outcome === 'win').length;
      const strategyWinRate = (wins / strategyTrades.length) * 100;
      const avgPnl = strategyTrades.reduce((sum, t) => sum + t.netPnl, 0) / strategyTrades.length;
      const avgRR = strategyTrades.reduce((sum, t) => sum + t.actualRR, 0) / strategyTrades.length;

      // Compare to target R:R
      const rrDifference = avgRR - strategy.targetRR;

      if (strategyWinRate < 50 && avgPnl < 0) {
        insights.push({
          type: 'danger',
          category: 'Strategy',
          title: `${strategy.name} Underperforming`,
          message: `This strategy has a ${strategyWinRate.toFixed(1)}% win rate and average loss of ${this.formatCurrency(Math.abs(avgPnl))} per trade.`,
          severity: 'high',
          actionable: `Stop using "${strategy.name}" until you've reviewed and fixed the issues. Review: ${strategy.setup}, Entry: ${strategy.entry}, Exit: ${strategy.exit}`,
          relatedTrades: strategyTrades.map(t => t.id),
          metrics: { winRate: strategyWinRate, avgPnl, expectedRR: strategy.targetRR, actualRR: avgRR }
        });
      } else if (rrDifference < -0.5) {
        insights.push({
          type: 'warning',
          category: 'Strategy',
          title: `${strategy.name} Missing R:R Target`,
          message: `Target R:R is ${strategy.targetRR}, but you're achieving ${avgRR.toFixed(2)}. You're exiting too early or entering with stops too wide.`,
          severity: 'medium',
          actionable: 'Review your exit rules. Are you taking profits too soon? Consider trailing stops or scaling out positions.',
          relatedTrades: strategyTrades.map(t => t.id),
          metrics: { targetRR: strategy.targetRR, actualRR: avgRR, difference: rrDifference }
        });
      } else if (strategyWinRate > 65 && avgPnl > 0) {
        insights.push({
          type: 'success',
          category: 'Strategy',
          title: `${strategy.name} Performing Well`,
          message: `Strong performance: ${strategyWinRate.toFixed(1)}% win rate with ${this.formatCurrency(avgPnl)} average profit. Achieving ${avgRR.toFixed(2)} R:R vs ${strategy.targetRR} target.`,
          severity: 'low',
          actionable: `"${strategy.name}" is your edge. Consider allocating more capital to this strategy and documenting what makes it successful.`,
          relatedTrades: strategyTrades.map(t => t.id),
          metrics: { winRate: strategyWinRate, avgPnl, actualRR: avgRR }
        });
      }
    }

    return insights;
  }

  /**
   * Analyze checklist adherence and its impact
   */
  private analyzeChecklistAdherence(): AIInsight[] {
    const insights: AIInsight[] = [];

    const tradesWithChecklist = this.trades.filter(t => Object.keys(t.checklistItems).length > 0);
    if (tradesWithChecklist.length < 10) return insights;

    const completedChecklistTrades = tradesWithChecklist.filter(t => t.checklistCompleted);
    const incompleteTrades = tradesWithChecklist.filter(t => !t.checklistCompleted);

    if (completedChecklistTrades.length > 0 && incompleteTrades.length > 0) {
      const completeWins = completedChecklistTrades.filter(t => t.outcome === 'win').length;
      const completeWinRate = (completeWins / completedChecklistTrades.length) * 100;

      const incompleteWins = incompleteTrades.filter(t => t.outcome === 'win').length;
      const incompleteWinRate = (incompleteWins / incompleteTrades.length) * 100;

      const difference = completeWinRate - incompleteWinRate;

      if (difference > 15) {
        insights.push({
          type: 'info',
          category: 'Checklist',
          title: 'Checklist Significantly Improves Results',
          message: `Win rate is ${completeWinRate.toFixed(1)}% when completing checklist vs ${incompleteWinRate.toFixed(1)}% when skipping items. That's a ${difference.toFixed(1)}% improvement!`,
          severity: 'high',
          actionable: 'ALWAYS complete your pre-trade checklist. The data proves it matters. Make it non-negotiable.',
          metrics: { completeWinRate, incompleteWinRate, difference }
        });
      } else if (difference > 5) {
        insights.push({
          type: 'info',
          category: 'Checklist',
          title: 'Checklist Shows Positive Impact',
          message: `Completing checklist improves win rate by ${difference.toFixed(1)}% (${completeWinRate.toFixed(1)}% vs ${incompleteWinRate.toFixed(1)}%).`,
          severity: 'medium',
          actionable: 'Your checklist is helping. Make it a habit to complete it before every trade.',
          metrics: { completeWinRate, incompleteWinRate, difference }
        });
      }
    }

    // Analyze specific checklist items
    if (this.checklists.length > 0) {
      const checklist = this.checklists[0]; // Use first checklist
      const requiredItems = checklist.items.filter(item => item.required);

      for (const item of requiredItems) {
        const tradesCheckingItem = this.trades.filter(t =>
          t.checklistItems[item.id] !== undefined
        );

        if (tradesCheckingItem.length < 5) continue;

        const completedItem = tradesCheckingItem.filter(t => t.checklistItems[item.id]);
        const skippedItem = tradesCheckingItem.filter(t => !t.checklistItems[item.id]);

        if (completedItem.length > 0 && skippedItem.length > 0) {
          const completedWinRate = (completedItem.filter(t => t.outcome === 'win').length / completedItem.length) * 100;
          const skippedWinRate = (skippedItem.filter(t => t.outcome === 'win').length / skippedItem.length) * 100;
          const impact = completedWinRate - skippedWinRate;

          if (impact > 20) {
            insights.push({
              type: 'info',
              category: 'Checklist',
              title: `Critical Checklist Item: "${item.text}"`,
              message: `This item has massive impact: ${completedWinRate.toFixed(1)}% win rate when checked vs ${skippedWinRate.toFixed(1)}% when skipped.`,
              severity: 'high',
              actionable: `Never skip: "${item.text}". It's one of your most important edge factors.`,
              metrics: { completedWinRate, skippedWinRate, impact }
            });
          }
        }
      }
    }

    return insights;
  }

  /**
   * Analyze risk management practices
   */
  private analyzeRiskManagement(): AIInsight[] {
    const insights: AIInsight[] = [];

    // Drawdown analysis
    const drawdownPercent = (this.analytics.maxDrawdown / this.account.investedAmount) * 100;
    if (drawdownPercent > 20) {
      insights.push({
        type: 'danger',
        category: 'Risk',
        title: 'Excessive Drawdown',
        message: `Maximum drawdown of ${this.formatCurrency(this.analytics.maxDrawdown)} (${drawdownPercent.toFixed(1)}% of capital) is dangerous.`,
        severity: 'high',
        actionable: "Immediately reduce position sizes by 50%. A 20%+ drawdown suggests you're over- leveraged.Focus on capital preservation.",
        metrics: { maxDrawdown: this.analytics.maxDrawdown, percent: drawdownPercent }
      });
    } else if (drawdownPercent > 10) {
      insights.push({
        type: 'warning',
        category: 'Risk',
        title: 'Moderate Drawdown',
        message: `Drawdown of ${drawdownPercent.toFixed(1)}% is concerning. Professional traders aim for <10%.`,
        severity: 'medium',
        actionable: 'Consider reducing position size by 25-30% until you can tighten your risk management.',
        metrics: { maxDrawdown: this.analytics.maxDrawdown, percent: drawdownPercent }
      });
    }

    // Consecutive losses
    if (this.analytics.consecutiveLosses >= 5) {
      insights.push({
        type: 'danger',
        category: 'Risk',
        title: 'Long Losing Streak',
        message: `${this.analytics.consecutiveLosses} consecutive losses suggests emotional trading or system breakdown.`,
        severity: 'high',
        actionable: 'STOP TRADING. Take a 3-day break. Review what went wrong. Was it revenge trading? Market conditions? Strategy failure?',
        metrics: { consecutiveLosses: this.analytics.consecutiveLosses }
      });
    } else if (this.analytics.consecutiveLosses >= 3) {
      insights.push({
        type: 'warning',
        category: 'Risk',
        title: 'Multiple Consecutive Losses',
        message: `${this.analytics.consecutiveLosses} losses in a row. Time to reassess.`,
        severity: 'medium',
        actionable: 'After 3 losses, step back. Review your trades. Are you forcing setups? Is the market condition suitable?',
        metrics: { consecutiveLosses: this.analytics.consecutiveLosses }
      });
    }

    // Recovery factor
    if (this.analytics.recoveryFactor < 2 && this.analytics.maxDrawdown > 0) {
      insights.push({
        type: 'warning',
        category: 'Risk',
        title: 'Low Recovery Factor',
        message: `Recovery factor of ${this.analytics.recoveryFactor.toFixed(2)} indicates slow recovery from drawdowns.`,
        severity: 'medium',
        actionable: 'Work on consistency. Avoid large losses and focus on steady, smaller wins.',
        metrics: { recoveryFactor: this.analytics.recoveryFactor }
      });
    }

    return insights;
  }

  /**
   * Analyze psychological patterns
   */
  private analyzePsychologicalPatterns(): AIInsight[] {
    const insights: AIInsight[] = [];

    // Plan adherence
    const planFollowers = this.trades.filter(t => t.followedPlan && t.status === 'closed');
    const planBreakers = this.trades.filter(t => !t.followedPlan && t.status === 'closed');

    if (planFollowers.length >= 5 && planBreakers.length >= 5) {
      const followerWinRate = (planFollowers.filter(t => t.outcome === 'win').length / planFollowers.length) * 100;
      const breakerWinRate = (planBreakers.filter(t => t.outcome === 'win').length / planBreakers.length) * 100;
      const difference = followerWinRate - breakerWinRate;

      if (difference > 15) {
        insights.push({
          type: 'discipline',
          category: 'Psychology',
          title: 'Plan Adherence Critical',
          message: `Win rate is ${followerWinRate.toFixed(1)}% when following plan vs ${breakerWinRate.toFixed(1)}% when deviating. Discipline matters!`,
          severity: 'high',
          actionable: 'Your plan works when you follow it. Write down: "I will not deviate from my plan." Review before every trade.',
          metrics: { followerWinRate, breakerWinRate, difference }
        });
      }
    }

    // Emotion analysis
    const emotions = ['disciplined', 'confident', 'neutral', 'fearful', 'greedy', 'revenge', 'fomo'];
    const emotionStats: { [key: string]: { total: number; wins: number; avgPnl: number } } = {};

    emotions.forEach(emotion => {
      const emotionTrades = this.trades.filter(t => t.emotion === emotion && t.status === 'closed');
      if (emotionTrades.length >= 3) {
        emotionStats[emotion] = {
          total: emotionTrades.length,
          wins: emotionTrades.filter(t => t.outcome === 'win').length,
          avgPnl: emotionTrades.reduce((sum, t) => sum + t.netPnl, 0) / emotionTrades.length
        };
      }
    });

    // Compare disciplined vs emotional
    if (emotionStats['disciplined'] && (emotionStats['greedy'] || emotionStats['fearful'] || emotionStats['revenge'])) {
      const disciplinedWinRate = (emotionStats['disciplined'].wins / emotionStats['disciplined'].total) * 100;
      let emotionalWinRate = 0;
      let emotionalCount = 0;

      ['greedy', 'fearful', 'revenge', 'fomo'].forEach(e => {
        if (emotionStats[e]) {
          emotionalWinRate += (emotionStats[e].wins / emotionStats[e].total) * 100;
          emotionalCount++;
        }
      });

      if (emotionalCount > 0) {
        emotionalWinRate /= emotionalCount;
        const emotionDifference = disciplinedWinRate - emotionalWinRate;

        if (emotionDifference > 20) {
          insights.push({
            type: 'discipline',
            category: 'Psychology',
            title: 'Emotional Trading Destroying Results',
            message: `${disciplinedWinRate.toFixed(1)}% win rate when disciplined vs ${emotionalWinRate.toFixed(1)}% when emotional. Emotion costs you ${emotionDifference.toFixed(1)}%!`,
            severity: 'high',
            actionable: 'Before every trade, check your emotional state. If not calm and disciplined, DON\'T TRADE. Walk away.',
            metrics: { disciplinedWinRate, emotionalWinRate, difference: emotionDifference }
          });
        }
      }
    }

    // Identify worst emotion
    let worstEmotion = '';
    let worstWinRate = 100;

    Object.entries(emotionStats).forEach(([emotion, stats]) => {
      const winRate = (stats.wins / stats.total) * 100;
      if (winRate < worstWinRate && emotion !== 'disciplined' && emotion !== 'confident') {
        worstWinRate = winRate;
        worstEmotion = emotion;
      }
    });

    if (worstEmotion && worstWinRate < 35) {
      insights.push({
        type: 'warning',
        category: 'Psychology',
        title: `Avoid Trading When ${worstEmotion.charAt(0).toUpperCase() + worstEmotion.slice(1)}`,
        message: `Only ${worstWinRate.toFixed(1)}% win rate when feeling ${worstEmotion}. This emotion is toxic to your trading.`,
        severity: 'high',
        actionable: `Recognize when you're feeling ${worstEmotion}. It's a signal to STOP. Take a break, clear your head, come back later.`,
        metrics: { emotion: worstEmotion, winRate: worstWinRate }
      });
    }

    return insights;
  }

  /**
   * Analyze time-based performance patterns
   */
  private analyzeTimeBasedPerformance(): AIInsight[] {
    const insights: AIInsight[] = [];

    // Time of day analysis
    const timeSlots = ['premarket', 'morning', 'midday', 'afternoon', 'afterhours'];
    const timeStats: { [key: string]: { total: number; wins: number; avgPnl: number } } = {};

    timeSlots.forEach(time => {
      const timeTrades = this.trades.filter(t => t.timeOfDay === time && t.status === 'closed');
      if (timeTrades.length >= 3) {
        timeStats[time] = {
          total: timeTrades.length,
          wins: timeTrades.filter(t => t.outcome === 'win').length,
          avgPnl: timeTrades.reduce((sum, t) => sum + t.netPnl, 0) / timeTrades.length
        };
      }
    });

    // Find best and worst times
    let bestTime = '';
    let bestWinRate = 0;
    let worstTime = '';
    let worstWinRate = 100;

    Object.entries(timeStats).forEach(([time, stats]) => {
      const winRate = (stats.wins / stats.total) * 100;
      if (winRate > bestWinRate && stats.total >= 5) {
        bestWinRate = winRate;
        bestTime = time;
      }
      if (winRate < worstWinRate && stats.total >= 5) {
        worstWinRate = winRate;
        worstTime = time;
      }
    });

    if (bestTime && bestWinRate > 60) {
      insights.push({
        type: 'info',
        category: 'Timing',
        title: `${this.capitalize(bestTime)} is Your Best Time`,
        message: `${bestWinRate.toFixed(1)}% win rate during ${bestTime} sessions. This is your edge window.`,
        severity: 'medium',
        actionable: `Focus your trading during ${bestTime}. This is when you perform best. Consider avoiding other times.`,
        metrics: { timeSlot: bestTime, winRate: bestWinRate }
      });
    }

    if (worstTime && worstWinRate < 40 && timeStats[worstTime].total >= 5) {
      insights.push({
        type: 'warning',
        category: 'Timing',
        title: `Avoid Trading During ${this.capitalize(worstTime)}`,
        message: `Only ${worstWinRate.toFixed(1)}% win rate during ${worstTime}. You're giving back profits in this window.`,
        severity: 'medium',
        actionable: `Stop trading during ${worstTime}. The data shows it's not working for you. Focus on your best times instead.`,
        metrics: { timeSlot: worstTime, winRate: worstWinRate }
      });
    }

    return insights;
  }

  /**
   * Analyze market condition performance
   */
  private analyzeMarketConditions(): AIInsight[] {
    const insights: AIInsight[] = [];

    const conditions = ['trending', 'ranging', 'volatile', 'quiet'];
    const conditionStats: { [key: string]: { total: number; wins: number; avgPnl: number } } = {};

    conditions.forEach(condition => {
      const conditionTrades = this.trades.filter(t => t.marketCondition === condition && t.status === 'closed');
      if (conditionTrades.length >= 3) {
        conditionStats[condition] = {
          total: conditionTrades.length,
          wins: conditionTrades.filter(t => t.outcome === 'win').length,
          avgPnl: conditionTrades.reduce((sum, t) => sum + t.netPnl, 0) / conditionTrades.length
        };
      }
    });

    // Find best condition
    let bestCondition = '';
    let bestWinRate = 0;

    Object.entries(conditionStats).forEach(([condition, stats]) => {
      const winRate = (stats.wins / stats.total) * 100;
      if (winRate > bestWinRate && stats.total >= 5) {
        bestWinRate = winRate;
        bestCondition = condition;
      }
    });

    if (bestCondition && bestWinRate > 65) {
      insights.push({
        type: 'info',
        category: 'Market Conditions',
        title: `Excels in ${this.capitalize(bestCondition)} Markets`,
        message: `${bestWinRate.toFixed(1)}% win rate in ${bestCondition} conditions. This is your ideal environment.`,
        severity: 'low',
        actionable: `Be selective. Wait for ${bestCondition} market conditions before taking trades. Your edge is strongest here.`,
        metrics: { condition: bestCondition, winRate: bestWinRate }
      });
    }

    return insights;
  }

  /**
   * Analyze recent trends (last 10-20 trades)
   */
  private analyzeRecentTrends(): AIInsight[] {
    const insights: AIInsight[] = [];

    const recentTrades = this.trades
      .filter(t => t.status === 'closed')
      .sort((a, b) => new Date(b.exitDate || b.entryDate).getTime() - new Date(a.exitDate || a.entryDate).getTime())
      .slice(0, 10);

    if (recentTrades.length >= 10) {
      const recentWins = recentTrades.filter(t => t.outcome === 'win').length;
      const recentWinRate = (recentWins / recentTrades.length) * 100;
      const recentPnl = recentTrades.reduce((sum, t) => sum + t.netPnl, 0);

      // Hot streak
      if (recentWins >= 7) {
        insights.push({
          type: 'success',
          category: 'Recent Form',
          title: 'On Fire! Hot Streak',
          message: `${recentWins} wins in last 10 trades (${recentWinRate}% win rate). Total: ${this.formatCurrency(recentPnl)}`,
          severity: 'low',
          actionable: 'Great momentum! Stay focused and don\'t get overconfident. Stick to your plan and don\'t increase risk.',
          metrics: { recentWins, recentWinRate, recentPnl }
        });
      }
      // Cold streak
      else if (recentWins <= 3) {
        insights.push({
          type: 'danger',
          category: 'Recent Form',
          title: 'Cold Streak - Immediate Action Required',
          message: `Only ${recentWins} wins in last 10 trades (${recentWinRate}% win rate). Down ${this.formatCurrency(Math.abs(recentPnl))}`,
          severity: 'high',
          actionable: 'STOP. Review your last 10 trades immediately. What changed? Are you forcing trades? Is market condition different? Take a break if needed.',
          relatedTrades: recentTrades.map(t => t.id),
          metrics: { recentWins, recentWinRate, recentPnl }
        });
      }
    }

    return insights;
  }

  /**
   * Analyze specific problematic trades
   */
  private analyzeIndividualTrades(): AIInsight[] {
    const insights: AIInsight[] = [];

    // Find trades that violated rules
    const violatedPlanTrades = this.trades.filter(t =>
      !t.followedPlan &&
      t.status === 'closed' &&
      t.outcome === 'loss'
    );

    if (violatedPlanTrades.length >= 3) {
      const totalLoss = violatedPlanTrades.reduce((sum, t) => sum + Math.abs(t.netPnl), 0);
      insights.push({
        type: 'warning',
        category: 'Discipline',
        title: 'Rule Violations Causing Losses',
        message: `${violatedPlanTrades.length} losing trades where you didn't follow your plan. Total damage: ${this.formatCurrency(totalLoss)}`,
        severity: 'high',
        actionable: 'Every time you break your rules, it costs you. Write your rules on a sticky note on your monitor. Follow them religiously.',
        relatedTrades: violatedPlanTrades.map(t => t.id),
        metrics: { violationCount: violatedPlanTrades.length, totalLoss }
      });
    }

    // Find trades with missed R:R targets
    const missedTargets = this.trades.filter(t =>
      t.status === 'closed' &&
      t.outcome === 'win' &&
      t.actualRR < t.expectedRR * 0.5
    );

    if (missedTargets.length >= 3) {
      const lostProfit = missedTargets.reduce((sum, t) => {
        const potentialProfit = (t.expectedRR / t.actualRR) * t.netPnl;
        return sum + (potentialProfit - t.netPnl);
      }, 0);

      insights.push({
        type: 'warning',
        category: 'Execution',
        title: 'Exiting Winners Too Early',
        message: `${missedTargets.length} winning trades exited at <50% of target R:R. Left ${this.formatCurrency(lostProfit)} on the table.`,
        severity: 'medium',
        actionable: 'Use trailing stops or scale out of positions. You\'re cutting winners short. Let them breathe.',
        relatedTrades: missedTargets.map(t => t.id),
        metrics: { earlyExitCount: missedTargets.length, lostProfit }
      });
    }

    return insights;
  }

  /**
   * Helper: Format currency
   */
  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  /**
   * Helper: Capitalize first letter
   */
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

/**
 * Main export function for easy use
 */
export async function generateAIAnalysis(
  trades: Trade[],
  account: Account,
  strategies: Strategy[],
  checklists: ChecklistTemplate[],
  analytics: AnalyticsData
): Promise<AIInsight[]> {
  const analyzer = new TradingAIAnalyzer(trades, account, strategies, checklists, analytics);
  return analyzer.generateInsights();
}
