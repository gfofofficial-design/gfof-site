export const boards=Object.freeze({
 clear:{name:"Clear skies",cash:60,fuel:7,time:8,target:110,note:"A balanced route. Bring back 110 credits after paying every delivery cost."},
 storm:{name:"Long detours",cash:60,fuel:8,time:9,target:108,note:"Several routes use more fuel today. All detour costs are shown before you choose."},
 urgent:{name:"Short shift",cash:45,fuel:6,time:6,target:85,note:"Less time and starting cash. A busy route is not always the most useful route."}
});
const base=[
 {id:"medical",name:"Medical supplies",place:"Aurora Clinic",cost:25,pay:55,fuel:3,time:3,x:100,y:70},
 {id:"tools",name:"Workshop tools",place:"Meridian Works",cost:20,pay:42,fuel:2,time:3,x:280,y:60},
 {id:"fresh",name:"Fresh provisions",place:"Greenhouse Ring",cost:18,pay:34,fuel:2,time:2,x:390,y:160},
 {id:"parts",name:"Repair components",place:"Relay Station",cost:12,pay:24,fuel:1,time:2,x:270,y:255},
 {id:"maps",name:"Survey charts",place:"Observatory",cost:8,pay:18,fuel:1,time:1,x:90,y:245}
];
export function jobs(board){return base.map(j=>({...j,fuel:j.fuel+(board==='storm'&&j.id!=='maps'?1:0),time:j.time+(board==='urgent'&&j.id==='medical'?1:0)}));}
export function initial(board='clear'){if(!Object.hasOwn(boards,board))board='clear';return {board,cash:boards[board].cash,fuel:boards[board].fuel,time:boards[board].time,done:[],ledger:[],ended:false};}
export function reason(s,id){const j=jobs(s.board).find(j=>j.id===id);if(!j)return 'Unknown delivery';if(s.ended)return 'Run finished';if(s.done.includes(id))return 'Delivered';if(s.done.length>=3)return 'Three deliveries complete — return to port';if(s.cash<j.cost)return 'Not enough credits to pay the upfront cost';if(s.fuel<j.fuel+1)return 'Keep 1 fuel for the return to port';if(s.time<j.time+1)return 'Keep 1 time unit for the return to port';return '';}
export function step(s,id){if(s.ended)return s;if(id==='dock')return {...s,fuel:s.fuel-1,time:s.time-1,ended:true};if(reason(s,id))return s;const j=jobs(s.board).find(j=>j.id===id);return {...s,cash:s.cash-j.cost+j.pay,fuel:s.fuel-j.fuel,time:s.time-j.time,done:[...s.done,id],ledger:[...s.ledger,{id,cost:j.cost,pay:j.pay,net:j.pay-j.cost}]};}
export function result(s){const b=boards[s.board];return {gain:s.cash-b.cash,target:b.target,met:s.ended&&s.cash>=b.target};}
