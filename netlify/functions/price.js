exports.handler = async function() {
  const CA = 'Dc9CeuctqvP947ipnCJb8fSf6HhNWDooAQxsVHj2RNBV';
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
    mint: CA,
    pairAddress: p.pairAddress,
    dexId: p.dexId
  });

  try {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${CA}`);
    if (!response.ok) throw new Error('market source unavailable');
    const data = await response.json();
    const pair = (data.pairs || []).find((p) =>
      p.chainId === 'solana' &&
      (p.baseToken?.address === CA || p.quoteToken?.address === CA) &&
      Number(p.priceUsd) > 0
    );
    if (!pair) throw new Error('current mint not indexed');
    return { statusCode: 200, headers, body: JSON.stringify(buildResponse(pair)) };
  } catch (e) {
    return {statusCode: 503, headers, body: JSON.stringify({mint: CA, error: 'current mint market data unavailable'})};
  }
};
