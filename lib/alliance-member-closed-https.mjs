// Closed public transport only. No application, account, maintenance or key API.
// Importing/constructing does not open a socket or discover any private input.
import {createServer} from 'node:https';
import {createSecureContext} from 'node:tls';

export const allianceMemberBackendHostname='alliance-members.galacticfederation.co';
const failure=()=>Error('closed_member_https_unavailable');
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','CDN-Cache-Control':'no-store','Netlify-CDN-Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow','Connection':'close'};

export function createClosedAllianceHttpsServer({enabled=false,hostname=allianceMemberBackendHostname,readTlsMaterial,bind='127.0.0.1',port=443}={}){
 if(enabled===false)return Object.freeze({listen:async()=>({state:'disabled'}),reloadTls:async()=>false,close:async()=>{}});
 if(enabled!==true||hostname!==allianceMemberBackendHostname||!['127.0.0.1','0.0.0.0'].includes(bind)||!Number.isInteger(port)||port<0||port>65535||typeof readTlsMaterial!=='function')throw failure();
 let server,attempted=false,closed=false,closing;
 async function material(){
  try{
   const value=await readTlsMaterial();
   if(!value||Object.keys(value).sort().join(',')!=='cert,key'||![value.key,value.cert].every(v=>(typeof v==='string'||Buffer.isBuffer(v))&&v.length>0))throw failure();
   const result={key:value.key,cert:value.cert,minVersion:'TLSv1.2'};
   createSecureContext(result);return result;
  }catch{throw failure();}
 }
 function handle(request,response){
  // Never trust forwarded host/origin and never inspect or log request content.
  const host=request.headers.host,exactHost=host===hostname||host===hostname+':443';
  const body=request.headers['transfer-encoding']!==undefined||request.headers['content-length']!==undefined&&request.headers['content-length']!=='0';
  const status=!exactHost?421:body?400:['GET','HEAD'].includes(request.method)&&request.url==='/healthz'?200:503;
  response.writeHead(status,headers);
  response.end(request.method==='HEAD'?undefined:JSON.stringify(status===200?{state:'closed',memberServing:false}:{state:'unavailable'}));
 }
 async function close(){
  closed=true;
  if(closing)return closing;
  if(!server)return;
  closing=new Promise(resolve=>{server.close(()=>resolve());server.closeAllConnections();});
  return closing;
 }
 return Object.freeze({
  async listen(){
   if(attempted||closed)throw failure();attempted=true;
   try{
    const tls=await material();if(closed)throw failure();
    server=createServer({...tls,maxHeaderSize:8192,headersTimeout:10000,requestTimeout:10000,keepAliveTimeout:1000,connectionsCheckingInterval:1000},handle);
    server.maxHeadersCount=32;server.maxConnections=32;server.maxRequestsPerSocket=1;
    server.setTimeout(10000,socket=>socket.destroy());
    server.on('clientError',(_error,socket)=>socket.destroy());
    server.on('tlsClientError',()=>{});
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,bind,()=>{server.removeListener('error',reject);resolve();});});
    if(closed){await close();throw failure();}
    return {state:'closed_https_listening',port:server.address().port,memberServing:false};
   }catch{await close();throw failure();}
  },
  async reloadTls(){
   if(closed||!server?.listening)return false;
   try{const tls=await material();if(closed||!server?.listening)return false;server.setSecureContext(tls);return true;}catch{return false;}
  },close,
 });
}
