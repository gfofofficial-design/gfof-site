// Pure models for fictional stories. No network or real accounts.
export const booths={side:{fee:20,extra:0,name:'Side-lane stall'},central:{fee:50,extra:4,name:'Central stall'}};
export function marketResult({booth,stock,price,weather='quiet',disposal='keep'}){
 const b=booths[booth],demand=(weather==='quiet'?(price===8?6:4):(price===8?18:10))+b.extra;
 const sold=Math.min(stock,demand),left=stock-sold,revenue=sold*price,resale=disposal==='resell'?left*2:0;
 return {sold,left,revenue,resale,outflow:b.fee+stock*4,cash:200-b.fee-stock*4+revenue+resale,held:['resell','donate'].includes(disposal)?0:left};
}
export const market={
 initial:()=>({step:'intro',cash:200,booth:null,stock:0,price:0,weather:'quiet',disposal:null}),
 step(state,action){const s=structuredClone(state);
  if(s.step==='intro'&&action==='begin')s.step='booth';
  else if(s.step==='booth'&&Object.hasOwn(booths,action)){s.booth=action;s.cash-=booths[action].fee;s.step='stock';}
  else if(s.step==='stock'&&['10','20','30'].includes(action)){s.stock=Number(action);s.cash-=s.stock*4;s.step='price';}
  else if(s.step==='price'&&['8','12'].includes(action)){s.price=Number(action);s.result=marketResult(s);s.cash=s.result.cash;s.step='close';}
  else if(s.step==='close'&&['keep','resell','donate'].includes(action)){s.disposal=action;s.result=marketResult(s);s.cash=s.result.cash;s.step='reflect';}
  else throw Error('Unavailable market choice');return s;
 }
};
export function savingsProjection(s,rate=s.rate){
 const remaining=Math.max(0,s.target-s.saved),weeks=remaining===0?0:rate===0?null:Math.ceil(remaining/rate);
 return {remaining,weeks,arrivalWeek:weeks===null?null:s.elapsed+s.breakWeeks+weeks};
}
export const savings={
 initial:()=>({step:'intro',saved:30,originalTarget:0,target:0,oldRate:0,rate:0,elapsed:0,breakWeeks:0}),
 step(state,action){const s=structuredClone(state);
  if(s.step==='intro'&&action==='begin')s.step='goal';
  else if(s.step==='goal'&&['90','120'].includes(action)){s.target=s.originalTarget=Number(action);s.step='pace';}
  else if(s.step==='pace'&&['5','10','15'].includes(action)){s.oldRate=Number(action);s.saved+=s.oldRate*2;s.elapsed=2;s.step='change';}
  else if(s.step==='change'&&action==='cover'){s.saved-=20;s.step='goal-again';}
  else if(s.step==='goal-again'&&['keep','smaller'].includes(action)){if(action==='smaller')s.target=60;s.step='break';}
  else if(s.step==='break'&&['continue','pause'].includes(action)){s.breakWeeks=action==='pause'?2:0;s.step='revise';}
  else if(s.step==='revise'&&['0','5','10','15'].includes(action)){s.rate=Number(action);s.step='reflect';}
  else throw Error('Unavailable planning choice');return s;
 }
};
export const gate={
 initial:()=>({step:'intro',cash:100,known:true,allowance:0,verified:false,inspected:false,connected:false,sharedLog:false,secret:false,outcome:null}),
 step(state,action){const s=structuredClone(state);
  if(s.step==='intro'&&action==='begin')s.step='request';
  else if(s.step==='request'&&action==='inspect')s.inspected=true;
  else if(s.step==='request'&&action==='verify')s.verified=true;
  else if(s.step==='request'&&action==='leave'){s.outcome='leave';s.step='reflect';}
  else if(s.step==='request'&&action==='public'&&s.verified){s.outcome='map';s.step='privacy';}
  else if(s.step==='request'&&action==='broad'){s.cash=60;s.allowance=60;s.connected=true;s.step='incident';}
  else if(s.step==='privacy'&&['local','share-log'].includes(action)){s.sharedLog=action==='share-log';s.step='reflect';}
  else if(s.step==='incident'&&action==='disconnect'){s.connected=false;s.step='check';}
  else if(['incident','check'].includes(s.step)&&action==='revoke'){s.connected=false;s.allowance=0;s.outcome='revoked';s.step='reflect';}
  else if(s.step==='check'&&action==='leave-open'){s.outcome='open';s.step='reflect';}
  else if(['incident','check'].includes(s.step)&&action==='support')s.step='support';
  else if(s.step==='support'&&action==='protect'){s.step='check';s.connected=false;}
  else if(s.step==='support'&&action==='share-secret'){s.secret=true;s.known=false;s.connected=false;s.outcome='compromised';s.step='reflect';}
  else throw Error('Unavailable permission choice');return s;
 }
};
