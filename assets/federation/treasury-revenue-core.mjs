// Reviewed public statements only; no wallet scanning, prices or payment secrets.
export const ASSETS=Object.freeze({SOL:9,USDC:6});
export const SOURCES=Object.freeze({swap:'Galactic Swap',other:'Other paid services'});
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const atom=v=>typeof v==='string'&&/^(0|[1-9][0-9]{0,17})$/.test(v);
export function validateRevenue(data){
 if(!exact(data,['version','statements'])||data.version!==1||!Array.isArray(data.statements)||data.statements.length>240)throw Error('Invalid revenue statements');
 const seen=new Set();
 return data.statements.map(row=>{
  if(!exact(row,['month','source','asset','gross','refunds','costs','reconciledOn','evidence'])||!/^20[0-9]{2}-(0[1-9]|1[0-2])$/.test(row.month)||!Object.hasOwn(SOURCES,row.source)||!Object.hasOwn(ASSETS,row.asset)||![row.gross,row.refunds,row.costs].every(atom)||!/^20[0-9]{2}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/.test(row.reconciledOn)||new Date(row.reconciledOn+'T00:00:00Z').toISOString().slice(0,10)!==row.reconciledOn||row.reconciledOn.slice(0,7)<=row.month||!/^\/record\/[a-z0-9][a-z0-9-]{0,99}\.(json|html)$/.test(row.evidence))throw Error('Invalid revenue statement');
  const key=[row.month,row.source,row.asset].join(':');if(seen.has(key))throw Error('Duplicate revenue statement');seen.add(key);
  const gross=BigInt(row.gross),refunds=BigInt(row.refunds),costs=BigInt(row.costs);
  return Object.freeze({...row,gross,refunds,costs,net:gross-refunds-costs});
 });
}
export function formatRevenue(value,asset){
 if(typeof value!=='bigint'||!Object.hasOwn(ASSETS,asset))throw Error('Invalid revenue amount');
 const scale=10n**BigInt(ASSETS[asset]),n=value<0n?-value:value,whole=(n/scale).toString().replace(/\B(?=(\d{3})+(?!\d))/g,','),fraction=(n%scale).toString().padStart(ASSETS[asset],'0').replace(/0+$/,'');
 return (value<0n?'-':'')+whole+(fraction?'.'+fraction:'')+' '+asset;
}
export function revenueSeries(rows,{asset='USDC',source='all'}={}){
 if(!Object.hasOwn(ASSETS,asset)||source!=='all'&&!Object.hasOwn(SOURCES,source))throw Error('Invalid revenue filter');
 const selected=rows.filter(r=>r.asset===asset&&(source==='all'||r.source===source));
 const months=new Map();for(const row of selected){const value=months.get(row.month)||{month:row.month,net:0n,rows:[]};value.net+=row.net;value.rows.push(row);months.set(row.month,value);}
 // Missing months are omitted, never invented as zero. Exact totals remain BigInt.
 return [...months.values()].sort((a,b)=>a.month.localeCompare(b.month));
}
