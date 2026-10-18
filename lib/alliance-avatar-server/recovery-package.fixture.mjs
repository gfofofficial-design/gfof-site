// Synthetic byte protocol only. NOT real dumps, Auth, Storage or key custody.
import {generateKeyPairSync,createHash} from 'node:crypto';
import {allianceTrustRecordBytes} from './trust-record.mjs';
import {RECOVERY_COMPONENTS,createAllianceRecoveryPackage} from './recovery-package.mjs';
const zero='0'.repeat(64);
export function packageFixture(){
 const scope={memberProjectRef:'abcdefghijklmnopqrst',journalProjectRef:'uvwxyzabcdefghijklmn',controlProjectRef:'opqrstuvwxyzabcdefgh',epoch:'11111111-1111-4111-8111-111111111111'};
 const publicKey=()=>Buffer.from(generateKeyPairSync('ed25519').publicKey.export({format:'jwk'}).x,'base64url').toString('hex');
 const trust=allianceTrustRecordBytes({format:1,...scope,generation:1,previousSha256:zero,controlMinimum:{revision:1,sha256:'e'.repeat(64),floor:{sequence:0,sha256:zero}},removalMinimum:{sequence:0,sha256:zero},controlVerificationKey:publicKey(),journalVerificationKey:publicKey()});
 const input={packageId:'22222222-2222-4222-8222-222222222222',capturedAt:'2026-10-18T00:00:00.000Z',sourceCommit:'a'.repeat(40),freezeId:'33333333-3333-4333-8333-333333333333',checkpointSha256:'b'.repeat(64),trustRecord:trust,components:RECOVERY_COMPONENTS.map(name=>({name,data:Buffer.concat([Buffer.from('SYNTHETIC component '+name+'; not a recoverable database or key.'),name==='storage'?Buffer.from([0,255,128,0,195,40]):Buffer.alloc(0)])}))};
 const options={enabled:true,expectedScope:scope,trustSha256:createHash('sha256').update(trust).digest('hex'),minimumGeneration:1,recipient:'age1'+'q'.repeat(58)};
 return {input,options,scope,make:extra=>createAllianceRecoveryPackage({...options,...extra})};
}
