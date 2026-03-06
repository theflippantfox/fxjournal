import { json } from '@sveltejs/kit';

const searchCache = new Map<string, { results: any[]; fetchedAt: number }>();
const CACHE_TTL_MS = 60_000; // 1 minute cache for search results

export async function GET({ url }) {
  const query = (url.searchParams.get('q') ?? '').trim();
  if (query.length < 1) return json([]);

  const cached = searchCache.get(query.toLowerCase());
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return json(cached.results);
  }

  try {
    // Yahoo Finance autocomplete API — works for NSE (.NS), BSE (.BO), global symbols
    const searchUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&lang=en-IN&region=IN&quotesCount=10&newsCount=0&listsCount=0&enableFuzzyQuery=true&enableCb=false`;

    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-IN,en;q=0.9',
      },
      signal: AbortSignal.timeout(5000)
    });

    if (!res.ok) return json([]);

    const data = await res.json();
    const quotes = data?.quotes ?? [];

    // Map to our instrument shape, prioritise Indian exchanges
    const results = quotes
      .filter((q: any) => q.symbol && q.quoteType !== 'MUTUALFUND' && q.quoteType !== 'CURRENCY')
      .map((q: any) => {
        const isNSE = q.symbol?.endsWith('.NS');
        const isBSE = q.symbol?.endsWith('.BO');
        const isMCX = q.exchange === 'MCX';
        const isIndex = q.quoteType === 'INDEX';
        const isFutures = q.quoteType === 'FUTURE';
        const isCrypto = q.quoteType === 'CRYPTOCURRENCY';

        // Determine display symbol (strip .NS/.BO for Indian equities)
        const displaySymbol = isNSE
          ? q.symbol.replace('.NS', '')
          : isBSE
            ? q.symbol.replace('.BO', '')
            : q.symbol;

        // Determine exchange label
        const exchangeLabel = isNSE ? 'NSE'
          : isBSE ? 'BSE'
            : isMCX ? 'MCX'
              : isIndex ? (q.exchange ?? 'INDEX')
                : isCrypto ? 'Crypto'
                  : q.exchange ?? '';

        // Determine type
        const type = isIndex ? 'index'
          : isFutures ? 'futures'
            : isCrypto ? 'crypto'
              : (isNSE || isBSE) ? 'stock'
                : 'stock';

        // Currency — INR for Indian exchanges
        const currency = (isNSE || isBSE || isMCX) ? 'INR' : (q.currency ?? 'USD');

        return {
          symbol: displaySymbol,
          yahoo_symbol: q.symbol,
          name: q.longname ?? q.shortname ?? displaySymbol,
          type,
          exchange: exchangeLabel,
          currency,
          score: isNSE ? 10 : isBSE ? 8 : 5  // rank Indian first
        };
      })
      // Deduplicate — prefer NSE over BSE for same company
      .reduce((acc: any[], item: any) => {
        const existing = acc.find(a => a.symbol === item.symbol);
        if (!existing || item.score > existing.score) {
          return [...acc.filter(a => a.symbol !== item.symbol), item];
        }
        return acc;
      }, [])
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 8);

    searchCache.set(query.toLowerCase(), { results, fetchedAt: Date.now() });
    return json(results);

  } catch (e) {
    console.error('Instrument search error:', e);
    return json([]);
  }
}
