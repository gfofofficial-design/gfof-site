const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../assets/federation/fed-deck-locks.js'),'utf8');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'../record/current-mint-locks-three-20261008.json')));
const addresses=['AiRhuw9iFyXiZYv2hqanBK12dckebF4vNMoAzj9Nj9nY','F1iUer7wVsdv7uQ4if77Jy1ZAfTVDjSy4Pd7ZiXsVfS1','BW6ZUUT5NXxSGMKNAzoMYbqrXy5Dm1ev1ekEgYSXJWX8','9NeQZao9SNt7FztKbNMCwCmEYZTYkWnidZmW4chuupQq','EPdpg7AYEzcwudN7TRdEkCGHQeHRrFhoK2yiYxDdGLnv','DkzEr7nsuhL4Ser6AyZQ71u2mBdGj86mXmHDAzpS1Pop','Dc9CeuctqvP947ipnCJb8fSf6HhNWDooAQxsVHj2RNBV'];
function payload(){return {mint:addresses[6],commitment:'finalized',slot:fixture.result.context.slot,observedAt:new Date().toISOString(),accounts:fixture.result.value.map((account,i)=>({address:addresses[i],account:structuredClone(account)}))}}
function setup(fetch,timers={setTimeout,clearTimeout}){
 const nodes=new Map();function node(){return {textContent:'',children:[],attributes:{},events:{},setAttribute(k,v){this.attributes[k]=v},append(e){this.children.push(e)},replaceChildren(){this.children=[]},addEventListener(k,f){this.events[k]=f}}}
 const get=id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id)};
 vm.runInNewContext(source,{document:{getElementById:get,createElement:node,createElementNS:(_,tag)=>node()},fetch,AbortController,atob:s=>Buffer.from(s,'base64').toString('binary'),Date,setTimeout:timers.setTimeout,clearTimeout:timers.clearTimeout});
 return {get,refresh:()=>get('deck-lock-refresh').events.click()};
}
const settled=async()=>{for(let i=0;i<20;i++)await new Promise(r=>setImmediate(r))};
test('public lock panel counts only principal and renders three verified contracts',async()=>{
 let calls=0;const app=setup(async(url,options)=>{calls++;assert.equal(url,'/api/treasury-locks');assert.equal(options.credentials,'omit');assert.equal(options.body,undefined);return {ok:true,json:async()=>payload()}});
 await settled();assert.equal(calls,1);assert.equal(app.get('deck-lock-total').textContent,'100,000,000 GFOF');assert.match(app.get('deck-lock-percent').textContent,/10.00%/);
 const cards=app.get('deck-lock-cards').children;assert.equal(cards.length,3);
 assert.equal(cards[0].children[2].textContent,'30,000,000 GFOF');assert.equal(cards[2].children[2].textContent,'40,000,000 GFOF');
 assert.equal(cards[0].children[3].value,0.3);assert.match(cards[1].children[4].textContent,/Aug 18, 2027/);
 assert.equal(cards[2].children[5].href,'https://app.streamflow.finance/contract/solana/mainnet/'+addresses[4]);assert.equal(app.get('deck-lock-timeline').children.length,1);
});
test('failed refresh removes the previously verified total and graph',async()=>{
 let fail=false;const app=setup(async()=>({ok:!fail,json:async()=>payload()}));await settled();fail=true;await app.refresh();
 assert.equal(app.get('deck-lock-total').textContent,'Unavailable');assert.equal(app.get('deck-lock-cards').children.length,0);assert.equal(app.get('deck-lock-timeline').children.length,0);assert.equal(app.get('deck-lock-refresh').disabled,false);
});
for(const scenario of ['stale','wrongMint','wrongEscrow','wrongVersion','duplicate']){
 test(scenario+' read cannot create a current lock claim',async()=>{
  const body=payload();
  if(scenario==='stale')body.observedAt='2020-01-01';
  if(scenario==='wrongMint')body.mint='wrong';
  if(scenario==='wrongEscrow')body.accounts[1].account.data.parsed.info.mint='wrong';
  if(scenario==='wrongVersion'){const b=Buffer.from(body.accounts[0].account.data[0],'base64');b[8]=3;body.accounts[0].account.data[0]=b.toString('base64')}
  if(scenario==='duplicate')body.accounts[1].address=body.accounts[0].address;
  const app=setup(async()=>({ok:true,json:async()=>body}));await settled();
  assert.equal(app.get('deck-lock-total').textContent,'Unavailable');assert.equal(app.get('deck-lock-cards').children.length,0);
 });
}
test('a pending read cannot be duplicated by repeated refresh clicks',async()=>{
 let resolve,calls=0;const app=setup(()=>{calls++;return new Promise(r=>resolve=r)});
 await app.refresh();assert.equal(calls,1);resolve({ok:true,json:async()=>payload()});await settled();assert.equal(app.get('deck-lock-refresh').disabled,false);
});

test('lock deadlines clear an old verified total and allow retry despite ignored abort',{timeout:1000},async()=>{
 for(const phase of ['headers','body']){
  let calls=0,expire,late;const app=setup(async()=>{calls++;if(calls!==2)return {ok:true,json:async()=>payload()};const delayed=new Promise(resolve=>late=resolve);return phase==='headers'?delayed:{ok:true,json:()=>delayed};},{setTimeout(callback,ms){assert.equal(ms,12000);expire=callback;return 1;},clearTimeout(){}});
  await settled();assert.equal(app.get('deck-lock-total').textContent,'100,000,000 GFOF');
  const pending=app.refresh();await settled();expire();await pending;
  assert.equal(app.get('deck-lock-refresh').disabled,false);assert.equal(app.get('deck-lock-total').textContent,'Unavailable');
  assert.equal(app.get('deck-lock-cards').children.length,0);assert.equal(app.get('deck-lock-timeline').children.length,0);
  await app.refresh();assert.equal(app.get('deck-lock-total').textContent,'100,000,000 GFOF');
  late(phase==='headers'?{ok:true,json:async()=>({})}:{});await settled();
  assert.equal(app.get('deck-lock-total').textContent,'100,000,000 GFOF');assert.equal(calls,3);
 }
});
