// Strict server-only durable profile receipt DTO. No connection or state change.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HASH=/^[0-9a-f]{64}$/;
export function profileWriteReceipt(value){
 if(value===null)return null;
 const fields=['profileId','sequence','pending','inputSha256','resultSha256'];
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==fields.length||!fields.every(k=>Object.hasOwn(value,k))||
  typeof value.profileId!=='string'||!UUID.test(value.profileId)||!Number.isSafeInteger(value.sequence)||value.sequence<0||typeof value.pending!=='boolean'||
  (value.sequence===0?(value.pending||value.inputSha256!==null||value.resultSha256!==null):
   typeof value.inputSha256!=='string'||!HASH.test(value.inputSha256)||typeof value.resultSha256!=='string'||!HASH.test(value.resultSha256)))throw Error('profile_write_receipt_unavailable');
 return Object.fromEntries(fields.map(k=>[k,value[k]]));
}
