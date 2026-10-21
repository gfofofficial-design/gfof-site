// Closed page composition. No Auth claim parsing, login, startup account read,
// actor selection, tokens, storage, feature discovery or automatic remount.
import {mountMemberProfileForm} from './fed-alliance-member-form.mjs';
import {createMemberProfileClient} from './fed-alliance-member-client.mjs';
import {createProfileRemovalClient} from './fed-alliance-profile-removal-client.mjs';
import {createProfileRemovalStatusClient} from './fed-alliance-profile-removal-status-client.mjs';
import {mountProfileRemovalPanel} from './fed-alliance-profile-removal-panel.mjs';
export function mountAllianceMemberPage(document,{enabled=false,origin,fetcher=globalThis.fetch}={}){
 if(typeof enabled!=='boolean'||enabled&&(!/^https:\/\/(?:galacticfederation\.co|deploy-preview-[1-9][0-9]*--gfof\.netlify\.app)$/.test(origin)||typeof fetcher!=='function'))throw Error('member_page_configuration');
 const root=document.getElementById('ap-removal');if(!root)throw Error('member_page_configuration');
 let disposed=false,epoch=0,highest=0,current=null,form,panel,reader,flight=null;
 const status=message=>{document.getElementById('ap-status').textContent=message;};
 const heading=text=>{const node=document.getElementById('ap-service-title');if(node)node.textContent=text;};
 function clear(){epoch++;current=null;form?.dispose();panel?.dispose();reader?.dispose();form=panel=reader=undefined;flight?.abort();flight=null;}
 function closed(message='Member profiles are not open here. No account request has started.'){
  form=mountMemberProfileForm(document);panel=mountProfileRemovalPanel(root);heading('Member service closed');status(message);
 }
 closed();
 function detach(message='Member page closed. Sign in again through the reviewed account page. Earlier interrupted requests may still need reconciliation.'){
  if(disposed)return;clear();closed(message);
 }
 // Generations are opaque host lifecycle counters, NOT identity or authority.
 // The host must verify its account session independently and advance this on
 // account/session replacement. Server routes always verify current cookies.
 function attach(generation){
  if(disposed||!enabled||!Number.isSafeInteger(generation)||generation<=highest)return false;
  clear();highest=generation;current=generation;const ownEpoch=epoch;
  const valid=()=>!disposed&&epoch===ownEpoch&&current===generation;
  const guard=()=>{if(!valid())throw Error('member_page_closed');};
  const transport=async(endpoint,init)=>{
   guard();if(flight)throw Error('member_page_busy');
   const target=new URL(endpoint);if(target.origin!==origin||!['/api/alliance-members/me','/api/alliance-members/me/profile','/api/alliance-members/me/profile/removal-status'].includes(target.pathname)||target.search||target.hash||target.username||target.password)throw Error('member_page_target');
   const c=new AbortController(),abort=()=>c.abort();flight=c;init.signal?.addEventListener('abort',abort,{once:true});if(init.signal?.aborted)abort();
   let response,bodyReader;
   const check=()=>{guard();if(c.signal.aborted)throw Error('member_page_closed');};
   try{
    check();response=await fetcher(endpoint,{...init,signal:c.signal});check();
    if(!response.body)return response;
    bodyReader=response.body.getReader();const chunks=[];let bytes=0;
    for(;;){const p=await bodyReader.read();check();if(p.done)break;if(!(p.value instanceof Uint8Array)||(bytes+=p.value.byteLength)>32768)throw Error('member_page_response');chunks.push(p.value);}
    const out=new Uint8Array(bytes);let at=0;for(const p of chunks){out.set(p,at);at+=p.byteLength;}check();
    return new Response(out,{status:response.status,statusText:response.statusText,headers:response.headers});
   }finally{init.signal?.removeEventListener('abort',abort);c.abort();try{void Promise.resolve(bodyReader?bodyReader.cancel():response?.body?.cancel()).catch(()=>{});}catch{}if(flight===c)flight=null;}
  };
  try{
   form=mountMemberProfileForm(document,{enabled:true,createClient:onState=>createMemberProfileClient({enabled:true,profileRevisions:true,origin,fetcher:transport,onState:s=>{if(!valid())return;onState(s);if(s.status==='sign_in_required')detach();}})});
   reader=createProfileRemovalStatusClient({enabled:true,origin,fetcher:transport});
   panel=mountProfileRemovalPanel(root,{enabled:true,profileBinding:true,readVersion:options=>{guard();return reader.read(options);},beforeConfirm:()=>valid()&&flight===null,createClient:onState=>createProfileRemovalClient({enabled:true,profileBinding:true,origin,fetcher:transport,onState:s=>{
    if(!valid())return;
    if(s.status==='removing'){form?.dispose();form=undefined;status('Profile editing is closed while removal is being checked. An interrupted request may still need reconciliation.');}
    onState(s);if(s.status==='sign_in_required')detach();
   }})});heading('Member service preview');return true;
  }catch{detach('Member page unavailable. No additional requests will start.');return false;}
 }
 return Object.freeze({attach,detach(generation){if(disposed||generation!==undefined&&generation!==current)return false;detach();return true;},dispose(){if(disposed)return;clear();closed('Member page closed. No further requests will start.');form?.dispose();panel?.dispose();disposed=true;}});
}
