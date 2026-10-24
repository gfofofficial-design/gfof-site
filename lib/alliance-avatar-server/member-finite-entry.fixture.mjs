// Public synthetic configuration only. No private key or password is generated.
import {rootCertificates} from 'node:tls';
import {syntheticMemberTrialPolicy} from './member-aws-trial-policy.fixture.mjs';
import {memberAwsTrialPolicyBundle,reviewMemberAwsTrialPolicyBundle} from './member-aws-trial-policy.mjs';
export function syntheticFiniteMemberEntry(){
 const policyInput=syntheticMemberTrialPolicy(),policy=memberAwsTrialPolicyBundle(policyInput);
 return {policyInput,policy,connectionSecrets:Object.fromEntries(['control','journal'].map(p=>[p,{...policyInput.secrets[p],ca:rootCertificates[0]}])),
  expectedPolicySha256:reviewMemberAwsTrialPolicyBundle({input:policyInput,prepared:policy}).sha256};
}
