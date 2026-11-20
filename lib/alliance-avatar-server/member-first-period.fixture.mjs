// Synthetic public identities only. No private key/password/cloud call.
import {rootCertificates} from 'node:tls';
import {syntheticMemberTrialPolicy} from './member-aws-trial-policy.fixture.mjs';
import {memberAwsFixedPeriodPolicyBundle,reviewMemberAwsFixedPeriodPolicyBundle} from './member-aws-first-period-policy.mjs';
export function syntheticFirstPeriodMemberEntry(){
 const policyInput=syntheticMemberTrialPolicy();
 policyInput.installation.binding.callerKey.notBeforeUtc='2026-10-24T12:00:00.000Z';
 policyInput.installation.binding.callerKey.notAfterUtc='2026-11-23T12:00:00.000Z';
 policyInput.window.notAfterUtc='2026-11-23T11:59:20.000Z';
 const policy=memberAwsFixedPeriodPolicyBundle(policyInput);
 return {policyInput,policy,connectionSecrets:Object.fromEntries(['control','journal'].map(p=>[p,{...policyInput.secrets[p],ca:rootCertificates[0]}])),expectedPolicySha256:reviewMemberAwsFixedPeriodPolicyBundle({input:policyInput,prepared:policy}).sha256};
}
