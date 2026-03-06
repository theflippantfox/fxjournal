import { json } from '@sveltejs/kit';

const priceCache = new Map<string, { price: number; change: number; changePct: number; fetchedAt: number }>();
const CACHE_TTL_MS = 15_000;

// Map display symbol → Yahoo Finance symbol
export function _yahooSymbol(symbol: string): string {
  const s = symbol.trim().toUpperCase();

  // Already a Yahoo symbol (has dot or caret)
  if (s.startsWith('^') || s.includes('.')) return s;

  // Known indices
  const indices: Record<string, string> = {
    'NIFTY50': '^NSEI', 'NIFTY 50': '^NSEI', 'NIFTY': '^NSEI',
    'SENSEX': '^BSESN', 'BSE500': '^BSE500',
    'BANKNIFTY': '^NSEBANK', 'BANK NIFTY': '^NSEBANK',
    'NIFTYIT': '^CNXIT', 'NIFTY IT': '^CNXIT',
    'FINNIFTY': '^CNXFIN',
    'MIDCPNIFTY': '^NSEMDCP50',
    'NIFTY MIDCAP': '^NSEMDCP50',
    // F&O — use underlying
    'NIFTY-FUT': '^NSEI', 'BANKNIFTY-FUT': '^NSEBANK',
    // MCX commodities → global futures
    'MCXGOLD': 'GC=F', 'MCXSILVER': 'SI=F',
    'MCXCRUDEOIL': 'CL=F', 'MCXNATGAS': 'NG=F', 'MCXCOPPER': 'HG=F',
    // Currency
    'USDINR': 'INR=X', 'EURINR': 'EURINR=X', 'GBPINR': 'GBPINR=X', 'JPYINR': 'JPYINR=X',
    // Crypto
    'BTCUSD': 'BTC-USD', 'ETHUSD': 'ETH-USD', 'XRPUSD': 'XRP-USD', 'SOLUSD': 'SOL-USD',
  };

  if (indices[s]) return indices[s];

  // F&O futures — strip -FUT suffix, use underlying NSE stock
  if (s.endsWith('-FUT')) return s.replace('-FUT', '') + '.NS';

  // Default: assume NSE equity
  return s + '.NS';
}

async function fetchYahooPrice(symbol: string): Promise<{ price: number; change: number; changePct: number } | null> {
  const ySym = _yahooSymbol(symbol);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ySym)}?interval=1m&range=1d`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
      signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) return null;
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) return null;

    const price = meta.regularMarketPrice ?? meta.previousClose ?? 0;
    const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
    const change = price - prevClose;
    const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;

    return {
      price: Math.round(price * 100) / 100,
      change: Math.round(change * 100) / 100,
      changePct: Math.round(changePct * 100) / 100
    };
  } catch {
    return null;
  }
}

export async function GET({ url }) {
  const symbols = (url.searchParams.get('symbols') ?? '')
    .split(',').map(s => s.trim()).filter(Boolean);

  if (!symbols.length) return json({});

  const now = Date.now();
  const result: Record<string, any> = {};
  const toFetch: string[] = [];

  for (const sym of symbols) {
    const cached = priceCache.get(sym);
    if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
      result[sym] = { price: cached.price, change: cached.change, changePct: cached.changePct };
    } else {
      toFetch.push(sym);
    }
  }

  // Fetch in parallel batches of 5
  for (let i = 0; i < toFetch.length; i += 5) {
    const batch = toFetch.slice(i, i + 5);
    const fetched = await Promise.all(
      batch.map(s => fetchYahooPrice(s).then(r => ({ sym: s, r })))
    );
    for (const { sym, r } of fetched) {
      if (r) {
        priceCache.set(sym, { ...r, fetchedAt: now });
        result[sym] = r;
      } else {
        const stale = priceCache.get(sym);
        if (stale) result[sym] = { ...stale, stale: true };
      }
    }
  }

  return json(result);
}
