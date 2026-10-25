// Explicit, default-off member surface. No automatic account read, persistence,
// polling or mount; remote text never becomes HTML. Host owns session lifecycle.
import {createMemberProfileClient} from './fed-alliance-member-client.mjs';
import {createAllianceFeedbackClient} from './fed-alliance-feedback-client.mjs';
const categories=[['tools','Tools'],['community','Community'],['learning','Learning'],['accessibility','Accessibility'],['research','Research']];
export function mountAllianceFeedbackPanel(root,{enabled=false,origin,fetcher=globalThis.fetch,onSignInRequired=()=>{}}={}){
 if(typeof enabled!=='boolean'||!root?.ownerDocument)throw Error('feedback_panel_configuration');
 const doc=root.ownerDocument,nodes={},events=[],rows=new Map(),reported=new Set();let disposed=false,busy=false,epoch=0,ownId=null,cursor=null,freshId=null,unknown=false,client,profile;
 const el=(tag,text,attrs={})=>{const n=doc.createElement(tag);if(text!==undefined)n.textContent=text;for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
 const box=(id,tag,text,attrs={})=>nodes[id]=el(tag,text,{id:'af-'+id,...attrs});
 const button=(id,text)=>box(id,'button',text,{type:'button'}),label=(id,text)=>el('label',text,{for:'af-'+id});
 const listen=(n,event,fn)=>{n.addEventListener(event,fn);events.push(()=>n.removeEventListener(event,fn));};
 const option=(select,text,value)=>{const n=el('option',text);n.value=value;select.append(n);};
 const title=box('title','h2','Member ideas'),status=box('status','p','Member ideas are not open here. No request has started.',{role:'status','aria-live':'polite','aria-atomic':'true',class:'profile-status'});
 root.setAttribute('aria-labelledby','af-title');root.replaceChildren(title,status);
 if(!enabled)return Object.freeze({dispose(){root.replaceChildren(title,el('p','Member ideas closed.'));}});
 root.append(el('p','Share useful ideas with other members. Support is an expression of interest, not a vote, reward or promise to build. Service operators and hosting providers can access stored records. Keep private contact and account information out of ideas.'));
 const toolbar=el('div',undefined,{class:'profile-toolbar'}),load=button('load','Load member ideas'),cancel=button('cancel','Stop waiting');toolbar.append(load,cancel);root.append(toolbar,el('p','Loading reads your profile and one page of ideas. Drafts are not submitted. There is no automatic refresh.',{class:'profile-help'}));
 const previous=button('previous','Check or finish the earlier action'),previousNote=box('previous-note','p','This resubmits the exact earlier action. It may finish that action if the first attempt did not complete. Reading ideas does not resolve an uncertain save.',{class:'profile-help'});previous.setAttribute('aria-describedby','af-previous-note');root.append(previous,previousNote);
 const form=box('form','form',undefined,{'aria-label':'Post an idea'}),fields=box('fields','fieldset');fields.append(el('legend','Post an idea'));
 const ideaTitle=box('idea-title','input',undefined,{type:'text',minlength:'5',maxlength:'80',required:''}),category=box('category','select'),detail=box('idea-detail','textarea',undefined,{rows:'5',minlength:'15',maxlength:'600',required:''});
 for(const [id,text]of categories)option(category,text,id);category.value='tools';
 fields.append(label('idea-title','Title (5–80 characters)'),ideaTitle,label('category','Category'),category,label('idea-detail','Detail (15–600 characters)'),detail);
 const post=button('post','Post idea');post.setAttribute('type','submit');fields.append(post);form.append(fields);root.append(form);
 const selection=box('selection','select',undefined,{'aria-describedby':'af-list-help'});root.append(label('selection','Ideas from your last read'),selection,box('list-help','p','Choose an idea, then read it before taking an action. A hidden or unavailable idea is not proof it never existed.',{class:'profile-help'}));
 const nav=el('div',undefined,{class:'profile-toolbar'});nav.append(button('read','Read selected idea'),button('more','Read more ideas'));root.append(nav);
 const view=box('detail','section',undefined,{'aria-label':'Last read idea',tabindex:'-1'});root.append(view);
 const actions=box('actions','fieldset');actions.append(el('legend','Support this idea'),el('p','Counts include support visible to your current session; they are not a community score.'),button('support-on','Support this idea'),button('support-off','Remove my support'));root.append(actions);
 const removal=box('removal','fieldset'),removeCheck=box('remove-check','input',undefined,{type:'checkbox'}),removeLabel=el('label',undefined,{class:'profile-check',for:'af-remove-check'});removeLabel.append(removeCheck,el('span','I want to remove this idea'));removal.append(el('legend','Remove your idea'),el('p','Removal clears this idea’s stored text and its support and idea-report records from the active service. Backups may retain earlier data. It does not remove your profile or sign-in account.'),removeLabel,button('remove','Remove my idea'));root.append(removal);
 const reports=box('reports','fieldset'),reportKind=box('report-kind','select'),reportCheck=box('report-check','input',undefined,{type:'checkbox'});option(reportKind,'This idea','idea');option(reportKind,'This idea’s author','member');reportKind.value='idea';
 const reportLabel=el('label',undefined,{class:'profile-check',for:'af-report-check'});reportLabel.append(reportCheck,el('span','I want to record this private report'));
 reports.append(el('legend','Record a private report'),el('p','This records a private flag. It does not automatically remove content or confirm that a person has reviewed it. Report details are not shown to other members.'),label('report-kind','Report about'),reportKind,reportLabel,button('report','Record private report'));root.append(reports);
 const say=text=>{status.textContent=text;},selected=()=>rows.get(selection.value),permitted=()=>!disposed&&!busy&&ownId!==null&&!unknown;
 const reportTarget=()=>reportKind.value==='member'?selected()?.owner:selected()?.id;
 function controls(){
  root.setAttribute('aria-busy',busy?'true':'false');load.disabled=disposed||busy;cancel.hidden=!busy;cancel.disabled=!busy;
  previous.hidden=previousNote.hidden=!unknown;previous.disabled=disposed||busy;
  fields.disabled=!permitted();selection.disabled=disposed||busy||!rows.size;nodes.read.disabled=disposed||busy||!selection.value;nodes.more.disabled=disposed||busy||!cursor;
  const r=selected(),fresh=r&&freshId===r.id,peer=fresh&&r.owner!==ownId;
  actions.disabled=!permitted()||!peer;nodes['support-on'].disabled=actions.disabled||r?.supported===true;nodes['support-off'].disabled=actions.disabled||r?.supported!==true;
  removal.disabled=!permitted()||!fresh||r.owner!==ownId;nodes.remove.disabled=removal.disabled||!removeCheck.checked;
  reports.disabled=!permitted()||!peer;nodes.report.disabled=reports.disabled||!reportCheck.checked||reported.has(reportKind.value+':'+reportTarget());
 }
 function list(){const old=selection.value;selection.replaceChildren();option(selection,rows.size?'Choose an idea':'No ideas loaded','');for(const r of rows.values())option(selection,(r.owner===ownId?'Your idea: ':'Member idea: ')+r.title,r.id);selection.value=rows.has(old)?old:'';}
 function render(){
  view.replaceChildren();const r=selected();if(!r||freshId!==r.id){view.append(el('p','Read the selected idea for its current details.'));controls();return;}
  view.append(el('h3',r.title),el('p',(categories.find(c=>c[0]===r.category)?.[1]||'Idea')+' · '+(r.owner===ownId?'Your idea':'Another member’s idea')),el('p',r.detail),el('p','Support visible in this read: '+r.supportCount+'. Your support: '+(r.supported?'on.':'off.')),el('p','Posted '+new Date(r.createdAt).toLocaleString()+' (your device time).'));controls();
 }
 function state(s){if(disposed)return;if(s.status==='unknown')unknown=true;if(s.status==='sign_in_required'){onSignInRequired();if(disposed)return;}say(s.message);controls();}
 client=createAllianceFeedbackClient({enabled:true,origin,fetcher,onState:state});profile=createMemberProfileClient({enabled:true,profileRevisions:true,origin,fetcher,onState:s=>{if(s.status==='sign_in_required'&&!disposed)onSignInRequired();}});
 async function run(work){
  if(disposed||busy)return;busy=true;const turn=epoch;controls();
  try{await work(()=>{if(disposed||turn!==epoch)throw Error('closed');});}
  catch(e){if(!disposed&&turn===epoch)say(e?.code?e.message:'Check the fields. The request could not be confirmed; no automatic retry will start.');}
  finally{if(!disposed&&turn===epoch){busy=false;controls();if(unknown)previous.focus();}}
 }
 function apply(result){
  if(result.idea){rows.set(result.idea.id,result.idea);list();selection.value=result.idea.id;freshId=result.idea.id;render();view.focus();}
  else if(result.state==='removed'){rows.delete(result.id);freshId=null;list();render();say('Idea removal confirmed. Earlier backups may remain.');load.focus();}
  else if(result.state==='set'){if(selection.value===result.id)freshId=null;render();say('Your support is confirmed '+(result.supported?'on':'off')+'. Read the idea again for current details and counts.');nodes.read.focus();}
  else if(result.state==='recorded'){reported.add(result.kind+':'+result.target);reportCheck.checked=false;controls();say('Report recorded privately. Content removal and human review are not confirmed.');}
 }
 listen(load,'click',()=>run(async check=>{
  ownId=null;rows.clear();cursor=freshId=null;removeCheck.checked=reportCheck.checked=false;list();render();const mine=await profile.load();check();ownId=mine.profile?.id||null;
  if(!ownId){say('Create and save your profile above before using member ideas. Your idea draft is kept.');return;}
  const page=(await client.list()).page;check();for(const r of page.items)rows.set(r.id,r);cursor=page.next;list();render();say('Ideas read. Choose an idea to read, or post your draft.');
 }));
 listen(nodes.more,'click',()=>run(async check=>{const page=(await client.list({after:cursor,limit:5})).page;check();for(const r of page.items){if(rows.size>=128&&!rows.has(r.id))break;rows.set(r.id,r);}cursor=rows.size>=128?null:page.next;list();render();}));
 listen(nodes.read,'click',()=>run(async check=>{const id=selection.value;freshId=null;removeCheck.checked=reportCheck.checked=false;render();const result=await client.read(id);check();rows.set(result.idea.id,result.idea);freshId=result.idea.id;list();render();view.focus();}));
 listen(selection,'change',()=>{freshId=null;removeCheck.checked=reportCheck.checked=false;render();});
 listen(removeCheck,'change',controls);listen(reportCheck,'change',controls);listen(reportKind,'change',()=>{reportCheck.checked=false;controls();});
 listen(form,'submit',e=>{e.preventDefault();if(!permitted())return;return run(async check=>{const result=await client.change({action:'post',id:globalThis.crypto.randomUUID(),title:ideaTitle.value.trim(),category:category.value,detail:detail.value.trim()});check();apply(result);say('Idea post confirmed. Your draft is kept.');});});
 for(const [name,supported]of [['support-on',true],['support-off',false]])listen(nodes[name],'click',()=>{const r=selected();if(!permitted()||freshId!==r?.id||r.owner===ownId)return;return run(async check=>{const result=await client.change({action:'support',id:r.id,supported});check();apply(result);});});
 listen(nodes.remove,'click',()=>{const r=selected();if(!permitted()||freshId!==r?.id||r.owner!==ownId||!removeCheck.checked)return;return run(async check=>{
  if(ideaTitle.value.trim()===r.title&&category.value===r.category&&detail.value.trim()===r.detail){ideaTitle.value=detail.value='';}
  rows.delete(r.id);freshId=null;removeCheck.checked=false;list();render();const result=await client.change({action:'remove',id:r.id});check();apply(result);
 });});
 listen(nodes.report,'click',()=>{const r=selected(),kind=reportKind.value,target=reportTarget();if(!permitted()||freshId!==r?.id||r.owner===ownId||!reportCheck.checked||reported.has(kind+':'+target))return;return run(async check=>{const result=await client.change({action:'report',id:globalThis.crypto.randomUUID(),kind,target});check();apply(result);});});
 listen(previous,'click',()=>run(async check=>{const result=await client.checkOrFinishPrevious();check();unknown=false;apply(result);}));
 listen(cancel,'click',()=>{epoch++;client.cancel();profile.cancel();busy=false;freshId=null;render();load.focus();});
 say('Load member ideas when ready. Nothing has been submitted.');list();render();
 return Object.freeze({dispose(){if(disposed)return;epoch++;client.dispose();profile.dispose();disposed=true;for(const off of events)off();rows.clear();reported.clear();ownId=null;ideaTitle.value=detail.value='';root.replaceChildren(el('h2','Member ideas'),el('p','Ideas closed. Private drafts and earlier reads were cleared.'));}});
}
