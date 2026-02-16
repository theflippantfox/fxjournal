export interface Account {
  id: string;
  name: string;
  entity: string;
  type: 'live' | 'demo' | 'paper';
  balance: number;
  investedAmount: number;
  totalPnl: number;
  createdAt: string;
}

export interface Trade {
  id: string;
  accountId: string;
  symbol: string;
  instrumentId: string;
  type: 'long' | 'short';
  entryPrice: number;
  exitPrice: number | null;
  lotSize: number;
  quantity: number;
  stopLoss: number;
  takeProfit: number;
  expectedRR: number;
  actualRR: number;
  entryDate: string;
  exitDate: string | null;
  status: 'open' | 'closed' | 'partial';
  outcome: 'win' | 'loss' | 'breakeven' | 'pending';
  pnl: number;
  pnlPercentage: number;
  fees: number;
  commissions: number;
  slippage: number;
  netPnl: number;
  notes: string;
  preTradeNotes: string;
  postTradeNotes: string;
  tags: string[];
  strategyId: string;
  emotion: 'confident' | 'fearful' | 'greedy' | 'neutral' | 'disciplined' | 'revenge' | 'fomo';
  mistakes: string;
  lessonsLearned: string;
  chartBeforeUrl?: string;
  chartAfterUrl?: string;
  chartBeforeThumbnail?: string;
  chartAfterThumbnail?: string;
  checklistCompleted: boolean;
  checklistItems: { [key: string]: boolean };
  sessionQuality: 1 | 2 | 3 | 4 | 5;
  timeOfDay: 'premarket' | 'morning' | 'midday' | 'afternoon' | 'afterhours';
  marketCondition: 'trending' | 'ranging' | 'volatile' | 'quiet';
  followedPlan: boolean;
  partialExits: PartialExit[];
}

export interface PartialExit {
  price: number;
  quantity: number;
  date: string;
  pnl: number;
}

export interface Instrument {
  id: string;
  symbol: string;
  name: string;
  type: 'stock' | 'forex' | 'crypto' | 'futures' | 'options' | 'index';
  exchange: string;
  tickSize: number;
  lotSize: number;
  currency: string;
  notes: string;
  pipValue?: number;           // Value per pip (for forex)
  contractSize?: number;       // Contract multiplier (100,000 for forex standard lot)
  marginRequirement?: number;  // Margin % required to open position
  tradingHours?: string;       // Trading hours (e.g., "9:30-16:00 EST")
  pointValue?: number;         // Point value for futures
  spread?: number;             // Typical spread in pips/points
}

export interface Strategy {
  id: string;
  name: string;
  description: string;
  setup: string;
  entry: string;
  exit: string;
  stopLoss: string;
  targetRR: number;
  timeframes: string[];
  markets: string[];
  winRate: number;
  totalTrades: number;
  avgPnl: number;
  notes: string;
  active: boolean;
}

export interface ChecklistTemplate {
  id: string;
  name: string;
  items: ChecklistItem[];
}

export interface ChecklistItem {
  id: string;
  text: string;
  category: 'pre-trade' | 'during-trade' | 'post-trade';
  required: boolean;
}

export interface DailyStats {
  date: string;
  accountId: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalPnl: number;
  largestWin: number;
  largestLoss: number;
}

export interface AnalyticsData {
  totalTrades: number;
  winRate: number;
  totalPnl: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  expectancy: number;
  bestTrade: Trade | null;
  worstTrade: Trade | null;
  tradesBySymbol: { [symbol: string]: number };
  tradesByStrategy: { [strategy: string]: number };
  winRateByStrategy: { [strategy: string]: number };
  pnlByDay: { date: string; pnl: number }[];
  pnlByWeek: { week: string; pnl: number }[];
  pnlByMonth: { month: string; pnl: number }[];
  consecutiveWins: number;
  consecutiveLosses: number;
  avgHoldTime: number;
  winLossRatio: number;
  sharpeRatio: number;
  maxDrawdown: number;
  recoveryFactor: number;
  tradesByTimeOfDay: { [time: string]: number };
  tradesByMarketCondition: { [condition: string]: number };
  avgRR: number;
}

export interface Settings {
  currency: string;
  timezone: string;
  defaultAccount: string;
  theme: 'light' | 'dark' | 'auto';
  checklistTemplate: string;
  defaultLotSize: number;
  defaultRR: number;
  riskPerTrade: number;
  maxDailyLoss: number;
  tradingHours: { start: string; end: string };
}
