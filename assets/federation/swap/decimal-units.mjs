// Shared integer-only amounts; each chain supplies its own maximum atomic value.
const checkDecimals=d=>Number.isInteger(d)&&d>=0&&d<=36;
function units(value,max){if(typeof value!=='string'||! /^(0|[1-9][0-9]{0,77})$/.test(value)||typeof max!=='bigint'||max<1n||BigInt(value)>max)throw Error('swap_units_invalid');return BigInt(value);}
export function parseDecimalUnits(value,decimals,max){
 if(!checkDecimals(decimals)||typeof value!=='string'||value.length>120)throw Error('swap_units_invalid');
 const s=value.trim();if(!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(s))throw Error('swap_units_invalid');
 const [whole='',fraction='']=s.split('.');if(fraction.length>decimals)throw Error('swap_units_invalid');
 const n=BigInt(whole||'0')*10n**BigInt(decimals)+BigInt((fraction||'').padEnd(decimals,'0')||'0');
 if(n<1n)throw Error('swap_units_invalid');return units(n.toString(),max).toString();
}
export function formatDecimalUnits(value,decimals,max){
 if(!checkDecimals(decimals))throw Error('swap_units_invalid');const n=units(value,max),scale=10n**BigInt(decimals);
 const whole=(n/scale).toString().replace(/\B(?=(\d{3})+(?!\d))/g,',');
 const fraction=decimals?(n%scale).toString().padStart(decimals,'0').replace(/0+$/,''):'';
 return whole+(fraction?'.'+fraction:'');
}
