const ACTIONS=new Set(['read_public','summarize','notify','sign_transaction','change_cloud','delete_user']);
export function inspectAgentRecord(record){
 if(!record||record.schema!==1||typeof record.agentId!=='string'||!/^[-a-zA-Z0-9_]{1,64}$/.test(record.agentId)||
   !Array.isArray(record.permissions)||record.permissions.length>20||!Array.isArray(record.attempts)||record.attempts.length>100)throw Error('Invalid bounded record');
 const validResource=v=>typeof v==='string'&&/^[-a-zA-Z0-9_:/\.]{1,128}$/.test(v);
 for(const permission of record.permissions)if(!permission||!ACTIONS.has(permission.action)||!validResource(permission.resource))throw Error('Invalid permission');
 const attempts=record.attempts.map((attempt,index)=>{
  if(!attempt||!ACTIONS.has(attempt.action)||!validResource(attempt.resource)||!['completed','failed','unknown'].includes(attempt.reportedOutcome))throw Error('Invalid attempt');
  const permitted=record.permissions.some(p=>p.action===attempt.action&&p.resource===attempt.resource);
  return {index,action:attempt.action,resource:attempt.resource,permittedByDeclaredRecord:permitted,reportedOutcome:attempt.reportedOutcome,verified:false};
 });
 return {schema:1,agentId:record.agentId,sourceAuthenticity:'not_verified',coverage:'not_established',
  permissionViolations:attempts.filter(x=>!x.permittedByDeclaredRecord).length,attempts,
  limitation:'This compares an unverified declared record. It does not enforce permissions, verify execution or certify a bot.'};
}
