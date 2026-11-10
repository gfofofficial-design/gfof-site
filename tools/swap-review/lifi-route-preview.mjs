import {pathToFileURL} from 'node:url';
import {GFOF, QUOTE_PAIRS, SOL, USDC} from '../../assets/federation/swap/token-registry.mjs';
import {parseDecimalUnits} from '../../assets/federation/swap/decimal-units.mjs';
import {SOLANA_MAX_UNITS} from '../../assets/federation/swap/solana-quote-adapter.mjs';
import boundedJson from '../../netlify/lib/read-json-bounded.cjs';

const baseUsdc = Object.freeze({
  chainId: 8453,
  chain: 'Base',
  address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  symbol: 'USDC',
  decimals: 6
});
function solanaAsset(token) {
  return {
    chainId: 1151111081099710,
    chain: 'Solana',
    address: token === SOL ? '11111111111111111111111111111111' : token.mint,
    symbol: token.symbol,
    decimals: token.decimals
  };
}

// Alliance membership is separate from reviewed token and pair eligibility.
const pairs = new Map([
  ['base-usdc:solana-usdc', [baseUsdc, solanaAsset(USDC)]],
  ['base-usdc:solana-gfof', [baseUsdc, solanaAsset(GFOF)]],
  ...QUOTE_PAIRS.map(({input, output}) => [
    'solana-' + input.id.toLowerCase() + ':solana-' + output.id.toLowerCase(),
    [solanaAsset(input), solanaAsset(output)]
  ])
]);
const defaultPair = 'base-usdc:solana-usdc';
const routeEndpoint = 'https://li.quest/v1/advanced/routes';

function matchesToken(token, expected) {
  if (token?.chainId !== expected.chainId || token.decimals !== expected.decimals) return false;
  return expected.chain === 'Base'
    ? typeof token.address === 'string' && token.address.toLowerCase() === expected.address.toLowerCase()
    : token.address === expected.address;
}

function isPositiveAmount(value) {
  return typeof value === 'string' && /^[1-9][0-9]*$/.test(value);
}

function summarizeCosts(costs) {
  return costs?.map(cost => ({
    name: cost.name,
    amount: cost.amount,
    amountUsd: cost.amountUSD ?? null,
    included: cost.included ?? null,
    token: cost.token?.symbol,
    tokenAddress: cost.token?.address,
    tokenChainId: cost.token?.chainId,
    tokenDecimals: cost.token?.decimals
  })) ?? null;
}

function summarizeRoute(route, source, destination, amount) {
  if (route?.fromChainId !== source.chainId || route.toChainId !== destination.chainId ||
      !matchesToken(route.fromToken, source) || !matchesToken(route.toToken, destination) ||
      route.fromAmount !== amount || route.containsSwitchChain !== false ||
      !isPositiveAmount(route.toAmount) || !isPositiveAmount(route.toAmountMin) ||
      BigInt(route.toAmountMin) > BigInt(route.toAmount) ||
      !Array.isArray(route.steps) || !route.steps.length ||
      !route.steps.every(step => typeof step?.tool === 'string' && step.tool.length)) {
    throw new Error('LI.FI returned a route outside the reviewed quote inputs');
  }

  return {
    estimatedOutputBaseUnits: route.toAmount,
    minimumOutputBaseUnits: route.toAmountMin,
    estimatedGasUsd: route.gasCostUSD ?? null,
    steps: route.steps.map(step => ({
      tool: step.tool,
      includedTools: Array.isArray(step.includedSteps)
        ? step.includedSteps.map(part => part.tool).filter(tool => typeof tool === 'string')
        : [],
      estimatedDurationSeconds: step.estimate?.executionDuration ?? null,
      fees: summarizeCosts(step.estimate?.feeCosts),
      gas: summarizeCosts(step.estimate?.gasCosts)
    }))
  };
}

export async function getLifiRoutePreview({pair = defaultPair, input = '25', fetcher = fetch} = {}) {
  const assets = pairs.get(pair);
  if (!assets) throw new Error('Choose a reviewed pair: ' + [...pairs.keys()].join(', '));
  const [source, destination] = assets;
  const amount = parseDecimalUnits(input, source.decimals, SOLANA_MAX_UNITS);

  const data = await boundedJson.readJsonBounded(routeEndpoint, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      fromChainId: source.chainId,
      fromTokenAddress: source.address,
      toChainId: destination.chainId,
      toTokenAddress: destination.address,
      fromAmount: amount,
      options: {allowSwitchChain: false}
    })
  }, {timeoutMs: 15_000, maxBytes: 2_000_000, fetcher});
  if (!Array.isArray(data?.routes)) throw new Error('LI.FI response omitted the route list');

  return {
    provider: 'LI.FI',
    mode: 'estimate-only',
    checkedAt: new Date().toISOString(),
    source: {...source},
    destination: {...destination},
    inputBaseUnits: amount,
    routes: data.routes.map(route => summarizeRoute(route, source, destination, amount))
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(JSON.stringify(await getLifiRoutePreview({pair: process.argv[2], input: process.argv[3]}), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
