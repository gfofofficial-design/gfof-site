// Explicit, closed-by-default session bridge. Never reads tokens or selects a
// backend actor. Every member route must still authenticate its current cookie.
export function createAllianceAccountBridge({enabled=false,origin,memberPage,fetcher=globalThis.fetch,
 locks=globalThis.navigator?.locks,document=globalThis.document,window=globalThis.window,
 channelFactory=name=>new BroadcastChannel(name),timeoutMs=12000}={}){
 if(typeof enabled!=='boolean'||!memberPage||typeof memberPage.attach!=='function'||typeof memberPage.detach!=='function'
 ||enabled&&(!/^https:\/\/(?:galacticfederation\.co|deploy-preview-[1-9][0-9]*--gfof\.netlify\.app)$/.test(origin)
 ||typeof fetcher!=='function'||typeof locks?.request!=='function')
 ||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>12000)throw Error('account_bridge_configuration');
 let disposed=false,epoch=0,generation=0,flight=null,channel=null,state='closed';
 function close(){epoch++;flight?.abort();memberPage.detach();state='closed';}
 const invalidate=()=>close();
 document?.addEventListener('visibilitychange',invalidate);
 window?.addEventListener('pagehide',invalidate);
 try{if(enabled){channel=channelFactory('gf-account-status');channel.onmessage=event=>{
  // An untrusted hint may close a page, never open one or establish identity.
  if(!disposed&&event.data?.type==='signed-out')close();
 };}}catch{channel=null;}
 memberPage.detach();
 async function verify(){
  if(!enabled||disposed||flight)return false;
  close();const turn=epoch,c=new AbortController();flight=c;state='checking';
  let expire;
  const deadline=new Promise(resolve=>{expire=setTimeout(()=>{if(epoch===turn){close();state='unavailable';}resolve(false);},timeoutMs);});
  const valid=()=>!disposed&&epoch===turn&&!c.signal.aborted;
  const work=(async()=>{
   let reader,response;
   try{return await locks.request('gf-account-session',{mode:'exclusive',signal:c.signal},async()=>{
    if(!valid())return false;
    response=await fetcher(origin+'/api/federation-account/session',{
     method:'GET',credentials:'same-origin',cache:'no-store',redirect:'error',signal:c.signal,
     headers:{Accept:'application/json'}
    });
    if(!valid())return false;
    if(response.status!==200){state=response.status===401?'signed_out':'unavailable';return false;}
    if(!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type')||'')||!response.body)throw Error('session_response');
    reader=response.body.getReader();let size=0;const chunks=[];
    for(;;){const part=await reader.read();if(!valid())return false;if(part.done)break;
     if(!(part.value instanceof Uint8Array)||(size+=part.value.byteLength)>4096)throw Error('session_response');chunks.push(part.value);}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    const data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
    if(data?.signedIn!==true||!data.user||typeof data.user.id!=='string'
     ||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.user.id))throw Error('session_response');
    if(!valid())return false;
    if(!Number.isSafeInteger(generation+1))throw Error('generation_exhausted');
    const attached=memberPage.attach(++generation)===true;
    if(!attached)memberPage.detach();state=attached?'attached':'unavailable';return attached;
   });}catch{if(valid()){close();state='unavailable';}return false;}
   finally{
    clearTimeout(expire);c.abort();try{void Promise.resolve(reader?reader.cancel():response?.body?.cancel()).catch(()=>{});}catch{}
    if(flight===c)flight=null;
   }
  })();
  return Promise.race([work,deadline]);
 }
 return Object.freeze({verify,close(){if(!disposed)close();},getState(){return Object.freeze({status:state});},
  dispose(){if(disposed)return;close();disposed=true;document?.removeEventListener('visibilitychange',invalidate);
   window?.removeEventListener('pagehide',invalidate);try{channel?.close();}catch{}channel=null;}});
}
