// Fictional, deterministic scenario. No network, accounts, or real transactions.
export const routes = {
  direct: {name: 'The blue corridor', cost: 10, days: 2, repair: 65},
  station: {name: 'The station route', cost: 25, days: 4, repair: 35}
};
export function initialState() {
  return {step:'intro',cash:180,debt:0,days:0,spending:0,route:null,repaired:false,paused:false,repaid:0,history:[]};
}
function entry(s,label,delta,debtDelta=0) {
  s.cash+=delta; s.debt+=debtDelta;
  s.history.push({label,delta,debtDelta,cash:s.cash,debt:s.debt});
}
export function transition(state,action) {
  const s=structuredClone(state);
  if(s.step==='intro' && action==='begin') {
    entry(s,'Air, meals and fuel for the planned trip',-80); s.step='prepare';
  } else if(s.step==='prepare' && [0,30,60].includes(action)) {
    s.spending=action; entry(s,'Optional cabin comforts',-action); s.step='route';
  } else if(s.step==='route' && Object.hasOwn(routes,action)) {
    s.route=action; const r=routes[action]; entry(s,r.name+' transit fee',-r.cost);s.days=r.days;s.step='repair';
  } else if(s.step==='repair') {
    const cost=routes[s.route].repair;
    if(action==='pause') {s.paused=true;s.step='reflect';}
    else if(action==='pay' && s.cash>=cost) {entry(s,'Coolant pump repair',-cost);s.repaired=true;s.step='recover';}
    else if(action==='borrow' && s.cash<cost) {
      const shortfall=cost-s.cash;
      entry(s,'Repair loan: principal plus 5-credit fee owed',shortfall,shortfall+5);
      entry(s,'Coolant pump repair',-cost);s.repaired=true;s.step='recover';
    } else throw Error('Unavailable repair choice');
  } else if(s.step==='recover') {
    if(action==='delivery' && s.cash>=10) {
      entry(s,'Delivery supplies',-10);entry(s,'Completed delivery payment',30);s.days+=1;
    } else if(action==='shift') {entry(s,'Completed station shift',15);s.days+=2;}
    else if(action!=='rest') throw Error('Unavailable recovery choice');
    // The story's one-time loan is due at arrival. No additional interest accrues.
    s.repaid=Math.min(s.cash,s.debt);
    if(s.repaid) entry(s,'Loan repayment at arrival',-s.repaid,-s.repaid);
    s.step='reflect';
  } else throw Error('Choice does not belong to this scene');
  if(s.cash<0 || s.debt<0) throw Error('Invalid ledger');
  return s;
}
export function comparePreparation(route) {
  const r=routes[route];
  return [0,30,60].map(spending=>({spending,reserve:100-spending-r.cost,shortfall:Math.max(0,r.repair-(100-spending-r.cost))}));
}
