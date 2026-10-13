const WINDOW=60000, LIMIT=24, DAY_LIMIT=3000, MIN_GAP=2500;
const WALLET_DAY_LIMIT=500,WALLET_MIN_GAP=1000;
const headers={'Content-Type':'application/json','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
const reply=(status,allowed=false)=>new Response(JSON.stringify({allowed}),{status,headers});
const walletReply=(status,reason)=>new Response(JSON.stringify({allowed:false,reason}),{status,headers});
// One named SQLite object coordinates every server instance. No address, IP,
// holdings, mint list, API key or request log is stored in its budget row.
export class PriceBudget {
 constructor(ctx){this.storage=ctx.storage;ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS budget (id INTEGER PRIMARY KEY CHECK(id=1), day INTEGER NOT NULL, used INTEGER NOT NULL, last INTEGER NOT NULL, times TEXT NOT NULL)');ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS wallet_budget (id INTEGER PRIMARY KEY CHECK(id=1), day INTEGER NOT NULL, used INTEGER NOT NULL, last INTEGER NOT NULL)');}
 reserveWallet(){
  try{return this.storage.transactionSync(()=>{
   const now=Date.now(),day=Math.floor(now/86400000);if(!Number.isSafeInteger(now)||now<0)throw Error();
   const row=this.storage.sql.exec('SELECT day, used, last FROM wallet_budget WHERE id=1').toArray()[0];let used=0;
   if(row){if(!Number.isSafeInteger(row.day)||row.day<0||day<row.day||!Number.isSafeInteger(row.used)||row.used<0||row.used>WALLET_DAY_LIMIT||!Number.isSafeInteger(row.last)||row.last<0||now<row.last)throw Error();used=day===row.day?row.used:0;}
   if(used>=WALLET_DAY_LIMIT)return walletReply(429,'day');
   if(row&&now-row.last<WALLET_MIN_GAP)return walletReply(429,'spacing');
   this.storage.sql.exec('INSERT INTO wallet_budget (id,day,used,last) VALUES (1,?,?,?) ON CONFLICT(id) DO UPDATE SET day=excluded.day,used=excluded.used,last=excluded.last',day,used+1,now);
   return reply(200,true);
  });}catch{return reply(503);}
 }
 fetch(request){
  if(request){try{const path=new URL(request.url||request).pathname;if(path==='/reserve-wallet')return this.reserveWallet();if(path!=='/reserve-price')return reply(404);}catch{return reply(404);}}
  try{return this.storage.transactionSync(()=>{
   const now=Date.now(),day=Math.floor(now/86400000);
   if(!Number.isSafeInteger(now)||now<0)throw Error();
   const row=this.storage.sql.exec('SELECT day, used, last, times FROM budget WHERE id=1').toArray()[0];
   let times=[],used=0;
   if(row){
    times=JSON.parse(row.times);used=row.used;
    if(!Number.isSafeInteger(row.day)||!Number.isSafeInteger(used)||used<0||used>DAY_LIMIT||!Number.isSafeInteger(row.last)||now<row.last||!Array.isArray(times)||times.length>LIMIT||times.some((t,i)=>!Number.isSafeInteger(t)||t<0||t>row.last||(i&&t<times[i-1])))throw Error();
    if(day<row.day)throw Error();if(day>row.day)used=0;
    times=times.filter(t=>now-t<WINDOW);
   }
   // Space reservations as well as capping totals: a minute allowance must
   // not permit a simultaneous burst against the upstream service.
   if((row&&now-row.last<MIN_GAP)||times.length>=LIMIT||used>=DAY_LIMIT)return reply(429);
   times.push(now);
   this.storage.sql.exec('INSERT INTO budget (id,day,used,last,times) VALUES (1,?,?,?,?) ON CONFLICT(id) DO UPDATE SET day=excluded.day,used=excluded.used,last=excluded.last,times=excluded.times',day,used+1,now,JSON.stringify(times));
   // Reservations are never refunded: network failures must not add capacity.
   return reply(200,true);
  });}catch{return reply(503);}
 }
}
async function authorized(value,secret){
 if(typeof secret!=='string'||!/^[-A-Za-z0-9_]{43,128}$/.test(secret)||value!=='Bearer '+secret)return false;
 return true;
}
export default {
 async fetch(request,env){
  try{
   const url=new URL(request.url);
   if(!['/reserve-price','/reserve-wallet'].includes(url.pathname)||url.search)return reply(404);
   if(request.method!=='POST')return reply(405);
   if(!await authorized(request.headers.get('authorization'),env.BUDGET_SECRET))return reply(403);
   // This endpoint accepts no payload, so callers cannot send wallet records.
   if(request.body){const reader=request.body.getReader();try{const first=await reader.read();if(!first.done&&first.value?.length)return reply(400);}finally{void reader.cancel().catch(()=>{});}}
   const id=env.PRICE_BUDGET.idFromName('price-preview-v1');
   return await env.PRICE_BUDGET.get(id).fetch('https://budget.internal'+url.pathname,{method:'POST'});
  }catch{return reply(503);}
 }
};
