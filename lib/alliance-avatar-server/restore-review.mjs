// Operator-only, disabled READ-ONLY comparison. Every outcome keeps access closed.
// The caller must independently authenticate the checkpoint and actual freeze.
import {isDeepStrictEqual} from 'node:util';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TABLES=['control','heads','operations','objects','daily','cleanup_attempts'];
const exact=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const date=v=>typeof v==='string'&&v.length===24&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v&&Date.parse(v)>=0;
const fail=()=>Error('avatar_restore_review_unavailable');
const closed=reason=>({state:'quarantine',access:'closed',reason});
export function avatarInventory(value){
  if(!exact(value,['format','closed','tables'])||value.format!==1||typeof value.closed!=='boolean'||!Array.isArray(value.tables)||value.tables.length!==6)throw fail();
  const tables=value.tables.map((t,i)=>{
    if(!exact(t,['table','rows','sha256'])||t.table!==TABLES[i]||!Number.isSafeInteger(t.rows)||t.rows<0||t.rows>1000||typeof t.sha256!=='string'||!/^[0-9a-f]{64}$/.test(t.sha256)||i===0&&t.rows!==1)throw fail();
    return {table:t.table,rows:t.rows,sha256:t.sha256};
  });
  return {format:1,closed:value.closed,tables};
}
function evidence(value,projectRef,now){
  if(!exact(value,['checkpoint','freezeId','frozenAt'])||!UUID.test(value.freezeId)||!date(value.frozenAt)||Date.parse(value.frozenAt)>now)throw fail();
  const p=value.checkpoint;
  if(!exact(p,['format','projectRef','freezeId','capturedAt','inventory'])||p.format!==1||typeof p.projectRef!=='string'||!/^[a-z0-9]{20}$/.test(p.projectRef)||!UUID.test(p.freezeId)||!date(p.capturedAt)||Date.parse(p.capturedAt)>now)throw fail();
  const inventory=avatarInventory(p.inventory);
  if(p.projectRef!==projectRef)return {refusal:'scope_mismatch'};
  if(p.freezeId!==value.freezeId)return {refusal:'freeze_mismatch'};
  if(Date.parse(p.capturedAt)<Date.parse(value.frozenAt))return {refusal:'checkpoint_predates_freeze'};
  if(!inventory.closed)return {refusal:'feature_open'};
  return {inventory};
}
export function createAvatarRestoreReview({enabled=false,ledger,projectRef,timeoutMs=4750}={}){
  if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>4750)throw fail();
  if(enabled===true&&(typeof ledger?.restoreInventory!=='function'||typeof projectRef!=='string'||!/^[a-z0-9]{20}$/.test(projectRef)))throw fail();
  let active=false,ended=false;const controllers=new Set();
  return Object.freeze({
    async inspect(input,{signal}={}){
      if(enabled!==true||ended)return closed('unavailable');
      if(signal?.aborted)return closed('cancelled');
      if(active)return closed('busy');
      let expected;try{expected=evidence(input,projectRef,Date.now());}catch{return closed('invalid_evidence');}
      if(expected.refusal)return closed(expected.refusal);
      active=true;const c=new AbortController(),abort=()=>c.abort();let onAbort;
      controllers.add(c);signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
      const stopped=new Promise((_,reject)=>{onAbort=()=>reject(fail());c.signal.addEventListener('abort',onAbort,{once:true});});
      const timer=setTimeout(abort,timeoutMs);
      try{
        if(c.signal.aborted)throw fail();
        const raw=await Promise.race([Promise.resolve().then(()=>{if(c.signal.aborted)throw fail();return ledger.restoreInventory({signal:c.signal});}),stopped]);
        if(c.signal.aborted)throw fail();const actual=avatarInventory(raw);
        if(!actual.closed)return closed('feature_open');
        if(!isDeepStrictEqual(expected.inventory,actual))return closed('ledger_mismatch');
        return {state:'matches_checkpoint',access:'closed'};
      }catch{return closed('unavailable');}
      finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);c.signal.removeEventListener('abort',onAbort);c.abort();controllers.delete(c);active=false;}
    },
    close(){ended=true;for(const c of controllers)c.abort();}
  });
}
