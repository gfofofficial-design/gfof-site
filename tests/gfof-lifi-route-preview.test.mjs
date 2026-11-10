import assert from 'node:assert/strict';
import test from 'node:test';
import {getLifiRoutePreview} from '../tools/swap-review/lifi-route-preview.mjs';

const from = {chainId: 8453, address: '0x833589fcd6edb6e08f4c7c32d4f71b54bdA02913', decimals: 6};
const to = {chainId: 1151111081099710, address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6};
const route = {
  fromChainId: from.chainId,
  toChainId: to.chainId,
  fromToken: from,
  toToken: to,
  fromAmount: '25000000',
  toAmount: '24937500',
  toAmountMin: '24937500',
  containsSwitchChain: false,
  steps: [{
    tool: 'example',
    estimate: {executionDuration: 30, feeCosts: [{amount: '62500', included: true}]},
    transactionRequest: {data: 'unsigned payload'}
  }]
};
const routesResponse = routes => async () => Response.json({routes});

test('requests only the fixed wallet-free corridor and projects estimates', async () => {
  const result = await getLifiRoutePreview({fetcher: async (url, options) => {
    assert.equal(url, 'https://li.quest/v1/advanced/routes');
    assert.equal(options.method, 'POST');
    assert.deepEqual(JSON.parse(options.body), {
      fromChainId: from.chainId,
      toChainId: to.chainId,
      fromTokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      toTokenAddress: to.address,
      fromAmount: '25000000',
      options: {allowSwitchChain: false}
    });
    return Response.json({routes: [route]});
  }});
  assert.equal(result.mode, 'estimate-only');
  assert.equal(result.routes[0].minimumOutputBaseUnits, '24937500');
  assert.equal(result.routes[0].steps[0].fees[0].amount, '62500');
  assert.equal(result.routes[0].steps[0].fees[0].included, true);
  assert.equal(result.routes[0].steps[0].gas, null);
  assert.doesNotMatch(JSON.stringify(result), /transactionRequest|unsigned payload/);
});

test('rejects wrong chain or mint, changed input, and inconsistent estimates', async () => {
  for (const change of [
    {toChainId: 1},
    {toToken: {...to, address: to.address.toLowerCase()}},
    {toToken: {...to, decimals: 9}},
    {fromAmount: '25000001'},
    {containsSwitchChain: true},
    {toAmountMin: '24937501'}
  ]) {
    await assert.rejects(getLifiRoutePreview({fetcher: routesResponse([{...route, ...change}])}), /outside/);
  }
});

test('distinguishes an empty route list from a provider error or invalid response', async () => {
  assert.deepEqual((await getLifiRoutePreview({fetcher: routesResponse([])})).routes, []);
  await assert.rejects(getLifiRoutePreview({fetcher: async () => Response.json({})}), /omitted/);
  await assert.rejects(getLifiRoutePreview({fetcher: async () => new Response(null, {status: 429})}), /unavailable/);
});

test('accepts reviewed project pairs and rejects unreviewed inputs before provider calls', async () => {
  await getLifiRoutePreview({
    pair: 'solana-sol:solana-gfof',
    input: '0.010',
    fetcher: async (_url, {body}) => {
      const request = JSON.parse(body);
      assert.equal(request.fromTokenAddress, '11111111111111111111111111111111');
      assert.equal(request.toTokenAddress, 'Dc9CeuctqvP947ipnCJb8fSf6HhNWDooAQxsVHj2RNBV');
      assert.equal(request.fromAmount, '10000000');
      return Response.json({routes: []});
    }
  });

  const fetcher = () => assert.fail('Unreviewed inputs must stay local');
  await assert.rejects(getLifiRoutePreview({pair: 'solana-sol:unreviewed', fetcher}), /reviewed pair/);
  await assert.rejects(getLifiRoutePreview({input: '0.0000001', fetcher}), /units_invalid/);
});
