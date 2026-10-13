import {pathToFileURL} from 'node:url';
import {checkFederationPages} from './check-federation-pages.mjs';
import {buildOperationsBrief} from '../lib/operations-brief-core.mjs';
export async function runOperationsBrief({checker=checkFederationPages,now=Date.now}={}){
 if(typeof checker!=='function'||typeof now!=='function')throw Error('Invalid operations configuration');
 return buildOperationsBrief(await checker(),{now:now()});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==2){process.stderr.write('Usage: node scripts/federation-operations-brief.mjs\n');process.exitCode=2;}
 else try{const brief=await runOperationsBrief();process.stdout.write(JSON.stringify(brief,null,2)+'\n');process.exitCode=brief.status==='checked_pages_ok'?0:1;}
 catch{process.stderr.write('Operations evidence unavailable or invalid.\n');process.exitCode=2;}
}
