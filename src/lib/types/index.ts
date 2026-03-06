export interface Account {
  id: string;
  name: string;
  broker: string;
  account_number: string;
  currency: string;
  initial_balance: number;
  current_balance: number;
  type: 'live' | 'demo' | 'paper';
  active: boolean;
  created_at: string;
}

export interface Instrument {
  id: string;
  symbol: string;
  name: string;
  type: 'forex' | 'crypto' | 'stock' | 'futures' | 'index' | 'commodity';
  exchange: string;
  tick_size: number;
  lot_size: number;
  currency: string;
  pip_value: number;
  contract_size: number;
  margin_requirement: number;
  trading_hours: string;
  spread: number;
  notes: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  category: 'pre-trade' | 'during-trade' | 'post-trade';
  required: boolean;
}

export interface Strategy {
  id: string;
  name: string;
  description: string;
  setup: string;
  entry: string;
  exit: string;
  stop_loss: string;
  target_rr: number;
  timeframes: string[];
  markets: string[];
  notes: string;
  active: boolean;
  checklist_items: ChecklistItem[];
  win_rate: number;
  total_trades: number;
  avg_pnl: number;
  created_at: string;
}

export interface Trade {
  id: string;
  account_id: string;
  symbol: string;
  instrument_id: string;
  strategy_id?: string;
  type: 'long' | 'short';
  status: 'open' | 'closed' | 'partial';
  outcome: 'win' | 'loss' | 'breakeven' | 'pending';
  entry_price: number;
  exit_price?: number;
  stop_loss: number;
  take_profit: number;
  quantity: number;
  lot_size: number;
  fees: number;
  commissions: number;
  slippage: number;
  gross_pnl: number;
  net_pnl: number;
  expected_rr: number;
  actual_rr: number;
  entry_date: string;
  exit_date?: string;
  time_of_day: 'premarket' | 'morning' | 'midday' | 'afternoon' | 'afterhours';
  market_condition: 'trending' | 'ranging' | 'volatile' | 'quiet';
  session_quality: number;
  emotion: 'confident' | 'fearful' | 'greedy' | 'neutral' | 'disciplined' | 'revenge' | 'fomo';
  followed_plan: boolean;
  chart_before_url?: string;
  chart_after_url?: string;
  pre_trade_notes?: string;
  post_trade_notes?: string;
  notes?: string;
  mistakes?: string;
  lessons_learned?: string;
  tags: string[];
  checklist_items: Record<string, boolean>;
  checklist_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface AIInsight {
  category: string;
  severity: 'success' | 'warning' | 'danger';
  message: string;
  recommendation: string;
}

export interface AIAnalysisResult {
  score: number;
  summary: string;
  insights: AIInsight[];
  strengths?: string[];
  weaknesses?: string[];
  recommendations?: string[];
  module_scores?: Record<string, number>;
}

export interface AdvancedAnalytics {
  sharpe_ratio: number;
  sortino_ratio: number;
  calmar_ratio: number;
  max_drawdown: number;
  max_drawdown_pct: number;
  recovery_factor: number;
  profit_factor: number;
  expectancy: number;
  win_rate: number;
  avg_win: number;
  avg_loss: number;
  kelly_full: number;
  kelly_half: number;
  kelly_quarter: number;
  monte_carlo: {
    median: number;
    best_case: number;
    worst_case: number;
    prob_profit: number;
    prob_ruin: number;
    avg_drawdown: number;
    max_drawdown_sim: number;
  };
  mae_avg: number;
  mfe_avg: number;
  equity_curve: { date: string; balance: number; drawdown: number }[];
}
