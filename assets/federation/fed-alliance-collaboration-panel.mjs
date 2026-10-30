// Explicit private workspace. Not mounted by the tab-only community sandbox.
// All remote content uses textContent; identities remain memory-only bindings.
import {CHALLENGE_KITS} from './fed-alliance-community-core.mjs';
import {createAllianceFeedbackClient} from './fed-alliance-feedback-client.mjs';
import {createMemberProfileClient} from './fed-alliance-member-client.mjs';
import {createAllianceCollaborationClient} from './fed-alliance-collaboration-client.mjs';
export function mountAllianceCollaborationPanel(root,{enabled=false,feedbackEnabled=false,origin,fetcher=globalThis.fetch,onSignInRequired=()=>{}}={}){
 if(typeof feedbackEnabled!=='boolean'||feedbackEnabled&&!enabled||typeof enabled!=='boolean'||!root?.ownerDocument)throw Error('collaboration_panel_configuration');
 const doc=root.ownerDocument,events=[],dynamicEvents=[],nodes={},members=new Map(),rows=new Map();let disposed=false,busy=false,epoch=0,ownId=null,cursor=null,directoryCursor=null,unknown=false,conflict=false,profileClient,client,feedbackClient,feedbackPending=false;const reportedChallenges=new Set();
 const el=(tag,text,attrs={})=>{const n=doc.createElement(tag);if(text!==undefined)n.textContent=text;for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
 const listen=(n,event,fn,dynamic=false)=>{n.addEventListener(event,fn);(dynamic?dynamicEvents:events).push(()=>n.removeEventListener(event,fn));};
 const box=(id,tag,text,attrs={})=>nodes[id]=el(tag,text,{id:'ac-'+id,...attrs});
 const button=(id,text)=>box(id,'button',text,{type:'button'});
 const label=(id,text)=>el('label',text,{for:'ac-'+id});
 const option=(select,text,value)=>{const n=el('option',text);n.value=value;select.append(n);};
 const heading=box('title','h2','Private collaborations'),note=el('p','Invitations and contribution notes are private to the two participants in the member interface. Service operators and hosting providers can access stored records. Peer acknowledgement is not independent verification, League points or permission to publish. Avoid private contact details and account information.');
 root.setAttribute('aria-labelledby','ac-title');root.replaceChildren(heading,note);
 const status=box('status','p','Private collaboration is not open here. No request has started.',{role:'status','aria-live':'polite','aria-atomic':'true',class:'profile-status'});root.append(status);
 if(!enabled)return Object.freeze({dispose(){root.replaceChildren(heading,el('p','Private collaboration is closed.'));}});
 const toolbar=el('div',undefined,{class:'profile-toolbar'}),load=button('load','Load private workspace'),cancel=button('cancel','Cancel request'),previous=button('previous','Check or finish earlier save');
 toolbar.append(load,cancel);root.append(toolbar,el('p','Loading reads your profile, listed members and one page of your collaborations. It does not submit your drafts. No automatic refresh runs.',{class:'profile-help'}));
 const previousNote=box('previous-note','p','This resubmits the exact earlier change. It may finish that change if the first attempt did not complete. It does not send a new intention.',{class:'profile-help'});previous.setAttribute('aria-describedby','ac-previous-note');root.append(previous,previousNote);
 const invitation=box('invitation','form',undefined,{'aria-label':'Invite a member'}),fields=box('fields','fieldset');fields.append(el('legend','Invite a member to useful work'));
 const target=box('target','select',undefined,{required:'', 'aria-describedby':'ac-target-help'}),kit=box('kit','select'),scope=box('scope','select'),days=box('days','select'),goal=box('goal','input',undefined,{type:'number',min:'1',max:'20',required:''}),brief=box('brief','textarea',undefined,{rows:'4',maxlength:'400'});
 option(target,'Load listed members, then choose someone','');for(const k of CHALLENGE_KITS)option(kit,k.title,k.id);option(scope,'Two members','members');option(scope,'Cross-community proposal','communities');for(const n of [3,7,14,30])option(days,n+' days after acceptance',String(n));days.value='7';goal.value=String(CHALLENGE_KITS[0].goal);
 fields.append(label('target','Listed member'),target,box('target-help','p','Choose another member. A self-described project name does not establish an official partnership.',{class:'profile-help'}),button('members-more','Read more listed members'),label('kit','Shared task'),kit,label('scope','Participants'),scope,label('days','Window after acceptance'),days,label('goal','Acknowledged contributions per participant'),goal,label('brief','Shared brief (optional, up to 400 characters)'),brief);
 const send=button('send','Send invitation');send.setAttribute('type','submit');fields.append(send);invitation.append(fields);root.append(invitation);
 const visibility=box('visibility','fieldset');visibility.append(el('legend','Hide or show the selected member'),el('p','Hiding blocks conversations in both directions. It does not erase earlier records. Showing permits access again if both people and the service allow it.'),button('hide','Hide selected member'),button('show','Show selected member'));root.append(visibility);
 const selection=box('selection','select',undefined,{'aria-describedby':'ac-list-help'});option(selection,'No collaboration loaded','');root.append(label('selection','Your private collaborations'),selection,box('list-help','p','Only the last successfully read page is shown. A hidden, removed or unavailable record is not evidence that it never existed.',{class:'profile-help'}));
 const nav=el('div',undefined,{class:'profile-toolbar'});nav.append(button('read','Read selected collaboration'),button('more','Read more collaborations'));root.append(nav);
 const detail=box('detail','section',undefined,{'aria-label':'Last read collaboration',tabindex:'-1'});root.append(detail);
 const actions=box('actions','fieldset');actions.append(el('legend','Respond to the last read invitation'),button('accept','Accept invitation'),button('decline','Decline invitation'),button('withdraw','Cancel unanswered invitation'));root.append(actions);
 const reports=feedbackEnabled?box('reports','fieldset'):null;let reportCheck;
 if(reports){reportCheck=box('report-check','input',undefined,{type:'checkbox'});const label=el('label',undefined,{class:'profile-check',for:'ac-report-check'});label.append(reportCheck,el('span','I want to report this invitation or task privately'));reports.append(el('legend','Report this invitation or task'),el('p','Only the recipient can report this invitation or task. A private report does not automatically remove content, settle a dispute or confirm human review.'),label,button('report-challenge','Record private report'));root.append(reports);}
 const contribution=box('contribution','form',undefined,{'aria-label':'Add a contribution'}),contributionFields=box('contribution-fields','fieldset');contributionFields.append(el('legend','Add a contribution'),label('contribution-note','Contribution note (10–240 characters)'),box('contribution-note','textarea',undefined,{rows:'4',minlength:'10',maxlength:'240',required:''}));const contribute=button('contribute','Submit contribution');contribute.setAttribute('type','submit');contributionFields.append(contribute);contribution.append(contributionFields);root.append(contribution);
 const selected=()=>rows.get(selection.value),say=text=>{status.textContent=text;};
 const permitted=()=>!disposed&&!busy&&ownId!==null&&!unknown&&!conflict;
 function controls(){
  root.setAttribute('aria-busy',busy?'true':'false');load.disabled=disposed||busy;cancel.hidden=!busy;cancel.disabled=!busy;
  previous.hidden=previousNote.hidden=!unknown;previous.disabled=disposed||busy;
  fields.disabled=visibility.disabled=!permitted();send.disabled=nodes.hide.disabled=nodes.show.disabled=!permitted()||!target.value;
  nodes['members-more'].disabled=disposed||busy||!ownId||!directoryCursor;
  selection.disabled=disposed||busy||!rows.size;nodes.read.disabled=disposed||busy||!selection.value;nodes.more.disabled=disposed||busy||!cursor;
  const r=selected();actions.disabled=!permitted()||!r||r.status!=='invited';nodes.accept.disabled=nodes.decline.disabled=actions.disabled||r?.to!==ownId;nodes.withdraw.disabled=actions.disabled||r?.from!==ownId;
  if(reports){reports.disabled=!permitted()||!r||r.to!==ownId;nodes['report-challenge'].disabled=reports.disabled||!reportCheck.checked||reportedChallenges.has(r?.id);}
  contributionFields.disabled=!permitted()||r?.status!=='active';for(const b of detail.querySelectorAll('button'))b.disabled=!permitted();
 }
 function list(){const old=selection.value;selection.replaceChildren();option(selection,rows.size?'Choose a collaboration':'No collaboration loaded','');for(const r of rows.values())option(selection,(r.from===ownId?'Sent':'Received')+' · '+(CHALLENGE_KITS.find(k=>k.id===r.kit)?.title||'Shared task')+' · '+r.status,r.id);selection.value=rows.has(old)?old:'';}
 function targetList(){const old=target.value;target.replaceChildren();option(target,'Choose a listed member','');for(const m of members.values())if(m.id!==ownId)option(target,m.name+(m.community?' · '+m.community:''),m.id);target.value=members.has(old)&&old!==ownId?old:'';}
 function render(){
  for(const remove of dynamicEvents.splice(0))remove();detail.replaceChildren();const r=selected();if(!r){detail.append(el('p','Choose a collaboration, then read it before making a change.'));controls();return;}
  detail.append(el('h3',CHALLENGE_KITS.find(k=>k.id===r.kit)?.title||'Shared task'),el('p','Last read status: '+r.status+' · revision '+r.revision),el('p',r.note||'No shared brief.'),el('p',r.acceptedAt?'Accepted '+new Date(r.acceptedAt).toLocaleString()+'. Window ends '+new Date(r.endsAt).toLocaleString()+' (your device time).':'The other participant must agree before work begins.'));
  const proofs=el('ul');for(const p of r.proofs){const item=el('li');item.append(el('p',(p.owner===ownId?'Your contribution':'Other participant’s contribution')+': '+p.note),el('p','Acknowledgement: '+p.status));if(p.owner!==ownId&&p.status==='pending'&&r.status==='active'){
   for(const [action,text]of [['acknowledge','Acknowledge contribution'],['reject','Decline acknowledgement']]){const b=el('button',text,{type:'button'});listen(b,'click',()=>change({action,proofId:p.id}),true);item.append(b);}
  }proofs.append(item);}detail.append(proofs);controls();
 }
 function state(s){if(disposed)return;if(s.status==='unknown')unknown=true;if(s.status==='conflict')conflict=true;if(s.status==='sign_in_required'){onSignInRequired();if(disposed)return;}say(s.message);controls();}
 if(feedbackEnabled)feedbackClient=createAllianceFeedbackClient({enabled:true,origin,fetcher,onState:state});
 client=createAllianceCollaborationClient({enabled:true,origin,fetcher,onState:state});profileClient=createMemberProfileClient({enabled:true,profileRevisions:true,origin,fetcher,onState:s=>{if(s.status==='sign_in_required'&&!disposed)onSignInRequired();}});
 async function run(work){
  if(disposed||busy)return;busy=true;const turn=epoch;controls();
  try{await work(()=>{if(disposed||turn!==epoch)throw Error('closed');});}
  catch(e){if(!disposed&&turn===epoch)say(e?.code?e.message:'Check the displayed fields and try again. The request could not be confirmed. No automatic retry will start.');}
  finally{if(!disposed&&turn===epoch){busy=false;controls();if(unknown)previous.focus();else if(conflict&&selection.value)nodes.read.focus();}}
 }
 async function change(extra){const r=selected();if(!permitted()||!r)return;return run(async check=>{const result=await client.change({operationId:globalThis.crypto.randomUUID(),challengeId:r.id,revision:r.revision,...extra});check();if(result.state==='conflict'){conflict=true;return;}rows.set(result.challenge.id,result.challenge);list();render();detail.focus();});}
 listen(load,'click',()=>run(async check=>{
  ownId=null;members.clear();rows.clear();cursor=directoryCursor=null;list();targetList();render();const mine=await profileClient.load();check();ownId=mine.profile?.id||null;
  if(!ownId){list();targetList();say('Create and save your profile above before using private collaboration.');return;}
  const directory=await profileClient.directory();check();for(const m of directory.items)members.set(m.id,m);directoryCursor=directory.next;targetList();
  const page=(await client.list()).page;check();for(const r of page.items)rows.set(r.id,r);cursor=page.next;list();render();say('Workspace read. Your invitation and contribution drafts are kept.');
 }));
 listen(nodes['members-more'],'click',()=>run(async check=>{const page=await profileClient.directory({after:directoryCursor,limit:20});check();for(const m of page.items){if(members.size>=128)break;members.set(m.id,m);}directoryCursor=members.size>=128?null:page.next;targetList();}));
 listen(nodes.more,'click',()=>run(async check=>{const page=(await client.list({after:cursor,limit:5})).page;check();for(const r of page.items)rows.set(r.id,r);cursor=page.next;list();render();}));
 listen(nodes.read,'click',()=>run(async check=>{const result=await client.read(selection.value);check();rows.set(result.challenge.id,result.challenge);conflict=false;list();render();}));
 listen(selection,'change',()=>{if(reportCheck)reportCheck.checked=false;render();});listen(target,'change',controls);listen(kit,'change',()=>{goal.value=String(CHALLENGE_KITS.find(k=>k.id===kit.value)?.goal||1);});
 listen(invitation,'submit',e=>{e.preventDefault();if(!permitted()||!target.value)return;return run(async check=>{const id=globalThis.crypto.randomUUID(),r=await client.change({operationId:id,challengeId:id,revision:0,action:'invite',target:target.value,kit:kit.value,scope:scope.value,days:Number(days.value),goal:Number(goal.value),note:brief.value.trim(),format:1});check();if(r.state==='conflict'){conflict=true;return;}rows.set(r.challenge.id,r.challenge);list();selection.value=r.challenge.id;render();});});
 listen(contribution,'submit',e=>{e.preventDefault();return change({action:'contribute',note:nodes['contribution-note'].value.trim()});});
 for(const [id,action]of [['accept','accept'],['decline','decline'],['withdraw','cancel']])listen(nodes[id],'click',()=>change({action}));
 for(const [id,hidden]of [['hide',true],['show',false]])listen(nodes[id],'click',()=>{if(!permitted()||!target.value)return;return run(async check=>{await client.visibility({target:target.value,hidden});check();rows.clear();list();render();say(hidden?'Member hidden. Read the workspace to check remaining conversations.':'Member shown. Read the workspace to check available conversations.');});});
 if(reports){
  listen(reportCheck,'change',controls);
  listen(nodes['report-challenge'],'click',()=>{const r=selected();if(!permitted()||!r||r.to!==ownId||!reportCheck.checked||reportedChallenges.has(r.id))return;return run(async check=>{feedbackPending=true;try{const result=await feedbackClient.change({action:'report',id:globalThis.crypto.randomUUID(),kind:'challenge',target:r.id});check();feedbackPending=false;reportedChallenges.add(result.target);reportCheck.checked=false;say('Report recorded privately. Removal and human review are not confirmed.');}catch(e){if(!['unknown','sign_in_required'].includes(e?.code))feedbackPending=false;throw e;}});});
 }
 listen(previous,'click',()=>run(async check=>{if(feedbackPending){const r=await feedbackClient.checkOrFinishPrevious();check();feedbackPending=false;unknown=false;reportedChallenges.add(r.target);reportCheck.checked=false;render();say('Report recorded privately. Removal and human review are not confirmed.');load.focus();return;}const r=await client.checkOrFinishPrevious();check();unknown=false;conflict=r.state==='conflict';if(r.state==='set'){rows.clear();list();}if(r.challenge){rows.set(r.challenge.id,r.challenge);list();selection.value=r.challenge.id;}render();if(r.challenge)detail.focus();else load.focus();}));
 listen(cancel,'click',()=>{epoch++;client.cancel();feedbackClient?.cancel();profileClient.cancel();busy=false;controls();load.focus();});
 say('Load your private workspace when ready. Nothing has been submitted.');render();
 return Object.freeze({dispose(){if(disposed)return;epoch++;client.dispose();feedbackClient?.dispose();profileClient.dispose();disposed=true;for(const remove of [...events,...dynamicEvents])remove();members.clear();rows.clear();reportedChallenges.clear();ownId=null;root.replaceChildren(el('h2','Private collaborations'),el('p','Private workspace closed. Unsaved private drafts were cleared.'));}});
}
