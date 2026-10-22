import {validMint, safeWebsite} from './fed-alliance-registry.mjs';

// Reviewed local activities. No clicks, plans or checkboxes are completion evidence.
export const ACTIVITIES = Object.freeze([
  {id:'first-mission', title:'Make your first money decision', role:'explore', minutes:5, kind:'FICTIONAL MISSION',
    summary:'Help Sera repair the shuttle. Talk through the trade-off before making your choice.',
    href:'/journey/repair-the-shuttle', link:'Play Repair the Shuttle',
    steps:['Play the fictional spending scenario.', 'Explain the choice you made and what you gave up.', 'Ask someone else how they would approach it.'],
    limit:'Fictional credits. Optional Passport progress stays on this device.'},
  {id:'lens-notes', title:'Read the controls behind a ticker', role:'research', minutes:8, kind:'READ-ONLY RESEARCH',
    summary:'Use Dossier Lens to separate recorded mint controls from unanswered questions.',
    href:'https://dossiertrack.co/token-structure', link:'Open Dossier Lens',
    steps:['Choose a Solana mint and start a lookup in Lens.', 'Record the source slot and one fact the report supports.', 'Write down one unknown. Keep a partial read labeled partial.'],
    limit:'A lookup can be incomplete. No safety rating, sale finding or ownership claim.'},
  {id:'lock-evidence', title:'Follow a lock back to its source', role:'research', minutes:8, kind:'PUBLISHED EVIDENCE',
    summary:'Explore the current-mint GFOF example, then distinguish a schedule from a current balance.',
    href:'https://dossiertrack.co/projects/gfof/2026-10-08', link:'Read the October 8 record',
    steps:['Open the dated GFOF record and its source links.', 'Find one scheduled allocation and its cliff date.', 'Explain why scheduled tokens, escrow balance and circulating supply are different.'],
    limit:'October 8, 2026 evidence. Opening the record does not refresh its facts.'},
  {id:'lending-lab', title:'Put a fictional loan under pressure', role:'explore', minutes:10, kind:'EDUCATIONAL SIMULATION',
    summary:'Change a fictional loan scenario and discuss how collateral and time affect it.',
    href:'/journey/lending-lab', link:'Try Lending Lab',
    steps:['Start a fictional scenario in Lending Lab.', 'Change one assumption and compare the outcome.', 'Name a risk the simulation does not establish for a real loan.'],
    limit:'No real deposits, borrowing, rewards or lending eligibility.'},
  {id:'crew-relay', title:'Bring the crew together', role:'explore', minutes:12, kind:'CO-OP DISCUSSION',
    summary:'Play The Meridian Relay and compare the reasoning behind your crew’s choices.',
    href:'/journey/meridian-relay', link:'Play The Meridian Relay',
    steps:['Open the fictional crew mission.', 'Discuss a choice before each person answers.', 'Compare the reasoning; there is no verified team score here.'],
    limit:'A shared discussion, not synchronized multiplayer or League credit.'},
  {id:'useful-guide', title:'Create something another member can use', role:'create', minutes:15, kind:'CONTRIBUTOR BRIEF',
    summary:'Outline a short guide, translation or evidence explainer using a published source.',
    href:'/research', link:'Explore published research',
    steps:['Choose one public tool or research source.', 'Draft three clear steps and include the source link and date.', 'Separate fact, interpretation and unknowns before asking for review.'],
    limit:'No automatic submission, accepted-work status or funded bounty.'},
  {id:'mobile-check', title:'Help a tool work better on a phone', role:'create', minutes:10, kind:'PRODUCT FEEDBACK',
    summary:'Try a public route and note one concrete improvement to clarity or navigation.',
    href:'/command-deck', link:'Open Command Deck',
    steps:['Choose a public dashboard flow on your own device.', 'Note the expected and observed behavior without private wallet or account data.', 'Draft one reproducible improvement for the team to review.'],
    limit:'Do not bypass browser warnings or test sign-in, signatures or financial actions.'},
  {id:'permission-pause', title:'Pause before giving permission', role:'explore', minutes:8, kind:'FICTIONAL SAFETY MISSION',
    summary:'Explore Keys to the Gate with Eno and discuss the scope of a request before deciding.',
    href:'/journey/keys-to-the-gate', link:'Play Keys to the Gate',
    steps:['Play the fictional chapter with Eno.', 'Describe what a request would allow and what remains unclear.', 'Compare the questions each crew member would ask before proceeding.'],
    limit:'Fictional scenario. No wallet connection, signature or real permission is needed.'},
  {id:'crowd-judgment', title:'Count what actually remains', role:'explore', minutes:8, kind:'FICTIONAL DECISION MISSION',
    summary:'Run a fictional stall with Kael and distinguish sales, cash paid out and unsold stock.',
    href:'/journey/after-the-crowd', link:'Play After the Crowd',
    steps:['Play the fictional chapter with Kael.', 'Compare sales received, cash paid out and the stock left over.', 'Change the demand assumption and explain why sales alone do not establish profit.'],
    limit:'Educational discussion, not a recommendation to buy, sell or hold a token.'},
  {id:'project-intro', title:'Prepare your community’s introduction', role:'connect', minutes:10, kind:'PROJECT PREPARATION',
    summary:'Use the public project worksheet to make a useful first conversation easier.',
    href:'#project-kit', link:'Open the Project Prep kit',
    steps:['Gather the public website and exact chain/mint, if applicable.', 'Choose one useful shared activity.', 'Confirm team permission and official contact channels before discussing a station.'],
    limit:'A draft brief does not approve a partner, publish a station or enroll members.'},
].map(item=>Object.freeze({...item, steps:Object.freeze(item.steps)})));

export const ROUTES = Object.freeze({
  welcome:Object.freeze({title:'Welcome relay', ids:Object.freeze(['first-mission','lending-lab','crew-relay'])}),
  evidence:Object.freeze({title:'Evidence workshop', ids:Object.freeze(['lens-notes','lock-evidence','useful-guide'])}),
  safety:Object.freeze({title:'Safety & judgment', ids:Object.freeze(['first-mission','permission-pause','crowd-judgment'])}),
  builders:Object.freeze({title:'Builder circle', ids:Object.freeze(['mobile-check','useful-guide','project-intro'])}),
});
export const PACES = Object.freeze({session:'One shared session', week:'Across one week', fortnight:'Across two weeks'});
export const PREP_CHECKS = Object.freeze({
  identity:'We know the project’s official website and contact channel.',
  consent:'An authorized team contact can discuss use of the project’s name and branding.',
  sources:'We can provide public sources for any proposed token or service claims.',
  activity:'We have one shared activity or tool use in mind.',
});
const byId = new Map(ACTIVITIES.map(activity=>[activity.id,activity]));
export function activityById(id) { return byId.get(id) || null; }
export function matchingActivities(role='all', time='all') {
  const selectedRole=['explore','research','create','connect'].includes(role) ? role : 'all';
  const ceiling=time === '10' ? 10 : time === '5' ? 5 : Infinity;
  return ACTIVITIES.filter(item=>(selectedRole === 'all' || item.role === selectedRole) && item.minutes <= ceiling);
}
export function selectActivities(ids) {
  if(!Array.isArray(ids) || ids.length > 3 || new Set(ids).size !== ids.length || ids.some(id=>!byId.has(id))) throw Error('Choose up to three different activities.');
  return ids.map(id=>byId.get(id));
}
export function updateSelection(ids, id) {
  selectActivities(ids);
  if(!byId.has(id)) throw Error('Choose an activity from the console.');
  if(ids.includes(id)) return ids.filter(value=>value !== id);
  if(ids.length === 3) return [...ids];
  return [...ids,id];
}
export function crewPlan(ids, requestedPace='session') {
  const activities=selectActivities(ids);
  const pace=Object.hasOwn(PACES,requestedPace) ? requestedPace : 'session';
  const slots=pace === 'week' ? ['Day 1','Day 3','Day 7'] : pace === 'fortnight' ? ['Day 1','Day 7','Day 14'] : ['First','Next','Then'];
  const minutes=activities.reduce((sum,item)=>sum+item.minutes,0);
  if(!activities.length) return {activities,minutes,text:''};
  const parts=['FEDERATION CREW PLAN — LOCAL DRAFT', PACES[pace], `${minutes} estimated activity minutes, plus discussion.`, ''];
  activities.forEach((item,index)=>{
    parts.push(`${slots[index]} — ${item.title}`, ...item.steps.map((step,n)=>`${n+1}. ${step}`),
      new URL(item.href,'https://galacticfederation.co/alliance').href, item.limit, '');
  });
  parts.push('HOST YOUR CREW', 'Rotate the reader, questioner and summarizer between activities. Anyone can pass; use fictional examples rather than personal finances.', 'After each activity: What did we choose? What supports it? What would change our minds?', 'Close with one useful takeaway per person and choose an optional next discussion together. Keep contributions voluntary; do not record or quote people without consent.', '', 'This is a suggested plan, not a scheduled event, competition entry or verified completion record. No membership, League points, prizes or rewards are awarded. Nothing is submitted or saved by this planner.',
    'Explore the Alliance: https://galacticfederation.co/alliance#crew-console');
  return {activities,minutes,text:parts.join('\n')};
}
export const COMPETITION_FORMATS=Object.freeze({creative:'Creative Clash',builder:'Builder Battle',research:'Research Showdown',exchange:'Community Exchange',headtohead:'Head-to-Head'});
export const COMPETITION_STARTERS=Object.freeze({
 creative:'Create one original 30-second video explaining a useful public concept, with permission for any third-party material.',
 builder:'Build a small working public tool, include a short demo and document one limitation and how another team can try it.',
 research:'Answer one agreed public research question with dated sources, a clear conclusion and explicit unanswered questions.',
 exchange:'Create one practical beginner guide or reviewed translation that another community can use, with its public sources.',
 headtohead:'Both projects create one original resource for the same agreed audience and problem, using equal entry limits and published judging criteria.'
});
export function prepareProjectBrief(fields, checks=[]) {
  const name=typeof fields?.name === 'string' ? fields.name.trim() : '';
  if(name.length < 2 || name.length > 70 || /[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069<>]/.test(name)) return {ok:false,field:'project-name',message:'Enter a public project name, 2–70 characters on one line, without hidden direction controls.'};
  const website=typeof fields.website === 'string' ? fields.website.trim() : '';
  let url;
  try { url=new URL(website); } catch {}
  if(!safeWebsite(website) || url.search || url.hash) return {ok:false,field:'project-website',message:'Use a public HTTPS website without a login, query string or fragment.'};
  const mint=typeof fields.mint === 'string' ? fields.mint.trim() : '';
  if(mint && !validMint(mint)) return {ok:false,field:'project-mint',message:'Enter the full Solana mint address, or leave it blank for the first discussion.'};
  const interests={competition:'Project-versus-project competitions',education:'Financial education and crew missions', research:'Token structure and evidence', feedback:'Product feedback and useful guides', community:'Joint community activities'};
  if(!Object.hasOwn(interests,fields.interest)) return {ok:false,field:'project-interest',message:'Choose a shared activity from the list.'};
  if(!Array.isArray(checks) || checks.length > 4 || new Set(checks).size !== checks.length || checks.some(key=>!Object.hasOwn(PREP_CHECKS,key))) return {ok:false,field:'project-prep-status',message:'Review the preparation checklist again.'};
  const competition=[];
  if(fields.interest==='competition'){
    if(!Object.hasOwn(COMPETITION_FORMATS,fields.format))return {ok:false,field:'project-format',message:'Choose one of the proposed Arena formats.'};
    const goal=typeof fields.goal==='string'?fields.goal.trim():'';
    if(goal.length<20||goal.length>240||/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069<>]/.test(goal))return {ok:false,field:'project-goal',message:'Describe what teams would make in 20–240 characters on one line, without markup or hidden direction controls.'};
    competition.push(`Proposed format: ${COMPETITION_FORMATS[fields.format]}`,`Proposed shared deliverable: ${goal}`, 'Before a match: both authorized project representatives must agree on the brief, deadline/time zone, equal entry limits, eligibility, originality/tool disclosures, judging criteria, reviewer conflicts and dispute process.', 'This is an unsent discussion proposal, not an invitation, accepted match, scheduled event or prize commitment.', '');
  }
  const text=['PROSPECTIVE ALLIANCE STATION — DISCUSSION DRAFT',`Project: ${name}`,`Public website: ${website}`,
    mint ? `Chain/mint supplied for review: Solana / ${mint}` : 'Chain/mint: not supplied; confirm before any listing.',
    `Shared interest: ${interests[fields.interest]}`, '', ...competition, 'Preparation — self-reported, not independently verified:',
    ...Object.entries(PREP_CHECKS).map(([key,label])=>`${checks.includes(key) ? '[prepared]' : '[to discuss]'} ${label}`), '',
    'Please confirm identity, team consent, public sources, station scope and any commercial terms through official channels before publication. This worksheet does not approve a partner, create an account, enroll members or grant access.',
    'No wallet keys, private contact details or account credentials belong in this brief.',
    'Alliance: https://galacticfederation.co/alliance#bring-your-project'].join('\n');
  return {ok:true,text,prepared:checks.length};
}
