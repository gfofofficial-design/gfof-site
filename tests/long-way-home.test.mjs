import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,transition,routes,comparePreparation} from '../journey/long-way-home-model.mjs';
const atRepair=(spend,route)=>transition(transition(transition(initialState(),'begin'),spend),route);
test('all reachable endings conserve cash and keep unpaid debt visible',()=>{
  let endings=0;
  for(const spend of [0,30,60]) for(const route of Object.keys(routes)) {
    const s=atRepair(spend,route);
    const paused=transition(s,'pause');
    assert.equal(paused.cash,s.cash);assert.equal(paused.repaired,false);assert.equal(paused.debt,0);assert.equal(paused.paused,true);endings++;
    const repaired=transition(s,s.cash>=routes[route].repair?'pay':'borrow');
    for(const job of ['rest','shift',...(repaired.cash>=10?['delivery']:[])]) {
      const end=transition(repaired,job);endings++;
      assert.equal(end.cash,180+end.history.reduce((a,e)=>a+e.delta,0));
      assert.equal(end.debt,end.history.reduce((a,e)=>a+e.debtDelta,0));
      assert.ok(end.history.every(e=>e.cash>=0&&e.debt>=0));
      assert.equal(end.step,'reflect');assert.equal(end.repaired,true);
      assert.equal(end.days,routes[route].days+(job==='shift'?2:job==='delivery'?1:0));
      assert.equal(repaired.step,'recover','transition does not mutate prior state');
    }
    assert.deepEqual(comparePreparation(route).find(r=>r.spending===spend),{spending:spend,reserve:s.cash,shortfall:Math.max(0,routes[route].repair-s.cash)});
  }
  assert.equal(endings,21);
});
test('loan principal is not income and a partial repayment does not erase the remainder',()=>{
  const repaired=transition(atRepair(60,'direct'),'borrow');
  assert.equal(repaired.cash,0);assert.equal(repaired.debt,40);
  const end=transition(repaired,'shift');
  assert.equal(end.repaid,15);assert.equal(end.cash,0);assert.equal(end.debt,25);assert.equal(end.days,4);
});
test('delivery deducts its upfront cost before recording the payment',()=>{
  const end=transition(transition(atRepair(0,'station'),'pay'),'delivery');
  assert.equal(end.cash,60);assert.equal(end.debt,0);assert.equal(end.days,5);
  assert.deepEqual(end.history.slice(-2).map(e=>e.delta),[-10,30]);
});
test('unfunded purchases and out-of-scene choices cannot advance the mission',()=>{
  assert.throws(()=>transition(initialState(),'borrow'));
  assert.throws(()=>transition(atRepair(60,'direct'),'pay'));
  assert.throws(()=>transition(atRepair(0,'station'),'borrow'));
  const repaired=transition(atRepair(60,'direct'),'borrow');
  assert.throws(()=>transition(repaired,'delivery'));
  assert.throws(()=>transition(transition(initialState(),'begin'),99));
});
