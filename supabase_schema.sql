-- =====================================================
-- Trading Journal - Supabase Schema
-- Run this in your Supabase SQL editor
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- ACCOUNTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  broker TEXT NOT NULL,
  account_number TEXT DEFAULT '',
  currency TEXT DEFAULT 'USD',
  initial_balance DECIMAL(15,2) DEFAULT 10000,
  current_balance DECIMAL(15,2) DEFAULT 10000,
  type TEXT CHECK (type IN ('live', 'demo', 'paper')) DEFAULT 'live',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INSTRUMENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS instruments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  symbol TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('forex', 'crypto', 'stock', 'futures', 'index', 'commodity')) NOT NULL,
  exchange TEXT DEFAULT 'OTC',
  tick_size DECIMAL(12,8) DEFAULT 0.0001,
  lot_size DECIMAL(12,2) DEFAULT 100000,
  currency TEXT DEFAULT 'USD',
  pip_value DECIMAL(10,4) DEFAULT 10,
  contract_size DECIMAL(12,2) DEFAULT 100000,
  margin_requirement DECIMAL(5,4) DEFAULT 0.0333,
  trading_hours TEXT DEFAULT '24/5',
  spread DECIMAL(8,4) DEFAULT 1.0,
  notes TEXT DEFAULT ''
);

-- =====================================================
-- STRATEGIES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS strategies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  setup TEXT DEFAULT '',
  entry TEXT DEFAULT '',
  exit TEXT DEFAULT '',
  stop_loss TEXT DEFAULT '',
  target_rr DECIMAL(5,2) DEFAULT 2.0,
  timeframes TEXT[] DEFAULT '{}',
  markets TEXT[] DEFAULT '{}',
  notes TEXT DEFAULT '',
  active BOOLEAN DEFAULT TRUE,
  checklist_items JSONB DEFAULT '[]',
  win_rate DECIMAL(5,2),
  total_trades INTEGER DEFAULT 0,
  avg_pnl DECIMAL(12,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TRADES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS trades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  instrument_id UUID REFERENCES instruments(id),
  strategy_id UUID REFERENCES strategies(id) ON DELETE SET NULL,
  
  -- Classification
  type TEXT CHECK (type IN ('long', 'short')) NOT NULL DEFAULT 'long',
  status TEXT CHECK (status IN ('open', 'closed', 'partial')) NOT NULL DEFAULT 'open',
  outcome TEXT CHECK (outcome IN ('win', 'loss', 'breakeven', 'pending')) NOT NULL DEFAULT 'pending',
  
  -- Prices
  entry_price DECIMAL(15,6) NOT NULL,
  exit_price DECIMAL(15,6),
  stop_loss DECIMAL(15,6) NOT NULL DEFAULT 0,
  take_profit DECIMAL(15,6) NOT NULL DEFAULT 0,
  
  -- Sizing
  quantity DECIMAL(10,4) DEFAULT 1,
  lot_size DECIMAL(10,4) DEFAULT 1,
  
  -- Costs
  fees DECIMAL(10,2) DEFAULT 0,
  commissions DECIMAL(10,2) DEFAULT 0,
  slippage DECIMAL(10,2) DEFAULT 0,
  
  -- Calculated P&L
  gross_pnl DECIMAL(12,2),
  net_pnl DECIMAL(12,2),
  expected_rr DECIMAL(8,4),
  actual_rr DECIMAL(8,4),
  
  -- Timing
  entry_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  exit_date TIMESTAMPTZ,
  time_of_day TEXT CHECK (time_of_day IN ('premarket', 'morning', 'midday', 'afternoon', 'afterhours')) DEFAULT 'morning',
  
  -- Market context
  market_condition TEXT CHECK (market_condition IN ('trending', 'ranging', 'volatile', 'quiet')) DEFAULT 'trending',
  session_quality INTEGER DEFAULT 3 CHECK (session_quality BETWEEN 1 AND 5),
  
  -- Psychology
  emotion TEXT CHECK (emotion IN ('confident', 'fearful', 'greedy', 'neutral', 'disciplined', 'revenge', 'fomo')) DEFAULT 'neutral',
  followed_plan BOOLEAN DEFAULT TRUE,
  
  -- Documentation
  chart_before_url TEXT,
  chart_after_url TEXT,
  pre_trade_notes TEXT,
  post_trade_notes TEXT,
  notes TEXT,
  mistakes TEXT,
  lessons_learned TEXT,
  tags TEXT[] DEFAULT '{}',
  
  -- Checklist
  checklist_items JSONB DEFAULT '{}',
  checklist_completed BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_trades_account_id ON trades(account_id);
CREATE INDEX idx_trades_entry_date ON trades(entry_date DESC);
CREATE INDEX idx_trades_symbol ON trades(symbol);
CREATE INDEX idx_trades_outcome ON trades(outcome);
CREATE INDEX idx_trades_strategy_id ON trades(strategy_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_trades_updated_at
  BEFORE UPDATE ON trades
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY (Optional - if using auth)
-- =====================================================
-- ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE strategies ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE instruments ENABLE ROW LEVEL SECURITY;

-- For simplest setup (single user, no auth), disable RLS:
ALTER TABLE accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE trades DISABLE ROW LEVEL SECURITY;
ALTER TABLE strategies DISABLE ROW LEVEL SECURITY;
ALTER TABLE instruments DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- SEED INSTRUMENTS (43 instruments)
-- =====================================================
INSERT INTO instruments (symbol, name, type, exchange, tick_size, lot_size, currency, pip_value, contract_size, margin_requirement, trading_hours, spread, notes) VALUES

-- FOREX MAJORS
('EURUSD', 'Euro / US Dollar', 'forex', 'OTC', 0.0001, 100000, 'USD', 10, 100000, 0.0333, '24/5', 0.8, 'Most liquid pair'),
('GBPUSD', 'British Pound / US Dollar', 'forex', 'OTC', 0.0001, 100000, 'USD', 10, 100000, 0.0333, '24/5', 1.0, ''),
('USDJPY', 'US Dollar / Japanese Yen', 'forex', 'OTC', 0.01, 100000, 'JPY', 9.09, 100000, 0.0333, '24/5', 0.7, ''),
('USDCHF', 'US Dollar / Swiss Franc', 'forex', 'OTC', 0.0001, 100000, 'CHF', 10, 100000, 0.0333, '24/5', 1.1, ''),
('USDCAD', 'US Dollar / Canadian Dollar', 'forex', 'OTC', 0.0001, 100000, 'CAD', 7.69, 100000, 0.0333, '24/5', 1.2, ''),
('AUDUSD', 'Australian Dollar / US Dollar', 'forex', 'OTC', 0.0001, 100000, 'USD', 10, 100000, 0.0333, '24/5', 1.1, ''),
('NZDUSD', 'New Zealand Dollar / US Dollar', 'forex', 'OTC', 0.0001, 100000, 'USD', 10, 100000, 0.0333, '24/5', 1.5, ''),

-- FOREX CROSSES
('EURGBP', 'Euro / British Pound', 'forex', 'OTC', 0.0001, 100000, 'GBP', 13.04, 100000, 0.05, '24/5', 1.2, ''),
('EURJPY', 'Euro / Japanese Yen', 'forex', 'OTC', 0.01, 100000, 'JPY', 9.09, 100000, 0.05, '24/5', 1.5, ''),
('GBPJPY', 'British Pound / Japanese Yen', 'forex', 'OTC', 0.01, 100000, 'JPY', 9.09, 100000, 0.05, '24/5', 2.0, 'Volatile pair'),
('EURCHF', 'Euro / Swiss Franc', 'forex', 'OTC', 0.0001, 100000, 'CHF', 10, 100000, 0.05, '24/5', 1.8, ''),
('EURCAD', 'Euro / Canadian Dollar', 'forex', 'OTC', 0.0001, 100000, 'CAD', 7.69, 100000, 0.05, '24/5', 2.0, ''),
('EURAUD', 'Euro / Australian Dollar', 'forex', 'OTC', 0.0001, 100000, 'AUD', 6.67, 100000, 0.05, '24/5', 1.8, ''),
('GBPCHF', 'British Pound / Swiss Franc', 'forex', 'OTC', 0.0001, 100000, 'CHF', 10, 100000, 0.05, '24/5', 2.2, ''),
('GBPCAD', 'British Pound / Canadian Dollar', 'forex', 'OTC', 0.0001, 100000, 'CAD', 7.69, 100000, 0.05, '24/5', 2.5, ''),
('GBPAUD', 'British Pound / Australian Dollar', 'forex', 'OTC', 0.0001, 100000, 'AUD', 6.67, 100000, 0.05, '24/5', 2.3, ''),
('AUDCAD', 'Australian Dollar / Canadian Dollar', 'forex', 'OTC', 0.0001, 100000, 'CAD', 7.69, 100000, 0.05, '24/5', 1.8, ''),
('AUDJPY', 'Australian Dollar / Japanese Yen', 'forex', 'OTC', 0.01, 100000, 'JPY', 9.09, 100000, 0.05, '24/5', 1.6, ''),
('AUDCHF', 'Australian Dollar / Swiss Franc', 'forex', 'OTC', 0.0001, 100000, 'CHF', 10, 100000, 0.05, '24/5', 1.9, ''),
('AUDNZD', 'Australian Dollar / New Zealand Dollar', 'forex', 'OTC', 0.0001, 100000, 'NZD', 6.25, 100000, 0.05, '24/5', 2.0, ''),
('CADJPY', 'Canadian Dollar / Japanese Yen', 'forex', 'OTC', 0.01, 100000, 'JPY', 9.09, 100000, 0.05, '24/5', 1.8, ''),
('NZDJPY', 'New Zealand Dollar / Japanese Yen', 'forex', 'OTC', 0.01, 100000, 'JPY', 9.09, 100000, 0.05, '24/5', 2.0, ''),
('CHFJPY', 'Swiss Franc / Japanese Yen', 'forex', 'OTC', 0.01, 100000, 'JPY', 9.09, 100000, 0.05, '24/5', 2.5, ''),
('NZDCAD', 'New Zealand Dollar / Canadian Dollar', 'forex', 'OTC', 0.0001, 100000, 'CAD', 7.69, 100000, 0.05, '24/5', 2.2, ''),
('NZDCHF', 'New Zealand Dollar / Swiss Franc', 'forex', 'OTC', 0.0001, 100000, 'CHF', 10, 100000, 0.05, '24/5', 2.0, ''),
('NZDAUD', 'New Zealand Dollar / Australian Dollar', 'forex', 'OTC', 0.0001, 100000, 'AUD', 6.67, 100000, 0.05, '24/5', 2.2, ''),
('CADCHF', 'Canadian Dollar / Swiss Franc', 'forex', 'OTC', 0.0001, 100000, 'CHF', 10, 100000, 0.05, '24/5', 2.0, ''),
('USDZAR', 'US Dollar / South African Rand', 'forex', 'OTC', 0.0001, 100000, 'ZAR', 0.053, 100000, 0.1, '24/5', 30, 'Exotic'),

-- CRYPTO
('BTCUSD', 'Bitcoin / US Dollar', 'crypto', 'Binance', 0.01, 1, 'USD', 1, 1, 0.1, '24/7', 50, 'Most liquid crypto'),
('ETHUSD', 'Ethereum / US Dollar', 'crypto', 'Binance', 0.01, 1, 'USD', 1, 1, 0.1, '24/7', 3, ''),
('LTCUSD', 'Litecoin / US Dollar', 'crypto', 'Binance', 0.01, 1, 'USD', 1, 1, 0.1, '24/7', 1, ''),
('XRPUSD', 'Ripple / US Dollar', 'crypto', 'Binance', 0.0001, 1, 'USD', 1, 1, 0.1, '24/7', 0.01, ''),
('SOLUSD', 'Solana / US Dollar', 'crypto', 'Binance', 0.001, 1, 'USD', 1, 1, 0.1, '24/7', 0.5, ''),

-- COMMODITIES
('XAUUSD', 'Gold / US Dollar', 'commodity', 'OTC', 0.01, 100, 'USD', 1, 100, 0.01, '24/5', 0.3, 'Safe haven'),
('XAGUSD', 'Silver / US Dollar', 'commodity', 'OTC', 0.001, 5000, 'USD', 1, 5000, 0.02, '24/5', 0.03, ''),
('USOIL', 'US Crude Oil (WTI)', 'commodity', 'NYMEX', 0.01, 1000, 'USD', 10, 1000, 0.02, '24/5', 0.05, 'Brent crude equiv'),
('UKOIL', 'UK Brent Crude Oil', 'commodity', 'ICE', 0.01, 1000, 'USD', 10, 1000, 0.02, '24/5', 0.05, ''),
('NATGAS', 'Natural Gas', 'commodity', 'NYMEX', 0.001, 10000, 'USD', 10, 10000, 0.05, '24/5', 0.01, ''),

-- INDICES
('SPX500', 'S&P 500 Index', 'index', 'CME', 0.1, 50, 'USD', 50, 50, 0.005, '9:30-16:00 ET', 0.5, 'US large cap'),
('NAS100', 'NASDAQ 100 Index', 'index', 'CME', 0.1, 20, 'USD', 20, 20, 0.005, '9:30-16:00 ET', 1.0, 'Tech heavy'),
('DJ30', 'Dow Jones 30', 'index', 'CME', 1, 5, 'USD', 5, 5, 0.005, '9:30-16:00 ET', 2.0, ''),
('GER40', 'DAX 40 Index', 'index', 'EUREX', 0.1, 25, 'EUR', 25, 25, 0.005, '9:00-17:30 CET', 1.0, 'German index'),
('UK100', 'FTSE 100 Index', 'index', 'LIFFE', 0.1, 10, 'GBP', 10, 10, 0.005, '8:00-16:30 GMT', 1.0, 'UK index')

ON CONFLICT (symbol) DO NOTHING;
