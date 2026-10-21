// Candidate SQL/fixture loader only. Importing this never connects or submits SQL.
import {readFileSync} from 'node:fs';
export const SCHEMA='federation_auth_email_signup';
export const candidate=readFileSync(new URL('../sql/federation-email-signup-candidate.sql',import.meta.url),'utf8').replaceAll('\r\n','\n');
const begin=candidate.indexOf('\nbegin;\n'),end=candidate.lastIndexOf('\ncommit;');
if(begin<0||end<=begin||candidate.slice(end).trim()!=='commit;')throw Error('Email candidate layout needs review.');
export const candidateDDL=candidate.slice(begin+'\nbegin;\n'.length,end);
export const denied={error:{http_code:403,message:'Account creation is unavailable for this sign-in method.'}};
const email={user:{app_metadata:{provider:'email',providers:['email']},is_anonymous:false,email:'member@example.invalid',phone:'',user_metadata:{}}};
const edit=fn=>{const copy=structuredClone(email);fn(copy);return copy;};
export const cases=[
 ['email OTP-shaped creation',email,true],
 ['email password-shaped creation is indistinguishable',structuredClone(email),true],
 ['not yet confirmed creation',edit(e=>{e.user.email_confirmed_at=null;}),true],
 ['confirmed flag is not this hooks authority',edit(e=>{e.user.email_confirmed_at='2026-10-20T00:00:00Z';}),true],
 ['missing phone',edit(e=>delete e.user.phone),true],
 ['null phone',edit(e=>e.user.phone=null),true],
 ['mixed case email',edit(e=>e.user.email='Member@Example.invalid'),true],
 ['accented local part',edit(e=>e.user.email='membre-été@example.invalid'),true],
 ['user metadata is not a role grant',edit(e=>{e.user.user_metadata={role:'admin',provider:'google'};}),true],
 ['Google denied',edit(e=>{e.user.app_metadata={provider:'google',providers:['google']};}),false],
 ['Apple denied',edit(e=>{e.user.app_metadata={provider:'apple',providers:['apple']};}),false],
 ['phone provider denied',edit(e=>{e.user.app_metadata={provider:'phone',providers:['phone']};}),false],
 ['unknown provider denied',edit(e=>{e.user.app_metadata={provider:'unknown',providers:['unknown']};}),false],
 ['forged user metadata email provider denied',edit(e=>{e.user.app_metadata={};e.user.user_metadata={provider:'email',providers:['email'],is_anonymous:false};}),false],
 ['missing app metadata',edit(e=>delete e.user.app_metadata),false],
 ['array app metadata',edit(e=>e.user.app_metadata=[]),false],
 ['mixed provider list',edit(e=>e.user.app_metadata.providers=['email','google']),false],
 ['missing provider list',edit(e=>delete e.user.app_metadata.providers),false],
 ['object provider list',edit(e=>e.user.app_metadata.providers={email:true}),false],
 ['duplicate provider list',edit(e=>e.user.app_metadata.providers=['email','email']),false],
 ['anonymous denied',edit(e=>e.user.is_anonymous=true),false],
 ['missing anonymous flag',edit(e=>delete e.user.is_anonymous),false],
 ['string false denied',edit(e=>e.user.is_anonymous='false'),false],
 ['missing email',edit(e=>delete e.user.email),false],
 ['null email',edit(e=>e.user.email=null),false],
 ['numeric email',edit(e=>e.user.email=7),false],
 ['empty email',edit(e=>e.user.email=''),false],
 ['spaces in email',edit(e=>e.user.email=' member@example.invalid'),false],
 ['line break in email',edit(e=>e.user.email='member\n@example.invalid'),false],
 ['multiple at signs',edit(e=>e.user.email='member@extra@example.invalid'),false],
 ['missing at sign',edit(e=>e.user.email='member.example.invalid'),false],
 ['oversize email',edit(e=>e.user.email='a'.repeat(241)+'@example.invalid'),false],
 ['populated phone on email user',edit(e=>e.user.phone='synthetic-not-a-number'),false],
 ['numeric phone',edit(e=>e.user.phone=123),false],
 ['null event',null,false],['array event',[],false],['scalar event','email',false],
 ['missing user',{},false],['scalar user',{user:'email'},false]
];
const literal=value=>"'"+JSON.stringify(value).replaceAll("'","''")+"'::jsonb";
export const ruleChecks=cases.map(([label,event,allow],i)=>`do $case$ begin if ${SCHEMA}.email_provider_only(${literal(event)}) is distinct from ${literal(allow?{}:denied)} then raise exception 'Email rule case ${i+1} refused';end if;raise notice 'PASS email rule ${i+1}';end $case$;`).join('\n');
