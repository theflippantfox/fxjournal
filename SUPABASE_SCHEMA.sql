-- ============================================================
-- Trading Journal Pro — Supabase Database Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- ACCOUNTS
create table if not exists accounts (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  broker text,
  account_number text,
  currency text default 'USD',
  initial_balance numeric default 10000,
  current_balance numeric default 10000,
  type text check (type in ('live','demo','paper')) default 'demo',
  active boolean default true,
  created_at timestamptz default now()
);

-- INSTRUMENTS (pre-loaded)
create table if not exists instruments (
  id uuid default gen_random_uuid() primary key,
  symbol text unique not null,
  name text,
  type text check (type in ('forex','crypto','stock','futures','index','commodity')),
  exchange text,
  tick_size numeric,
  lot_size numeric default 100000,
  currency text,
  pip_value numeric default 10,
  contract_size numeric default 100000,
  margin_requirement numeric,
  trading_hours text,
  spread numeric,
  notes text
);

-- STRATEGIES
create table if not exists strategies (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  setup text,
  entry text,
  exit text,
  stop_loss text,
  target_rr numeric default 2,
  timeframes text[] default '{}',
  markets text[] default '{}',
  notes text,
  active boolean default true,
  checklist_items jsonb default '[]',
  win_rate numeric default 0,
  total_trades integer default 0,
  avg_pnl numeric default 0,
  created_at timestamptz default now()
);

-- TRADES
create table if not exists trades (
  id uuid default gen_random_uuid() primary key,
  account_id uuid references accounts(id) on delete cascade,
  symbol text not null,
  instrument_id uuid references instruments(id),
  strategy_id uuid references strategies(id) on delete set null,
  type text check (type in ('long','short')) not null,
  status text check (status in ('open','closed','partial')) default 'open',
  outcome text check (outcome in ('win','loss','breakeven','pending')) default 'pending',
  entry_price numeric not null,
  exit_price numeric,
  stop_loss numeric,
  take_profit numeric,
  quantity numeric default 1,
  lot_size numeric default 1,
  fees numeric default 0,
  commissions numeric default 0,
  slippage numeric default 0,
  gross_pnl numeric default 0,
  net_pnl numeric default 0,
  expected_rr numeric default 0,
  actual_rr numeric default 0,
  entry_date timestamptz,
  exit_date timestamptz,
  time_of_day text check (time_of_day in ('premarket','morning','midday','afternoon','afterhours')) default 'morning',
  market_condition text check (market_condition in ('trending','ranging','volatile','quiet')) default 'trending',
  session_quality integer check (session_quality between 1 and 5) default 3,
  emotion text check (emotion in ('confident','fearful','greedy','neutral','disciplined','revenge','fomo')) default 'neutral',
  followed_plan boolean default true,
  chart_before_url text,
  chart_after_url text,
  pre_trade_notes text,
  post_trade_notes text,
  notes text,
  mistakes text,
  lessons_learned text,
  tags text[] default '{}',
  checklist_items jsonb default '{}',
  checklist_completed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes for performance
create index if not exists trades_account_id_idx on trades(account_id);
create index if not exists trades_entry_date_idx on trades(entry_date);
create index if not exists trades_symbol_idx on trades(symbol);

-- ============================================================
-- SEED: 43 Pre-loaded Instruments
-- ============================================================

insert into instruments (symbol, name, type, exchange, tick_size, lot_size, currency, pip_value, contract_size, margin_requirement, trading_hours, spread) values
-- Forex Majors
('EURUSD', 'Euro / US Dollar', 'forex', 'OTC', 0.0001, 100000, 'USD', 10, 100000, 3.33, '24/5', 0.8),
('GBPUSD', 'British Pound / US Dollar', 'forex', 'OTC', 0.0001, 100000, 'USD', 10, 100000, 3.33, '24/5', 1.0),
('USDJPY', 'US Dollar / Japanese Yen', 'forex', 'OTC', 0.01, 100000, 'JPY', 9.1, 100000, 3.33, '24/5', 0.9),
('USDCHF', 'US Dollar / Swiss Franc', 'forex', 'OTC', 0.0001, 100000, 'CHF', 10, 100000, 3.33, '24/5', 1.1),
('AUDUSD', 'Australian Dollar / US Dollar', 'forex', 'OTC', 0.0001, 100000, 'USD', 10, 100000, 3.33, '24/5', 1.0),
('USDCAD', 'US Dollar / Canadian Dollar', 'forex', 'OTC', 0.0001, 100000, 'CAD', 7.7, 100000, 3.33, '24/5', 1.2),
('NZDUSD', 'New Zealand Dollar / US Dollar', 'forex', 'OTC', 0.0001, 100000, 'USD', 10, 100000, 3.33, '24/5', 1.3),
-- Forex Crosses
('EURGBP', 'Euro / British Pound', 'forex', 'OTC', 0.0001, 100000, 'GBP', 12.7, 100000, 3.33, '24/5', 1.2),
('EURJPY', 'Euro / Japanese Yen', 'forex', 'OTC', 0.01, 100000, 'JPY', 9.1, 100000, 3.33, '24/5', 1.2),
('GBPJPY', 'British Pound / Japanese Yen', 'forex', 'OTC', 0.01, 100000, 'JPY', 9.1, 100000, 3.33, '24/5', 2.0),
('EURAUD', 'Euro / Australian Dollar', 'forex', 'OTC', 0.0001, 100000, 'AUD', 6.5, 100000, 3.33, '24/5', 1.5),
('EURCHF', 'Euro / Swiss Franc', 'forex', 'OTC', 0.0001, 100000, 'CHF', 10, 100000, 3.33, '24/5', 1.5),
('GBPAUD', 'British Pound / Australian Dollar', 'forex', 'OTC', 0.0001, 100000, 'AUD', 6.5, 100000, 3.33, '24/5', 2.0),
('AUDJPY', 'Australian Dollar / Japanese Yen', 'forex', 'OTC', 0.01, 100000, 'JPY', 9.1, 100000, 3.33, '24/5', 1.8),
('CADJPY', 'Canadian Dollar / Japanese Yen', 'forex', 'OTC', 0.01, 100000, 'JPY', 9.1, 100000, 3.33, '24/5', 2.0),
-- Crypto
('BTCUSD', 'Bitcoin / US Dollar', 'crypto', 'Binance', 0.01, 1, 'USD', 1, 1, 10, '24/7', 15),
('ETHUSD', 'Ethereum / US Dollar', 'crypto', 'Binance', 0.01, 1, 'USD', 1, 1, 10, '24/7', 3),
('XRPUSD', 'Ripple / US Dollar', 'crypto', 'Binance', 0.0001, 1, 'USD', 1, 1, 10, '24/7', 0.005),
('LTCUSD', 'Litecoin / US Dollar', 'crypto', 'Binance', 0.01, 1, 'USD', 1, 1, 10, '24/7', 0.5),
('BNBUSD', 'Binance Coin / US Dollar', 'crypto', 'Binance', 0.01, 1, 'USD', 1, 1, 10, '24/7', 0.5),
-- Commodities
('XAUUSD', 'Gold / US Dollar', 'commodity', 'OTC', 0.01, 100, 'USD', 1, 100, 0.5, '23/5', 0.3),
('XAGUSD', 'Silver / US Dollar', 'commodity', 'OTC', 0.001, 5000, 'USD', 1, 5000, 0.5, '23/5', 0.02),
('USOIL', 'US Crude Oil (WTI)', 'commodity', 'NYMEX', 0.01, 1000, 'USD', 10, 1000, 1, '23/5', 0.04),
('UKOIL', 'UK Brent Crude', 'commodity', 'ICE', 0.01, 1000, 'USD', 10, 1000, 1, '23/5', 0.04),
('NATGAS', 'Natural Gas', 'commodity', 'NYMEX', 0.001, 10000, 'USD', 10, 10000, 2, '23/5', 0.005),
-- Indices
('US500', 'S&P 500 Index', 'index', 'CME', 0.25, 50, 'USD', 50, 50, 0.5, '23/5', 0.4),
('US100', 'NASDAQ 100 Index', 'index', 'CME', 0.25, 20, 'USD', 20, 20, 0.5, '23/5', 0.6),
('US30', 'Dow Jones Industrial Average', 'index', 'CME', 1, 5, 'USD', 5, 5, 0.5, '23/5', 1.5),
('UK100', 'FTSE 100 Index', 'index', 'ICE', 0.5, 10, 'GBP', 10, 10, 0.5, '08/21 Mon-Fri', 1.0),
('GER40', 'DAX 40 Index', 'index', 'Eurex', 0.5, 5, 'EUR', 5, 5, 0.5, '08/22 Mon-Fri', 1.0)
on conflict (symbol) do nothing;

-- ============================================================
-- Row Level Security (optional - uncomment if needed)
-- ============================================================
-- alter table accounts enable row level security;
-- alter table trades enable row level security;
-- alter table strategies enable row level security;
-- create policy "Public access" on accounts for all using (true);
-- create policy "Public access" on trades for all using (true);
-- create policy "Public access" on strategies for all using (true);
-- create policy "Public read instruments" on instruments for select using (true);

