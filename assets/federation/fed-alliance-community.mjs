import {CHALLENGE_KITS,PROFILE_ROLES,IDEA_CATEGORIES,matchingKits,kitGoalLabel,createCommunitySandbox} from './fed-alliance-community-core.mjs';
import {createArtworkSelection} from './fed-alliance-artwork.mjs';

export function mountCommunityHub(document,options={}){
  const get=id=>document.getElementById(id);if(!get('community-hub'))return null;
  let store=createCommunitySandbox(),self='',actor='',examples=false,disposed=false;
  const listeners=[];
  const element=(tag,cls='',text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  function listen(n,event,fn){n.addEventListener(event,fn);listeners.push(()=>n.removeEventListener(event,fn));}
  function announce(message){get('hub-status').textContent=message;}
  function act(fn,message,focusId,fallbackId){if(disposed)return;try{fn();render();if(message)announce(message);if(focusId)(get(focusId)||(fallbackId&&get(fallbackId)))?.focus();}catch(error){announce(error.message);}}
  function button(text,fn,label){const n=element('button','',text);n.type='button';if(label)n.setAttribute('aria-label',label);n.addEventListener('click',event=>{if(!disposed)fn(event);});return n;}
  function empty(text){return element('p','hub-empty',text);}
  function option(value,text){const n=element('option','',text);n.value=value;return n;}
  function openPanel(key,focus=false){for(const name of ['profile','challenges','ideas']){const selected=name===key;get('hub-tab-'+name).setAttribute('aria-selected',String(selected));get('hub-tab-'+name).setAttribute('tabindex',selected?'0':'-1');get('hub-panel-'+name).hidden=!selected;}if(focus)get('hub-tab-'+key).focus();}
  function name(id){return store.getMember(id).name;}
  const artwork=createArtworkSelection({...options.artwork,update(state){
    const image=get('hub-avatar-image');image.hidden=true;image.removeAttribute('src');get('hub-avatar-mark').hidden=false;
    get('hub-image-remove').hidden=!['pending','ready'].includes(state.status);get('hub-image').removeAttribute('aria-invalid');
    if(state.status==='ready'){image.src=state.image.url;image.hidden=false;get('hub-avatar-mark').hidden=true;get('hub-image-status').textContent=state.image.name+' · '+state.image.width+' × '+state.image.height+' · selected only in this tab.';}
    else if(state.status==='pending')get('hub-image-status').textContent='Checking your image… Remove it to cancel.';
    else if(state.status==='error'){get('hub-image').value='';get('hub-image').setAttribute('aria-invalid','true');get('hub-image-status').textContent=state.message;}
    else{get('hub-image').value='';get('hub-image-status').textContent='No image selected.';}
    if(self)renderDirectory();
  }});
  function renderProfile(){
    const m=self?store.getMember(self):null;
    get('hub-card-name').textContent=m?m.name:'Your name, in the crew.';
    get('hub-card-community').textContent=m?(m.community||'Independent explorer')+' · self-described':'Your community · self-described';
    get('hub-card-bio').textContent=m?m.bio:'Tell other members what you build, study or bring to the conversation.';
    get('hub-card-role').textContent=m?PROFILE_ROLES[m.role]:'YOUR CONTRIBUTION';
    get('hub-avatar-mark').textContent=m?m.name.split(/\s+/u).slice(0,2).map(x=>Array.from(x)[0]).join('').toLocaleUpperCase():'YOU';
    get('hub-profile-save').textContent=self?'Save preview changes':'Create preview profile';
    get('hub-profile-fields').disabled=!!self&&actor!==self;
  }
  function renderSession(){
    get('hub-session').hidden=!self;
    if(!self)return;
    const all=store.directory();get('hub-actor').replaceChildren(...all.map(m=>option(m.id,m.name+(m.example?' · fictional roleplay':' · your local profile'))));get('hub-actor').value=actor;
    get('hub-return').hidden=actor===self;get('hub-examples').disabled=examples;
    get('hub-examples').textContent=examples?'Fictional crew added':'Add two fictional crew members';
  }
  function renderDirectory(){
    const rows=store.directory(actor,get('hub-member-search').value);get('hub-directory-count').textContent=rows.length?rows.length+' '+(rows.length===1?'profile':'profiles')+' in this tab’s preview, including any fictional examples.':'No matching preview profiles.';
    const cards=rows.map(m=>{
      const card=element('article','hub-member');const head=element('div','hub-member-top');const mark=element('div','hub-mini-avatar');
      if(m.id===self&&artwork.current){const img=element('img');img.src=artwork.current.url;img.alt='';mark.append(img);}else mark.textContent=m.name.split(/\s+/u).slice(0,2).map(x=>Array.from(x)[0]).join('').toLocaleUpperCase();
      const title=element('div');title.append(element('span','eyebrow',m.example?'FICTIONAL EXAMPLE':m.id===self?'YOUR LOCAL PROFILE':'PREVIEW MEMBER'),element('h4','',m.name));head.append(mark,title);
      card.append(head,element('p','hub-member-community',(m.community||'Independent explorer')+' · self-described'),element('span','hub-role',PROFILE_ROLES[m.role]),element('p','',m.bio));
      card.id='hub-member-card-'+m.id;card.setAttribute('tabindex','-1');
      if(actor&&actor!==m.id){const actions=element('div','hub-card-actions');actions.append(button('Challenge',()=>{openPanel('challenges');renderTargets(m.id);get('hub-challenge-target').focus();},'Challenge '+m.name),button('Hide member',()=>act(()=>store.block(actor,m.id),'Member hidden for this preview identity. Invitations between these identities are blocked.','hub-member-search'),'Hide '+m.name+' in this preview'),button('Report',()=>act(()=>store.report(actor,'member',m.id),'Report recorded only in this preview. No content was removed and nothing was sent.',card.id),'Report profile for '+m.name));card.append(actions);}
      return card;
    });get('hub-members').replaceChildren(...(cards.length?cards:[empty(self?'No profiles match. Clear the search or check your hidden members.':'The public member directory is not open. Create a local profile to try it, then add fictional crew to test invitations.')]));
    const hidden=actor?store.blockedList(actor):[];get('hub-blocks').hidden=!hidden.length;get('hub-blocks').replaceChildren(...hidden.map(m=>button('Show '+m.name,()=>act(()=>store.block(actor,m.id),'Member shown again in this preview.','hub-member-card-'+m.id,'hub-member-search'))));
  }
  function kitChanged(){const kit=CHALLENGE_KITS.find(k=>k.id===get('hub-challenge-kit').value)||CHALLENGE_KITS[0];get('hub-challenge-goal').value=String(kit.goal);get('hub-challenge-unit').textContent='Count '+kit.unit+'. '+kit.brief;}
  function renderKits(){const kits=matchingKits(get('hub-kit-filter').value);get('hub-kits').replaceChildren(...kits.map(k=>{const card=element('article','hub-kit');card.append(element('span','eyebrow',k.category+' // CHALLENGE TEMPLATE'),element('h4','',k.title),element('p','',k.brief),element('p','small','Suggested goal: '+kitGoalLabel(k,k.goal)),button('Use this template',()=>{get('hub-challenge-kit').value=k.id;kitChanged();get('hub-challenge-target').focus();},'Use '+k.title+' challenge template'));return card;}));}
  function renderTargets(preferred){
    const old=preferred||get('hub-challenge-target').value;const targets=store.directory(actor).filter(m=>m.id!==actor);
    get('hub-challenge-target').replaceChildren(...(targets.length?targets.map(m=>option(m.id,m.name+(m.community?' · '+m.community:''))):[option('','Add fictional crew to try an invitation')]));
    if(targets.some(m=>m.id===old))get('hub-challenge-target').value=old;
    get('hub-challenge-fields').disabled=!actor||!targets.length;
    get('hub-idea-fields').disabled=!actor;
    const status=get('hub-challenge-status');
    if(!actor)status.textContent='Create a preview profile to try an invitation.';
    else if(!targets.length)status.textContent='Add fictional crew, or unhide another preview member, to try an invitation.';
    else if(/^(Create a|Add fictional)/.test(status.textContent))status.textContent='Choose a template and a member. An invitation needs their acceptance in this preview.';
  }
  function progress(c,owner){const count=c.proofs.filter(p=>p.owner===owner&&p.status==='acknowledged').length;const box=element('div','hub-score');box.append(element('strong','',name(owner)),element('span','',count+' / '+c.goal+' acknowledged'));const meter=element('progress');meter.max=c.goal;meter.value=count;meter.setAttribute('aria-label',name(owner)+' preview acknowledged contributions');box.append(meter);return box;}
  function renderChallenges(){
    const filter=get('hub-challenge-filter').value;const rows=store.challengeList(actor).filter(c=>filter==='all'||c.status===filter).reverse();
    get('hub-challenges').replaceChildren(...(rows.length?rows.map(c=>{
      const kit=CHALLENGE_KITS.find(k=>k.id===c.kit),card=element('article','hub-challenge');card.dataset.status=c.status;card.id='hub-challenge-card-'+c.id;card.setAttribute('tabindex','-1');
      const top=element('div','hub-match-top');top.append(element('span','eyebrow',c.status.toLocaleUpperCase()+' // LOCAL PREVIEW'),element('span','small',c.days+'-day plan · clock not running'));card.append(top,element('h4','',kit.title));
      card.append(element('p','hub-versus',name(c.from)+'  /  '+name(c.to)),element('p','',kitGoalLabel(kit,c.goal)+' per participant.'));
      if(c.scope==='communities')card.append(element('p','hub-help','Cross-community proposal: '+(store.getMember(c.from).community)+' / '+(store.getMember(c.to).community)+'. Personal invitations; no official project agreement.'));
      if(c.note)card.append(element('p','',c.note));
      const scores=element('div','hub-scores');scores.append(progress(c,c.from),progress(c,c.to));card.append(scores);
      const actions=element('div','hub-card-actions');
      if(c.status==='invited'&&actor===c.to)actions.append(button('Accept invitation',()=>act(()=>store.respond(actor,c.id,'accept'),'Invitation accepted in this preview. No real event or deadline was created.',card.id,'hub-challenge-filter')),button('Decline invitation',()=>act(()=>store.respond(actor,c.id,'decline'),'Preview invitation declined.',card.id,'hub-challenge-filter')));
      if(c.status==='invited'&&actor===c.from)actions.append(button('Cancel invitation',()=>act(()=>store.cancel(actor,c.id),'Preview invitation cancelled.',card.id,'hub-challenge-filter')));
      if(c.status==='invited')card.append(element('p','hub-help','Only the invited member can accept. In this preview, change the fictional identity selector to try their response.'));
      if(c.status==='active'&&[c.from,c.to].includes(actor)){
        const form=element('form','hub-proof-form'),label=element('label','','Describe one contribution · 10–240 characters'),area=element('textarea');const areaId='hub-proof-'+c.id;area.id=areaId;area.maxLength=240;area.rows=2;label.setAttribute('for',areaId);form.append(label,area);const submit=element('button','','Add contribution to preview');submit.type='submit';form.append(submit);form.addEventListener('submit',e=>{e.preventDefault();act(()=>store.addProof(actor,c.id,area.value),'Contribution added. The other participant can acknowledge it in this preview.',areaId);});card.append(form);
      }
      if(c.proofs.length){const list=element('ul','hub-proofs');for(const p of c.proofs){const li=element('li');li.append(element('strong','',name(p.owner)+' · '+p.status),element('p','',p.note));if(c.status==='active'&&[c.from,c.to].includes(actor)&&actor!==p.owner&&p.status==='pending')li.append(button('Acknowledge',()=>act(()=>store.reviewProof(actor,c.id,p.id,true),'Contribution acknowledged by the other preview participant.',card.id,'hub-challenge-filter')),button('Decline contribution',()=>act(()=>store.reviewProof(actor,c.id,p.id,false),'Contribution declined in this preview.',card.id,'hub-challenge-filter')));list.append(li);}card.append(list);}
      if(c.winner)card.append(element('p','hub-goal-reached','Preview goal reached by '+name(c.winner)+'. No public result or reward was created.'));
      if(actor&&actor!==c.from)actions.append(button('Report challenge',()=>act(()=>store.report(actor,'challenge',c.id),'Challenge report recorded only in this preview. Nothing was sent.',card.id)));
      card.append(actions,element('p','hub-help','Peer acknowledgement, not independent verification. No League points or financial rewards.'));return card;
    }):[empty('No matching preview challenges. Create an invitation above; no real challenge is published.')]));
  }
  function renderIdeas(){
    const rows=store.ideaList(actor,get('hub-idea-filter').value);
    get('hub-ideas').replaceChildren(...(rows.length?rows.map(item=>{
      const card=element('article','hub-idea');card.id='hub-idea-card-'+item.id;card.setAttribute('tabindex','-1');card.append(element('span','eyebrow',IDEA_CATEGORIES[item.category]+' // PREVIEW IDEA'),element('h4','',item.title),element('p','',item.detail),element('p','small','By '+name(item.owner)+' · Preview reference '+item.id));
      const actions=element('div','hub-card-actions');const vote=button((item.votes.includes(actor)?'Remove support':'Support idea')+' · '+item.votes.length,()=>act(()=>store.vote(actor,item.id),'Preview support updated. One vote per preview identity; no public vote was recorded.','hub-vote-'+item.id));vote.id='hub-vote-'+item.id;vote.disabled=!actor||actor===item.owner;vote.setAttribute('aria-pressed',String(item.votes.includes(actor)));actions.append(vote);
      if(actor===item.owner)actions.append(button('Remove my idea',()=>act(()=>store.removeIdea(actor,item.id),'Your idea was removed from this preview.','hub-ideas-title')));
      else if(actor)actions.append(button('Report idea',()=>act(()=>store.report(actor,'idea',item.id),'Idea report recorded only in this preview. Nothing was sent.',card.id)));
      card.append(actions);return card;
    }):[empty('No matching preview ideas. Create a profile, then post an idea above to try the exchange.')]));
  }
  function render(){renderProfile();renderSession();renderDirectory();renderTargets();renderChallenges();renderIdeas();}
  const tabs=['profile','challenges','ideas'];
  for(const [index,key]of tabs.entries()){
    listen(get('hub-tab-'+key),'click',()=>openPanel(key));
    listen(get('hub-tab-'+key),'keydown',event=>{let next;if(event.key==='ArrowRight')next=(index+1)%3;else if(event.key==='ArrowLeft')next=(index+2)%3;else if(event.key==='Home')next=0;else if(event.key==='End')next=2;else return;event.preventDefault();openPanel(tabs[next],true);});
  }
  listen(get('hub-profile-form'),'submit',event=>{event.preventDefault();if(artwork.pending){get('hub-profile-status').textContent='Finish checking the image, or remove it to continue.';return;}try{
    if(self&&actor!==self)throw Error('Return to your own preview identity to edit this profile.');
    const fields={name:get('hub-name').value,community:get('hub-community').value,bio:get('hub-bio').value,role:get('hub-role').value,listed:get('hub-listed').checked};
    if(self)store.updateMember(actor,self,fields);else{const m=store.createMember(fields);self=m.id;actor=self;}
    get('hub-profile-status').textContent='Your profile is ready in this tab. No manual approval, message or real membership was created.';render();announce('Profile saved in the preview. Add fictional crew to try challenges and suggestions.');
  }catch(error){get('hub-profile-status').textContent=error.message;}});
  listen(get('hub-image'),'change',()=>artwork.select(get('hub-image').files?.[0]));listen(get('hub-image-remove'),'click',()=>{artwork.clear();get('hub-image').focus();});
  listen(get('hub-examples'),'click',()=>act(()=>{if(!self)throw Error('Create your preview profile first.');if(examples)return;store.createMember({name:'Nova · example',community:'Ion Guild · fictional',bio:'A fictional builder for trying invitations and peer acknowledgements.',role:'builder',listed:true},{example:true});store.createMember({name:'Echo · example',community:'Orbit Circle · fictional',bio:'A fictional researcher for trying ideas, support and community proposals.',role:'researcher',listed:true},{example:true});examples=true;},'Two fictional crew members added. They are not people, partners or public members.'));
  listen(get('hub-actor'),'change',()=>{actor=get('hub-actor').value;render();announce('Preview identity changed. This is roleplay, not a real sign-in.');});
  listen(get('hub-return'),'click',()=>{actor=self;render();openPanel('profile',true);announce('Returned to your own local preview profile.');});
  listen(get('hub-member-search'),'input',renderDirectory);listen(get('hub-kit-filter'),'change',renderKits);listen(get('hub-challenge-kit'),'change',kitChanged);
  listen(get('hub-challenge-form'),'submit',event=>{event.preventDefault();try{store.invite(actor,get('hub-challenge-target').value,{kit:get('hub-challenge-kit').value,scope:get('hub-challenge-scope').value,days:Number(get('hub-challenge-days').value),goal:Number(get('hub-challenge-goal').value),note:get('hub-challenge-note').value});get('hub-challenge-status').textContent='Preview invitation created. Switch to the invited fictional identity to accept or decline. Nothing was sent.';render();}catch(error){get('hub-challenge-status').textContent=error.message;}});
  listen(get('hub-challenge-filter'),'change',renderChallenges);
  listen(get('hub-idea-form'),'submit',event=>{event.preventDefault();try{store.postIdea(actor,{title:get('hub-idea-title').value,category:get('hub-idea-category').value,detail:get('hub-idea-detail').value});get('hub-idea-title').value='';get('hub-idea-detail').value='';get('hub-idea-status').textContent='Idea posted only to this preview board. No email, Telegram message or public suggestion was sent.';renderIdeas();}catch(error){get('hub-idea-status').textContent=error.message;}});
  listen(get('hub-idea-filter'),'change',renderIdeas);
  listen(get('hub-reset'),'click',()=>{artwork.clear();store=createCommunitySandbox();self='';actor='';examples=false;for(const id of ['hub-name','hub-community','hub-bio','hub-member-search','hub-challenge-note','hub-idea-title','hub-idea-detail'])get(id).value='';get('hub-listed').checked=false;get('hub-role').value='explorer';get('hub-challenge-kit').value='explain';get('hub-challenge-scope').value='members';get('hub-challenge-days').value='7';get('hub-challenge-filter').value='all';get('hub-idea-category').value='tools';get('hub-idea-filter').value='all';get('hub-kit-filter').value='all';kitChanged();renderKits();render();openPanel('profile',true);get('hub-profile-status').textContent='Preview reset. No public profile or post was deleted, because none was created.';get('hub-challenge-status').textContent='Create a profile and add fictional crew to try an invitation.';get('hub-idea-status').textContent='Preview ideas stay in this tab; they are not delivered to the team.';announce('The local preview was cleared.');});
  get('hub-challenge-kit').replaceChildren(...CHALLENGE_KITS.map(k=>option(k.id,k.title)));get('hub-challenge-kit').value='explain';kitChanged();renderKits();render();get('hub-reset').disabled=false;
  announce('The self-service preview is ready. No real account, upload, public post or message is created here.');
  return {getState:()=>({self,actor,members:store.directory(),challenges:store.challengeList(actor),ideas:store.ideaList(actor)}),dispose(){disposed=true;artwork.dispose();for(const remove of listeners)remove();for(const id of ['hub-profile-fields','hub-challenge-fields','hub-idea-fields'])get(id).disabled=true;}};
}
if(typeof document!=='undefined'){try{mountCommunityHub(document);}catch{const status=document.getElementById('hub-status');if(status)status.textContent='The member preview is unavailable. Public station links still work; nothing has been submitted.';}}

