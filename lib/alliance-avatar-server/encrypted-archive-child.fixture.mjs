// Byte decryption child only: no database/library/restore capability. Keys stdin.
import {execFile} from 'node:child_process';
import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {createAllianceRecoveryPackage,createAllianceCommunityRecoveryPackage,createAllianceFeedbackRecoveryPackage,createAllianceReportReviewRecoveryPackage} from './recovery-package.mjs';
let identity,opened;
try{
 if(process.env.ALLIANCE_RECOVERY_PACKAGE_TEST_CONFIRM!=='synthetic_encrypted_package')throw Error();
 let input='';for await(const chunk of process.stdin){input+=chunk;if(input.length>20000)throw Error();}const args=JSON.parse(input);input='';identity=Buffer.from(args.identity,'base64');
 const [binary,file]=process.argv.slice(2),sha=b=>createHash('sha256').update(b).digest('hex');
 if(!binary||!file||sha(readFileSync(binary))!==args.binarySha256||args.options.expectedScope.memberProjectRef!=='abcdefghijklmnopqrst'||args.options.expectedScope.journalProjectRef!=='uvwxyzabcdefghijklmn'||args.options.expectedScope.controlProjectRef!=='opqrstuvwxyzabcdefgh')throw Error();
 const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>['PATH','Path','SystemRoot','SYSTEMROOT','WINDIR','TEMP','TMP'].includes(k)));
 const decryptBytes=async(cipher,{signal})=>{
  const temporary=join(dirname(file),randomUUID()+'.age');writeFileSync(temporary,cipher,{flag:'wx',mode:0o600});
  try{return await new Promise((resolve,reject)=>{const child=execFile(binary,['--decrypt','--identity','-',temporary],{env,encoding:'buffer',timeout:12000,maxBuffer:8*1048576,signal,windowsHide:true},(error,out)=>error?reject(Error('Synthetic age child stopped')):resolve(out));child.stdin?.on('error',()=>{});child.stdin?.end(identity);});}finally{unlinkSync(temporary);}
 };
 if(args.profile!==undefined&&!['community','feedback','report-review'].includes(args.profile))throw Error();
 const p=(args.profile==='report-review'?createAllianceReportReviewRecoveryPackage:args.profile==='feedback'?createAllianceFeedbackRecoveryPackage:args.profile==='community'?createAllianceCommunityRecoveryPackage:createAllianceRecoveryPackage)({...args.options,decryptBytes});
 try{opened=await p.open({descriptor:args.descriptor,ciphertext:readFileSync(file)});if(opened.state!=='verified_bytes')throw Error();
  process.stdout.write(JSON.stringify({state:opened.state,access:opened.access,manifest:opened.manifest,components:opened.components.map(c=>({name:c.name,data:c.data.toString('base64')}))})+'\n');
 }finally{p.close();}
}catch{process.stderr.write('Synthetic archive decryption child stopped; private detail withheld.\n');process.exitCode=1;}
finally{identity?.fill(0);if(opened?.components)for(const c of opened.components)c.data.fill(0);}
