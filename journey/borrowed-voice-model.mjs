export const evidence = {
  identity: {title:'Inspect the seal and sender',kind:'Unverified presentation',text:'The message displays Admiral Voss’s seal and calls itself the Command Allocation Desk. These are details supplied by the sender. A copied seal does not establish who is speaking.',note:'Familiar appearance is not independent verification.'},
  promise: {title:'Ask where the payment comes from',kind:'Unanswered question',text:'You ask how sending 40 credits could produce 80 tomorrow. The sender replies, “Our allocation engine handles it. Trust Command.” There is no explanation of funding, terms, or risk.',note:'An explanation has not been supplied. That is a reason to pause, not proof by itself.'},
  crowd: {title:'Trace the glowing reviews',kind:'Unsupported claim',text:'Every screenshot comes from the sender. Names and balances are visible, but no independent record connects them to real payments. A busy conversation is not evidence that anyone can withdraw money.',note:'Several repeated claims do not become separate sources.'},
  directory: {title:'Contact Command independently',kind:'Independent finding',text:'You open the ship’s Command directory, saved before this message arrived. The duty officer confirms that Command issued no allocation offer and did not authorize this sender to collect credits.',note:'In this story, the independently reached organization contradicts the claimed authorization.'}
};
export function initialState(){return {step:'intro',cash:100,opened:[],active:null,choice:null,recovery:null,history:[]};}
export function transition(state,action){
  const s=structuredClone(state);
  if(s.step==='intro'&&action==='begin')s.step='inbox';
  else if(s.step==='inbox'&&action==='investigate')s.step='investigate';
  else if(s.step==='investigate'&&Object.hasOwn(evidence,action)){
    if(!s.opened.includes(action))s.opened.push(action);s.active=action;
  }else if(['inbox','investigate'].includes(s.step)&&action==='decide')s.step='decide';
  else if(s.step==='decide'&&action==='recheck')s.step='investigate';
  else if(s.step==='decide'&&['hold','decline','send'].includes(action)){
    s.choice=action;
    if(action==='send'){s.cash-=40;s.history.push({label:'Sent to the fictional Allocation Desk',delta:-40});s.step='aftermath';}
    else s.step='reflect';
  }else if(s.step==='aftermath'&&action==='read-followup')s.step='recovery';
  else if(s.step==='aftermath'&&action==='stop'){s.recovery='stop';s.step='reflect';}
  else if(s.step==='recovery'&&['pay-recovery','record','stop'].includes(action)){
    s.recovery=action;
    if(action==='pay-recovery'){s.cash-=20;s.history.push({label:'Paid the fictional recovery sender',delta:-20});}
    s.step='reflect';
  }else throw Error('Unavailable story action');
  return s;
}
