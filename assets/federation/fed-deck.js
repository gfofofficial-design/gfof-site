'use strict';
(()=>{
 const form=document.getElementById('wallet-form'),input=document.getElementById('wallet-address'),status=document.getElementById('wallet-message'),rows=document.getElementById('wallet-rows'),clear=document.getElementById('wallet-clear'),button=document.getElementById('wallet-load');
 const walletResults = document.getElementById('wallet-results');
 const walletTable = document.getElementById('wallet-table-scroll');
 const walletHeading = document.getElementById('wallet-state');
 const walletHistoryLink = document.getElementById('wallet-history-link');
 const exampleButton = document.getElementById('wallet-example');
 const walletEvidence=document.getElementById('wallet-read-evidence');
 const solMint = 'So11111111111111111111111111111111111111112';
 // Illustrative quantities and prices only. There is no address, source slot
 // or observation time, so the example cannot enter live evidence or history.
 const usdcMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
 const example = {
  sol: '2.540834112',
  tokens: [
   { symbol: 'USDC', mint: usdcMint, quantity: '125.5' },
   { symbol: 'GFOF', mint: 'Dc9CeuctqvP947ipnCJb8fSf6HhNWDooAQxsVHj2RNBV', quantity: '45000.250001' },
  ],
  pricing: { prices: { [solMint]: { usdPrice: 147.24 }, [usdcMint]: { usdPrice: 1 } } },
 };

 function showWalletMessage(state, text) {
  status.setAttribute('data-state', state);
  status.textContent = text;
 }

 function clearReadEvidence(){
  if(!walletEvidence?.hasAttribute?.('data-fed-evidence'))return;
  walletEvidence.hidden=true;
  walletEvidence.removeAttribute('data-fed-readout');
 }
 function setReadEvidence(data,coverage){
  if(!walletEvidence?.hasAttribute?.('data-fed-evidence'))return;
  walletEvidence.setAttribute('data-fed-readout',JSON.stringify({
   commitment:data.network==='solana-mainnet'?data.commitment:null,
   slots:Array.isArray(data.slots)&&data.slots.length===3?data.slots.map(number=>Number.isSafeInteger(number)?number:null):[],
   observedAt:typeof data.observedAt==='string'?data.observedAt.slice(0,39):null,
   ...coverage
  }));
 }
 let activeRead,sequence=0;
 function setReadPending(pending){
  button.setAttribute('aria-disabled',String(pending));
  walletTable.setAttribute('aria-busy',String(pending));
  button.textContent = pending ? 'Reading balances…' : 'Read balances';
 }
 function cancelRead(){
  activeRead?.controller.abort();
  activeRead=undefined;
  setReadPending(false);
 }
 const assetFilter=document.getElementById('wallet-asset-filter'),filterPanel=document.getElementById('wallet-filter-panel'),filterStatus=document.getElementById('wallet-filter-status');let filterRows=[];
 function filterHoldings() {
  const query = assetFilter.value.trim().toLowerCase();
  let shown = 0;
  for (const item of filterRows) {
   item.row.hidden = Boolean(query) && !item.search.includes(query);
   if (!item.row.hidden) shown++;
  }
  const matches = shown ? 'Showing ' + shown + ' of ' + filterRows.length + ' assets.' :
   'No matching assets in this balance read.';
  filterStatus.textContent = matches + (query ? ' Totals still cover all returned holdings.' : '');
 }
 assetFilter.addEventListener('input',filterHoldings);
 document.getElementById('wallet-filter-clear').addEventListener('click',()=>{assetFilter.value='';filterHoldings();assetFilter.focus();});
 let historyAddress='',historySamples=[];
 function clearHistory(){walletHistoryLink.hidden=true;historyAddress='';historySamples=[];document.getElementById('balance-history-plot').replaceChildren();document.getElementById('balance-history-rows').replaceChildren();document.getElementById('balance-history-message').textContent='Read an address to start. Refresh it again to add another reading.';document.getElementById('balance-history-range').textContent='No readings yet';}
 function recordHistory(data){
  const time=Date.parse(data.observedAt),value=Number(data.sol);if(!Number.isFinite(time)||!Number.isFinite(value)||value<0)throw Error('Balance history response could not be verified.');
  if(historyAddress!==data.address){clearHistory();historyAddress=data.address;}
  if(!historySamples.some(s=>s.time===time))historySamples.push({time,value,quantity:data.sol});historySamples.sort((a,b)=>a.time-b.time);historySamples=historySamples.slice(-12);
  walletHistoryLink.hidden = false;
  const table=document.getElementById('balance-history-rows');table.replaceChildren();
  for(const sample of historySamples){const tr=document.createElement('tr');for(const text of [new Date(sample.time).toLocaleString(),sample.quantity+' SOL']){const td=document.createElement('td');td.textContent=text;tr.append(td);}table.append(tr);}
  document.getElementById('balance-history-message').textContent=historySamples.length+' actual readings for '+data.address.slice(0,6)+'…'+data.address.slice(-6)+' in this page visit. '+(historySamples.length<2?'Refresh the same address to draw a line.':'This is a balance change, not investment profit.');
  const plot=document.getElementById('balance-history-plot');plot.replaceChildren();
  const low=Math.min(...historySamples.map(s=>s.value)),high=Math.max(...historySamples.map(s=>s.value));
  document.getElementById('balance-history-range').textContent='Range: '+low.toLocaleString('en-US',{maximumFractionDigits:9})+'–'+high.toLocaleString('en-US',{maximumFractionDigits:9})+' SOL';
  if(historySamples.length<2)return;
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 400 140');svg.setAttribute('role','img');svg.setAttribute('aria-label','Native SOL balance readings over this visit; exact observations are in the table below.');const line=document.createElementNS('http://www.w3.org/2000/svg','polyline');
  const start=historySamples[0].time,end=historySamples[historySamples.length-1].time;
  line.setAttribute('points',historySamples.map(s=>((s.time-start)/(end-start)*380+10).toFixed(2)+','+(high===low?70:120-(s.value-low)/(high-low)*100).toFixed(2)).join(' '));svg.append(line);plot.append(svg);
 }

 function reset() {
  walletResults.hidden = true;
  clearReadEvidence();
  filterRows = [];
  assetFilter.value = '';
  filterPanel.hidden = true;
  filterStatus.textContent = 'Read balances to filter returned assets.';
  for (const id of ['wallet-unpriced-list', 'wallet-source-links', 'wallet-source-slots', 'holdings-graph']) {
   document.getElementById(id).replaceChildren();
  }
  for (const id of ['wallet-unpriced-panel', 'wallet-source-panel', 'wallet-coverage-meter']) {
   document.getElementById(id).hidden = true;
  }
  document.getElementById('wallet-price-details').open = false;
  document.getElementById('wallet-source-details').open = false;
  document.getElementById('wallet-unpriced-summary').textContent = '';
  document.getElementById('wallet-source-message').textContent = 'No source details loaded.';
  document.getElementById('wallet-price-status').textContent = 'WAITING FOR BALANCES';
  document.getElementById('wallet-priced-count').textContent = '—';
  document.getElementById('wallet-unpriced-count').textContent = '—';
  document.getElementById('wallet-coverage-label').textContent = 'Price coverage will appear after a balance read.';
  rows.replaceChildren();
  document.getElementById('priced-total').textContent = '—';
  document.getElementById('price-coverage').textContent = 'Load an address to view priced holdings.';
  document.getElementById('wallet-count').textContent = '—';
  walletHeading.textContent = 'No address loaded';
  document.getElementById('wallet-scope').textContent = 'Read-only address viewer';
  document.getElementById('wallet-caption').textContent = 'No balances loaded';
  document.getElementById('wallet-data-status').textContent = 'READ ONLY';
 }
 const dollars=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2});
 function mintLinkOK(mint){if(typeof mint!=='string'||!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint))return false;let n=0n;const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';for(const c of mint)n=n*58n+BigInt(alphabet.indexOf(c));let bytes=0;while(n){bytes++;n>>=8n;}return bytes+mint.match(/^1*/)[0].length===32;}
 function renderSources(data){
  const panel=document.getElementById('wallet-source-panel');if(!mintLinkOK(data.address))return;
  const link=document.createElement('a');link.href='https://explorer.solana.com/address/'+encodeURIComponent(data.address);link.target='_blank';link.rel='noopener noreferrer';link.textContent='Check this address on Solana Explorer ↗';link.setAttribute('aria-label','Open viewed public address '+data.address+' in Solana Explorer, opens a new tab');document.getElementById('wallet-source-links').append(link);panel.hidden=false;
  const valid=data.commitment==='confirmed'&&Array.isArray(data.slots)&&data.slots.length===3&&data.slots.every(slot=>Number.isSafeInteger(slot)&&slot>=0);
  document.getElementById('wallet-source-message').textContent=valid?'Confirmed Solana balance reads. The three source slots may differ; this is not one atomic or finalized snapshot. Explorer shows its own latest state. Reference prices are separate from these balance reads.':'Balance source slots or commitment are unavailable. Explorer shows its own latest state; it cannot reproduce this read without the source details.';
  if(valid)for(const [i,label] of ['Native SOL','Original SPL token accounts','Token-2022 accounts'].entries()){const dt=document.createElement('dt');dt.textContent=label;const dd=document.createElement('dd');dd.textContent='Slot '+data.slots[i];document.getElementById('wallet-source-slots').append(dt);document.getElementById('wallet-source-slots').append(dd);}
 }
 function row(asset, amount, mint, value, illustrative) {
  const tr = document.createElement('tr');
  for (const text of [asset, amount, value === null ? 'Price unavailable' :
    value > 0 && value < 0.01 ? '< $0.01' : dollars.format(value)]) {
   const td = document.createElement('td');
   td.textContent = text;
   tr.append(td);
  }
  if (mint) {
   const detail = document.createElement('details');
   detail.className = 'wallet-mint-details';
   const disclosure = document.createElement('summary');
   disclosure.textContent = 'Mint address';
   disclosure.setAttribute('aria-label', 'Show mint address for ' + asset);
   const address = document.createElement('code');
   address.className = 'mint-address';
   address.textContent = mint;
   detail.append(disclosure);
   detail.append(address);
   tr.firstChild.append(detail);
   if (!illustrative && mintLinkOK(mint)) {
    const link = document.createElement('a');
    link.className = 'wallet-lens-link';
    link.href = 'https://dossiertrack.co/token-structure?mint=' + encodeURIComponent(mint);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Inspect mint';
    link.setAttribute('aria-label', 'Inspect ' + asset + ' mint ' + mint + ' in Dossier Lens, opens a new tab');
    tr.firstChild.append(link);
   }
  }
  rows.append(tr);
  filterRows.push({ row: tr, search: (asset + ' ' + (mint || solMint)).toLowerCase() });
 }

 function holdings(data, illustrative = false) {
  const assets = [{ symbol: 'SOL', mint: solMint, quantity: data.sol }, ...data.tokens];
  const priced = [], unpriced = [];
  for (const asset of assets) {
   const price = data.pricing?.prices?.[asset.mint]?.usdPrice;
   const quantity = Number(asset.quantity);
   const estimate = Number.isFinite(price) && price > 0 ? quantity * price : null;
   const value = Number.isFinite(estimate) && estimate >= 0 ? estimate : null;
   row(asset.symbol || 'Unverified token', asset.quantity, asset.mint === solMint ? null : asset.mint, value, illustrative);
   if (!(quantity > 0)) continue;
   if (value === null) unpriced.push(asset);
   else priced.push({ ...asset, value });
  }
  const missing = unpriced.length;
  const total = priced.reduce((sum, asset) => sum + asset.value, 0);
  if (!Number.isFinite(total)) throw Error('Estimated values exceeded the display range.');
  document.getElementById('priced-total').textContent = priced.length ?
    (total > 0 && total < 0.01 ? '< $0.01' : dollars.format(total)) : 'Unavailable';
  const pricedLabel = priced.length === 1 ? 'asset' : 'assets';
  const missingLabel = missing === 1 ? 'asset' : 'assets';
  const coverageNote = priced.length + ' ' + pricedLabel + ' priced; ' + missing + ' nonzero ' + missingLabel + ' excluded.';
  const source = illustrative ? 'Fictional reference prices.' :
    (data.pricing?.status === 'unavailable' ? 'Price service unavailable.' : 'Reference prices from Jupiter Price V3.');
  document.getElementById('price-coverage').textContent = priced.length + missing === 0 ?
   'No nonzero balances were returned. There is no subtotal to calculate.' : coverageNote + ' ' + source;
  const unpricedPanel=document.getElementById('wallet-unpriced-panel'),unpricedList=document.getElementById('wallet-unpriced-list');unpricedList.replaceChildren();unpricedPanel.hidden=unpriced.length===0;
  for(const a of unpriced.slice(0,5)){const item=document.createElement('li');const name=a.symbol||a.mint.slice(0,6)+'…'+a.mint.slice(-4);item.textContent=name+' · '+a.quantity+(a.mint==='So11111111111111111111111111111111111111112'?' SOL':' tokens');unpricedList.append(item);}
  document.getElementById('wallet-unpriced-summary').textContent=unpriced.length+' nonzero '+(unpriced.length===1?'asset is':'assets are')+' excluded from the dollar subtotal.'+(unpriced.length>5?' Showing the first 5; the wallet table contains all returned quantities.':'');
  const assetCount=priced.length+missing;
  document.getElementById('wallet-priced-count').textContent=String(priced.length);document.getElementById('wallet-unpriced-count').textContent=String(missing);
  document.getElementById('wallet-price-status').textContent=assetCount===0?'NO NONZERO HOLDINGS':priced.length===0?'PRICES UNAVAILABLE':missing?'PARTIAL PRICE COVERAGE':'ALL RETURNED HOLDINGS PRICED';
  const coverage=document.getElementById('wallet-coverage-meter');coverage.hidden=assetCount===0;coverage.max=assetCount||1;coverage.value=priced.length;
  document.getElementById('wallet-coverage-label').textContent=assetCount?priced.length+' of '+assetCount+' nonzero assets have a reference price. Coverage is by asset count, not token quantity or portfolio value.':'No nonzero assets were returned. There is no price coverage to calculate.';
  function shareLabel(value){const percent=100*value/total;return percent>0&&percent<0.1?'< 0.1%':percent>99.9&&priced.some(other=>other.value>0&&other.value!==value)?'> 99.9%':percent.toFixed(1)+'%';}
  const graph=document.getElementById('holdings-graph');if(total>0)for(const a of priced.sort((a,b)=>b.value-a.value)){const item=document.createElement('div');item.className='holding-bar';const label=document.createElement('span');label.textContent=(a.symbol||a.mint.slice(0,6)+'…'+a.mint.slice(-4))+' · '+shareLabel(a.value)+' · '+(a.value>0&&a.value<0.01?'< $0.01':dollars.format(a.value));const meter=document.createElement('meter');meter.min=0;meter.max=1;meter.value=a.value/total;meter.setAttribute('aria-label',label.textContent);meter.textContent=label.textContent;item.append(label);item.append(meter);graph.append(item);}else graph.textContent='No priced nonzero assets available. Unpriced quantities remain in the wallet table.';
  filterPanel.hidden=false;filterHoldings();return {priced:priced.length,total:assetCount};
 }
 form.addEventListener('submit',async e=>{
  e.preventDefault();const address=input.value.trim();
  // Keep the submit button focusable while preventing a repeated read.
  if(activeRead?.address===address)return;
  const request=++sequence;cancelRead();reset();if(historyAddress&&historyAddress!==address)clearHistory();
  if (!mintLinkOK(address)) {
   input.setAttribute('aria-invalid', 'true');
   showWalletMessage('invalid', 'Enter a public Solana address. Copy it from your wallet’s Receive screen.');
   input.focus();
   return;
  }
  input.setAttribute('aria-invalid','false');
  const requestController=new AbortController();
  activeRead={address,controller:requestController};
  let timedOut=false,onAbort;
  const aborted=new Promise((_,reject)=>{onAbort=()=>reject(Object.assign(Error('Lookup cancelled.'),{name:'AbortError'}));requestController.signal.addEventListener('abort',onAbort,{once:true});});
  const timeout=setTimeout(()=>{timedOut=true;requestController.abort();},20000);setReadPending(true);showWalletMessage('loading', 'Reading balances from Solana and checking available reference prices…');
  try{
   const payload=await Promise.race([(async()=>{
    const res=await fetch('/api/federation-wallet',{method:'POST',credentials:'omit',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({address}),signal:requestController.signal});
    let data;try{data=await res.json();}catch{throw Error(res.status===429?'Too many lookups. Please wait a minute.':'Wallet service is unavailable. Please try again later.');}
    if(res.status===429){const reasons=['The shared daily wallet-read limit has been reached. Please return after 00:00 UTC.','The wallet reader is busy. Please wait a moment before trying again.'];throw Error(reasons.includes(data?.error)?data.error:'Too many lookups. Please wait a minute.');}
    return {res,data};
   })(),aborted]);
   if(request!==sequence)return;const {res,data}=payload;if(!res.ok)throw Error(data.error||'Wallet service unavailable.');if(data.address!==address||!Array.isArray(data.tokens)||data.tokens.length>1000||typeof data.sol!=='string')throw Error('Balance response could not be verified.');
   const coverage=holdings(data);recordHistory(data);renderSources(data);setReadEvidence(data,coverage);
   document.getElementById('wallet-count').textContent = String(data.tokens.length);
   walletHeading.textContent = 'Address loaded';
   document.getElementById('wallet-scope').textContent = address.slice(0, 6) + '…' + address.slice(-6) + ' · Ownership unverified';
   document.getElementById('wallet-caption').textContent = 'On-chain quantities and available reference values';
   document.getElementById('wallet-data-status').textContent = 'BALANCES LOADED';
   walletResults.hidden = false;
   const provider = data.source === 'Helius Solana RPC' ? 'Helius Solana RPC' : 'Solana public RPC';
   const observed = new Date(data.observedAt).toLocaleString();
   const accounts = data.tokenAccounts === 1 ? '1 token account read.' : data.tokenAccounts + ' token accounts read.';
   showWalletMessage('ready', 'Observed ' + observed + ' via ' + provider + '. ' + accounts);
  } catch (error) {
   if (request !== sequence) return;
   reset();
   clearHistory();
   const message = error.name === 'AbortError' ?
    (timedOut ? 'Lookup timed out. Please try again later.' : 'Lookup cancelled.') :
    error.message;
   showWalletMessage(timedOut ? 'timeout' : 'unavailable', message);
  } finally {
   clearTimeout(timeout);
   requestController.signal.removeEventListener('abort', onAbort);
   if (request === sequence) {
    activeRead = undefined;
    setReadPending(false);
   }
  }
 });

 function clearLookup() {
  sequence++;
  cancelRead();
  reset();
  clearHistory();
  input.setAttribute('aria-invalid', 'false');
 }

 exampleButton.addEventListener('click', () => {
  clearLookup();
  holdings(example, true);
  document.getElementById('wallet-count').textContent = String(example.tokens.length);
  document.getElementById('wallet-caption').textContent = 'Example quantities and reference values';
  document.getElementById('wallet-data-status').textContent = 'FICTIONAL EXAMPLE';
  walletHeading.textContent = 'Example wallet balances';
  document.getElementById('wallet-scope').textContent = 'Illustrative Solana balances and prices';
  walletResults.hidden = false;
  showWalletMessage('example', 'Example only. No wallet lookup was made for these figures.');
  walletHeading.focus();
 });
 input.addEventListener('input', () => {
  clearLookup();
  showWalletMessage('idle', input.value.trim() ? 'Ready to read this address.' : 'Ready to read a public address.');
 });
 clear.addEventListener('click', () => {
  clearLookup();
  input.value = '';
  showWalletMessage('idle', 'Cleared from this page. No wallet address is saved to your account or this device.');
  input.focus();
 });
 exampleButton.hidden = false;
 clear.hidden = false;
 const passport=globalThis.FederationPassport;
 const missionIDs=['repair-the-shuttle','the-signal','starport-market','observatory-journey','docking-request','long-way-home','borrowed-voice','after-the-crowd','changing-course','keys-to-the-gate','meridian-relay'];
 function renderPassport(){
  const collection=document.getElementById('mission-collection');collection.replaceChildren();
  if(!passport){document.getElementById('mission-message').textContent='Passport progress is unavailable. You can still open the journey.';return;}
  try{
   const p=passport.read();const missions=passport.missions.filter(m=>missionIDs.includes(m[0]));const done=new Set(p.enabled&&p.available&&Array.isArray(p.done)?p.done.filter(id=>missionIDs.includes(id)):[]);
   document.getElementById('mission-progress').max=missions.length;document.getElementById('mission-progress').value=done.size;
   document.getElementById('explorer-rank').textContent=p.available&&p.enabled?done.size+' / '+missions.length:p.available?'Start exploring':'Progress unavailable';
   document.getElementById('explorer-note').textContent=p.available&&p.enabled?'Mission badges on this device':p.available?'No saved passport on this device':'Browser storage cannot be read';
   document.getElementById('mission-message').textContent=!p.available?'Browser storage is unavailable. Saved completion cannot be checked.':!p.enabled?'Passport saving is off. Open Explorer Passport to choose whether to remember badges on this device.':done.size+' of '+missions.length+' badges remembered on this device. These are personal progress, not verified leaderboard scores.';
   const next=missions.find(m=>!done.has(m[0]))||missions[0];const link=document.getElementById('next-mission');link.href='/journey/'+next[0]+'.html';link.textContent=(done.size===missions.length?'Replay: ':'Next mission: ')+next[1]+' →';
   for(const m of missions){const card=document.createElement('article');card.className='badge-card'+(done.has(m[0])?' earned':'');const state=document.createElement('span');state.className='status';state.textContent=!p.available?'STATUS UNAVAILABLE':done.has(m[0])?'BADGE REMEMBERED':'EXPLORE';const title=document.createElement('h3');title.textContent=m[3];const guide=document.createElement('p');guide.textContent=m[1]+' · Guide: '+m[2];const action=document.createElement('a');action.href='/journey/'+m[0]+'.html';action.textContent=done.has(m[0])?'Replay mission →':'Open mission →';card.append(state);card.append(title);card.append(guide);card.append(action);collection.append(card);}
  }catch{document.getElementById('mission-message').textContent='Passport progress could not be read. Open Explorer Passport to check it.';document.getElementById('explorer-rank').textContent='Progress unavailable';}
 }
 document.getElementById('mission-refresh').addEventListener('click',renderPassport);
 globalThis.addEventListener?.('pageshow',renderPassport);
 renderPassport();
})();

