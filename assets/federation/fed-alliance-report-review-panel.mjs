// Default-off private review surface. The host must supply a reviewed,
// authenticated server client and dispose this panel whenever a session ends.
import {reportReviewRecord,reportReviewPage,reportReviewCommand} from './fed-alliance-report-review-contract.mjs';
const labels={unreviewed:'Unreviewed',no_action:'Reviewed — no action',owner_follow_up:'Reviewed — owner follow-up'};
const kinds={member:'Member',idea:'Idea',challenge:'Challenge'};
export function mountAllianceReportReviewPanel(root,{enabled=false,clientFactory}={}){
 if(typeof enabled!=='boolean'||!root?.ownerDocument)throw Error('report_review_panel_configuration');
 const doc=root.ownerDocument,nodes={},events=[],rows=new Map();let client,disposed=false,busy=false,epoch=0,cursor=null,freshId=null,active,pending,unknown;
 const el=(tag,text,attrs={})=>{const n=doc.createElement(tag);if(text!==undefined)n.textContent=text;for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
 const node=(id,tag,text,attrs={})=>nodes[id]=el(tag,text,{id:'arr-'+id,...attrs});
 const button=(id,text)=>node(id,'button',text,{type:'button'});
 const listen=(n,event,fn)=>{n.addEventListener(event,fn);events.push(()=>n.removeEventListener(event,fn));};
 const option=(select,text,value)=>{const o=el('option',text);o.value=value;select.append(o);};
 const title=node('title','h2','Private report review'),status=node('status','p','Private report review is not open here.',{role:'status','aria-live':'polite','aria-atomic':'true',class:'profile-status'});
 root.setAttribute('aria-labelledby','arr-title');root.replaceChildren(title,status);
 if(!enabled)return Object.freeze({dispose(){root.replaceChildren(title,el('p','Private review closed.'));}});
 if(typeof clientFactory!=='function')throw Error('report_review_panel_configuration');
 client=clientFactory();if(!client||!['list','read','review','close'].every(k=>typeof client[k]==='function'))throw Error('report_review_panel_configuration');
 root.append(el('p','Owner review is private. Loading reads one page of report records. It does not contact members or remove content.'),
  el('p','Reviewed reports expire 30 days after the first review; unreviewed reports expire 90 days after receipt. Encrypted recovery copies may retain them for up to 30 additional days. Earlier removal can delete records sooner.'));
 const load=button('load','Load private reports'),stop=button('stop','Stop waiting'),more=button('more','Read more reports');root.append(load,stop,more);
 const selection=node('selection','select');root.append(el('label','Reports from your last read',{for:'arr-selection'}),selection,button('read','Read selected report'));
 const detail=node('detail','section',undefined,{'aria-label':'Last read report',tabindex:'-1'});root.append(detail);
 const fields=node('fields','fieldset'),disposition=node('disposition','select'),checked=node('checked','input',undefined,{type:'checkbox'});
 option(disposition,'Reviewed — no action','no_action');option(disposition,'Reviewed — owner follow-up','owner_follow_up');disposition.value='no_action';
 const checkedLabel=el('label',undefined,{for:'arr-checked'});checkedLabel.append(checked,el('span','I reviewed this report'));
 fields.append(el('legend','Record your review'),el('p','This records review only. It does not remove content or take an account action. Updating the outcome does not extend retention.'),
  el('label','Review outcome',{for:'arr-disposition'}),disposition,checkedLabel,button('save','Save review'));
 root.append(fields,button('check','Check saved result'),button('fresh','Start a fresh queue read'),
  el('p','Starting a fresh read clears this tab’s uncertainty note. It does not undo or repeat an earlier review.',{id:'arr-fresh-help'}));
 nodes.fresh.setAttribute('aria-describedby','arr-fresh-help');
 const say=text=>{status.textContent=text;};
 function controls(){
  const selected=rows.get(selection.value),ready=!!selected&&freshId===selected.id;
  root.setAttribute('aria-busy',busy?'true':'false');load.disabled=disposed||busy||!!unknown;stop.hidden=!busy;stop.disabled=!busy;
  more.disabled=disposed||busy||!!unknown||!cursor;selection.disabled=disposed||busy||!!unknown||!rows.size;nodes.read.disabled=disposed||busy||!!unknown||!selection.value;
  fields.disabled=disposed||busy||!!unknown||!ready;nodes.save.disabled=fields.disabled||!checked.checked;
  nodes.check.hidden=nodes.fresh.hidden=!unknown;nodes.check.disabled=nodes.fresh.disabled=disposed||busy||!unknown;
 }
 function choices(){const old=selection.value;selection.replaceChildren();option(selection,rows.size?'Choose a report':'No reports loaded','');for(const r of rows.values())option(selection,kinds[r.kind]+' report · '+labels[r.disposition]+' · '+new Date(r.createdAt).toLocaleString(),r.id);selection.value=rows.has(old)?old:'';}
 function render(){
  detail.replaceChildren();const r=rows.get(selection.value);
  if(!r||freshId!==r.id){detail.append(el('p','Read the selected report before recording a review.'));controls();return;}
  const context={available:'The target existed at this read. Use the existing member view to inspect content your account can access.',removed:'The target was removed.',unavailable:'The target is unavailable. This is not proof that it never existed.'};
  detail.append(el('h3',kinds[r.kind]+' report'),el('p',context[r.contextState]));
  if(r.targetTitle!==null)detail.append(el('h4',r.targetTitle),el('p',r.targetSummary));
  if(r.kind==='challenge')detail.append(el('p','Private challenge text is not included. Existing participant access is required to inspect its details.'));
  detail.append(el('p',labels[r.disposition]),
   el('p','Received '+new Date(r.createdAt).toLocaleString()+' (your device time).'),
   el('p','Expires '+new Date(r.expiresAt).toLocaleString()+' (your device time).'));
  if(r.reviewedAt)detail.append(el('p','First reviewed '+new Date(r.reviewedAt).toLocaleString()+' (your device time).'));
  controls();
 }
 function apply(value){const r=reportReviewRecord(value);if(!r.contextLoaded||Date.parse(r.expiresAt)<=Date.now())throw Error('expired');rows.set(r.id,r);choices();selection.value=r.id;freshId=r.id;disposition.value=r.disposition==='unreviewed'?'no_action':r.disposition;checked.checked=false;render();detail.focus();return r;}
 async function run(work){
  if(disposed||busy)return;busy=true;const turn=epoch,c=new AbortController();active=c;controls();
  const check=()=>{if(disposed||epoch!==turn||c.signal.aborted)throw Error('closed');};
  try{await work(check,c.signal);}
  catch{if(!disposed&&epoch===turn){if(pending){unknown=pending;pending=undefined;say('Review not confirmed. Check the saved result before deciding again. No automatic retry will start.');}else say('The read could not be confirmed. The queue may be unavailable; this does not mean it is empty.');}}
  finally{if(!disposed&&epoch===turn){busy=false;active=undefined;controls();if(unknown)nodes.check.focus();}}
 }
 function freshRead(){rows.clear();cursor=freshId=null;checked.checked=false;choices();render();}
 const loadQueue=()=>run(async(check,signal)=>{freshRead();const page=reportReviewPage(await client.list({after:null,limit:5},{signal}));check();for(const r of page.items)if(Date.parse(r.expiresAt)>Date.now())rows.set(r.id,r);cursor=page.next;choices();render();say(rows.size?'Reports read. Choose a report to read its current state.':'No unexpired reports were returned by this successful read.');});
 listen(load,'click',()=>{if(!unknown)return loadQueue();});
 listen(more,'click',()=>run(async(check,signal)=>{const page=reportReviewPage(await client.list({after:cursor,limit:5},{signal}),{after:cursor,limit:5});check();for(const r of page.items)if(rows.size<256&&Date.parse(r.expiresAt)>Date.now())rows.set(r.id,r);cursor=rows.size>=256?null:page.next;choices();render();say('The next page was read.');}));
 listen(selection,'change',()=>{freshId=null;checked.checked=false;render();});
 listen(nodes.read,'click',()=>run(async(check,signal)=>{const id=selection.value;freshId=null;checked.checked=false;render();const r=await client.read(id,{signal});check();if(r?.id!==id)throw Error('mismatch');apply(r);say('Report read. Review does not remove its target.');}));
 listen(checked,'change',controls);
 listen(nodes.save,'click',()=>{
  const r=rows.get(selection.value);if(unknown||!r||freshId!==r.id||!checked.checked||busy||disposed)return;
  return run(async(check,signal)=>{const v=reportReviewCommand({id:r.id,expected:r.disposition,disposition:disposition.value});pending=v;checked.checked=false;controls();const result=await client.review(v,{signal});check();const saved=reportReviewRecord(result);if(saved.id!==v.id||saved.disposition!==v.disposition)throw Error('mismatch');apply(saved);pending=undefined;say('Review confirmed. No content or account action was taken.');});
 });
 listen(nodes.check,'click',()=>run(async(check,signal)=>{
  const previous=unknown;if(!previous)return;const value=await client.read(previous.id,{signal});check();const r=reportReviewRecord(value);if(r.id!==previous.id)throw Error('mismatch');
  apply(r);unknown=undefined;freshId=null;render();say(r.disposition===previous.disposition?'The saved review now matches your requested outcome. Nothing was resubmitted.':'The saved state differs from your requested outcome. Nothing was resubmitted. Read the report before deciding again.');
 }));
 listen(nodes.fresh,'click',()=>{if(!unknown||busy)return;unknown=undefined;pending=undefined;freshRead();say('The local uncertainty note was cleared. The earlier review was not undone or repeated. Load reports to read the current state.');load.focus();controls();});
 listen(stop,'click',()=>{if(!busy)return;epoch++;active?.abort();active=undefined;busy=false;freshId=null;checked.checked=false;if(pending){unknown=pending;pending=undefined;}render();say(unknown?'Waiting stopped. Review may have completed; check the saved result.':'Waiting stopped. Earlier reads are not current confirmation.');(unknown?nodes.check:load).focus();});
 choices();render();say('No reports have been read. Choose Load private reports when ready.');
 return Object.freeze({dispose(){if(disposed)return;disposed=true;epoch++;active?.abort();try{Promise.resolve(client.close()).catch(()=>{});}catch{}for(const off of events)off();rows.clear();pending=unknown=undefined;root.replaceChildren(title,el('p','Private review closed. Earlier reads were cleared.'));}});
}
