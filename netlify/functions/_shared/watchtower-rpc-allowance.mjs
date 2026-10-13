const SQL=`INSERT INTO public.watchtower_rpc_allowance AS b (scope,day_utc,month_utc,day_requests,month_requests)
 VALUES ($1,(statement_timestamp() AT TIME ZONE 'UTC')::date,date_trunc('month',statement_timestamp() AT TIME ZONE 'UTC')::date,1,1)
 ON CONFLICT(scope) DO UPDATE SET day_utc=EXCLUDED.day_utc,month_utc=EXCLUDED.month_utc,
 day_requests=CASE WHEN b.day_utc=EXCLUDED.day_utc THEN b.day_requests+1 ELSE 1 END,
 month_requests=CASE WHEN b.month_utc=EXCLUDED.month_utc THEN b.month_requests+1 ELSE 1 END
 WHERE EXCLUDED.day_utc>=b.day_utc AND EXCLUDED.month_utc>=b.month_utc
 AND (CASE WHEN b.day_utc=EXCLUDED.day_utc THEN b.day_requests ELSE 0 END)<$2
 AND (CASE WHEN b.month_utc=EXCLUDED.month_utc THEN b.month_requests ELSE 0 END)<$3 RETURNING scope`;
export function createWatchtowerRpcAllowance({query,scope,dailyLimit,monthlyLimit}={}){
 if(typeof query!=='function'||!['preview','production'].includes(scope)||![dailyLimit,monthlyLimit].every(n=>Number.isInteger(n)&&n>=1&&n<=100000)||dailyLimit>monthlyLimit)throw Error('Invalid Watchtower allowance configuration');
 return async request=>{
  if(!request||Object.keys(request).sort().join(',')!=='maxRequests,maxResponseBytes,method,purpose'||request.purpose!=='watchtower_candidate_verification'||
   !['getTransaction','getMultipleAccounts'].includes(request.method)||request.maxRequests!==1||request.maxResponseBytes!==1048576)return false;
  try{return (await query(SQL,[scope,dailyLimit,monthlyLimit])).rowCount===1;}catch{return false;}
 };
}
