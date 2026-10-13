import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {base58Bytes} from '../lib/watchtower-batch-core.mjs';
const EXPECTED=[['mint_account','Dc9CeuctqvP947ipnCJb8fSf6HhNWDooAQxsVHj2RNBV'],['streamflow_metadata','AiRhuw9iFyXiZYv2hqanBK12dckebF4vNMoAzj9Nj9nY'],['streamflow_metadata','BW6ZUUT5NXxSGMKNAzoMYbqrXy5Dm1ev1ekEgYSXJWX8'],['streamflow_metadata','EPdpg7AYEzcwudN7TRdEkCGHQeHRrFhoK2yiYxDdGLnv']];
export function inspectWatchtowerPilot(config){
 if(!config||config.schema!==1||config.pilotId!=='gfof-mint-three-locks-20261013'||config.chain!=='solana-mainnet'||config.enabled!==false||
  config.mode!=='prepare_observe_only'||config.additionalProviderSpendUsd!==0||config.planUpgradeAllowed!==false||config.activationRequiresCreditHeadroomCheck!==true||config.notificationsEnabled!==false||
  !Array.isArray(config.accounts)||config.accounts.length!==4||config.accounts.some((a,i)=>!a||a.role!==EXPECTED[i][0]||a.address!==EXPECTED[i][1]||!base58Bytes(a.address,32))||
  config.proposedVerificationLimitsOnly?.dailyRequests!==2000||config.proposedVerificationLimitsOnly?.monthlyRequests!==60000)throw Error('Invalid pilot preparation');
 return {schema:1,pilotId:config.pilotId,status:'prepared_not_activated',accountCount:4,additionalProviderSpendUsd:0,
  proposedMonthlyVerificationRequests:60000,scope:'one_current_mint_and_three_streamflow_metadata_accounts',
  gates:['Confirm the existing Helius plan, remaining monthly credits and provider-side spending controls.','Review and approve storage, migration, provider/network provenance and real operating deadlines.','Approve the actual verification limits and separately authorize live configuration.'],
  limitations:['This static configuration does not itself enforce a provider spending cap.','Mint-account monitoring does not cover every holder transfer or trade.','Only lock metadata accounts are included; escrow balances need separate reviewed scope or existing live-read verification.','No webhook, worker, account change, key read, alert or financial action is activated.']};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==2){process.stderr.write('Usage: node scripts/check-watchtower-pilot.mjs\n');process.exitCode=2;}
 else try{const config=JSON.parse(await readFile(new URL('../config/watchtower-pilot.json',import.meta.url),'utf8'));process.stdout.write(JSON.stringify(inspectWatchtowerPilot(config),null,2)+'\n');}
 catch{process.stderr.write('Pilot preparation unavailable or invalid.\n');process.exitCode=2;}
}
