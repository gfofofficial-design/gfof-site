// Closed page composition. No Auth claim parsing, login, startup account read,
// actor selection, tokens, storage, feature discovery or automatic remount.
import {mountAllianceCollaborationPanel} from './fed-alliance-collaboration-panel.mjs';
import {mountAllianceFeedbackPanel} from './fed-alliance-feedback-panel.mjs';
import {mountAllianceReportReviewPanel} from './fed-alliance-report-review-panel.mjs';
import {createAllianceReportReviewClient} from './fed-alliance-report-review-client.mjs';
import {mountMemberProfileForm} from './fed-alliance-member-form.mjs';
import {createMemberProfileClient} from './fed-alliance-member-client.mjs';
import {createProfileRemovalClient} from './fed-alliance-profile-removal-client.mjs';
import {createProfileRemovalStatusClient} from './fed-alliance-profile-removal-status-client.mjs';
import {mountProfileRemovalPanel} from './fed-alliance-profile-removal-panel.mjs';
export function mountAllianceMemberPage(document,{enabled=false,collaborationEnabled=false,feedbackEnabled=false,reportReviewEnabled=false,origin,fetcher=globalThis.fetch}={}){
 if(typeof reportReviewEnabled!=='boolean'||reportReviewEnabled&&(!enabled||!feedbackEnabled)||typeof feedbackEnabled!=='boolean'||feedbackEnabled&&(!enabled||!collaborationEnabled)||typeof collaborationEnabled!=='boolean'||collaborationEnabled&&!enabled||typeof enabled!=='boolean'||enabled&&(!/^https:\/\/(?:galacticfederation\.co|deploy-preview-[1-9][0-9]*--gfof\.netlify\.app)$/.test(origin)||typeof fetcher!=='function'))throw Error('member_page_configuration');
 const root=document.getElementById('ap-removal');if(!root)throw Error('member_page_configuration');
 let disposed=false,epoch=0,highest=0,current=null,form,panel,reader,collaboration,feedback,reportReview,flight=null;
 const status=message=>{document.getElementById('ap-status').textContent=message;};
 const heading=text=>{const node=document.getElementById('ap-service-title');if(node)node.textContent=text;};
 function clear(){epoch++;current=null;form?.dispose();panel?.dispose();reader?.dispose();collaboration?.dispose();feedback?.dispose();reportReview?.dispose();form=panel=reader=collaboration=feedback=reportReview=undefined;flight?.abort();flight=null;}
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
   const target=new URL(endpoint),reviewTarget=reportReviewEnabled&&target.pathname.startsWith('/api/alliance-members/report-review/');
   if(target.origin!==origin||!['/api/alliance-members/me','/api/alliance-members/me/profile','/api/alliance-members/me/profile/removal-status',...(collaborationEnabled?['/api/alliance-members/directory','/api/alliance-members/community/challenges','/api/alliance-members/community/challenge','/api/alliance-members/community/change','/api/alliance-members/community/visibility']:[]),...(feedbackEnabled?['/api/alliance-members/feedback/ideas','/api/alliance-members/feedback/idea','/api/alliance-members/feedback/change']:[]),...(reportReviewEnabled?['/api/alliance-members/report-review/reports','/api/alliance-members/report-review/report','/api/alliance-members/report-review/review']:[])].includes(target.pathname)||target.search&&!((collaborationEnabled&&['/api/alliance-members/directory','/api/alliance-members/community/challenges','/api/alliance-members/community/challenge'].includes(target.pathname))||(feedbackEnabled&&['/api/alliance-members/feedback/ideas','/api/alliance-members/feedback/idea'].includes(target.pathname))||(reviewTarget&&['/api/alliance-members/report-review/reports','/api/alliance-members/report-review/report'].includes(target.pathname)))||target.hash||target.username||target.password)throw Error('member_page_target');
   const c=new AbortController(),abort=()=>c.abort();flight=c;init.signal?.addEventListener('abort',abort,{once:true});if(init.signal?.aborted)abort();
   let response,bodyReader;
   const check=()=>{guard();if(c.signal.aborted)throw Error('member_page_closed');};
   try{
    check();response=await fetcher(endpoint,{...init,signal:c.signal});check();
    if(reviewTarget&&response.status===401){detach();throw Error('member_page_sign_in_required');}
    if(!response.body)return response;
    bodyReader=response.body.getReader();const chunks=[];let bytes=0;
    for(;;){const p=await bodyReader.read();check();if(p.done)break;if(!(p.value instanceof Uint8Array)||(bytes+=p.value.byteLength)>(reviewTarget?65536:(target.pathname.startsWith('/api/alliance-members/community/')||target.pathname.startsWith('/api/alliance-members/feedback/'))?262144:32768))throw Error('member_page_response');chunks.push(p.value);}
    const out=new Uint8Array(bytes);let at=0;for(const p of chunks){out.set(p,at);at+=p.byteLength;}check();
    return new Response(out,{status:response.status,statusText:response.statusText,headers:response.headers});
   }finally{init.signal?.removeEventListener('abort',abort);c.abort();try{void Promise.resolve(bodyReader?bodyReader.cancel():response?.body?.cancel()).catch(()=>{});}catch{}if(flight===c)flight=null;}
  };
  try{
   form=mountMemberProfileForm(document,{enabled:true,createClient:onState=>createMemberProfileClient({enabled:true,profileRevisions:true,origin,fetcher:transport,onState:s=>{if(!valid())return;onState(s);if(s.status==='sign_in_required')detach();}})});
   reader=createProfileRemovalStatusClient({enabled:true,origin,fetcher:transport});
   panel=mountProfileRemovalPanel(root,{enabled:true,profileBinding:true,collaborationEnabled,feedbackEnabled,readVersion:options=>{guard();return reader.read(options);},beforeConfirm:()=>valid()&&flight===null,createClient:onState=>createProfileRemovalClient({enabled:true,profileBinding:true,origin,fetcher:transport,onState:s=>{
    if(!valid())return;
    if(s.status==='removing'){form?.dispose();form=undefined;collaboration?.dispose();feedback?.dispose();reportReview?.dispose();collaboration=feedback=reportReview=undefined;status('Profile editing is closed while removal is being checked. An interrupted request may still need reconciliation.');}
    onState(s);if(s.status==='sign_in_required')detach();
   }})});
   if(collaborationEnabled){const root=document.getElementById('ap-collaboration');if(!root)throw Error('member_page_configuration');collaboration=mountAllianceCollaborationPanel(root,{enabled:true,feedbackEnabled,origin,fetcher:transport,onSignInRequired:()=>detach()});}
   if(feedbackEnabled){const root=document.getElementById('ap-feedback');if(!root)throw Error('member_page_configuration');feedback=mountAllianceFeedbackPanel(root,{enabled:true,origin,fetcher:transport,onSignInRequired:()=>detach()});}
   if(reportReviewEnabled){const root=document.getElementById('ap-report-review');if(!root)throw Error('member_page_configuration');reportReview=mountAllianceReportReviewPanel(root,{enabled:true,clientFactory:()=>createAllianceReportReviewClient({enabled:true,origin,fetcher:transport})});}
   heading('Member service preview');return true;
  }catch{detach('Member page unavailable. No additional requests will start.');return false;}
 }
 return Object.freeze({attach,detach(generation){if(disposed||generation!==undefined&&generation!==current)return false;detach();return true;},dispose(){if(disposed)return;clear();closed('Member page closed. No further requests will start.');form?.dispose();panel?.dispose();disposed=true;}});
}
