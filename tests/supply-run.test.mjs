import {test} from 'node:test';
import assert from 'node:assert/strict';
import {boards,jobs,initial,reason,step,result} from '../journey/supply-run-model.mjs';
test('every reachable route conserves credits and resources and returns safely',()=>{
 let checked=0;
 for(const board of Object.keys(boards)){
 const b=boards[board],list=jobs(board);let wins=0;
 function visit(s){checked++;const used=s.done.map(id=>list.find(j=>j.id===id));assert.equal(s.cash,b.cash+used.reduce((n,j)=>n+j.pay-j.cost,0));assert.equal(s.fuel,b.fuel-used.reduce((n,j)=>n+j.fuel,0));assert.equal(s.time,b.time-used.reduce((n,j)=>n+j.time,0));assert.ok(s.fuel>=1&&s.time>=1);assert.equal(new Set(s.done).size,s.done.length);assert.ok(s.done.length<=3);
 const dock=step(s,'dock');assert.equal(dock.fuel,s.fuel-1);assert.equal(dock.time,s.time-1);assert.equal(dock.cash,s.cash);assert.equal(step(dock,'dock'),dock);assert.equal(step(dock,'maps'),dock);if(result(dock).met)wins++;
 for(const j of list){const before=JSON.stringify(s);const next=step(s,j.id);assert.equal(JSON.stringify(s),before);if(reason(s,j.id)){assert.equal(next,s);}else{assert.equal(next.cash,s.cash-j.cost+j.pay);visit(next);}}
 }visit(initial(board));assert.ok(wins>0,board+' must be solvable');
 }assert.ok(checked>100);
});
test('short shift rewards a selective route and exposes the busy-route tradeoff',()=>{let s=initial('urgent');for(const id of ['medical','maps','dock'])s=step(s,id);assert.equal(s.cash,85);assert.equal(result(s).met,true);assert.equal(s.time,0);let busy=initial('urgent');for(const id of ['parts','fresh','maps','dock'])busy=step(busy,id);assert.equal(busy.cash,83);assert.equal(result(busy).met,false);});
test('unaffordable, duplicate, unknown and reserve-breaking deliveries cannot advance',()=>{let s=initial('clear');assert.equal(step(s,'bad'),s);s=step(s,'medical');assert.equal(step(s,'medical'),s);const poor={...initial(),cash:0};assert.equal(step(poor,'maps'),poor);const noFuel={...initial(),fuel:1};assert.equal(step(noFuel,'maps'),noFuel);const noTime={...initial(),time:1};assert.equal(step(noTime,'maps'),noTime);});
test('new scenarios reset fully and no goal is awarded until docking',()=>{for(const b of ['missing','__proto__',null])assert.equal(initial(b).board,'clear');let s=initial();s=step(step(s,'medical'),'tools');assert.equal(result(s).met,false);assert.equal(result(step(s,'dock')).met,true);assert.equal(initial('storm').done.length,0);});
