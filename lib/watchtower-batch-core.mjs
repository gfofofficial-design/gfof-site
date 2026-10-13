import {replayWatchtower} from './watchtower-core.mjs';
const TYPES=['transfer','mint_authority_changed','freeze_authority_changed','lock_schedule_changed'];
const ALPHABET='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function base58Bytes(value,size){
 if(typeof value!=='string'||value.length<1||value.length>88)return false;
 let n=0n;for(const c of value){const digit=ALPHABET.indexOf(c);if(digit<0)return false;n=n*58n+BigInt(digit);}
 let leading=0;while(value[leading]==='1')leading++;
 const bytes=n===0n?0:Math.ceil(n.toString(16).length/2);return leading+bytes===size;
}
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===keys.sort().join(',');
export function createWatchtowerBatchProcessor({watchlist,now=Date.now}={}){
 if(typeof now!=='function'||!Array.isArray(watchlist)||watchlist.length<1||watchlist.length>20)throw Error('Invalid watchlist configuration');
 const allowed=new Map();
 for(const entry of watchlist){
  if(!exact(entry,['account','types'])||!base58Bytes(entry.account,32)||allowed.has(entry.account)||
   !Array.isArray(entry.types)||entry.types.length<1||entry.types.length>4||new Set(entry.types).size!==entry.types.length||
   !entry.types.every(type=>TYPES.includes(type)))throw Error('Invalid watchlist configuration');
  allowed.set(entry.account,new Set(entry.types));
 }
 return batch=>{
  if(!exact(batch,['schema','format','chain','receivedAt','events'])||batch.schema!==1||batch.format!=='federation_normalized_events'||batch.chain!=='solana-mainnet'||
   typeof batch.receivedAt!=='string'||!Array.isArray(batch.events)||batch.events.length>100)throw Error('Invalid normalized batch');
  const received=Date.parse(batch.receivedAt),clock=now();
  if(!Number.isSafeInteger(clock)||!Number.isFinite(received)||new Date(received).toISOString()!==batch.receivedAt||received>clock||clock-received>900000)throw Error('Invalid batch time');
  const selected=[];let ignoredOutsideWatchlist=0;
  for(const event of batch.events){
   if(!exact(event,['schema','chain','type','slot','eventIndex','signature','account','commitment'])||
    !base58Bytes(event.account,32)||!base58Bytes(event.signature,64))throw Error('Invalid normalized event');
   // Validate every event before filtering; malformed outside-scope data is not silently accepted.
   replayWatchtower([event]);
   if(!allowed.get(event.account)?.has(event.type)){ignoredOutsideWatchlist++;continue;}
   selected.push({...event});
  }
  const replay=replayWatchtower(selected);
  return {...replay,mode:'offline_watchlist_batch',receivedAt:batch.receivedAt,ignoredOutsideWatchlist,
   watchlistAuthenticity:'operator_supplied_not_verified',deduplicationScope:'this_batch_only',retention:'none',
   limitations:['This is the Federation normalized format, not a Helius webhook parser.','No webhook authentication, independent finality check or completeness proof was performed.','Received time and commitment are supplied claims.','No live subscription, persistent cursor, alert or financial action is activated.']};
 };
}
