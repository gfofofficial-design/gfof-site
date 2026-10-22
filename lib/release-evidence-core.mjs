const SITES=Object.freeze({command:'e0aa8628-b13e-4ed3-a0aa-e8aff507454c',dossier:'012c79b9-9561-4503-b1f2-e8ca2a34732c'});
const REPOS={command:'gfofofficial-design/gfof-site',dossier:'gfofofficial-design/dossier-site'};
const sha=value=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value);
const time=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
export function buildReleaseFreshnessBrief(input,{now=Date.now()}={}){
 const fail=()=>{throw Error('Invalid release evidence');};
 if(!Number.isSafeInteger(now)||!input||input.schema!==1||!time(input.checkedAt)||Date.parse(input.checkedAt)>now||
  !Array.isArray(input.expected)||input.expected.length!==2||!Array.isArray(input.deploys)||input.deploys.length>2)fail();
 const expected=new Map(),deploys=new Map();
 for(const item of input.expected){
  if(!item||!Object.hasOwn(SITES,item.site)||expected.has(item.site)||item.siteId!==SITES[item.site]||!sha(item.commit))fail();
  expected.set(item.site,item.commit);
 }
 for(const item of input.deploys){
  if(!item||!Object.hasOwn(SITES,item.site)||deploys.has(item.site)||item.siteId!==SITES[item.site]||
   typeof item.deployId!=='string'||!/^[a-f0-9]{24}$/.test(item.deployId)||
   !['ready','building','error','queued','new'].includes(item.state)||
   !['production','deploy-preview','branch-deploy'].includes(item.context)||
   typeof item.branch!=='string'||item.branch.length>128||
   !(item.commit===null||sha(item.commit))||
   !(item.publishedAt===null||(time(item.publishedAt)&&Date.parse(item.publishedAt)<=Date.parse(input.checkedAt))))fail();
  deploys.set(item.site,item);
 }
 const fresh=now-Date.parse(input.checkedAt)<=900000;
 const checks=Object.keys(SITES).map(site=>{
  const d=deploys.get(site);let reason='missing_published_evidence';
  if(!fresh)reason='stale_evidence';
  else if(d){
   if(d.state!=='ready'||d.context!=='production'||d.branch!=='main'||d.publishedAt===null)reason='not_published_production';
   else if(d.commit===null)reason='commit_unavailable';
   else reason=d.commit===expected.get(site)?'matches_expected_commit':'unexpected_commit';
  }
  return {site,reason,expectedCommit:expected.get(site),observedCommit:d?.commit??null,deployId:d?.deployId??null,
   commitEvidenceUrl:d?.commit?'https://github.com/'+REPOS[site]+'/commit/'+d.commit:null};
 });
 return {schema:1,method:'reviewed_release_comparison',checkedAt:input.checkedAt,
  approvalEvidence:'operator_supplied_not_verified',deploymentEvidence:'supplied_snapshot_not_authenticated',
  status:checks.every(x=>x.reason==='matches_expected_commit')?'expected_commits_observed':'review_needed',checks,
  tasks:checks.filter(x=>x.reason!=='matches_expected_commit').map(x=>({site:x.site,priority:'P2',reason:x.reason,
   nextStep:x.reason==='stale_evidence'?'Read the currently published deploy again.':'Compare the published deploy with the recorded release approval before proposing changes.'})),
  limitations:['Only Command and Dossier release metadata are compared; FCC is not assessed.','Expected commits must come from an independently reviewed owner approval, never from observed deploy data.','A mismatch does not establish an outage, an older release or an unauthorized change.','Matching commits do not verify served files, security, Safe Browsing or sign-in.','No redeployment or account change is performed.']};
}
