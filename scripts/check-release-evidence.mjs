import {pathToFileURL} from 'node:url';
import {buildReleaseFreshnessBrief} from '../lib/release-evidence-core.mjs';
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==2){process.stderr.write('Usage: node scripts/check-release-evidence.mjs < reviewed-public-evidence.json\n');process.exitCode=2;}
 else try{
  const chunks=[];let bytes=0;
  for await(const chunk of process.stdin){bytes+=chunk.length;if(bytes>32768)throw Error('limit');chunks.push(chunk);}
  const input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));
  const brief=buildReleaseFreshnessBrief(input);process.stdout.write(JSON.stringify(brief,null,2)+'\n');
  process.exitCode=brief.status==='expected_commits_observed'?0:1;
 }catch{process.stderr.write('Release evidence unavailable or invalid.\n');process.exitCode=2;}
}
