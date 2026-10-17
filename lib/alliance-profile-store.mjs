// Server-side candidate adapter. Not imported by the browser or a deployed route.
// It defaults closed; Supabase's verified bearer context and RLS own authorization.
import bounded from '../netlify/lib/read-json-bounded.cjs';
import {validateProfileInput,ownProfile,profileRecord as record,profileDirectoryOptions} from '../assets/federation/fed-alliance-profile-contract.mjs';
export {validateProfileInput} from '../assets/federation/fed-alliance-profile-contract.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const error=code=>new Error(code);
export function createProfileStore({enabled=false,url,key,fetcher=globalThis.fetch}={}){
  let origin;
  if(enabled===true){
    if(typeof url!=='string'||!/^https:\/\/[a-z0-9]{10,40}\.supabase\.co$/.test(url)||typeof key!=='string'||!/^sb_publishable_[A-Za-z0-9_-]{20,512}$/.test(key))throw error('profile_configuration_unavailable');
    origin=url;
  }
  function ready(token){
    if(enabled!==true)throw error('community_unavailable');
    if(typeof token!=='string'||token.length>4096||!/^[A-Za-z0-9_-]{1,2048}\.[A-Za-z0-9_-]{1,2048}\.[A-Za-z0-9_-]{1,2048}$/.test(token))throw error('sign_in_required');
  }
  async function read(path,token,body){
    try{return await bounded.readJsonBounded(origin+path,{method:body===undefined?'GET':'POST',credentials:'omit',headers:{apikey:key,Authorization:'Bearer '+token,...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})},{fetcher,timeoutMs:8000,maxBytes:65536});}
    catch{throw error('profile_unavailable');}
  }
  return Object.freeze({
    async mine(token){ready(token);const data=await read('/rest/v1/rpc/alliance_my_profile',token,{});try{return ownProfile(data);}catch{throw error('profile_unavailable');}},
    async save(token,input){ready(token);const p=validateProfileInput(input);const data=await read('/rest/v1/rpc/alliance_save_profile',token,{p_name:p.name,p_community:p.community,p_bio:p.bio,p_role:p.role,p_listed:p.listed});try{const result=ownProfile(data);if(!result)throw error('profile_unavailable');return result;}catch{throw error('profile_unavailable');}},
    async remove(token){ready(token);const result=await read('/rest/v1/rpc/alliance_remove_profile',token,{});if(!record(result)||result.removed!==true)throw error('profile_unavailable');return {removed:true};},
    async directory(token,{after=null,limit=20}={}){
      ready(token);profileDirectoryOptions({after,limit});
      const query=new URLSearchParams({select:'id,display_name,community,bio,contribution_role',listed:'eq.true',moderation_state:'eq.visible',order:'id.asc',limit:String(limit+1)});if(after)query.set('id','gt.'+after);
      const data=await read('/rest/v1/alliance_profiles?'+query,token);
      try{
        if(!Array.isArray(data)||data.length>limit+1)throw error('profile_unavailable');
        let previous=after;const rows=data.map(row=>{
          if(!record(row)||typeof row.id!=='string'||!UUID.test(row.id)||(previous&&row.id<=previous))throw error('profile_unavailable');previous=row.id;
          const p=validateProfileInput({name:row.display_name,community:row.community,bio:row.bio,role:row.contribution_role,listed:true});
          return {id:row.id,name:p.name,community:p.community,bio:p.bio,role:p.role};
        });
        const items=rows.slice(0,limit);return {items,next:rows.length>limit?items.at(-1).id:null};
      }catch{throw error('profile_unavailable');}
    },
  });
}
