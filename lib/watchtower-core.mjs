const TYPES=new Set(['transfer','mint_authority_changed','freeze_authority_changed','lock_schedule_changed']);
const address=v=>typeof v==='string'&&/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v);
export function replayWatchtower(events){
 if(!Array.isArray(events)||events.length>100)throw Error('Invalid bounded event list');
 const seen=new Map();let duplicates=0,pending=0;const observations=[];
 for(const event of events){
  if(!event||event.schema!==1||event.chain!=='solana-mainnet'||!TYPES.has(event.type)||
   !Number.isSafeInteger(event.slot)||event.slot<1||!Number.isSafeInteger(event.eventIndex)||event.eventIndex<0||event.eventIndex>10000||
   typeof event.signature!=='string'||!/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(event.signature)||
   !address(event.account)||!['confirmed','finalized'].includes(event.commitment))throw Error('Invalid normalized event');
  const key=event.signature+':'+event.eventIndex;
  const safe={key,type:event.type,slot:event.slot,account:event.account,commitment:event.commitment};
  const prior=seen.get(key);
  if(prior){if(prior.type!==safe.type||prior.slot!==safe.slot||prior.account!==safe.account)throw Error('Conflicting duplicate');
   duplicates++;
   if(prior.commitment==='confirmed'&&safe.commitment==='finalized'){prior.commitment='finalized';}
  }else seen.set(key,safe);
 }
 for(const event of [...seen.values()].sort((a,b)=>a.slot-b.slot||a.key.localeCompare(b.key))){
  if(event.commitment!=='finalized'){pending++;continue;}
  const text=event.type==='transfer'?'A transfer was reported. This alone does not establish a sale, profit or beneficial owner.':
   event.type==='lock_schedule_changed'?'A lock-schedule change was reported. Verify the contract and transaction before describing its effect.':
   'A mint control change was reported. Compare the finalized account state before describing the new permissions.';
  observations.push({...event,text});
 }
 return {schema:1,mode:'offline_replay',sourceAuthenticity:'not_verified',coverage:'not_established',duplicates,pending,observations};
}
