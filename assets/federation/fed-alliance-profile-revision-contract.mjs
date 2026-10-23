// Public revision DTOs only; no session, operator receipt or database authority.
import {profileRecord,validateProfileInput,ownProfile} from './fed-alliance-profile-contract.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const zero='00000000-0000-0000-0000-000000000000';
const exact=(v,keys)=>profileRecord(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const revision=v=>Number.isSafeInteger(v)&&v>=0;
const operation=v=>typeof v==='string'&&UUID.test(v)&&v!==zero;
const fail=()=>Error('profile_revision_unavailable');
export function profileRevisionRequest(v){
 if(!exact(v,['operationId','revision','profile'])||!operation(v.operationId)||!revision(v.revision)||v.revision===Number.MAX_SAFE_INTEGER)throw fail();
 return {operationId:v.operationId,revision:v.revision,profile:validateProfileInput(v.profile)};
}
export function profileRevisionSnapshot(v){
 if(!exact(v,['profile','revision'])||!revision(v.revision))throw fail();
 const profile=ownProfile(v.profile);if((profile===null)!==(v.revision===0))throw fail();
 return {profile,revision:v.revision};
}
export function profileRevisionResult(v){
 if(exact(v,['state','revision'])&&v.state==='conflict'&&revision(v.revision))return {state:'conflict',revision:v.revision};
 if(!exact(v,['state','revision','operationId','profile'])||!['saved','replayed'].includes(v.state)||!operation(v.operationId)||!revision(v.revision)||v.revision===0)throw fail();
 const profile=ownProfile(v.profile);if(!profile)throw fail();
 return {state:v.state,revision:v.revision,operationId:v.operationId,profile};
}
