import {pathToFileURL} from 'node:url';
import {checkFederationPages} from './check-federation-pages.mjs';
import {buildOperationsBrief} from '../lib/operations-brief-core.mjs';
import {buildReleaseFreshnessBrief} from '../lib/release-evidence-core.mjs';

export async function runOperationsReport(releaseInput,{checker=checkFederationPages,now=Date.now}={}){
 if(typeof checker!=='function'||typeof now!=='function')throw Error('Invalid operations configuration');
 // Validate supplied bindings before any public-page request; never derive approval from deployment data.
 const evidence=structuredClone(releaseInput);
 buildReleaseFreshnessBrief(evidence,{now:now()});
 const check=await checker();const completedAt=now();
 const pages=buildOperationsBrief(check,{now:completedAt});
 const releases=buildReleaseFreshnessBrief(evidence,{now:completedAt});
 const tasks=[...pages.repairs.map(task=>({...task,source:'public_page_check'})),
  ...releases.tasks.map(task=>({...task,source:'release_comparison'}))];
 if(pages.status==='stale_check')tasks.push({source:'public_page_check',priority:'P2',reason:'stale_check',nextStep:pages.nextStep});
 tasks.sort((a,b)=>a.priority.localeCompare(b.priority)||String(a.site||'').localeCompare(String(b.site||''))||a.source.localeCompare(b.source));
 return {schema:1,method:'manual_federation_operations_report',completedAt:new Date(completedAt).toISOString(),
  status:pages.status==='checked_pages_ok'&&releases.status==='expected_commits_observed'?'checked_scope_ok':'review_needed',
  pages,releases,tasks,limitations:[
   'This report covers three public homepages/dashboard links and Command/Dossier release metadata only.',
   'Operator-supplied approvals and deployment snapshots are not authenticated by this report.',
   'A passing report does not establish security, Safe Browsing, sign-in, financial features or monitoring coverage.',
   'One finite public-page check is made; no provider RPC, credential access, repair, deployment, schedule or notification occurs.']};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==2){process.stderr.write('Usage: node scripts/federation-operations-report.mjs < reviewed-public-evidence.json\n');process.exitCode=2;}
 else try{
  const chunks=[];let bytes=0;
  for await(const chunk of process.stdin){bytes+=chunk.length;if(bytes>32768)throw Error('limit');chunks.push(chunk);}
  const input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));
  const result=await runOperationsReport(input);process.stdout.write(JSON.stringify(result,null,2)+'\n');
  process.exitCode=result.status==='checked_scope_ok'?0:1;
 }catch{process.stderr.write('Operations report evidence unavailable or invalid.\n');process.exitCode=2;}
}
