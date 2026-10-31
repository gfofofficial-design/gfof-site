// Explicit application transport. Construction never opens a socket or prepares
// a member generation; trusted composition supplies an already-owned host.
import {createServer} from 'node:https';
import {createSecureContext} from 'node:tls';
import {createPersistentAllianceNodeHttp} from './alliance-member-node-http.mjs';
import {allianceMemberBackendHostname as hostname} from './alliance-member-closed-https.mjs';

const failure=()=>Error('persistent_member_https_unavailable');
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','CDN-Cache-Control':'no-store','Netlify-CDN-Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow','Connection':'close'};

export function createPersistentAllianceHttpsServer({enabled=false,readTlsMaterial,bind='127.0.0.1',port=443,origin,installation,applicationHost}={}){
 if(enabled===false)return Object.freeze({listen:async()=>({state:'disabled'}),reloadTls:async()=>false,close:async()=>{}});
 let bridge;
 try{
  if(enabled!==true||!['127.0.0.1','0.0.0.0'].includes(bind)||!Number.isInteger(port)||port<0||port>65535||typeof readTlsMaterial!=='function')throw failure();
  bridge=createPersistentAllianceNodeHttp({enabled:true,origin,installation,applicationHost});
 }catch{throw failure();}
 let server,attempted=false,closed=false,closing;
 async function material(){
  try{
   const value=await readTlsMaterial();
   if(!value||Object.keys(value).sort().join(',')!=='cert,key'||![value.key,value.cert].every(v=>(typeof v==='string'||Buffer.isBuffer(v))&&v.length>0&&Buffer.byteLength(v)<=1048576))throw failure();
   const result={key:value.key,cert:value.cert,minVersion:'TLSv1.2'};
   createSecureContext(result);return result;
  }catch{throw failure();}
 }
 function handle(request,response){
  if(request.url==='/healthz'){
   const exactHost=request.headers.host===hostname||request.headers.host===hostname+':443';
   const hasBody=request.headers['transfer-encoding']!==undefined||request.headers['content-length']!==undefined&&request.headers['content-length']!=='0';
   const ok=exactHost&&!hasBody&&['GET','HEAD'].includes(request.method)&&!closed;
   response.writeHead(ok?200:503,headers);
   // Transport availability is not evidence of startup, SERVE or provider drain.
   response.end(request.method==='HEAD'?undefined:JSON.stringify(ok?{state:'transport_ready'}:{state:'unavailable'}));
   request.resume();return;
  }
  void bridge.handle(request,response).catch(()=>{request.resume();if(!response.destroyed&&!response.writableEnded){response.writeHead(503,headers);response.end(JSON.stringify({state:'unavailable'}));}void close();});
 }
 function close(){
  closed=true;if(closing)return closing;
  // Stop admission and connections before awaiting actual application closure.
  const application=Promise.resolve().then(()=>bridge.close());
  const network=server?new Promise(resolve=>{server.close(()=>resolve());server.closeAllConnections();}):Promise.resolve();
  closing=Promise.all([application,network]).then(()=>undefined);
  return closing;
 }
 return Object.freeze({
  async listen(){
   if(attempted||closed)throw failure();attempted=true;
   try{
    const tls=await material();if(closed)throw failure();
    server=createServer({...tls,maxHeaderSize:32768,headersTimeout:10000,requestTimeout:20000,keepAliveTimeout:1000,connectionsCheckingInterval:1000},handle);
    server.maxHeadersCount=64;server.maxConnections=32;server.maxRequestsPerSocket=1;
    server.setTimeout(20000,socket=>socket.destroy());
    server.on('clientError',(_error,socket)=>socket.destroy());server.on('tlsClientError',()=>{});
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,bind,()=>{server.removeListener('error',reject);resolve();});});
    server.on('error',()=>{void close().catch(()=>{});});
    if(closed){await close();throw failure();}
    return {state:'member_transport_listening',port:server.address().port};
   }catch{try{await close();}catch{}throw failure();}
  },
  async reloadTls(){
   if(closed||!server?.listening)return false;
   try{const tls=await material();if(closed||!server?.listening)return false;server.setSecureContext(tls);return true;}catch{return false;}
  },close,
 });
}
