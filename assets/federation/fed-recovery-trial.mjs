// Isolated acceptance helper. Tokens live only in this closure, never storage.
export const TRIAL_URL='https://arjycxziiqlkfomieocc.supabase.co';
export function createRecoveryTrial({key,email,fetcher=fetch}={}){
 if(typeof email!=='string'||email.length>254||!/^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/.test(email))throw Error('Test configuration unavailable.');
 if(!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key||''))throw Error('Test configuration unavailable.');
 let state='ready',access='',refresh='',busy=false,disposed=false;
 async function call(path,{method='POST',body,token}={}){
  const controller=new AbortController();let reader,timer;
  const stopped=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('Test request timed out. Stop and report the result.'));},12000);});
  try{return await Promise.race([(async()=>{
   const response=await fetcher(TRIAL_URL+'/auth/v1/'+path,{method,redirect:'error',credentials:'omit',cache:'no-store',signal:controller.signal,headers:{apikey:key,...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
   if(disposed)throw Error('Test page closed.');
   if(!response.ok)throw Error(response.status===429?'Test rate limit reached. Stop; do not retry.':'Provider refused this test step. Stop and report the result.');
   if(response.status===204)return null;
   if(!response.body)throw Error('Test response unavailable.');
   reader=response.body.getReader();let size=0;const chunks=[];
   for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>65536)throw Error('Test response too large.');chunks.push(value);}
   const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
   if(disposed)throw Error('Test page closed.');return JSON.parse(new TextDecoder().decode(bytes));
  })(),stopped]);}finally{clearTimeout(timer);controller.abort();try{Promise.resolve(reader?.cancel()).catch(()=>{});}catch{}}
 }
 async function run(work){if(busy||disposed||state==='stopped')throw Error('Test is closed or busy.');busy=true;try{return await work();}catch(error){state='stopped';access='';refresh='';throw error;}finally{busy=false;}}
 async function accept(data){
  if(typeof data?.access_token!=='string'||!data.access_token||data.access_token.length>8000||typeof data.refresh_token!=='string'||!data.refresh_token||data.refresh_token.length>8000)throw Error('Invalid test session.');
  const u=await call('user',{method:'GET',token:data.access_token});
  if(!u?.id||u.email?.toLowerCase()!==email||!u.email_confirmed_at||u.is_anonymous!==false||u.id!==data.user?.id)throw Error('Unexpected test identity.');
  access=data.access_token;refresh=data.refresh_token;
 }
 return Object.freeze({
  state:()=>state,
  requestCode:()=>run(async()=>{if(state!=='ready')throw Error('Only one recovery email is allowed.');state='requested';await call('recover',{body:{email:email}});return {state};}),
  verifyCode:code=>run(async()=>{if(state!=='requested'||!/^\d{8}$/.test(code||''))throw Error('Enter the eight-digit recovery code.');await accept(await call('verify',{body:{email:email,token:code,type:'recovery'}}));state='recovered';return {state};}),
  setPassword:password=>run(async()=>{if(state!=='recovered'||typeof password!=='string'||password.length<12||password.length>128)throw Error('Use a new test password of 12–128 characters.');await call('user',{method:'PUT',token:access,body:{password}});await call('logout?scope=local',{token:access});access='';refresh='';state='password-set';return {state};}),
  login:password=>run(async()=>{if(state!=='password-set'||typeof password!=='string'||password.length>128)throw Error('Test password login is unavailable.');await accept(await call('token?grant_type=password',{body:{email:email,password}}));state='signed-in';return {state};}),
  logout:()=>run(async()=>{if(state!=='signed-in')throw Error('No test session.');await call('logout?scope=local',{token:access});access='';refresh='';state='complete';return {state};}),
  dispose(){disposed=true;access='';refresh='';state='stopped';}
 });
}
