'use strict';
(()=>{
 const MINT='Dc9CeuctqvP947ipnCJb8fSf6HhNWDooAQxsVHj2RNBV';
 const PROGRAM='strmRqUCoQUgGUan5YhzUZa6KqdzwX5L6FpUxfmKg5m';
 const TOKEN_PROGRAM='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
 const LOCKS=[
  ['AiRhuw9iFyXiZYv2hqanBK12dckebF4vNMoAzj9Nj9nY','F1iUer7wVsdv7uQ4if77Jy1ZAfTVDjSy4Pd7ZiXsVfS1'],
  ['BW6ZUUT5NXxSGMKNAzoMYbqrXy5Dm1ev1ekEgYSXJWX8','9NeQZao9SNt7FztKbNMCwCmEYZTYkWnidZmW4chuupQq'],
  ['EPdpg7AYEzcwudN7TRdEkCGHQeHRrFhoK2yiYxDdGLnv','DkzEr7nsuhL4Ser6AyZQ71u2mBdGj86mXmHDAzpS1Pop']
 ];
 const button=document.getElementById('deck-lock-refresh'),message=document.getElementById('deck-lock-message'),cards=document.getElementById('deck-lock-cards'),plot=document.getElementById('deck-lock-timeline');
 let pending=false;
 const number=n=>n.toLocaleString('en-US',{maximumFractionDigits:6});
 const date=ts=>new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric',year:'numeric'}).format(new Date(ts*1000));
 function element(tag,text,className){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;}
 function base58(bytes){
  const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';let n=0n,out='';
  for(const b of bytes)n=n*256n+BigInt(b);
  while(n){out=alphabet[Number(n%58n)]+out;n/=58n;}
  for(const b of bytes){if(b!==0)break;out='1'+out;}
  return out;
 }
 function u64(bytes,offset){
  const n=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getBigUint64(offset,true);
  if(n>BigInt(Number.MAX_SAFE_INTEGER))throw Error('Unsafe quantity');
  return Number(n);
 }
 function decode(data){
  if(data.mint!==MINT||data.commitment!=='finalized'||!Number.isSafeInteger(data.slot)||data.slot<0||!Array.isArray(data.accounts)||data.accounts.length!==7||Math.abs(Date.now()-Date.parse(data.observedAt))>120000||!Number.isFinite(Date.parse(data.observedAt)))throw Error('Unverified read');
  const byAddress=new Map(data.accounts.map(e=>[e.address,e.account]));
  if(byAddress.size!==7)throw Error('Duplicate account');
  const mint=byAddress.get(MINT),info=mint?.data?.parsed?.info;
  if(mint?.owner!==TOKEN_PROGRAM||info?.decimals!==6||info?.supply!=='1000000000000000')throw Error('Mint changed');
  return LOCKS.map(([metadata,escrow],index)=>{
   const account=byAddress.get(metadata),token=byAddress.get(escrow),balance=token?.data?.parsed?.info;
   if(account?.owner!==PROGRAM||!Array.isArray(account.data)||account.data[1]!=='base64')throw Error('Metadata unavailable');
   const bytes=Uint8Array.from(atob(account.data[0]),c=>c.charCodeAt(0));
   if(bytes.length!==1104||bytes[8]!==4||base58(bytes.slice(177,209))!==MINT||base58(bytes.slice(209,241))!==escrow)throw Error('Contract mismatch');
   if(token?.owner!==TOKEN_PROGRAM||balance?.mint!==MINT||balance?.tokenAmount?.decimals!==6||!/^\d+$/.test(balance.tokenAmount.amount))throw Error('Escrow mismatch');
   const raw=Number(balance.tokenAmount.amount),principal=u64(bytes,417),withdrawn=u64(bytes,17),cliff=u64(bytes,441),end=u64(bytes,33),canceled=u64(bytes,25);
   if(!Number.isSafeInteger(raw)||withdrawn>principal||u64(bytes,409)!==cliff||end!==cliff||u64(bytes,449)!==principal||cliff<1577836800||cliff>4102444800)throw Error('Unsupported schedule');
   const amount=(canceled?0:Math.min(raw,principal-withdrawn))/1e6;
   return {index,metadata,escrow,amount,cliff,status:canceled?'Canceled':Date.now()/1000>=end?'Unlocked':amount>0?'Locked':'Empty'};
  });
 }
 function render(locks,data){
  cards.replaceChildren();plot.replaceChildren();
  const total=locks.reduce((n,l)=>n+l.amount,0);
  document.getElementById('deck-lock-total').textContent=number(total)+' GFOF';
  document.getElementById('deck-lock-percent').textContent=(total/1e9*100).toFixed(2)+'% of minted supply · scheduled tokens in escrow';
  for(const lock of locks){
   const card=element('article',undefined,'lock-signal');card.append(element('h3','Lock '+(lock.index+1)));
   card.append(element('span',lock.status,'status'));card.append(element('strong',number(lock.amount)+' GFOF','lock-quantity'));
   const share=total?lock.amount/total:0,meter=element('meter');meter.min=0;meter.max=1;meter.value=share;meter.setAttribute('aria-label','Lock '+(lock.index+1)+': '+(share*100).toFixed(1)+'% of the combined scheduled tokens in escrow');card.append(meter);
   card.append(element('p','Full cliff: '+date(lock.cliff)+' · midnight Chicago'));
   const a=element('a','Verify on Streamflow →');a.href='https://app.streamflow.finance/contract/solana/mainnet/'+lock.metadata;a.target='_blank';a.rel='noopener noreferrer';card.append(a);cards.append(card);
  }
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 720 120');svg.setAttribute('role','img');svg.setAttribute('aria-label','Full-cliff dates spaced by time. '+locks.map(l=>'Lock '+(l.index+1)+': '+date(l.cliff)).join('; ')+'. Exact dates are in the lock cards.');
  const sorted=[...locks].sort((a,b)=>a.cliff-b.cliff),first=sorted[0].cliff,last=sorted[2].cliff;
  const line=document.createElementNS('http://www.w3.org/2000/svg','line');line.setAttribute('x1','40');line.setAttribute('x2','680');line.setAttribute('y1','55');line.setAttribute('y2','55');svg.append(line);
  for(const lock of sorted){
   const x=first===last?360:40+(lock.cliff-first)/(last-first)*640;
   const circle=document.createElementNS('http://www.w3.org/2000/svg','circle');circle.setAttribute('cx',String(x));circle.setAttribute('cy','55');circle.setAttribute('r','7');svg.append(circle);
   const text=document.createElementNS('http://www.w3.org/2000/svg','text');text.setAttribute('x',String(x));text.setAttribute('y',lock.index===0?'90':'30');text.setAttribute('text-anchor',x>650?'end':x<70?'start':'middle');text.textContent='Lock '+(lock.index+1)+' · '+date(lock.cliff);svg.append(text);
  }
  plot.append(svg);message.textContent='Finalized slot '+data.slot+' · observed '+new Date(data.observedAt).toLocaleString()+'. Bars compare these three locks only. Escrow excess is excluded.';
 }
 async function refresh(){
  if(pending)return;pending=true;button.disabled=true;message.textContent='Reading the three public contracts…';
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{
   const response=await fetch('/api/treasury-locks',{credentials:'omit',signal:controller.signal});
   if(!response.ok)throw Error('Unavailable');
   const data=await response.json();render(decode(data),data);
  }catch{
   cards.replaceChildren();plot.replaceChildren();document.getElementById('deck-lock-total').textContent='Unavailable';document.getElementById('deck-lock-percent').textContent='Current read could not be verified';
   message.textContent='The current lock read is unavailable. Use the dated treasury evidence and contract links; no current total is inferred.';
  }finally{clearTimeout(timer);pending=false;button.disabled=false;}
 }
 button.addEventListener('click',refresh);refresh();
})();
