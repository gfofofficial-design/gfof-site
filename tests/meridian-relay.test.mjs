import test from 'node:test';
import assert from 'node:assert/strict';
import {initial,actions,step,inventory,forecast,comparison} from '../journey/meridian-relay-model.mjs';
const run=(list,day='quiet')=>list.reduce(step,initial(day));
test('every reachable decision path preserves cash, goods, and conditional goals',()=>{
 const economic=new Set();let endings=0,minBefore=Infinity;
 const visit=s=>{
  assert.equal(s.cash,s.ledger.reduce((n,x)=>n+x.amount,0));assert.ok(s.cash>=0);
  const inv=inventory(s);assert.equal(s.stock,s.sold+inv.held+inv.gifted+inv.salvaged);
  if(s.step==='reflect'){
   endings++;const current=comparison(s,s.day);assert.equal(current.cash,s.cash);assert.equal(current.held,inv.held);minBefore=Math.min(minBefore,current.before);
   const f=forecast(s);
   if(s.target===null)assert.equal(f.weeks,null);
   else if(s.cash>=s.target)assert.equal(f.weeks,0);
   else{assert.ok(s.cash+f.weeks*s.weekly>=s.target);assert.ok(s.cash+(f.weeks-1)*s.weekly<s.target);}
   economic.add(JSON.stringify([s.message==='pay',s.access==='grant',s.stock,s.berth,s.market?s.day:'skip',s.disposal]));return;
  }
  for(const action of actions(s)){
   if(s.checks.includes(action))continue;
   // Inquiry order does not change economics; inspect its behavior separately.
   if(['read-offer','directory','read-access'].includes(action))continue;
   const before=JSON.stringify(s);const next=step(s,action);assert.equal(JSON.stringify(s),before);visit(next);
  }
 };
 visit(initial('quiet'));visit(initial('busy'));
 assert.equal(economic.size,100);assert.equal(minBefore,3);assert.ok(endings>500);
});
test('the five worked endings match the story design',()=>{
 const examples=[
  {day:'quiet',market:false,pay:false,grant:false,expected:150},
  {day:'quiet',stock:6,berth:'side',disposal:'retain',expected:140,held:2},
  {day:'busy',stock:6,berth:'side',disposal:'retain',expected:164,held:0},
  {day:'quiet',stock:9,berth:'central',disposal:'salvage',expected:141,held:0},
  {day:'quiet',stock:9,berth:'central',disposal:'retain',pay:true,grant:true,expected:87,held:2}
 ];
 for(const x of examples){const path=['begin',x.market===false?'skip':'stall',x.pay?'pay':'decline',x.grant?'grant':'skip-map'];
  if(x.market!==false)path.push('stock-'+x.stock,x.berth);path.push('repair');
  if(x.market!==false)path.push('close-market',x.disposal);
  const s=run(path,x.day);assert.equal(s.cash,x.expected);assert.equal(inventory(s).held,x.held||0);
 }
});
test('inquiries are free, idempotent, immutable, and gate the independent map',()=>{
 let s=run(['begin','stall']);
 for(const action of ['read-offer','directory']){const old=s;s=step(s,action);assert.equal(s.cash,old.cash);assert.deepEqual(step(s,action),s);assert.ok(!old.checks.includes(action));}
 s=step(s,'decline');assert.throws(()=>step(s,'public-map'));
 for(const action of ['read-access','verify-map']){const old=s;s=step(s,action);assert.equal(s.cash,old.cash);assert.deepEqual(step(s,action),s);}
 const mapped=step(s,'public-map');assert.equal(mapped.cash,180);assert.equal(mapped.access,'public-map');
});
test('repair is funded before sales; a forecast never adds current cash',()=>{
 let s=run(['begin','stall','pay','grant','stock-9','central','repair']);assert.equal(s.cash,3);assert.equal(s.sold,0);
 s=step(s,'close-market');assert.equal(s.cash,87);s=step(s,'retain');s=step(s,'goal-200');s=step(s,'weekly-10');
 assert.equal(s.cash,87);assert.deepEqual(forecast(s),{remaining:113,weeks:12});
 const busy=comparison(s,'busy');assert.equal(busy.cash,111);assert.equal(busy.held,0);assert.equal(s.cash,87);
});
test('paused and already-funded goals are distinct; invalid actions do not advance',()=>{
 const s=run(['begin','skip','decline','skip-map','repair']);
 const paused=step(s,'pause'),funded=step(s,'goal-140');assert.equal(paused.step,'reflect');assert.equal(funded.step,'reflect');
 assert.equal(forecast(paused).weeks,null);assert.equal(forecast(funded).weeks,0);assert.equal(funded.cash,150);
 assert.throws(()=>step(initial(),'repair'));assert.throws(()=>step(paused,'weekly-10'));assert.throws(()=>initial('random'));
 const poor={...run(['begin','stall','decline','skip-map']),cash:1};assert.throws(()=>step(poor,'stock-9'));
});
