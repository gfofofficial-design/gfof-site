// Synthetic journal only. Real store/producer have their separate TLS tests.
import {deletionRecord} from './deletion-journal.mjs';
import {projectRef,epoch,zero} from './deletion-journal.fixture.mjs';
export function memoryRemovalJournal(){
  const rows=[],calls=[];let enabled=true;
  const tip=()=>({projectRef,epoch,sequence:rows.length,sha256:rows.at(-1)?.sha256||zero,enabled});
  return {rows,calls,set enabled(v){enabled=v;},async tip(){calls.push('tip');return tip();},async records(){calls.push('records');return structuredClone(rows);},async append({event,expected}){
    calls.push('append');if(!enabled)return {state:'paused',tip:tip()};const existing=rows.find(r=>r.event.id===event.id);
    if(existing)return {state:'recorded',record:structuredClone(existing),tip:tip()};
    if(rows.length===256)return {state:'full',tip:tip()};if(expected.sequence!==rows.length||expected.sha256!==tip().sha256)return {state:'conflict',tip:tip()};
    const r=deletionRecord({projectRef,epoch,sequence:rows.length+1,previous:tip().sha256,event});rows.push(r);return {state:'recorded',record:structuredClone(r),tip:tip()};
  }};
}
