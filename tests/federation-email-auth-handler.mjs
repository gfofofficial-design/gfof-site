// Actual application handler with real fixture HTTP responses. No browser/runtime flags.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {createHandler}=createRequire(import.meta.url)('../netlify/functions/federation-account.cjs');
const origin='https://account.example.invalid';
const parse=result=>JSON.parse(result.body);
const cookieLines=result=>result.multiValueHeaders?.['Set-Cookie']||[];
const cookieHeader=result=>cookieLines(result).filter(value=>!value.includes('Max-Age=0')).map(value=>value.split(';')[0]).join('; ');
function response(result,expected,label){
  assert.equal(result.statusCode,expected,`${label}: unexpected application HTTP status`);
  assert.equal(result.headers['Cache-Control'],'private, no-store',`${label}: cacheable response`);
}
export async function handlerAcceptance({fetchImpl,messages,delivery,unchanged,email,id}) {
  let now=Date.now(),requests=0;
  const handler=createHandler({env:{FEDERATION_ACCOUNT_ENABLED:'true',FEDERATION_ACCOUNT_ORIGIN:origin,
    FEDERATION_AUTH_URL:'https://syntheticfixture.supabase.co',FEDERATION_AUTH_PUBLISHABLE_KEY:'sb_publishable_fixtureonly',
    FEDERATION_AUTH_EMAIL_ENABLED:'true',FEDERATION_AUTH_EMAIL_SIGNUP_ENABLED:'false'},now:()=>now,
    fetchImpl:async(url,options)=>{requests++;return fetchImpl(url,options);}});
  const event=(action,body,jar='',method='POST')=>({path:'/api/federation-account/'+action,
    rawUrl:origin+'/api/federation-account/'+action,httpMethod:method,
    headers:{origin,'sec-fetch-site':'same-origin','content-type':'application/json',...(jar?{cookie:jar}:{})},
    ...(body===undefined?{}:{body:JSON.stringify(body)})});
  const unsigned=await handler(event('session',undefined,'','GET'));response(unsigned,401,'Unsigned session');
  const foreign=event('email-start',{email});foreign.headers.origin='https://foreign.example.invalid';
  response(await handler(foreign),403,'Foreign origin');
  const direct=event('email-start',{email});direct.path='/.netlify/functions/federation-account/email-start';
  response(await handler(direct),404,'Direct function route');
  assert.equal(requests,0,'Local boundary failure reached provider');
  const config=await handler(event('config',undefined,'','GET'));response(config,200,'Config');
  assert.equal(parse(config).emailSignupEnabled,false,'Application signup was opened');
  const before=await messages();
  const started=await handler(event('email-start',{email}));response(started,202,'Start email sign-in');
  assert(parse(started).sent===true&&parse(started).expiresIn===600,'Wrong start contract');
  const challenge=parse(started).challenge,flowJar=cookieHeader(started);
  const code=await delivery(email,before);
  const verified=await handler(event('email-verify',{code,challenge},flowJar));response(verified,200,'Verify real sink code');
  assert(verified.body==='{"ok":true}','Application returned unexpected verification payload');
  const lines=cookieLines(verified);
  assert(lines.length===3&&lines.every(value=>value.includes('Path=/; Secure; HttpOnly; SameSite=Lax')),'Unsafe session cookie attributes');
  assert(lines.every(value=>!/[; ]Domain=/i.test(value)),'Session cookie is not host-only');
  assert(lines.some(value=>value.startsWith('__Host-gf-flow=')&&value.includes('Max-Age=0')),'Flow cookie not cleared');
  const signedJar=cookieHeader(verified);
  const session=await handler(event('session',undefined,signedJar,'GET'));response(session,200,'Current session');
  assert(parse(session).signedIn===true&&parse(session).user?.id===id&&parse(session).user?.email===email,'Wrong composed account');
  const refreshed=await handler(event('refresh',{},signedJar));response(refreshed,200,'Refresh');
  assert(refreshed.body==='{"ok":true}','Refresh exposed unexpected payload');
  const freshJar=cookieHeader(refreshed);
  const out=await handler(event('logout',{},freshJar));response(out,200,'Logout');
  assert(parse(out).remoteRevoked===true&&parse(out).signedOut===true,'Remote logout not verified');
  assert(cookieLines(out).length===3&&cookieLines(out).every(value=>value.includes('Max-Age=0')),'Logout did not clear cookies');
  response(await handler(event('refresh',{},freshJar)),401,'Refresh after real logout');
  response(await handler(event('session',undefined,'','GET')),401,'Empty session after logout');
  await unchanged('Composed verified session');
  const unknown=await handler(event('email-start',{email:'unknown-handler@example.invalid'}));response(unknown,202,'Neutral unknown address');
  assert(parse(unknown).sent===true&&parse(unknown).expiresIn===600,'Unknown address response reveals eligibility');
  await unchanged('Composed unknown address');

  // A second received code cannot bypass the application's expired flow cookie.
  await new Promise(resolve=>setTimeout(resolve,1100));
  const beforeExpiry=await messages();
  const expiring=await handler(event('email-start',{email}));response(expiring,202,'Start expiring flow');
  const unused=await delivery(email,beforeExpiry),beforeVerify=requests;
  now+=600001;
  const expired=await handler(event('email-verify',{code:unused,challenge:parse(expiring).challenge},cookieHeader(expiring)));
  response(expired,400,'Expired application flow');assert.equal(requests,beforeVerify,'Expired flow reached provider');
  assert(cookieLines(expired).length===1&&cookieLines(expired)[0].includes('Max-Age=0'),'Expired flow not cleared');
  await unchanged('Composed expired flow');
  return {requests};
}
