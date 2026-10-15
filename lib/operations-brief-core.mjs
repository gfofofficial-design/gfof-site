const SCOPE='public_homepage_availability_and_command_deck_links';
const TARGETS={command:'https://galacticfederation.co/',dossier:'https://dossiertrack.co/',fcc:'https://fcc.galacticfederation.co/'};
const REASONS=['ok','unavailable','unexpected_status','unexpected_content_type','missing_body','response_too_large','dashboard_link_missing','timeout'];
const ACTIONS={
 dashboard_link_missing:['P2','Restore the Command Deck link','Review the homepage source for the canonical dashboard link; prepare a source change for approval.'],
 unexpected_status:['P1','Investigate homepage availability','Check the published deploy and HTTP status before proposing a repair.'],
 unavailable:['P1','Investigate an unavailable check','Repeat the finite check and inspect deployment/network evidence; do not infer a cause.'],
 timeout:['P1','Investigate a timed-out check','Repeat the finite check and inspect deployment/network evidence; do not infer a cause.'],
 unexpected_content_type:['P1','Investigate an unexpected page response','Compare the published route and response type with the reviewed homepage.'],
 missing_body:['P1','Investigate an incomplete page response','Inspect the deployed route and repeat the check before proposing a repair.'],
 response_too_large:['P2','Review the response-size limit','Inspect the published homepage size; do not increase the limit without reviewing the response.']
};
export function buildOperationsBrief(check,{now=Date.now(),maxAgeMs=900000}={}){
 const invalid=()=>{throw Error('Invalid operations evidence');};
 if(!Number.isSafeInteger(now)||!Number.isInteger(maxAgeMs)||maxAgeMs<1||maxAgeMs>900000||
  !check||check.schema!==1||check.scope!==SCOPE||check.securityVerdict!=='not_assessed'||check.accountAcceptance!=='not_assessed'||
  typeof check.checkedAt!=='string'||!Array.isArray(check.results)||check.results.length!==3)invalid();
 const at=Date.parse(check.checkedAt);if(!Number.isFinite(at)||new Date(at).toISOString()!==check.checkedAt||at>now)invalid();
 const seen=new Set();
 for(const row of check.results){
  if(!row||!Object.hasOwn(TARGETS,row.id)||seen.has(row.id)||row.url!==TARGETS[row.id]||!REASONS.includes(row.reason)||
   !(row.status===null||(Number.isInteger(row.status)&&row.status>=100&&row.status<=599))||
   typeof row.dashboardLink!=='boolean'||row.healthy!==(row.reason==='ok'))invalid();
  if((row.reason==='ok'&&(row.status!==200||!row.dashboardLink))||
   (row.reason==='dashboard_link_missing'&&(row.status!==200||row.dashboardLink))||
   (row.reason==='unexpected_status'&&(row.status===null||row.status===200)))invalid();
  seen.add(row.id);
 }
 if(check.healthy!==check.results.every(row=>row.healthy))invalid();
 const fresh=now-at<=maxAgeMs;
 const repairs=fresh?check.results.filter(row=>!row.healthy).map(row=>{
  const [priority,title,nextStep]=ACTIONS[row.reason];
  return {site:row.id,priority,title,nextStep,evidence:{url:row.url,checkedAt:check.checkedAt,status:row.status,reason:row.reason}};
 }).sort((a,b)=>a.priority.localeCompare(b.priority)||a.site.localeCompare(b.site)):[];
 return {schema:1,method:'reviewed_operations_rules',scope:SCOPE,checkedAt:check.checkedAt,
  evidenceStatus:'supplied_check_not_authenticated',status:fresh?(check.healthy?'checked_pages_ok':'attention_needed'):'stale_check',
  repairs,nextStep:fresh?'Review the listed evidence before authorizing any changes.':'Run the finite public-page check again; this evidence is stale.',
  limitations:['Only three public homepages and their Command Deck links were checked.','Security, Safe Browsing, sign-in, balances, prices, staking and lending were not assessed.','P1 means investigate availability first; it does not establish an outage cause or security incident.','No repair, deployment, account change or notification is performed.']};
}
