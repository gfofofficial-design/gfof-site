exports.handler = async function(event) {
  const CA = '2oQmHWoTZRmRLregHKjBSGJy3ueX3iRNzimy2iZCmoon';
  const PAIR = '3y4NNTfU3y1KzCChAJyQUv5RmX3zuZNxVbXer2vjASGE';
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=20'
  };

  const buildResponse = (p) => ({
    price: p.priceUsd || '0',
    mc: p.fdv || p.marketCap || 0,
    vol24h: (p.volume && p.volume.h24) || 0,
    priceChange: (p.priceChange && p.priceChange.h24) || 0,
    buys24h: (p.txns && p.txns.h24 && p.txns.h24.buys) || 0,
    sells24h: (p.txns && p.txns.h24 && p.txns.h24.sells) || 0,
    pairAddress: p.pairAddress || PAIR,
    dexId: p.dexId || 'meteoradbc'
  });

  try {
    /* Primary: direct pair endpoint — most complete data for this Meteora pool */
    const r1 = await fetch(
      `https://api.dexscreener.com/latest/dex/pairs/solana/${PAIR}`,
      { headers: { 'User-Agent': 'GFOF-Site/1.0' } }
    );
    if (!r1.ok) throw new Error('pair endpoint failed');
    const d1 = await r1.json();
    const p1 = d1.pair || (d1.pairs && d1.pairs[0]);
    if (!p1 || !p1.priceUsd) throw new Error('no pair data');
    return { statusCode: 200, headers, body: JSON.stringify(buildResponse(p1)) };
  } catch (e) {
    try {
      /* Fallback: token endpoint */
      const r2 = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${CA}`);
      const d2 = await r2.json();
      const p2 = (d2.pairs || [])[0];
      if (!p2) throw new Error('no token data');
      return { statusCode: 200, headers, body: JSON.stringify(buildResponse(p2)) };
    } catch (e2) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ error: 'data unavailable', price: '0', mc: 0 })
      };
    }
  }
};
