// Disabled server facade; NO mounted route, body parser, environment/credential
// lookup or browser-supplied actor. Future hosting must bound HTTP request bodies.
import {createAvatarFlow} from './flow.mjs';
import {createAlliancePrivateView} from './private-view.mjs';
import {validateAvatarInput} from '../alliance-avatar-runtime/limits.mjs';
import {createProfileRemovalVersionView} from './profile-removal-version.mjs';
import {profileImagePath as ROOT,profileImageStatePath,profileImageContentPath} from '../../assets/federation/fed-alliance-profile-image-contract.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TOKEN=/^[A-Za-z0-9_-]{1,2048}\.[A-Za-z0-9_-]{1,2048}\.[A-Za-z0-9_-]{1,2048}$/;
const PROFILE='/api/alliance-members/me/profile';
const ERRORS=new Set(['sign_in_required','account_unavailable','request_ended']);
const result=state=>Object.freeze({state});
const fail=state=>Object.assign(Error('avatar_member_unavailable'),{state});
function cookie(raw){
  if(typeof raw!=='string'||raw.length>24000)throw fail('sign_in_required');let value;
  for(const part of raw.split(';')){const at=part.indexOf('=');if(at<0||part.slice(0,at).trim()!=='__Host-gf-access')continue;
    if(value!==undefined)throw fail('sign_in_required');try{value=decodeURIComponent(part.slice(at+1));}catch{throw fail('sign_in_required');}}
  if(typeof value!=='string'||value.length>4096||!TOKEN.test(value))throw fail('sign_in_required');return value;
}
// Strict limits independent of a transport that ignores AbortSignal; late bytes
// are cancelled and cannot initiate SQL or processing.
async function user(url,key,token,fetcher,signal,timeoutMs){
  const controller=new AbortController(),abort=()=>controller.abort();let timer,reader,response;
  signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();
  const ended=new Promise((_,reject)=>{controller.signal.addEventListener('abort',()=>reject(fail(signal.aborted?'request_ended':'account_unavailable')),{once:true});});
  timer=setTimeout(abort,timeoutMs);
  const check=()=>{if(controller.signal.aborted)throw fail(signal.aborted?'request_ended':'account_unavailable');};
  try{check();return await Promise.race([(async()=>{
    response=await fetcher(url+'/auth/v1/user',{method:'GET',credentials:'omit',redirect:'error',signal:controller.signal,headers:{apikey:key,Authorization:'Bearer '+token}});
    if(controller.signal.aborted){try{void response.body?.cancel().catch(()=>{});}catch{}check();}
    if(response.status===401||response.status===403){try{void response.body?.cancel().catch(()=>{});}catch{}throw fail('sign_in_required');}
    const length=response.headers.get('content-length');if(!response.ok||!response.body||length!==null&&(!/^\d+$/.test(length)||Number(length)>65536))throw fail('account_unavailable');
    reader=response.body.getReader();const chunks=[];let size=0;
    for(;;){const part=await reader.read();check();if(part.done)break;if(!(part.value instanceof Uint8Array)||(size+=part.value.byteLength)>65536)throw fail('account_unavailable');chunks.push(Buffer.from(part.value));}
    if(length!==null&&Number(length)!==size)throw fail('account_unavailable');
    return JSON.parse(Buffer.concat(chunks,size).toString('utf8'));
  })(),ended]);}finally{clearTimeout(timer);signal.removeEventListener('abort',abort);controller.abort();try{void Promise.resolve(reader?reader.cancel():response?.body?.cancel()).catch(()=>{});}catch{}}
}
export function verifiedAccountContext(token,account,url){
  // Parsing is NOT verification. Only called after the exact cookie was accepted
  // by the pinned Auth server. Compare the returned subject and pin issuer/role.
  let value;try{value=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString('utf8'));}catch{throw fail('sign_in_required');}
  const now=Math.floor(Date.now()/1000);
  if(!account||!UUID.test(account.id)||account.is_anonymous!==false||typeof account.email_confirmed_at!=='string'||!Number.isFinite(Date.parse(account.email_confirmed_at))||
    !value||value.sub!==account.id||value.iss!==url+'/auth/v1'||value.role!=='authenticated'||value.aud!=='authenticated'||!UUID.test(value.session_id)||
    !Number.isSafeInteger(value.exp)||value.exp<=now)throw fail('sign_in_required');
  return {actorId:account.id,sessionId:value.session_id,expiresAt:value.exp*1000};
}
async function bounded(work,signal,timeoutMs){
  const controller=new AbortController(),abort=()=>controller.abort();let timer;
  signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();
  try{return await Promise.race([Promise.resolve().then(()=>{if(controller.signal.aborted)throw fail('request_ended');return work(controller.signal);}),new Promise((_,reject)=>{timer=setTimeout(()=>{abort();reject(fail('account_unavailable'));},timeoutMs);})]);}
  finally{clearTimeout(timer);signal.removeEventListener('abort',abort);abort();}
}
export function createAllianceAvatarMemberService({enabled=false,viewEnabled=false,currentImageEnabled=false,removalVersionEnabled=false,profileBindingEnabled=false,origin,url,key,ledger,processor,storage,journal,serving,removal,creation,fetcher=fetch,authTimeoutMs=8000}={}){
  if(typeof removalVersionEnabled!=='boolean'||typeof profileBindingEnabled!=='boolean'||typeof currentImageEnabled!=='boolean'||currentImageEnabled&&(!viewEnabled||!removalVersionEnabled))throw fail('unavailable');
  if(!Number.isInteger(authTimeoutMs)||authTimeoutMs<1||authTimeoutMs>8000)throw fail('unavailable');
  if(enabled===true&&(!/^https:\/\/(?:galacticfederation\.co|deploy-preview-[1-9][0-9]*--gfof\.netlify\.app)$/.test(origin)||
    !/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(url)||!/^sb_publishable_[A-Za-z0-9_-]{20,512}$/.test(key)||
    !['authorizeSession','reserveSession','claimUploadSession','commitUploadSession','cancelReservedSession','operationReceiptSession','removeImageSession','settleUnpublished'].every(k=>typeof ledger?.[k]==='function')||typeof processor?.process!=='function'||typeof storage?.upload!=='function'))throw fail('unavailable');
  const viewer=createAlliancePrivateView({enabled:enabled===true&&viewEnabled===true,currentEnabled:currentImageEnabled,ledger,storage,journal,serving});
  const removalVersion=createProfileRemovalVersionView({enabled:enabled===true&&removalVersionEnabled,ledger,journal,serving});
  let active=0,closed=false;const running=new Set();
  async function handle(request,input,{expectedProfileId}={}){
    if(enabled!==true||closed)return result('unavailable');
    let target,action,snapshot;
    try{
      target=new URL(request.url);
      if(target.origin!==origin||target.search||target.hash||target.username||target.password)return result('invalid');
      const {pathname}=target,{method}=request;
      if(pathname===PROFILE+'/removal-status'&&method==='GET')action='removal_version';
      if(pathname===PROFILE&&method==='DELETE')action='remove_profile';
      if(pathname===profileImageStatePath&&method==='GET')action='image_state';
      if(pathname===profileImageContentPath&&method==='GET')action='read';
      if(pathname===ROOT)action=method==='PUT'?'replace':method==='DELETE'?'remove':method==='GET'?'status':null;
      if(!action)return result('invalid');
      if(action==='removal_version'&&!removalVersionEnabled)return result('unavailable');
      if(action==='read'&&viewEnabled!==true)return result('unavailable');
      if((action==='image_state'||expectedProfileId!==undefined)&&(!currentImageEnabled||typeof expectedProfileId!=='string'||!UUID.test(expectedProfileId)||
        action==='remove_profile'||action==='removal_version'))return result('invalid');
      const from=request.headers.get('origin'),site=request.headers.get('sec-fetch-site');
      if(request.headers.has('authorization')||from!==null&&from!==origin||site!==null&&site!=='same-origin'||!['status','read','removal_version','image_state'].includes(action)&&from!==origin)return result('forbidden');
      if(action==='removal_version'||action==='image_state'){
        if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)return result('invalid');snapshot={};
      }else if(action==='read'&&expectedProfileId!==undefined){
        if(!input||Object.keys(input).length!==1||!Object.hasOwn(input,'version')||!Number.isSafeInteger(input.version)||input.version<1)return result('invalid');
        snapshot={version:input.version};
      }else{
      const removing=['remove','remove_profile'].includes(action);
      const boundProfile=action==='remove_profile'&&profileBindingEnabled;
      const fields=action==='replace'?['operationId','version','bytes','mime']:removing?['operationId','version','confirm',...(boundProfile?['profileId']:[])]:['operationId'];
      if(!input||Object.keys(input).length!==fields.length||!fields.every(k=>Object.hasOwn(input,k))||!UUID.test(input.operationId)||
        !['status','read'].includes(action)&&(!Number.isSafeInteger(input.version)||input.version<0)||removing&&input.confirm!==(action==='remove_profile'?'remove_my_profile':'remove_my_image'))return result('invalid');
      if(removing&&typeof removal?.run!=='function')return result('unavailable');
      if(boundProfile&&!UUID.test(input.profileId))return result('invalid');
      if(action==='replace'){validateAvatarInput(input.bytes,input.mime);if(typeof creation?.reserve!=='function')return result('unavailable');snapshot={...input,bytes:new Uint8Array(input.bytes)};}else snapshot={...input};
      }
    }catch{return result('invalid');}
    if(request.signal.aborted)return result('request_ended');if(active>=2)return result('busy');active++;
    const controller=new AbortController(),abort=()=>controller.abort();request.signal.addEventListener('abort',abort,{once:true});if(request.signal.aborted)abort();running.add(controller);
    let dispatched=false,expiryTimer;
    try{
      const token=cookie(request.headers.get('cookie'));
      const account=await user(url,key,token,fetcher,controller.signal,authTimeoutMs);
      if(controller.signal.aborted)return result('request_ended');const context=verifiedAccountContext(token,account,url);
      if(action==='removal_version'||action==='image_state'){
        const value=await removalVersion.read(context,{signal:controller.signal,includeImage:action==='image_state'});
        if(action==='removal_version'||value.state!=='ready')return value;
        if(value.profileId!==expectedProfileId)return result('profile_changed');
        return {state:'ready',version:value.version,hasImage:value.hasImage};
      }
      const removing=['remove','remove_profile'].includes(action);
      let profileId;
      if(!removing||expectedProfileId!==undefined){
        const checked=await bounded(s=>ledger.authorizeSession(context.actorId,context.sessionId,{signal:s}),controller.signal,4750);
        if(!checked||checked.actorId!==context.actorId||checked.sessionId!==context.sessionId||!UUID.test(checked.profileId)||Object.keys(checked).length!==3)throw fail('account_unavailable');
        if(controller.signal.aborted)return result('request_ended');
        if(context.expiresAt<=Date.now())return result('sign_in_required');
        profileId=checked.profileId;
        if(expectedProfileId!==undefined&&profileId!==expectedProfileId)return result('profile_changed');
      }
      if(removing){
        dispatched=true;
        const binding=action==='remove_profile'&&profileBindingEnabled?{expectedProfileId:snapshot.profileId}:expectedProfileId===undefined?{}:{expectedProfileId};
        const value=await removal.run({...context,operationId:snapshot.operationId,version:snapshot.version,kind:action==='remove'?'image':'profile',...binding},{signal:controller.signal});
        if(value?.state==='committed'&&Number.isSafeInteger(value.version)&&value.version>0)return Object.freeze({state:'committed',version:value.version});
        return result(['unknown','removal_pending','request_ended','sign_in_required','busy','unavailable'].includes(value?.state)?value.state:'unknown');
      }
      expiryTimer=setTimeout(abort,Math.min(45000,context.expiresAt-Date.now()));
      if(action==='read')return await viewer.read({...context,profileId,...snapshot},{signal:controller.signal});
      // Bind account+session from verified context; caller cannot choose them.
      const bound={};for(const name of ['reserve','claimUpload','commitUpload','cancelReserved','operationReceipt'])bound[name]=(actor,...args)=>{
        if(actor!==context.actorId||context.expiresAt<=Date.now())throw Object.assign(Error('avatar_member_unavailable'),{outcome:'rejected'});
        return ledger[name+'Session'](context.actorId,context.sessionId,...args);
      };
      bound.settleUnpublished=(...args)=>ledger.settleUnpublished(...args);
      bound.reserve=(actor,operationId,version,options)=>{
        if(actor!==context.actorId||context.expiresAt<=Date.now())throw Object.assign(Error('avatar_member_unavailable'),{outcome:'rejected'});
        return creation.reserve(context,operationId,version,expectedProfileId===undefined?options:{...options,expectedProfileId});
      };
      const flow=createAvatarFlow({enabled:true,ledger:bound,processor,storage});
      try{dispatched=action==='replace';return action==='replace'?await flow.replace({actorId:context.actorId,...snapshot},{signal:controller.signal}):await flow.status(context.actorId,snapshot.operationId,{signal:controller.signal});}
      finally{flow.close();}
    }catch(error){return result(dispatched?'unknown':controller.signal.aborted?'request_ended':ERRORS.has(error?.state)?error.state:(error?.outcome==='rejected'?'sign_in_required':'account_unavailable'));}
    finally{clearTimeout(expiryTimer);request.signal.removeEventListener('abort',abort);controller.abort();running.delete(controller);active--;}
  }
  return Object.freeze({handle,close(){closed=true;viewer.close();removalVersion.close();for(const c of running)c.abort();}});
}

