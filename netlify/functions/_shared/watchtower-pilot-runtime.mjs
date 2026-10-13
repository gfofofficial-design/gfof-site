import {inspectWatchtowerPilot} from '../../../scripts/check-watchtower-pilot.mjs';
import {createHeliusIntake} from './watchtower-helius-intake.mjs';
import {createWatchtowerReceiptSink} from './watchtower-receipt-sink.mjs';
import {createWatchtowerRpcAllowance} from './watchtower-rpc-allowance.mjs';
import {createWatchtowerRpcTransport} from './watchtower-rpc-transport.mjs';
import {createCandidateVerifier} from './watchtower-verify-candidate.mjs';
import {createWatchtowerWorker} from './watchtower-worker.mjs';
const REQUIRED=['creditHeadroomChecked','automaticPurchasesDisabled','providerPauseReviewed','storageMigrationApproved','storageReady','limitsApproved','mainnetTransportReviewed'];
// All startup declarations are private operator inputs, never HTTP/client input.
// They record prerequisites; they do not authenticate billing or database evidence.
export function createWatchtowerPilotRuntime({enabled=false,config,startup,query,apiKey,authorizationValue,fetcher=fetch}={}){
 if(typeof enabled!=='boolean')throw Error('Invalid pilot runtime configuration');
 if(!enabled)return Object.freeze({status:'disabled',receive:createHeliusIntake(),processOne:createWatchtowerWorker()});
 inspectWatchtowerPilot(config);
 if(!startup||startup.additionalProviderSpendUsd!==0||!REQUIRED.every(key=>startup[key]===true)||
  typeof query!=='function'||typeof apiKey!=='string'||apiKey.length<16||apiKey.length>512||!/^[!-~]+$/.test(apiKey)||
  typeof authorizationValue!=='string'||!/^Bearer [-A-Za-z0-9_]{43,128}$/.test(authorizationValue)||typeof fetcher!=='function')throw Error('Pilot startup prerequisites not recorded');
 const watchedAccounts=config.accounts.map(item=>item.address);
 const acceptReceipt=createWatchtowerReceiptSink({query});
 const reserveAllowance=createWatchtowerRpcAllowance({query,scope:'production',dailyLimit:config.proposedVerificationLimitsOnly.dailyRequests,monthlyLimit:config.proposedVerificationLimitsOnly.monthlyRequests});
 const rpc=createWatchtowerRpcTransport({enabled:true,apiKey,fetcher});
 const verify=createCandidateVerifier({enabled:true,watchedAccounts,rpc,reserveAllowance});
 return Object.freeze({status:'configured_by_operator',startupEvidence:'operator_declarations_not_independently_verified',
  receive:createHeliusIntake({enabled:true,authorizationValue,watchedAccounts,acceptReceipt}),
  processOne:createWatchtowerWorker({enabled:true,query,verify})});
}
