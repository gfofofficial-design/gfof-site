import test from 'node:test';import assert from 'node:assert/strict';
import {market,marketResult,booths,savings,savingsProjection,gate} from '../journey/chapters-model.mjs';
const run=(model,actions)=>actions.reduce((s,a)=>model.step(s,a),model.initial());
test('Kael: all 36 plans reconcile cash; 72 crowd comparisons preserve stock counts',()=>{
 let count=0;
 for(const booth of ['side','central'])for(const stock of ['10','20','30'])for(const price of ['8','12'])for(const disposal of ['keep','resell','donate']){
  const s=run(market,['begin',booth,stock,price,disposal]);assert.equal(s.step,'reflect');assert.equal(s.result.outflow,booths[booth].fee+Number(stock)*4);
  for(const weather of ['quiet','busy']){const r=marketResult({...s,weather});assert.equal(r.sold+r.left,Number(stock));assert.ok(r.sold<=Number(stock));assert.equal(r.cash,200-r.outflow+r.revenue+r.resale);assert.equal(r.held,disposal==='keep'?r.left:0);assert.ok(r.cash>=0);count++;}
 }
 assert.equal(count,72);
});
test('Kael: unsold stock is still held before a disposal decision; cash is not sales',()=>{
 const s=run(market,['begin','central','30','12']);assert.equal(s.cash,126);assert.equal(s.result.revenue,96);assert.equal(s.result.left,22);assert.equal(s.result.held,22);
 const end=market.step(s,'resell');assert.equal(end.cash,170);assert.equal(end.result.held,0);assert.equal(s.cash,126);
});
test('Aela: all 96 revised plans keep projections separate from actual savings',()=>{
 let count=0;
 for(const target of ['90','120'])for(const oldRate of ['5','10','15'])for(const goal of ['keep','smaller'])for(const pause of ['continue','pause'])for(const rate of ['0','5','10','15']){
  const s=run(savings,['begin',target,oldRate,'cover',goal,pause,rate]);const p=savingsProjection(s);assert.equal(s.saved,30+2*Number(oldRate)-20);assert.equal(s.elapsed,2);
  if(rate==='0'){assert.equal(p.weeks,null);assert.equal(p.arrivalWeek,null);}else{assert.equal(p.arrivalWeek,2+(pause==='pause'?2:0)+p.weeks);assert.ok(s.saved+p.weeks*Number(rate)>=s.target);assert.ok(s.saved+(p.weeks-1)*Number(rate)<s.target);}
  count++;
 }assert.equal(count,96);
});
test('Aela: a break changes the date, not the money held',()=>{
 const s=run(savings,['begin','120','10','cover','smaller','pause','5']);assert.equal(s.saved,30);assert.deepEqual(savingsProjection(s),{remaining:30,weeks:6,arrivalWeek:10});
});
test('Eno: disconnect keeps allowance, revocation stops it but does not restore loss',()=>{
 const incident=run(gate,['begin','broad']);assert.equal(incident.cash,60);assert.equal(incident.allowance,60);
 const closed=gate.step(incident,'disconnect');assert.equal(closed.connected,false);assert.equal(closed.allowance,60);assert.equal(closed.cash,60);
 const end=gate.step(closed,'revoke');assert.equal(end.allowance,0);assert.equal(end.cash,60);assert.equal(end.outcome,'revoked');assert.equal(incident.connected,true);
});
test('Eno: every request-check combination supports distinct permission and privacy outcomes',()=>{
 for(const checks of [[],['inspect'],['verify'],['inspect','verify']]){
  const s=run(gate,['begin',...checks]);assert.equal(gate.step(s,'leave').cash,100);
  if(s.verified)for(const privacy of ['local','share-log']){const end=gate.step(gate.step(s,'public'),privacy);assert.equal(end.cash,100);assert.equal(end.allowance,0);assert.equal(end.sharedLog,privacy==='share-log');}
  else assert.throws(()=>gate.step(s,'public'));
  const incident=gate.step(s,'broad');
  for(const first of ['disconnect','support']){
   const next=gate.step(incident,first);
   if(first==='disconnect'){const end=gate.step(next,'leave-open');assert.equal(end.allowance,60);assert.equal(end.known,true);}
   else {const end=gate.step(next,'share-secret');assert.equal(end.known,false);assert.equal(end.cash,60,'last observed value is retained, not represented as zero');assert.equal(end.allowance,60);assert.equal(end.secret,true);const protectedState=gate.step(next,'protect');assert.equal(protectedState.secret,false);assert.equal(protectedState.allowance,60);}
  }
 }
});
test('all three models reject out-of-scene or unlisted choices',()=>{
 assert.throws(()=>market.step(market.initial(),'resell'));assert.throws(()=>savings.step(savings.initial(),'cover'));assert.throws(()=>gate.step(gate.initial(),'share-secret'));assert.throws(()=>run(market,['begin','side','500']));
});
