// A deliberately isolated, in-memory product preview. These checks are not
// authentication, database authorization, moderation or a public scoring service.
export const CHALLENGE_KITS = Object.freeze([
  {id:'explain',title:'Explain the signal',category:'Create',unit:'sourced explainers',singular:'sourced explainer',goal:3,brief:'Make a short, useful explanation of a financial or on-chain concept. Cite the source and name what remains uncertain.'},
  {id:'feedback',title:'Find the friction',category:'Improve',unit:'actionable feedback notes',singular:'actionable feedback note',goal:5,brief:'Try a public tool. Record the route, device, expected behavior and one specific improvement. Do not include account details.'},
  {id:'translate',title:'Translate the bridge',category:'Create',unit:'reviewed translations',singular:'reviewed translation',goal:2,brief:'Translate a useful public guide, keep its source and date, and ask a speaker of that language to review the meaning.'},
  {id:'research',title:'Evidence sprint',category:'Investigate',unit:'source-backed research notes',singular:'source-backed research note',goal:3,brief:'Follow a public claim back to its source. Separate observation, interpretation and unanswered questions.'},
  {id:'roundtable',title:'Bring the minds together',category:'Connect',unit:'discussion summaries',singular:'discussion summary',goal:1,brief:'Host a community discussion and share a useful summary. Get consent before quoting anyone; attendance is not proof of membership.'},
  {id:'prototype',title:'Build something useful',category:'Build',unit:'working demonstrations',singular:'working demonstration',goal:1,brief:'Make a small tool, guide or prototype another community member can try. Explain its limits and collect feedback.'},
].map(Object.freeze));
export const PROFILE_ROLES=Object.freeze({explorer:'Explorer',builder:'Builder',researcher:'Researcher',connector:'Community connector'});
export const IDEA_CATEGORIES=Object.freeze({tools:'Tools & dashboard',community:'Community',learning:'Learning',accessibility:'Accessibility',research:'Research & evidence'});
const badText=/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069<>]/u;
function text(value,min,max,multiline=false){
  if(typeof value!=='string'||badText.test(value)||(!multiline&&/[\r\n\t]/u.test(value)))throw Error('Use ordinary public text within the displayed length limits.');
  const cleaned=value.trim();if(cleaned.length<min||cleaned.length>max)throw Error('Complete the required fields within the displayed length limits.');return cleaned;
}
export function profileFields(input={}){
  if(!Object.hasOwn(PROFILE_ROLES,input.role))throw Error('Choose a contribution role.');
  if(typeof input.listed!=='boolean')throw Error('Choose whether to list this preview profile in the directory.');
  return {name:text(input.name,2,40),community:text(input.community,0,70),bio:text(input.bio,10,280,true),role:input.role,listed:input.listed};
}
export function challengeFields(input={}){
  const kit=CHALLENGE_KITS.find(x=>x.id===input.kit);
  if(!kit||!['members','communities'].includes(input.scope))throw Error('Choose a challenge template and format.');
  if(![3,7,14,30].includes(input.days)||!Number.isSafeInteger(input.goal)||input.goal<1||input.goal>20)throw Error('Choose 3–30 days and a whole-number goal from 1 to 20.');
  return {kit:kit.id,scope:input.scope,days:input.days,goal:input.goal,note:text(input.note,0,400,true)};
}
export function ideaFields(input={}){
  if(!Object.hasOwn(IDEA_CATEGORIES,input.category))throw Error('Choose an idea category.');
  return {title:text(input.title,5,80),category:input.category,detail:text(input.detail,15,600,true)};
}
export function matchingKits(category='all'){return CHALLENGE_KITS.filter(x=>category==='all'||x.category===category);}
export function kitGoalLabel(kit,count){return count+' '+(count===1?kit.singular:kit.unit);}
export function createCommunitySandbox(){
  let next=0;const members=new Map(),challenges=new Map(),ideas=new Map(),blocks=new Map(),reports=new Set();
  const id=prefix=>prefix+'-'+(++next);
  const member=key=>{const found=members.get(key);if(!found)throw Error('Create a preview profile first.');return found;};
  const blocked=(a,b)=>blocks.get(a)?.has(b)||blocks.get(b)?.has(a);
  const copy=value=>structuredClone(value);
  function visible(actor,owner){return !actor||actor===owner||!blocked(actor,owner);}
  function challenge(key){const found=challenges.get(key);if(!found)throw Error('This preview challenge is unavailable.');return found;}
  function participant(actor,c){member(actor);if(![c.from,c.to].includes(actor)||blocked(c.from,c.to))throw Error('Only unblocked participants can use this challenge.');}
  return {
    createMember(input,{example=false}={}){
      if(members.size>=12)throw Error('This preview holds up to 12 profiles. Reset it to start again.');
      const m={id:id('member'),...profileFields(input),example:example===true};members.set(m.id,m);return copy(m);
    },
    updateMember(actor,target,input){member(actor);const m=member(target);if(actor!==target)throw Error('You can edit only your own preview profile.');Object.assign(m,profileFields(input));return copy(m);},
    getMember(key){return copy(member(key));},
    directory(actor,query=''){
      const q=typeof query==='string'?query.slice(0,70).trim().toLocaleLowerCase():'';
      return copy([...members.values()].filter(m=>m.listed&&visible(actor,m.id)&&(!q||(m.name+' '+m.community).toLocaleLowerCase().includes(q))));
    },
    invite(actor,target,input){
      const from=member(actor),to=member(target),fields=challengeFields(input);
      if(actor===target||blocked(actor,target)||!to.listed)throw Error('Choose another available preview member.');
      if(fields.scope==='communities'&&(!from.community||!to.community||from.community.toLocaleLowerCase()===to.community.toLocaleLowerCase()))throw Error('Community proposals need two different self-described communities.');
      if(challenges.size>=12)throw Error('This preview holds up to 12 challenges. Reset it to start again.');
      if([...challenges.values()].some(c=>c.kit===fields.kit&&['invited','active'].includes(c.status)&&[c.from,c.to].includes(actor)&&[c.from,c.to].includes(target)))throw Error('That pair already has an open invitation for this template.');
      const c={id:id('challenge'),...fields,from:actor,to:target,status:'invited',proofs:[],winner:null};challenges.set(c.id,c);return copy(c);
    },
    respond(actor,key,action){
      const c=challenge(key);participant(actor,c);
      if(c.status!=='invited'||actor!==c.to||!['accept','decline'].includes(action))throw Error('Only the invited member can accept or decline an open invitation.');
      c.status=action==='accept'?'active':'declined';return copy(c);
    },
    cancel(actor,key){const c=challenge(key);member(actor);if(actor!==c.from||c.status!=='invited')throw Error('Only the sender can cancel an unanswered invitation.');c.status='cancelled';return copy(c);},
    addProof(actor,key,note){
      const c=challenge(key);participant(actor,c);if(c.status!=='active')throw Error('Accept the invitation before adding a contribution.');
      const clean=text(note,10,240,true);
      if(c.proofs.filter(p=>p.owner===actor).length>=c.goal+3)throw Error('This participant has reached the preview contribution limit.');
      if(c.proofs.some(p=>p.owner===actor&&p.note.toLocaleLowerCase()===clean.toLocaleLowerCase()))throw Error('That contribution is already in this challenge.');
      c.proofs.push({id:id('proof'),owner:actor,note:clean,status:'pending'});return copy(c);
    },
    reviewProof(actor,key,proofId,accept){
      const c=challenge(key);participant(actor,c);const p=c.proofs.find(x=>x.id===proofId);
      if(c.status!=='active'||!p||p.owner===actor||p.status!=='pending'||typeof accept!=='boolean')throw Error('Only the other participant can review a pending contribution.');
      p.status=accept?'acknowledged':'declined';
      if(c.proofs.filter(x=>x.owner===p.owner&&x.status==='acknowledged').length>=c.goal){c.status='complete';c.winner=p.owner;}
      return copy(c);
    },
    challengeList(actor){return copy([...challenges.values()].filter(c=>visible(actor,c.from)&&visible(actor,c.to)));},
    postIdea(actor,input){member(actor);if(ideas.size>=20)throw Error('This preview holds up to 20 ideas. Reset it to start again.');const item={id:id('idea'),owner:actor,...ideaFields(input),votes:[]};ideas.set(item.id,item);return copy(item);},
    vote(actor,key){member(actor);const item=ideas.get(key);if(!item||!visible(actor,item.owner))throw Error('That idea is unavailable.');if(item.owner===actor)throw Error('Support another member’s idea. Your own idea already has its author.');const at=item.votes.indexOf(actor);if(at<0)item.votes.push(actor);else item.votes.splice(at,1);return copy(item);},
    removeIdea(actor,key){const item=ideas.get(key);if(!item||item.owner!==actor)throw Error('You can remove only your own preview idea.');ideas.delete(key);},
    ideaList(actor,category='all'){return copy([...ideas.values()].filter(x=>visible(actor,x.owner)&&(category==='all'||x.category===category)).sort((a,b)=>b.votes.length-a.votes.length));},
    block(actor,target){member(actor);member(target);if(actor===target)throw Error('Choose another member.');const set=blocks.get(actor)||new Set();if(set.has(target))set.delete(target);else set.add(target);blocks.set(actor,set);},
    blockedList(actor){member(actor);return copy([...(blocks.get(actor)||[])].map(key=>member(key)));},
    report(actor,kind,key){
      member(actor);const entry=kind==='member'?members.get(key):kind==='idea'?ideas.get(key):kind==='challenge'?challenges.get(key):null;
      if(!entry)throw Error('Choose an available item to report.');
      const owner=kind==='member'?entry.id:kind==='challenge'?entry.from:entry.owner;
      if(actor===owner)throw Error('Use your own edit or remove controls for your content.');
      const reportKey=actor+':'+kind+':'+key;if(reports.has(reportKey))throw Error('You have already reported this item in the preview.');reports.add(reportKey);
      return {recorded:true,removed:false};
    },
  };
}
