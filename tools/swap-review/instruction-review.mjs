// Offline supporting-effect policy. Unknown programs and all unimplemented
// instructions refuse. No swap-router decoder or execution permission exists.
import {resolveEnvelopeAccounts} from './account-review.mjs';
const fail=()=>Error('swap_instruction_review_refused');
const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function hex(address){let n=0n;for(const c of address)n=n*58n+BigInt(alphabet.indexOf(c));const out=[];while(n){out.unshift(Number(n&255n));n>>=8n;}for(const c of address){if(c!=='1')break;out.unshift(0);}if(out.length!==32)throw fail();return Buffer.from(out).toString('hex');}
const SYSTEM=hex('11111111111111111111111111111111');
const COMPUTE=hex('ComputeBudget111111111111111111111111111111');
const TOKEN=hex('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const uint=v=>typeof v==='string'&&/^(0|[1-9][0-9]{0,19})$/.test(v)&&BigInt(v)<=18446744073709551615n;
const key=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
export function reviewSupportingInstructions(base64,lookupSnapshots,context,policy){
 try{
  if(!key(policy.ownerHex)||!uint(policy.maxSolTransferLamports)||!uint(policy.maxPriorityFeeLamports)||!Number.isInteger(policy.maxComputeUnits)||policy.maxComputeUnits<1||policy.maxComputeUnits>1400000||!Array.isArray(policy.solRecipients)||!Array.isArray(policy.tokenTransfers)||policy.solRecipients.length>32||policy.tokenTransfers.length>32)throw fail();
  const recipients=new Map(),transfers=new Map();
  for(const r of policy.solRecipients){if(!key(r.publicKeyHex)||!uint(r.maximumLamports)||recipients.has(r.publicKeyHex))throw fail();recipients.set(r.publicKeyHex,{limit:BigInt(r.maximumLamports),used:0n});}
  for(const t of policy.tokenTransfers){if(![t.sourceHex,t.destinationHex,t.mintHex].every(key)||!uint(t.maximumUnits)||!Number.isInteger(t.decimals)||t.decimals<0||t.decimals>36)throw fail();const id=[t.sourceHex,t.destinationHex,t.mintHex,t.decimals].join(':');if(transfers.has(id))throw fail();transfers.set(id,{limit:BigInt(t.maximumUnits),used:0n});}
  const resolved=resolveEnvelopeAccounts(base64,lookupSnapshots,context),effects=[];let limit,price,solTotal=0n;
  if(resolved.accounts.filter(a=>a.signer).length!==1||resolved.accounts[0].publicKeyHex!==policy.ownerHex||!resolved.accounts[0].signer||!resolved.accounts[0].writable)throw fail();
  for(const ix of resolved.instructions){
   const data=Buffer.from(ix.dataHex,'hex'),a=ix.accounts;
   if(ix.programPublicKeyHex===COMPUTE){
    if(a.length)throw fail();
    if(data.length===5&&data[0]===2&&limit===undefined){limit=data.readUInt32LE(1);if(!limit||limit>policy.maxComputeUnits)throw fail();effects.push(Object.freeze({kind:'compute-unit-limit',units:limit}));}
    else if(data.length===9&&data[0]===3&&price===undefined){price=data.readBigUInt64LE(1);effects.push(Object.freeze({kind:'compute-unit-price',microLamports:price.toString()}));}
    else throw fail();
   }else if(ix.programPublicKeyHex===SYSTEM){
    if(data.length!==12||data.readUInt32LE(0)!==2||a.length!==2||a[0].publicKeyHex!==policy.ownerHex||!a[0].signer||!a[0].writable||!a[1].writable||a[1].signer)throw fail();
    const amount=data.readBigUInt64LE(4),allowed=recipients.get(a[1].publicKeyHex);if(!allowed||!amount)throw fail();allowed.used+=amount;solTotal+=amount;
    if(allowed.used>allowed.limit||solTotal>BigInt(policy.maxSolTransferLamports))throw fail();
    effects.push(Object.freeze({kind:'sol-transfer',destinationHex:a[1].publicKeyHex,lamports:amount.toString()}));
   }else if(ix.programPublicKeyHex===TOKEN){
    // Approve, SetAuthority, unchecked transfer, mint/burn, close and native/ATA
    // setup are deliberately unsupported until their exact policies are reviewed.
    if(data.length!==10||data[0]!==12||a.length!==4||!a[0].writable||!a[2].writable||a[1].writable||a[1].signer||a[3].publicKeyHex!==policy.ownerHex||!a[3].signer)throw fail();
    const amount=data.readBigUInt64LE(1),decimals=data[9],id=[a[0].publicKeyHex,a[2].publicKeyHex,a[1].publicKeyHex,decimals].join(':'),allowed=transfers.get(id);
    if(!amount||!allowed)throw fail();allowed.used+=amount;if(allowed.used>allowed.limit)throw fail();
    effects.push(Object.freeze({kind:'token-transfer-checked',sourceHex:a[0].publicKeyHex,destinationHex:a[2].publicKeyHex,mintHex:a[1].publicKeyHex,units:amount.toString(),decimals}));
   }else throw fail();
  }
  // Explicit limit and price avoid relying on implicit/default fee assumptions.
  if(limit===undefined||price===undefined)throw fail();const priority=(BigInt(limit)*price+999999n)/1000000n;
  if(priority>BigInt(policy.maxPriorityFeeLamports))throw fail();
  return Object.freeze({state:'supporting-effects-match-policy',tradeAllowed:false,messageSha256:resolved.messageSha256,effects:Object.freeze(effects),solTransferLamports:solTotal.toString(),priorityFeeLamports:priority.toString(),
   limitation:'Supporting effects only. No swap-router instruction is accepted. Requires independent account/intent/fee verification, codec parity, simulation, current chain state and owner acceptance. Not signing authority.'});
 }catch{throw fail();}
}
