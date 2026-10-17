// Public data shapes only. No identity/session, storage or provider operations.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ROLES=new Set(['explorer','builder','researcher','connector']);
const BAD=/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069<>]/u;
const error=code=>new Error(code);
export function profileRecord(value){return value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));}
function text(value,min,max,single=false){if(typeof value!=='string'||BAD.test(value)||(single&&/[\r\n\t]/u.test(value)))throw error('profile_invalid');const result=value.trim();if(result.length<min||result.length>max)throw error('profile_invalid');return result;}
export function validateProfileInput(input){
  if(!profileRecord(input)||Object.keys(input).sort().join(',')!=='bio,community,listed,name,role'||!ROLES.has(input.role)||typeof input.listed!=='boolean')throw error('profile_invalid');
  return {name:text(input.name,2,40,true),community:text(input.community,0,70,true),bio:text(input.bio,10,280),role:input.role,listed:input.listed};
}
export function ownProfile(data){
  if(data===null)return null;
  if(!profileRecord(data)||typeof data.id!=='string'||!UUID.test(data.id)||!['private','listed','held'].includes(data.publication)||typeof data.updatedAt!=='string'||!Number.isFinite(Date.parse(data.updatedAt)))throw error('profile_unavailable');
  const fields=validateProfileInput({name:data.name,community:data.community,bio:data.bio,role:data.role,listed:data.listed});
  if(data.publication!=='held'&&data.publication!==(fields.listed?'listed':'private'))throw error('profile_unavailable');
  return {id:data.id,...fields,publication:data.publication,updatedAt:data.updatedAt};
}
export function directoryPage(data,{after=null,limit=20}={}){
  if(!profileRecord(data)||!Array.isArray(data.items)||data.items.length>limit||data.next!==null&&(typeof data.next!=='string'||!UUID.test(data.next)))throw error('profile_unavailable');
  let previous=after;
  const items=data.items.map(row=>{
    if(!profileRecord(row)||typeof row.id!=='string'||!UUID.test(row.id)||(previous&&row.id<=previous))throw error('profile_unavailable');previous=row.id;
    const p=validateProfileInput({name:row.name,community:row.community,bio:row.bio,role:row.role,listed:true});
    return {id:row.id,name:p.name,community:p.community,bio:p.bio,role:p.role};
  });
  if(data.next!==null&&(items.length!==limit||data.next!==items.at(-1)?.id))throw error('profile_unavailable');
  return {items,next:data.next};
}
export function profileDirectoryOptions({after=null,limit=20}={}){
  if(!Number.isSafeInteger(limit)||limit<1||limit>20||(after!==null&&(typeof after!=='string'||!UUID.test(after))))throw error('directory_invalid');
  return {after,limit};
}
