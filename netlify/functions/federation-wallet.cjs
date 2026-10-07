'use strict';
const {readPrices}=require('../lib/wallet-prices.cjs');
const ORIGIN='https://deploy-preview-99--gfof.netlify.app';
const RPC='https://api.mainnet-beta.solana.com';
const PROGRAMS=['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA','TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'];
const GFOF='Dc9CeuctqvP947ipnCJb8fSf6HhNWDooAQxsVHj2RNBV';
const USDC='EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
function addressOK(s){if(typeof s!=='string'||s.length<32||s.length>44||!/^[1-9A-HJ-NP-Za-km-z]+$/.test(s))return false;let n=0n;const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';for(const c of s)n=n*58n+BigInt(alphabet.indexOf(c));let bytes=0;while(n){bytes++;n>>=8n;}return bytes+(s.match(/^1*/)[0].length)===32;}
function quantity(raw,decimals){const s=raw.toString().padStart(decimals+1,'0');return decimals?(s.slice(0,-decimals)+'.'+s.slice(-decimals)).replace(/\.?0+$/,''):s;}
function reply(statusCode,data){return {statusCode,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','Netlify-CDN-Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'},body:JSON.stringify(data)};}
exports.handler=async event=>{
 let url;try{url=new URL(event.rawUrl);}catch{return reply(503,{error:'Wallet preview unavailable.'});}
 if(url.origin!==ORIGIN||url.pathname!=='/api/federation-wallet'||url.search)return reply(404,{error:'Not found.'});
 if(event.httpMethod!=='POST')return reply(405,{error:'Use the wallet viewer form.'});
 const headers=Object.fromEntries(Object.entries(event.headers||{}).map(([k,v])=>[k.toLowerCase(),v]));
 if(headers.origin!==ORIGIN||headers['sec-fetch-site']&&headers['sec-fetch-site']!=='same-origin')return reply(403,{error:'Open the wallet viewer on its preview page.'});
 if(!/^application\/json(?:;|$)/i.test(headers['content-type']||'')||event.isBase64Encoded||typeof event.body!=='string'||Buffer.byteLength(event.body)>256)return reply(400,{error:'Enter a public Solana address.'});
 let address;try{const body=JSON.parse(event.body);if(!body||Object.keys(body).length!==1)throw Error();address=body.address;if(!addressOK(address))throw Error();}catch{return reply(400,{error:'Enter a valid public Solana address. Never enter a seed phrase or private key.'});}
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),8000);
 async function rpc(method,params){const res=await fetch(RPC,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:controller.signal,redirect:'error'});if(!res.ok)throw Error('rpc');const reader=res.body.getReader();let size=0;const parts=[];while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2000000){await reader.cancel();throw Error('size');}parts.push(Buffer.from(value));}const data=JSON.parse(Buffer.concat(parts).toString('utf8'));if(data.error||!data.result)throw Error('rpc');return data.result;}
 try{
  const [sol,...groups]=await Promise.all([rpc('getBalance',[address,{commitment:'confirmed'}]),...PROGRAMS.map(programId=>rpc('getTokenAccountsByOwner',[address,{programId},{encoding:'jsonParsed',commitment:'confirmed'}]))]);
  if(!Number.isSafeInteger(sol.value)||sol.value<0)throw Error('balance');
  if([sol,...groups].some(r=>!Number.isSafeInteger(r.context?.slot)||r.context.slot<0))throw Error('slot');
  const aggregate=new Map();let tokenAccounts=0;
  for(const group of groups){if(!Array.isArray(group.value)||group.value.length>5000)throw Error('accounts');for(const a of group.value){tokenAccounts++;const info=a.account?.data?.parsed?.info;const t=info?.tokenAmount;if(!info||info.owner!==address||!addressOK(info.mint)||!t||typeof t.amount!=='string'||!/^\d{1,20}$/.test(t.amount)||!Number.isInteger(t.decimals)||t.decimals<0||t.decimals>255)throw Error('data');const previous=aggregate.get(info.mint);if(previous&&previous.decimals!==t.decimals)throw Error('decimals');aggregate.set(info.mint,{mint:info.mint,decimals:t.decimals,raw:(previous?.raw||0n)+BigInt(t.amount)});}}
  const tokens=[...aggregate.values()].filter(t=>t.raw>0n).sort((a,b)=>a.mint.localeCompare(b.mint));
  if(tokens.length>1000)throw Error('too-many');
  const pricing=await readPrices(tokens,sol.context?.slot);
  return reply(200,{address,network:'solana-mainnet',source:'Solana public RPC',observedAt:new Date().toISOString(),slots:[sol,...groups].map(r=>r.context?.slot),sol:quantity(BigInt(sol.value),9),tokenAccounts,tokens:tokens.map(t=>({mint:t.mint,symbol:t.mint===GFOF?'GFOF':t.mint===USDC?'USDC':null,quantity:quantity(t.raw,t.decimals)})),pricesAvailable:Object.keys(pricing.prices).length>0,pricing});
 }catch{return reply(503,{error:'Solana balance service is busy or unavailable. No balance was confirmed. Please try again later.'});}finally{clearTimeout(timer);}
};
exports.addressOK=addressOK;
exports.quantity=quantity;
