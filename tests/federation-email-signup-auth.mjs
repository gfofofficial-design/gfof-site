// Disposable self-hosted Auth acceptance; no hosted URL or real credentials accepted.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import {candidateDDL,SCHEMA} from './federation-email-signup-candidate.mjs';
import {EMAIL_AUTH_DB,AUTH_IMAGE,MAIL_IMAGE,TEMPLATE_IMAGE,CODE_TEMPLATE,fixtureConfig,fixtureOrigin,fixtureAuthPath,sinkCode} from './federation-email-auth-contract.mjs';
import {handlerAcceptance} from './federation-email-auth-handler.mjs';

const DB = EMAIL_AUTH_DB;
const FN = `${SCHEMA}.email_provider_only`;
if (process.env.FEDERATION_EMAIL_AUTH_TEST_CONFIRM !== 'disposable_email_auth_fixture') {
  throw new Error('Explicit disposable email Auth confirmation is required.');
}
const pg = process.env.FEDERATION_EMAIL_AUTH_TEST_POSTGRES || '';
if (!/^[a-f0-9]{12,64}$/.test(pg)) throw new Error('Expected a local fixture Docker container ID.');

const credentials = [randomBytes(32).toString('hex'), randomBytes(32).toString('hex')];
const [dbPassword, jwtSecret] = credentials;
const password = `Fixture-${randomBytes(18).toString('hex')}!`;
const replacementPassword = `Fixture-${randomBytes(18).toString('hex')}!`;
credentials.push(replacementPassword);
credentials.push(password);
function docker(args, input) {
  try {
    return execFileSync('docker', args, { input, encoding: 'utf8', timeout: 60000,
      maxBuffer: 4 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    throw new Error(`Disposable Docker ${args[0]} failed; no credential or service log was emitted.`);
  }
}
let queryCount=0;
function query(sql) {
  assert(++queryCount<=120, 'Fixture query budget exceeded');
  return docker(['exec', '-i', '-u', 'postgres', pg, 'psql', '-X', '-At', '-v',
    'ON_ERROR_STOP=1', '-U', 'postgres', '-d', DB], sql);
}
const pgConfig = JSON.parse(docker(['inspect', '--format', '{{json .Config}}', pg]));
fixtureConfig(pgConfig);
assert.equal(query("select current_setting('server_version_num');"), '170011');
assert.equal(query(`select count(*) from pg_namespace where nspname in ('auth','${SCHEMA}');`), '0');
assert.equal(query("select count(*) from pg_roles where rolname in ('supabase_auth_admin','anon','authenticated','service_role');"), '0');

let network, mail, auth, template, authOrigin, mailOrigin;
const ownedContainers = new Set();
const fixtureOrigins = new Set();
const baseURL = 'http://127.0.0.1:9999';
let httpCount=0, delivered=0, expectedUsers=0;
function localOrigin(container, port) {
  const info=JSON.parse(docker(['inspect','--format','{{json .NetworkSettings}}',container]));
  const origin=fixtureOrigin(info,network,port); fixtureOrigins.add(origin); return origin;
}
async function http(origin,path,body,token,method=body===undefined?'GET':'POST') {
  assert(fixtureOrigins.has(origin),'Only owned fixture addresses');
  assert(++httpCount<=400,'Fixture HTTP budget exceeded');
  const response=await fetch(origin+path,{method,redirect:'error',signal:AbortSignal.timeout(15000),
    headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},
    ...(body===undefined?{}:{body:JSON.stringify(body)})});
  const raw=await response.text(); assert(raw.length<2*1024*1024,'Oversized fixture response');
  let json;try{json=JSON.parse(raw);}catch{json={};}
  for(const value of [json.access_token,json.refresh_token])if(typeof value==='string')credentials.push(value);
  return {status:response.status,json};
}
const authHTTP=(path,body,token,method)=>http(authOrigin,path,body,token,method);
function status(result,expected,label) {
  assert.equal(result.status,expected,`${label}: HTTP ${result.status}; no response payload emitted`);
}
function rejected(result,label,expected) {
  if(expected)status(result,expected,label);
  else assert(result.status>=400&&result.status<500,`${label}: expected rejection`);
  assert(!result.json.access_token&&!result.json.refresh_token,`${label}: unexpected session`);
}
async function ready(origin,path) {
  for(let attempt=0;attempt<60;attempt++){
    try{const result=await http(origin,path);if(result.status===200)return result;}catch(error){
      if(httpCount>=400)throw error;
    }
    await delay(500);
  }
  throw Error('Disposable service did not become ready; no service logs emitted.');
}
async function messages() {
  const result=await http(mailOrigin,'/api/v1/messages?limit=100');status(result,200,'Sink list');
  assert(Number.isSafeInteger(result.json.total)&&Array.isArray(result.json.messages),'Invalid sink metadata');
  return result.json;
}
function counts() {
  const value=query("select (select count(*) from auth.users)::text||'/'||(select count(*) from auth.identities)::text;");
  assert.match(value,/^[0-9]+\/[0-9]+$/,'Invalid aggregate count');return value;
}
async function unchanged(label) {
  assert.equal(counts(),`${expectedUsers}/${expectedUsers}`,`${label}: unexpected account/identity count`);
  await delay(100);assert.equal((await messages()).total,delivered,`${label}: unexpected sink mail`);
}
async function delivery(email,before) {
  let inbox;
  for(let n=0;n<30;n++){
    inbox=await messages();if(inbox.total>=before.total+1)break;await delay(100);
  }
  assert.equal(inbox.total,before.total+1,'Expected exactly one new sink message');
  const ids=new Set(before.messages.map(message=>message.ID));
  const added=inbox.messages.filter(message=>!ids.has(message.ID));
  assert.equal(added.length,1,'Ambiguous sink delivery');
  assert.match(added[0].ID,/^[a-zA-Z0-9-]+$/,'Invalid sink message ID');
  const message=await http(mailOrigin,`/api/v1/message/${added[0].ID}`);status(message,200,'Read sink message');
  const code=sinkCode(message.json,email);credentials.push(code);delivered++;
  return code;
}
async function sendCode(email,path,body,newAccount=false) {
  const before=await messages();const result=await authHTTP(path,body);status(result,200,'Request sink code');
  assert(!result.json.access_token&&!result.json.refresh_token,'Request must not return session');
  if(newAccount)expectedUsers++;
  const code=await delivery(email,before);await unchanged('Code request');return code;
}
async function verify(email,code,type='email') {
  return authHTTP('/verify',{email,token:code,type});
}
async function acceptedSession(result,email,id) {
  status(result,200,'Verified session');
  assert(typeof result.json.access_token==='string'&&typeof result.json.refresh_token==='string','Missing session');
  assert.equal(result.json.user?.email,email,'Wrong session address');
  assert.ok(result.json.user?.email_confirmed_at&&!result.json.user?.is_anonymous,'Unconfirmed or anonymous session');
  if(id)assert.equal(result.json.user.id,id,'Wrong account identity');
  const read=await authHTTP('/user',undefined,result.json.access_token);status(read,200,'Authenticated user read');
  assert.equal(read.json.id,result.json.user.id,'Wrong authenticated user');
  return result.json;
}
async function endSession(session) {
  status(await authHTTP('/logout?scope=local',{},session.access_token),204,'Logout');
  rejected(await authHTTP('/token?grant_type=refresh_token',{refresh_token:session.refresh_token}),'Refresh after logout');
}
async function startAuth(closed,hook) {
  if(auth){docker(['rm','-f',auth]);ownedContainers.delete(auth);auth=undefined;}
  const env={
    GOTRUE_API_HOST:'0.0.0.0',GOTRUE_API_PORT:'9999',API_EXTERNAL_URL:baseURL,
    GOTRUE_DB_DRIVER:'postgres',GOTRUE_DB_DATABASE_URL:`postgres://supabase_auth_admin:${dbPassword}@fixture-postgres:5432/${DB}?sslmode=disable`,
    GOTRUE_DB_NAMESPACE:'auth',GOTRUE_DB_MAX_POOL_SIZE:'5',GOTRUE_SITE_URL:'http://127.0.0.1:3000',
    GOTRUE_DISABLE_SIGNUP:String(closed),GOTRUE_JWT_SECRET:jwtSecret,GOTRUE_JWT_EXP:'3600',
    GOTRUE_JWT_ISSUER:baseURL,GOTRUE_JWT_AUD:'authenticated',GOTRUE_JWT_ADMIN_ROLES:'service_role',
    GOTRUE_JWT_DEFAULT_GROUP_NAME:'authenticated',GOTRUE_EXTERNAL_EMAIL_ENABLED:'true',
    GOTRUE_EXTERNAL_PHONE_ENABLED:'false',GOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED:'false',
    GOTRUE_MAILER_AUTOCONFIRM:'false',GOTRUE_MAILER_OTP_LENGTH:'8',GOTRUE_MAILER_OTP_EXP:'600',
    GOTRUE_SMTP_HOST:'fixture-mail',GOTRUE_SMTP_PORT:'1025',GOTRUE_SMTP_ADMIN_EMAIL:'fixture@example.invalid',
    GOTRUE_SMTP_SENDER_NAME:'Disposable fixture',GOTRUE_SMTP_MAX_FREQUENCY:'1s',GOTRUE_LOG_LEVEL:'error',
    GOTRUE_RATE_LIMIT_EMAIL_SENT:'100',GOTRUE_RATE_LIMIT_VERIFY:'100',
    GOTRUE_MAILER_TEMPLATES_CONFIRMATION:'http://fixture-template:8080/code.html',
    GOTRUE_MAILER_TEMPLATES_MAGIC_LINK:'http://fixture-template:8080/code.html',
    GOTRUE_MAILER_TEMPLATES_RECOVERY:'http://fixture-template:8080/code.html',
    GOTRUE_HOOK_BEFORE_USER_CREATED_ENABLED:String(hook),
    ...(hook?{GOTRUE_HOOK_BEFORE_USER_CREATED_URI:`pg-functions://postgres/${SCHEMA}/email_provider_only`}:{})
  };
  auth=docker(['run','-d','--network',network,...Object.entries(env).flatMap(([key,value])=>['-e',`${key}=${value}`]),AUTH_IMAGE]);
  ownedContainers.add(auth);authOrigin=localOrigin(auth,9999);
  const health=await ready(authOrigin,'/health');assert(String(health.json.version).includes('2.197.0'),'Wrong Auth version');
  const settings=await authHTTP('/settings');status(settings,200,'Settings');
  assert.equal(settings.json.disable_signup,closed,'Unexpected signup setting');
  assert.equal(settings.json.external.email,true,'Email provider disabled');
}
const otpEmail='otp-member@example.invalid',passwordEmail='password-member@example.invalid',expiredEmail='expired-member@example.invalid';
try {
  for(const image of [AUTH_IMAGE,MAIL_IMAGE,TEMPLATE_IMAGE])docker(['pull',image]);
  network=docker(['network','create','--internal',`federation-email-${randomBytes(6).toString('hex')}`]);
  const net=JSON.parse(docker(['network','inspect',network]))[0];assert.equal(net.Internal,true);network=net.Name;
  docker(['network','connect','--alias','fixture-postgres',network,pg]);
  query(`begin;create role supabase_auth_admin login noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls password '${dbPassword}';
    create role anon nologin;create role authenticated nologin;create role service_role nologin;
    create schema auth authorization supabase_auth_admin;alter role supabase_auth_admin set search_path=auth;commit;`);
  mail=docker(['run','-d','--network',network,'--network-alias','fixture-mail',MAIL_IMAGE]);ownedContainers.add(mail);
  mailOrigin=localOrigin(mail,8025);await ready(mailOrigin,'/api/v1/messages?limit=1');
  assert.equal((await messages()).total,0,'Sink must be empty');
  template=docker(['run','-d','--network',network,'--network-alias','fixture-template',TEMPLATE_IMAGE,
    'sh','-c',"mkdir /www && cat > /www/code.html <<'TEMPLATE'\n"+CODE_TEMPLATE+"\nTEMPLATE\nexec httpd -f -p 8080 -h /www"]);
  ownedContainers.add(template);await ready(localOrigin(template,8080),'/code.html');
  await startAuth(true,false);assert.equal(counts(),'0/0','Auth must start empty');
  docker(['rm','-f',auth]);ownedContainers.delete(auth);auth=undefined;
  query(`begin;${candidateDDL}commit;`);
  await startAuth(true,true);
  const closed=await authHTTP('/signup',{email:'closed@example.invalid',password});rejected(closed,'Closed new signup',422);
  assert.equal(closed.json.error_code,'signup_disabled');await unchanged('Closed initial state');
  await startAuth(false,true);
  rejected(await authHTTP('/signup',{email:'not-an-email',password}),'Malformed email');
  rejected(await authHTTP('/signup',{phone:'+15555550123',password}),'Disabled phone provider');
  rejected(await authHTTP('/token?grant_type=id_token',{provider:'google',id_token:'invalid-fixture-token'}),'Unconfigured Google ID token');
  await unchanged('Malformed and unsupported requests');
  const otp=await sendCode(otpEmail,'/otp',{email:otpEmail,create_user:true,data:{role:'admin',provider:'google'}},true);
  assert.equal(query('select count(*) from auth.users where email_confirmed_at is not null;'),'0','New account already confirmed');
  const wrong=(otp[0]==='0'?'1':'0')+otp.slice(1);
  rejected(await verify(otpEmail,wrong),'Wrong eight-digit code',403);
  assert.equal(query('select count(*) from auth.sessions;'),'0','Wrong code created session');
  const first=await acceptedSession(await verify(otpEmail,otp),otpEmail);
  assert.equal(first.user.app_metadata?.provider,'email','Applicant metadata changed authoritative provider');
  assert.equal(first.user.role,'authenticated','Applicant metadata granted role');
  const sessionCount=query('select count(*) from auth.sessions;');
  rejected(await verify(otpEmail,otp),'Consumed code replay',403);
  assert.equal(query('select count(*) from auth.sessions;'),sessionCount,'Replay created session');
  await endSession(first);await unchanged('OTP confirmation and replay');
  console.log('PASS OTP creation: delivered eight digits, unconfirmed before verification, wrong/replayed codes refused, exact confirmed identity and logout');

  const confirmation=await sendCode(passwordEmail,'/signup',{email:passwordEmail,password},true);
  const unconfirmed=await authHTTP('/token?grant_type=password',{email:passwordEmail,password});rejected(unconfirmed,'Unconfirmed password login',400);
  assert.equal(unconfirmed.json.error_code,'email_not_confirmed');
  await endSession(await acceptedSession(await verify(passwordEmail,confirmation),passwordEmail));
  await endSession(await acceptedSession(await authHTTP('/token?grant_type=password',{email:passwordEmail,password}),passwordEmail));
  console.log('PASS direct email/password also admitted: no session before email confirmation; confirmed login works (not an OTP-only policy)');

  const expired=await sendCode(expiredEmail,'/otp',{email:expiredEmail,create_user:true},true);
  const beforeExpiry=query('select count(*) from auth.sessions;');
  query(`update auth.users set confirmation_sent_at=clock_timestamp()-interval '601 seconds' where email='${expiredEmail}' and email_confirmed_at is null;`);
  rejected(await verify(expiredEmail,expired),'Expired creation code',403);
  assert.equal(query('select count(*) from auth.sessions;'),beforeExpiry,'Expired code created session');
  assert.equal(query(`select count(*) from auth.users where email='${expiredEmail}' and email_confirmed_at is null;`),'1');
  await unchanged('Synthetic-aged expiry');
  console.log('PASS ten-minute expiry predicate: fixture timestamp backdated; expired code creates no session or confirmation (not a ten-minute wall-clock wait)');

  await startAuth(true,true);
  const existing=await sendCode(otpEmail,'/otp',{email:otpEmail,create_user:false});
  await endSession(await acceptedSession(await verify(otpEmail,existing),otpEmail,first.user.id));
  const unknown=await authHTTP('/otp',{email:'unknown@example.invalid',create_user:false});rejected(unknown,'Unknown account with create_user=false');
  await unchanged('Closed signup existing-account continuity');
  console.log('PASS existing account email OTP with managed signup closed; unknown address creates no account or mail');

  await delay(1100);
  const recovery=await sendCode(passwordEmail,'/recover',{email:passwordEmail});
  const recovered=await acceptedSession(await verify(passwordEmail,recovery,'recovery'),passwordEmail);
  rejected(await verify(passwordEmail,recovery,'recovery'),'Consumed recovery code replay',403);
  status(await authHTTP('/user',{password:replacementPassword},recovered.access_token,'PUT'),200,'Recovery password update');
  await endSession(recovered);
  rejected(await authHTTP('/token?grant_type=password',{email:passwordEmail,password}),'Old password after recovery',400);
  await endSession(await acceptedSession(await authHTTP('/token?grant_type=password',{email:passwordEmail,password:replacementPassword}),passwordEmail));
  await unchanged('Recovery with signup closed');
  console.log('PASS recovery mail/code, one-use recovery, old password refused and fresh new-password login while signup remains closed');

  const composed=await handlerAcceptance({email:otpEmail,id:first.user.id,messages,delivery,unchanged,
    fetchImpl:async(url,options)=>{
      const path=fixtureAuthPath(url);assert(++httpCount<=400,'Fixture HTTP budget exceeded');
      return fetch(authOrigin+path,{...options,redirect:'error'});
    }});
  console.log(`PASS actual application handler: real code/user lookup, HttpOnly host-only cookies, session/refresh/logout, neutral unknown address and local expiry; ${composed.requests} provider requests`);

  await startAuth(false,true);
  query(`revoke execute on function ${FN}(jsonb) from supabase_auth_admin;`);
  rejected(await authHTTP('/signup',{email:'no-execute@example.invalid',password}),'Missing hook EXECUTE',500);
  await unchanged('Missing EXECUTE');
  query(`grant execute on function ${FN}(jsonb) to supabase_auth_admin;revoke usage on schema ${SCHEMA} from supabase_auth_admin;`);
  rejected(await authHTTP('/otp',{email:'no-usage@example.invalid',create_user:true}),'Missing schema USAGE',500);
  await unchanged('Missing USAGE');
  query(`grant usage on schema ${SCHEMA} to supabase_auth_admin;alter function ${FN}(jsonb) rename to email_provider_unavailable;`);
  rejected(await authHTTP('/signup',{email:'no-function@example.invalid',password}),'Missing hook function',500);
  await unchanged('Missing function');
  query(`alter function ${SCHEMA}.email_provider_unavailable(jsonb) rename to email_provider_only;`);
  const functionStart=candidateDDL.indexOf(`create function ${FN}(event jsonb)`);
  const functionEnd=candidateDDL.indexOf('$hook$;',functionStart)+'$hook$;'.length;
  assert(functionStart>=0&&functionEnd>functionStart,'Missing candidate function');
  const restoreFunction=candidateDDL.slice(functionStart,functionEnd).replace(/^create function /,'create or replace function ');
  query(`create or replace function ${FN}(event jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$begin raise exception 'Synthetic email hook failure';end;$$;`);
  rejected(await authHTTP('/signup',{email:'runtime-error@example.invalid',password}),'Hook runtime error',500);
  await unchanged('Hook runtime failure');
  query("alter role supabase_auth_admin set statement_timeout='2s';");
  await startAuth(false,true);
  query(`create or replace function ${FN}(event jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$begin perform pg_catalog.pg_sleep(3);return '{}'::jsonb;end;$$;`);
  rejected(await authHTTP('/otp',{email:'timeout@example.invalid',create_user:true}),'Fixture database cancellation',500);
  await unchanged('Explicit two-second database deadline');
  query(restoreFunction);query('alter role supabase_auth_admin reset statement_timeout;');
  await startAuth(false,true);
  await sendCode('restored-member@example.invalid','/otp',{email:'restored-member@example.invalid',create_user:true},true);
  console.log('PASS missing grants/function, runtime error and explicit database cancellation create no account or mail; exact restored candidate admits again');
  await startAuth(true,true);await unchanged('Final closure');
  const final=await authHTTP('/signup',{email:'final-closed@example.invalid',password});rejected(final,'Final closed signup',422);
  assert.equal(expectedUsers,4);assert.equal(delivered,8);
  console.log(`PASS final closure and exact counts: ${expectedUsers} synthetic users/identities, ${delivered} sink messages; ${httpCount} bounded HTTP requests, ${queryCount} SQL submissions`);
} finally {
  let cleanupFailed=false;
  for(const container of ownedContainers){
    try{docker(['rm','-f',container]);const check=spawnSync('docker',['inspect',container],{stdio:'pipe',timeout:10000});if(check.status===0)cleanupFailed=true;}
    catch{cleanupFailed=true;}
  }
  if(network){
    try{docker(['network','disconnect',network,pg]);}catch{cleanupFailed=true;}
    try{docker(['network','rm',network]);const check=spawnSync('docker',['network','inspect',network],{stdio:'pipe',timeout:10000});if(check.status===0)cleanupFailed=true;}
    catch{cleanupFailed=true;}
  }
  if(cleanupFailed)throw Error('Disposable email Auth child-container/network cleanup failed');
  console.log('PASS disposable Auth, mail and template containers/internal network removed; dedicated PostgreSQL service belongs to CI teardown');
}

