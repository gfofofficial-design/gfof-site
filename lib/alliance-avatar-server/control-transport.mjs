// Explicit candidate route only. Never discovers, retries or changes providers.
import {controlRef,controlFailure as fail} from './control-policy.mjs';
const sessionHost='aws-0-us-east-2.pooler.supabase.com';
export function controlTransportProfile(profile='direct'){
 if(!['direct','supabase-session'].includes(profile))throw fail();return profile;
}
export function controlTransport({profile='direct',projectRef,role,host}){
 controlTransportProfile(profile);
 if(!controlRef(projectRef)||!['alliance_control_reader','alliance_control_anchor_writer'].includes(role))throw fail();
 const expected=profile==='direct'?`db.${projectRef}.supabase.co`:sessionHost;
 if(host!==expected)throw fail();
 return {host:expected,servername:expected,user:profile==='direct'?role:`${role}.${projectRef}`};
}
