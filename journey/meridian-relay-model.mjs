export function initial(day = 'quiet') {
  if (!['quiet', 'busy'].includes(day)) throw new Error('Unknown scenario');
  return {step:'intro', day, cash:240, market:null, message:null, access:null,
    stock:0, berth:0, sold:0, disposal:null, target:null, weekly:null,
    checks:[], ledger:[{label:'Starting credits', amount:240}]};
}
export function actions(s) {
  switch(s.step) {
    case 'intro': return ['begin'];
    case 'plan': return ['stall','skip'];
    case 'offer': return ['read-offer','directory','decline','pay'];
    case 'access': return ['read-access','verify-map','skip-map','grant', ...(s.checks.includes('verify-map')?['public-map']:[])];
    case 'stock': return ['stock-6','stock-9'];
    case 'berth': return ['side','central'];
    case 'repair': return ['repair'];
    case 'sales': return ['close-market'];
    case 'leftovers': return ['retain','salvage','gift'];
    case 'goal': return ['goal-200','goal-140','pause'];
    case 'pace': return ['weekly-10','weekly-20'];
    default: return [];
  }
}
export function demand(day, berth) { return (day==='quiet'?{10:4,25:7}:{10:8,25:12})[berth] || 0; }
export function step(previous, action) {
  if (!actions(previous).includes(action)) throw new Error('Unavailable action');
  const s={...previous, checks:[...previous.checks], ledger:previous.ledger.map(x=>({...x}))};
  const book=(label,amount)=>{if(s.cash+amount<0)throw new Error('Insufficient available credits');s.cash+=amount;s.ledger.push({label,amount});};
  if (['read-offer','directory','read-access','verify-map'].includes(action)) {
    if(!s.checks.includes(action))s.checks.push(action); return s;
  }
  switch(s.step) {
    case 'intro': book('Prepaid expedition essentials',-60);s.step='plan';break;
    case 'plan': s.market=action==='stall';s.step='offer';break;
    case 'offer': s.message=action; if(action==='pay')book('Unverified activation payment lost',-30);s.step='access';break;
    case 'access': s.access=action;if(action==='grant')book('Map terminal uses its full allowance',-20);s.step=s.market?'stock':'repair';break;
    case 'stock': s.stock=Number(action.slice(6));book('Charms bought upfront',-8*s.stock);s.step='berth';break;
    case 'berth': s.berth=action==='side'?10:25;book('Market berth',-s.berth);s.step='repair';break;
    case 'repair': book('Docking seal repair',-30);s.step=s.market?'sales':'goal';break;
    case 'sales': s.sold=Math.min(s.stock,demand(s.day,s.berth));book('Charm sales received',12*s.sold);s.step='leftovers';break;
    case 'leftovers': s.disposal=action;if(action==='salvage')book('Unsold charms salvaged',2*(s.stock-s.sold));s.step='goal';break;
    case 'goal':
      s.target=action==='pause'?null:Number(action.slice(5));
      s.step=s.target===null||s.cash>=s.target?'reflect':'pace';break;
    case 'pace':s.weekly=Number(action.slice(7));s.step='reflect';break;
  }
  return s;
}
export function forecast(s) {
  if(s.target===null)return {remaining:null,weeks:null};
  const remaining=Math.max(0,s.target-s.cash);
  return {remaining,weeks:remaining===0?0:s.weekly?Math.ceil(remaining/s.weekly):null};
}
export function inventory(s) {
  const remaining=s.stock-s.sold;
  return {held:s.disposal==='gift'||s.disposal==='salvage'?0:remaining,
    gifted:s.disposal==='gift'?remaining:0,salvaged:s.disposal==='salvage'?remaining:0};
}
export function comparison(s,day) {
  const sold=s.market?Math.min(s.stock,demand(day,s.berth)):0;
  const unsold=s.stock-sold;
  const salvage=s.disposal==='salvage'?2*unsold:0;
  const before=240-60-(s.message==='pay'?30:0)-(s.access==='grant'?20:0)-8*s.stock-s.berth-30;
  return {before,sold,salvage,cash:before+12*sold+salvage,held:s.disposal==='retain'?unsold:0};
}
