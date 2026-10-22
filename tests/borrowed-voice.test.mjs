import test from 'node:test';import assert from 'node:assert/strict';
import {initialState,transition,evidence} from '../journey/borrowed-voice-model.mjs';
const opened=()=>transition(transition(initialState(),'begin'),'investigate');
test('all 16 evidence subsets support five terminal choices without inventing recovery',()=>{
 let endings=0;const keys=Object.keys(evidence);
 for(let mask=0;mask<16;mask++){
  let s=opened();for(let i=0;i<4;i++)if(mask&(1<<i))s=transition(s,keys[i]);
  const d=transition(s,'decide');
  for(const choice of ['hold','decline']){const end=transition(d,choice);assert.equal(end.cash,100);assert.equal(end.step,'reflect');endings++;}
  const paid=transition(d,'send');assert.equal(paid.cash,60);assert.equal(paid.step,'aftermath');
  const recovery=transition(paid,'read-followup');
  for(const choice of ['stop','record','pay-recovery']){
   const end=transition(recovery,choice);assert.equal(end.cash,choice==='pay-recovery'?40:60);assert.equal(end.cash,100+end.history.reduce((sum,e)=>sum+e.delta,0));assert.equal(end.step,'reflect');assert.deepEqual(end.opened,s.opened);endings++;
  }
  assert.equal(d.cash,100,'transitions preserve the previous state');
 }
 assert.equal(endings,80);
});
test('inquiries are free, repeatable, and do not multiply independent findings',()=>{
 let s=opened();s=transition(s,'directory');s=transition(s,'directory');assert.deepEqual(s.opened,['directory']);assert.equal(s.cash,100);assert.equal(s.history.length,0);
 s=transition(transition(s,'decide'),'recheck');assert.deepEqual(s.opened,['directory']);
});
test('stopping immediately after a loss retains the loss without a recovery fee',()=>{
 const inbox=transition(initialState(),'begin');const after=transition(transition(inbox,'decide'),'send');const end=transition(after,'stop');assert.equal(end.step,'reflect');assert.equal(end.cash,60);assert.equal(end.recovery,'stop');
});
test('only available scene actions change the story',()=>{
 assert.throws(()=>transition(initialState(),'send'));assert.throws(()=>transition(opened(),'pay-recovery'));const end=transition(transition(transition(initialState(),'begin'),'decide'),'decline');assert.throws(()=>transition(end,'send'));
});
