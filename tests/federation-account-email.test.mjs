import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const {createHandler}=createRequire(import.meta.url)('../netlify/functions/federation-account.cjs');
const origin='https://galacticfederation.co';
const env={FEDERATION_ACCOUNT_ENABLED:'true',FEDERATION_ACCOUNT_ORIGIN:origin,FEDERATION_AUTH_URL:'https://syntheticfixture.supabase.co',FEDERATION_AUTH_PUBLISHABLE_KEY:'sb_publishable_syntheticfixture',FEDERATION_AUTH_EMAIL_ENABLED:'true'};
const email='member@example.invalid',tokens={access_token:'synthetic-access',refresh_token:'synthetic-refresh',expires_in:3600};
const user={id:'synthetic-member',email,email_confirmed_at:'2026-10-20T18:00:00Z',is_anonymous:false};
const response=(data,status=200)=>new Response(status===204?null:JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
const event=(action,body,{jar,method='POST',headers={}}={})=>({path:'/api/federation-account/'+action,rawUrl:origin+'/api/federation-account/'+action,httpMethod:method,headers:{origin,'sec-fetch-site':'same-origin','content-type':'application/json',...(jar?{cookie:jar}:{}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
const parse=r=>JSON.parse(r.body),jar=r=>r.multiValueHeaders['Set-Cookie'].map(c=>c.split(';')[0]).join('; ');
function fixture({changes={},verify=tokens,verified=user,otpStatus=200,verifyStatus=200,clock=()=>2000000}={}){
 const calls=[];const handler=createHandler({env:{...env,...changes},now:clock,fetchImpl:async(url,init)=>{calls.push({url,init});return url.endsWith('/otp')?response({},otpStatus):url.endsWith('/verify')?response(verify,verifyStatus):response(verified);}});
 return {handler,calls,start:()=>handler(event('email-start',{email}))};
}
test('email remains disabled by default and separately exposes no signup permission',async()=>{
 const f=fixture({changes:{FEDERATION_AUTH_EMAIL_ENABLED:'false'}});assert.equal((await f.start()).statusCode,404);assert.equal(f.calls.length,0);
 const on=fixture();assert.deepEqual(parse(await on.handler(event('config',undefined,{method:'GET'}))),{enabled:true,providers:[],hasSessionCookie:false,emailEnabled:true,emailSignupEnabled:false});
});
test('email sending uses a fixed provider endpoint and forbids automatic account creation by default',async()=>{
 const f=fixture(),r=await f.start();assert.equal(r.statusCode,202);assert.match(parse(r).challenge,/^[A-Za-z0-9_-]{32}$/);assert.equal(parse(r).expiresIn,600);
 assert.equal(f.calls[0].url,env.FEDERATION_AUTH_URL+'/auth/v1/otp');assert.deepEqual(JSON.parse(f.calls[0].init.body),{email,create_user:false});
 assert.ok(r.multiValueHeaders['Set-Cookie'][0].includes('Secure; HttpOnly; SameSite=Lax; Max-Age=600'));assert.doesNotMatch(r.body,/synthetic-access|synthetic-refresh|member@example/);
});
test('email signup is controlled by an independent exact server flag',async()=>{
 for(const value of [undefined,'false','TRUE','true']){const f=fixture({changes:{FEDERATION_AUTH_EMAIL_SIGNUP_ENABLED:value}});await f.start();assert.equal(JSON.parse(f.calls[0].init.body).create_user,value==='true');}
});
test('invalid email requests and client signup or redirect overrides never reach the provider',async()=>{
 for(const body of [null,[],{}, {email:'bad'}, {email:email+'\r\nBcc:x'}, {email,create_user:true},{email,redirect_to:'https://attacker.invalid'}, {email:'a'.repeat(65)+'@example.invalid'}]){
  const f=fixture(),r=await f.handler(event('email-start',body));assert.equal(r.statusCode,400);assert.equal(f.calls.length,0);
 }
});
test('email request envelope, origin and direct-function boundaries fail closed',async()=>{
 const f=fixture();for(const e of [event('email-start',{email},{headers:{origin:'https://attacker.invalid'}}),event('email-start',{email},{headers:{'sec-fetch-site':'same-site'}})])assert.equal((await f.handler(e)).statusCode,403);
 assert.equal((await f.handler(event('email-start',{email},{headers:{'content-type':'text/plain'}}))).statusCode,400);
 assert.equal((await f.handler({...event('email-start',{email}),body:'x'.repeat(1025)})).statusCode,413);
 assert.equal((await f.handler({...event('email-start',{email}),isBase64Encoded:true})).statusCode,413);
 assert.equal((await f.handler({...event('email-start',{email}),path:'/.netlify/functions/federation-account/email-start'})).statusCode,404);assert.equal(f.calls.length,0);
});
test('ineligible addresses have the same generic send response without leaking provider reasons',async()=>{
 for(const status of [200,400,422]){const f=fixture({otpStatus:status}),r=await f.start();assert.equal(r.statusCode,202);assert.equal(parse(r).sent,true);assert.doesNotMatch(r.body,/exist|signup_disabled|eligible/);}
 const limited=fixture({otpStatus:429});assert.equal((await limited.start()).statusCode,429);
 const outage=fixture({otpStatus:503});assert.equal((await outage.start()).statusCode,502);
});
test('verified email establishes only HttpOnly cookies after an independent confirmed-user lookup',async()=>{
 const f=fixture(),start=await f.start(),r=await f.handler(event('email-verify',{code:'12345678',challenge:parse(start).challenge},{jar:jar(start)}));
 assert.equal(r.statusCode,200);assert.deepEqual(parse(r),{ok:true});assert.equal(f.calls.length,3);assert.deepEqual(JSON.parse(f.calls[1].init.body),{email,token:'12345678',type:'email'});assert.equal(f.calls[2].init.headers.Authorization,'Bearer synthetic-access');
 assert.equal(r.headers['Cache-Control'],'private, no-store');assert.equal(r.multiValueHeaders['Set-Cookie'].length,3);assert.ok(r.multiValueHeaders['Set-Cookie'].every(c=>c.includes('Secure; HttpOnly; SameSite=Lax')));assert.doesNotMatch(r.body,/12345678|synthetic|member@example/);
});
test('email verification rejects absent, duplicated, foreign, expired and future flow cookies before network',async()=>{
 for(const change of ['missing','duplicate','foreign','expired','future','oauth']){
  let clock=2000000;const f=fixture({clock:()=>clock}),start=await f.start(),challenge=parse(start).challenge;
  let cookies=jar(start);if(change==='missing')cookies='';if(change==='duplicate')cookies+='; '+cookies;if(change==='foreign')cookies='__Host-gf-flow='+encodeURIComponent(JSON.stringify({kind:'email',email,challenge:'x'.repeat(32),created:clock}));if(change==='expired')clock+=600001;if(change==='future')clock--;if(change==='oauth')cookies='__Host-gf-flow='+encodeURIComponent(JSON.stringify({state:challenge,verifier:'v'.repeat(43),created:clock}));
  const r=await f.handler(event('email-verify',{code:'12345678',challenge},{jar:cookies}));assert.equal(r.statusCode,400,change);assert.equal(f.calls.length,1,change);assert.match(r.multiValueHeaders['Set-Cookie'][0],/Max-Age=0/);
 }
});
test('malformed code and extra identity fields cannot select a different account',async()=>{
 for(const body of [{code:'12345'},{code:'123456'},{code:'1234567'},{code:'123456789'},{code:12345678},{code:'12345678',email:'other@example.invalid'},{code:'12345678',type:'recovery'}]){
  const f=fixture(),start=await f.start(),r=await f.handler(event('email-verify',{challenge:parse(start).challenge,...body},{jar:jar(start)}));assert.equal(r.statusCode,400);assert.equal(f.calls.length,1);
 }
});
test('wrong or unconfirmed returned identities and malformed sessions never set session cookies',async()=>{
 for(const options of [{verified:{...user,email:'other@example.invalid'}},{verified:{...user,email_confirmed_at:null}},{verified:{...user,is_anonymous:true}},{verify:{...tokens,refresh_token:null}},{verifyStatus:400},{verifyStatus:429}]){
  const f=fixture(options),start=await f.start(),r=await f.handler(event('email-verify',{code:'12345678',challenge:parse(start).challenge},{jar:jar(start)}));assert.ok([401,429,502].includes(r.statusCode));assert.equal(r.multiValueHeaders['Set-Cookie'].length,1);assert.match(r.multiValueHeaders['Set-Cookie'][0],/^__Host-gf-flow=.*Max-Age=0/);assert.doesNotMatch(r.body,/other@example|synthetic-access/);
 }
});
const source=readFileSync(new URL('../assets/federation/fed-account.js',import.meta.url),'utf8');
const tick=()=>new Promise(r=>setImmediate(r));
function page({emailEnabled=true,routes={}}={}){
 const ids=['account-message','google','apple','logout','identity','member-email','passport-summary','email-form','email-code-form','email-address','email-code','email-send','email-verify'];
 const elements={},handlers={},calls=[],pageHandlers={},documentHandlers={};
 for(const id of ids)elements[id]={id,value:'',textContent:'',hidden:['logout','identity','email-form','email-code-form'].includes(id),disabled:false,focus(){this.focused=true;},addEventListener(name,fn){handlers[id+':'+name]=fn;}};
 let queue=Promise.resolve();const locks={request(_name,{signal},work){const p=queue.then(()=>{signal.throwIfAborted();return work();});queue=p.catch(()=>{});return p;}};
 class Channel{postMessage(){}close(){}}
 runInNewContext(source,{document:{visibilityState:'visible',getElementById:id=>elements[id],addEventListener(name,fn){documentHandlers[name]=fn;}},navigator:{locks},BroadcastChannel:Channel,location:{origin,hash:'',search:'',assign(){throw Error('unexpected navigation');}},history:{replaceState(){}},URL,URLSearchParams,AbortController,setTimeout,clearTimeout,addEventListener(name,fn){pageHandlers[name]=fn;},fetch:async(url,init)=>{const action=url.split('/').at(-1);calls.push({action,init});if(routes[action])return routes[action](init);return {status:200,ok:true,json:async()=>action==='config'?{enabled:true,providers:[],emailEnabled,hasSessionCookie:false}:action==='email-start'?{sent:true,challenge:'c'.repeat(32)}:action==='email-verify'?{ok:true}:{signedIn:true,user}};}});
 return {elements,calls,submit:id=>handlers[id+':submit']({preventDefault(){}}),pagehide:()=>pageHandlers.pagehide(),visible:()=>documentHandlers.visibilitychange?.()};
}
test('email-only page asks for a code then verifies the cookie session without OAuth or browser token storage',async()=>{
 const p=page();await tick();assert.equal(p.elements['email-form'].hidden,false);p.elements['email-address'].value=email;await p.submit('email-form');assert.equal(p.elements['email-code'].focused,true);assert.equal(p.elements['email-code-form'].hidden,false);
 p.elements['email-code'].value='12345678';await p.submit('email-code-form');assert.deepEqual(p.calls.map(c=>c.action),['config','email-start','email-verify','session']);assert.equal(p.elements['email-code'].value,'');assert.equal(p.elements.identity.hidden,false);assert.equal(p.elements['email-form'].hidden,true);assert.equal(p.elements['member-email'].textContent,email);p.pagehide();
});
test('disabled email and invalid codes cannot dispatch sign-in requests',async()=>{
 const closed=page({emailEnabled:false});await tick();await closed.submit('email-form');assert.equal(closed.calls.length,1);assert.equal(closed.elements['email-form'].hidden,true);closed.pagehide();
 const p=page();await tick();p.elements['email-address'].value=email;await p.submit('email-form');p.elements['email-code'].value='123';await p.submit('email-code-form');assert.equal(p.calls.length,2);p.pagehide();
});
test('uncertain email verification clears code, requests reload and does not retry or fetch a session',async()=>{
 const p=page({routes:{'email-verify':async()=>{throw Error('network');}}});await tick();p.elements['email-address'].value=email;await p.submit('email-form');p.elements['email-code'].value='12345678';await p.submit('email-code-form');assert.equal(p.elements.identity.hidden,true);assert.match(p.elements['account-message'].textContent,/Reload/);assert.equal(p.elements['email-code'].value,'');const n=p.calls.length;await p.submit('email-form');assert.equal(p.calls.length,n);p.pagehide();
});
test('late email send response cannot repopulate the form after pagehide',async()=>{
 let release;const gate=new Promise(r=>release=r);const p=page({routes:{'email-start':async()=>{await gate;return {ok:true,status:202,json:async()=>({sent:true,challenge:'c'.repeat(32)})};}}});await tick();p.elements['email-address'].value=email;const sending=p.submit('email-form');await tick();p.pagehide();release();await sending;assert.equal(p.elements['email-code-form'].hidden,true);assert.equal(p.elements.identity.hidden,true);
});

test('visibility readback cannot reopen sign-in after uncertain verification',async()=>{
 const p=page({routes:{'email-verify':async()=>{throw Error('network');}}});await tick();p.elements['email-address'].value=email;await p.submit('email-form');p.elements['email-code'].value='12345678';await p.submit('email-code-form');p.visible();await tick();const n=p.calls.length;await p.submit('email-form');assert.equal(p.calls.length,n);assert.match(p.elements['account-message'].textContent,/Reload/);assert.equal(p.elements['email-form'].hidden,true);p.pagehide();
});

test('leaving a signed-in page clears the success message without reopening sign-in',async()=>{
 const p=page();await tick();p.elements['email-address'].value=email;await p.submit('email-form');p.elements['email-code'].value='12345678';await p.submit('email-code-form');
 assert.equal(p.elements.identity.hidden,false);p.pagehide();
 assert.equal(p.elements.identity.hidden,true);assert.equal(p.elements['email-form'].hidden,true);assert.equal(p.elements['email-code-form'].hidden,true);assert.doesNotMatch(p.elements['account-message'].textContent,/You are signed in/);
});
