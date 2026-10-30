// Local reviewed metadata and explicitly registered adapters only. No discovery,
// remote token list, wallet permission, signing or network side effect.
const freeze=v=>Object.freeze(v);
const id=v=>typeof v==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,179}$/.test(v);
const text=v=>typeof v==='string'&&v.length>0&&v.length<=80&&!/[\u0000-\u001f\u007f]/.test(v);
const capabilities=v=>v&&['research','quote','trade'].every(k=>typeof v[k]==='boolean');
const fail=()=>Error('swap_catalog_invalid');
export function createSwapCatalog({chains,tokens,routes},{chainAdapters,providerAdapters}){
 if(!Array.isArray(chains)||!Array.isArray(tokens)||!Array.isArray(routes)||chains.length>100||tokens.length>10000||routes.length>50000)throw fail();
 const chainMap=new Map(),tokenMap=new Map(),routeMap=new Map(),providers=new Map(),identities=new Set();
 for(const c of chains){
  const adapter=chainAdapters?.[c.adapterId];
  if(!id(c.id)||!text(c.name)||chainMap.has(c.id)||!adapter||typeof adapter.validateAsset!=='function'||adapter.chainId!==c.id)throw fail();
  chainMap.set(c.id,freeze({id:c.id,name:c.name,adapterId:c.adapterId}));
 }
 for(const t of tokens){
  const chain=chainMap.get(t.chainId),adapter=chain&&chainAdapters[chain.adapterId];
  if(!id(t.id)||!chain||tokenMap.has(t.id)||!text(t.symbol)||!text(t.name)||!['native','token'].includes(t.kind)||typeof t.reference!=='string'||!capabilities(t.capabilities)||!Number.isInteger(t.decimals)||t.decimals<0||t.decimals>36||adapter.validateAsset(t)!==true)throw fail();
  const canonical=adapter.canonicalReference(t);if(typeof canonical!=='string'||!canonical||canonical.length>180)throw fail();
  const identity=JSON.stringify([t.chainId,canonical]);if(identities.has(identity))throw fail();identities.add(identity);
  // Full chain/reference identity is independent of a reused ticker or logo.
  tokenMap.set(t.id,freeze({id:t.id,identity,chainId:t.chainId,kind:t.kind,reference:t.reference,symbol:t.symbol,name:t.name,decimals:t.decimals,capabilities:freeze({...t.capabilities})}));
 }
 for(const r of routes){
  const input=tokenMap.get(r.inputId),output=tokenMap.get(r.outputId),provider=providerAdapters?.[r.providerId];
  if(!id(r.id)||routeMap.has(r.id)||!input||!output||input===output||!capabilities(r.capabilities)||!provider||!Array.isArray(provider.chainIds))throw fail();
  // A bridge requires a separate reviewed adapter; a quote provider cannot turn
  // a same-chain route into a cross-chain trade by metadata alone.
  if(input.chainId!==output.chainId||!provider.chainIds.includes(input.chainId)||typeof provider.buildQuoteRequest!=='function'||r.capabilities.quote&&(!input.capabilities.quote||!output.capabilities.quote))throw fail();
  if(!providers.has(r.providerId))providers.set(r.providerId,freeze({buildQuoteRequest:provider.buildQuoteRequest}));
  routeMap.set(r.id,freeze({id:r.id,input,output,providerId:r.providerId,capabilities:freeze({...r.capabilities}),executionEnabled:false}));
 }
 const getRoute=routeId=>{const r=routeMap.get(routeId);if(!r||r.capabilities.quote!==true)throw fail();return r;};
 return freeze({chains:freeze([...chainMap.values()]),tokens:freeze([...tokenMap.values()]),routes:freeze([...routeMap.values()]),
  token:tokenId=>tokenMap.get(tokenId)||null,route:getRoute,
  quoteRequest(routeId,amount){const r=getRoute(routeId);return providers.get(r.providerId).buildQuoteRequest({input:r.input,output:r.output,amount});},
  // No execution function is exposed. Trade metadata is never launch authority.
  executionEnabled:false});
}
