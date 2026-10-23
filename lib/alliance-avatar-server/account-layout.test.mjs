import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import data from './account-layout-data.mjs';
import {accountContractFixture} from './account-contract.fixture.mjs';
import {verifyAccountContract} from './account-contract.mjs';
const reject=mutate=>{for(const domain of ['history','ack']){const c=accountContractFixture(domain);mutate(c,c.tables[0].layout);assert.throws(()=>verifyAccountContract(c,domain));}};
test('fixed layout manifest pins the unchanged reviewed SQL and accepts both account domains',()=>{
 for(const [name,digest] of Object.entries(data.sourceHashes)){const bytes=readFileSync(new URL('../../sql/'+name,import.meta.url),'utf8').replace(/\r\n/g,'\n');assert.equal(createHash('sha256').update(bytes).digest('hex'),digest);}
 for(const domain of ['history','ack'])assert.equal(verifyAccountContract(accountContractFixture(domain),domain),true);
});
test('column ordinal/name/type/typmod/nullability/identity/generated/inheritance/missing/collation/default drift refuses',()=>{
 for(const [index,value] of [[0,99],[1,'other'],[2,999],[3,'public'],[4,'varchar'],[5,64],[6,1],[7,false],[8,'a'],[9,'s'],[10,true],[11,false],[12,1],[13,true],[14,['unknown=true']],[15,['x=y']],[16,'public'],[17,'unknown'],[18,'42']])reject((c,l)=>{l.columns[0][index]=value;});
 reject((c,l)=>l.columns.pop());reject((c,l)=>l.columns.push([...l.columns[0]]));reject((c,l)=>l.columns.reverse());
});
test('missing/extra/weaker/deferred/unvalidated constraints and changed keys refuse',()=>{
 for(const [index,value] of [[0,'other'],[1,'f'],[2,[99]],[3,'CHECK (true)'],[4,true],[5,true],[6,false],[7,false],[8,1],[9,true]])reject((c,l)=>{l.constraints[0][index]=value;});
 reject((c,l)=>l.constraints.pop());reject((c,l)=>l.constraints.push([...l.constraints[0]]));reject((c,l)=>l.constraintSafety=false);
});
test('index definitions, uniqueness, readiness, validation, immediacy, method/owner/options are pinned',()=>{
 for(const [index,value] of [[0,'other'],[1,'CREATE INDEX unreviewed'],[2,false],[4,false],[5,false],[6,false],[7,false],[8,true],[9,true],[10,'hash'],[11,'postgres'],[12,['fillfactor=50']]])reject((c,l)=>{l.indexes[0][index]=value;});
 reject((c,l)=>{l.indexes[0][3]=!l.indexes[0][3];});
 reject((c,l)=>l.indexes.pop());reject((c,l)=>l.indexes.push([...l.indexes[0]]));
});
test('RLS policy command/permissiveness/role set/USING/WITH CHECK and extra policy refuse',()=>{
 for(const [index,value] of [[0,'other'],[1,'r'],[2,false],[3,['PUBLIC']],[4,'false'],[5,null]])reject((c,l)=>{l.policies[0][index]=value;});
 reject((c,l)=>l.policies=[]);reject((c,l)=>l.policies.push([...l.policies[0]]));
});
test('owner/schema future-object grant and default ACL grantor/options drift refuses',()=>{
 reject(c=>c.defaultAcl=[]);reject(c=>c.defaultAcl.push(['other','alliance_account','r',[]]));
 for(const row of [['PUBLIC','alliance_account_owner','EXECUTE',false],['alliance_account_owner','postgres','EXECUTE',false],['alliance_account_owner','alliance_account_owner','EXECUTE',true]])reject(c=>c.defaultAcl[0][3].push(row));
});
test('unlogged/partitioned/inherited/rule-bearing tables and unknown layout fields refuse',()=>{
 reject((c,l)=>l.ordinary=false);reject((c,l)=>l.unknown=true);reject((c,l)=>delete l.columns);reject((c,l)=>l.policies.reverse().push(['other','*',true,['PUBLIC'],'true','true']));
});
test('deeply frozen public manifest and independent fixture copies cannot rewrite runtime expectations',()=>{
 assert.ok(Object.isFrozen(data.history.tables.entries.columns[0]));assert.throws(()=>{data.history.tables.entries.columns[0][1]='unreviewed';});
 const a=accountContractFixture('history');a.tables[0].layout.columns[0][1]='other';assert.equal(verifyAccountContract(accountContractFixture('history'),'history'),true);assert.throws(()=>verifyAccountContract(a,'history'));
});
