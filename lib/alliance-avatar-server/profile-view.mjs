// Unmounted text-response guard. Journal absence never supplies Auth/RLS authority.
// The trusted caller supplies ONE load; it may be a read or a save response.
import {performance} from 'node:perf_hooks';
import {ownProfile,directoryPage,profileDirectoryOptions} from '../../assets/federation/fed-alliance-profile-contract.mjs';
const exact=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const fail=()=>Error('profile_view_unavailable'),unavailable=()=>({state:'unavailable'});
export function createAllianceProfileView({enabled=false,journal,serving,timeoutMs=8000}={}){
  if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>8000)throw fail();
  if(enabled===true&&(typeof journal?.review!=='function'||typeof serving?.authorize!=='function'))throw fail();
  let closed=false,active=false,faulted=false,controller;
  return Object.freeze({
    async read(input,{load,signal}={}){
      if(enabled!==true||closed||faulted)return unavailable();
      let options;
      try{
        if(exact(input,['kind'])&&input.kind==='self')options={kind:'self'};
        else if(exact(input,['kind','after','limit'])&&input.kind==='directory')options={kind:'directory',...profileDirectoryOptions(input)};
        else throw fail();
        if(typeof load!=='function'||signal?.aborted)throw fail();
      }catch{return unavailable();}
      if(active)return {state:'busy'};
      active=true;const c=new AbortController(),started=performance.now(),abort=()=>c.abort();controller=c;
      signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
      let view,onAbort;
      const stopped=new Promise((_,reject)=>{onAbort=()=>reject(fail());c.signal.addEventListener('abort',onAbort,{once:true});});
      const timer=setTimeout(abort,timeoutMs);
      const check=()=>{if(closed||c.signal.aborted||performance.now()-started>=timeoutMs)throw fail();};
      const phase=fn=>Promise.race([Promise.resolve().then(()=>{check();return fn();}),stopped]);
      const permit=async()=>{if(await phase(()=>serving.authorize({signal:c.signal}))!==true)throw fail();check();};
      const review=async()=>{
        view?.close();view=undefined;await permit();
        view=await phase(async()=>{const value=await journal.review({signal:c.signal});if(closed||c.signal.aborted){value?.close?.();throw fail();}return value;});
        check();if(view?.state!=='verified_evidence'||typeof view.checkProfile!=='function'||typeof view.close!=='function')throw fail();
      };
      const denied=id=>{
        check();if(view?.state!=='verified_evidence')throw fail();
        const value=view.checkProfile({profileId:id});
        if(exact(value,['state'])&&value.state==='not_listed')return false;
        if(exact(value,['state','scope'])&&value.state==='blocked'&&value.scope==='profile')return true;
        throw fail();
      };
      try{
        await review();
        const raw=await phase(()=>load({signal:c.signal}));check();
        // Copy only the public DTO, never hidden account fields.
        const body=options.kind==='self'?{profile:ownProfile(raw)}:directoryPage(raw,options);
        const ids=options.kind==='self'?(body.profile?[body.profile.id]:[]):body.items.map(p=>p.id);
        const blocked=new Set(ids.filter(denied));
        await review();for(const id of ids)if(denied(id))blocked.add(id);
        await permit();check();if(view.state!=='verified_evidence')throw fail();
        if(options.kind==='self'){
          if(body.profile&&blocked.has(body.profile.id))return {state:'withheld'};
          return {state:'ready',body};
        }
        const items=body.items.filter(p=>!blocked.has(p.id));
        // No removed ID in a cursor, refill loop, or false end-of-directory claim.
        if(body.next!==null&&!items.length)return {state:'withheld'};
        const next=body.next!==null?items.at(-1).id:null;
        return {state:'ready',body:directoryPage({items,next},options)};
      }catch{if(c.signal.aborted)faulted=true;return unavailable();}
      finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);c.signal.removeEventListener('abort',onAbort);c.abort();try{view?.close?.();}catch{}controller=undefined;active=false;}
    },close(){closed=true;controller?.abort();}
  });
}
