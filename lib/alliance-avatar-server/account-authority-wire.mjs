// Shared authority wire validation. No network, credentials or initialization.
import {createHash} from 'node:crypto';
import {isDeepStrictEqual as same} from 'node:util';
import {accountHandoffBytes,reviewAccountHandoff} from './account-handoff.mjs';
import {controlExact as exact,controlHash as hash} from './control-policy.mjs';
const zero='0'.repeat(64),sha=b=>createHash('sha256').update(b).digest('hex');
const fail=()=>Error('alliance_account_lambda_unavailable');
function receipt(v){
 if(!exact(v,['generation','sha256'])||!Number.isSafeInteger(v.generation)||v.generation<1||v.generation>2147483646||!hash(v.sha256)||v.sha256===zero)throw fail();
 return {generation:v.generation,sha256:v.sha256};
}
function binding(v){
 if(!exact(v,['accountId','region','functionName','version'])||typeof v.accountId!=='string'||!/^\d{12}$/.test(v.accountId)||typeof v.region!=='string'||!/^us-(east|west)-[12]$/.test(v.region)||typeof v.functionName!=='string'||!/^alliance-account-authority-[a-z0-9-]{1,37}$/.test(v.functionName)||typeof v.version!=='string'||!(/^[1-9]\d{0,8}$/).test(v.version))throw fail();
 return `arn:aws:lambda:${v.region}:${v.accountId}:function:${v.functionName}:${v.version}`;
}
function policy(scope,verificationKey){
 scope=structuredClone(scope);
 accountHandoffBytes({format:1,scope,generation:1,previousSha256:zero,verificationKey,minimum:{head:{sequence:0,sha256:zero},acknowledged:{sequence:0,sha256:zero}},pending:null});
 return {scope,verificationKey};
}
function advance(input,p,wire=false){
 if(!exact(input,['expected','next','bytes','records','kind'])||!['ordinary','resolution'].includes(input.kind)||!Array.isArray(input.records)||input.records.length>256||Buffer.byteLength(JSON.stringify(input.records))>262144)throw fail();
 const expected=receipt(input.expected),next=receipt(input.next);let bytes;
 if(wire){
  if(typeof input.bytes!=='string'||input.bytes.length>5464||!(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/).test(input.bytes))throw fail();
  bytes=Buffer.from(input.bytes,'base64');if(bytes.toString('base64')!==input.bytes)throw fail();
 }else{if(!(input.bytes instanceof Uint8Array))throw fail();bytes=Buffer.from(input.bytes);}
 if(bytes.length<1||bytes.length>4096||next.generation!==expected.generation+1||sha(bytes)!==next.sha256)throw fail();
 const record=reviewAccountHandoff({bytes,expectedSha256:next.sha256,expectedScope:p.scope,expectedVerificationKey:p.verificationKey,minimumGeneration:next.generation});
 if(record.generation!==next.generation||record.previousSha256!==expected.sha256)throw fail();
 return {expected,next,bytes,records:structuredClone(input.records),kind:input.kind};
}
function result(v,write,next){
 if(exact(v,['generation','sha256'])&&!write)return receipt(v);
 if(exact(v,['state'])&&['unavailable','cancelled','busy',...(write?['invalid','unknown']:[])].includes(v.state))return {state:v.state};
 if(write&&exact(v,['state','receipt'])&&['committed','conflict'].includes(v.state)){
  const r=receipt(v.receipt);if(v.state==='committed'&&!same(r,next))throw fail();return {state:v.state,receipt:r};
 }
 throw fail();
}
function parsed(bytes,max){
 if(!(bytes instanceof Uint8Array)||bytes.byteLength<1||bytes.byteLength>max)throw fail();
 return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
}

export {receipt as authorityReceipt,binding as authorityArn,policy as authorityPolicy,advance as authorityAdvance,result as authorityResult,parsed as authorityParsed};
export const AUTHORITY_MAX_BYTES=274432;
