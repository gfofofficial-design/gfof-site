export const TOOL_PAGE_SCOPE='public_tool_page_delivery';
export const TOOL_PAGE_TARGETS=Object.freeze([
 {id:'command-deck',site:'command',url:'https://galacticfederation.co/command-deck',title:'Command Deck · Galactic Federation'},
 {id:'alliance',site:'command',url:'https://galacticfederation.co/alliance',title:'Federation Alliance · Communities, Connected'},
 {id:'journey',site:'command',url:'https://galacticfederation.co/journey/',title:'First Contact · Galactic Federation'},
 {id:'staking',site:'command',url:'https://galacticfederation.co/staking',title:'GFOF Staking Preparation · Galactic Federation of Finance'},
 {id:'building',site:'command',url:'https://galacticfederation.co/building',title:"What We're Building — Galactic Federation"},
 {id:'treasury',site:'command',url:'https://galacticfederation.co/treasury',title:'Transparency Report — $GFOF Galactic Federation of Finance'},
 {id:'lens',site:'dossier',url:'https://dossiertrack.co/token-structure',title:'Token Structure Lens — Dossier Solana Beta'}
].map(target=>Object.freeze(target)));
const REASONS=['ok','unavailable','unexpected_status','unexpected_content_type','missing_body','response_too_large','unexpected_encoding','page_identity_missing','timeout'];
const CONTENT_REASONS=['unexpected_content_type','missing_body','response_too_large','unexpected_encoding','page_identity_missing'];
const ACTIONS={
 unavailable:['P1','Investigate an unavailable tool-page check','Inspect route, deployment and network evidence; repeat the finite check before proposing a repair.'],
 timeout:['P1','Investigate a timed-out tool-page check','Inspect route, deployment and network evidence; do not infer the cause from the timeout.'],
 unexpected_status:['P1','Investigate tool-page delivery','Compare the HTTP status and route with the published deployment.'],
 unexpected_content_type:['P1','Investigate the tool-page response type','Compare the public route with the expected HTML page.'],
 missing_body:['P1','Investigate an incomplete tool page','Inspect the deployed route and its response before proposing a repair.'],
 unexpected_encoding:['P1','Investigate the tool-page encoding','Compare the delivered response with the reviewed UTF-8 page source.'],
 page_identity_missing:['P1','Investigate the tool-page identity','Compare the delivered route and title with the reviewed page; HTTP 200 alone is insufficient.'],
 response_too_large:['P2','Review the tool-page size limit','Inspect the response size before considering a reviewed limit change.']
};
export function buildToolPageBrief(check,{now=Date.now(),maxAgeMs=900000}={}){
 const fail=()=>{throw Error('Invalid tool-page evidence');};
 if(!Number.isSafeInteger(now)||now<0||!Number.isInteger(maxAgeMs)||maxAgeMs<1||maxAgeMs>900000||
  !check||check.schema!==1||check.scope!==TOOL_PAGE_SCOPE||check.securityVerdict!=='not_assessed'||check.accountAcceptance!=='not_assessed'||
  typeof check.checkedAt!=='string'||!Array.isArray(check.results)||check.results.length!==TOOL_PAGE_TARGETS.length)fail();
 const at=Date.parse(check.checkedAt);if(!Number.isFinite(at)||new Date(at).toISOString()!==check.checkedAt||at>now)fail();
 const seen=new Set(),checks=[];
 for(const row of check.results){
  const target=TOOL_PAGE_TARGETS.find(t=>t.id===row?.id);
  if(!target||seen.has(row.id)||row.site!==target.site||row.url!==target.url||!REASONS.includes(row.reason)||
   !(row.status===null||(Number.isInteger(row.status)&&row.status>=100&&row.status<=599))||
   typeof row.titleMatches!=='boolean'||row.healthy!==(row.reason==='ok'))fail();
  if((row.reason==='ok'&&(row.status!==200||!row.titleMatches))||
   (row.reason!=='ok'&&row.titleMatches)||
   (CONTENT_REASONS.includes(row.reason)&&row.status!==200)||
   (row.reason==='unexpected_status'&&(row.status===null||row.status===200)))fail();
  seen.add(row.id);
  checks.push({id:target.id,site:target.site,url:target.url,status:row.status,titleMatches:row.titleMatches,reason:row.reason,healthy:row.healthy});
 }
 if(check.healthy!==checks.every(row=>row.healthy))fail();
 const fresh=now-at<=maxAgeMs;
 const repairs=fresh?checks.filter(row=>!row.healthy).map(row=>{
  const [priority,title,nextStep]=ACTIONS[row.reason];
  return {site:row.site,tool:row.id,priority,title,nextStep,evidence:{url:row.url,checkedAt:check.checkedAt,status:row.status,reason:row.reason}};
 }).sort((a,b)=>a.priority.localeCompare(b.priority)||a.tool.localeCompare(b.tool)):[];
 return {schema:1,method:'reviewed_tool_page_rules',scope:TOOL_PAGE_SCOPE,checkedAt:check.checkedAt,
  evidenceStatus:'supplied_check_not_authenticated',status:fresh?(check.healthy?'checked_tool_pages_ok':'attention_needed'):'stale_check',checks,repairs,
  nextStep:fresh?'Review any listed route evidence before proposing changes.':'Run the finite tool-page check again; this evidence is stale.',
  limitations:[
   'Only seven fixed public HTML destinations, their response type and expected title were checked.',
   'A matching title is a delivery marker, not full-file integrity, browser rendering or a security verdict.',
   'Scripts, APIs, Google sign-in, balances, prices, transactions and financial readiness were not tested.',
   'Staking and lending pages describe preparation or development; successful delivery does not make those services live.',
   'No repair, deployment, schedule or notification is performed.'
  ]};
}
