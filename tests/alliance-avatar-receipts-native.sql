-- Continues only inside the runner-owned synthetic rollback fixture. Remove its
-- 100 deliberately incomplete quota-test objects, never provider/user records.
reset role;
delete from alliance_avatar.objects where descriptor is null and state='cleanup';
insert into auth.users(id) values('dddddddd-dddd-4ddd-8ddd-dddddddddddd');
select set_config('request.jwt.claim.sub','dddddddd-dddd-4ddd-8ddd-dddddddddddd',true),set_config('request.jwt.claim.is_anonymous','false',true);
set local role authenticated;
select public.alliance_save_profile('Receipt Fixture','','Synthetic durable image receipt fixture.','builder',false)->>'id' as receipt_profile \gset
reset role;
set local role alliance_avatar_executor;
select public.fixture_assert(not has_function_privilege('alliance_avatar_executor','alliance_avatar.valid_descriptor(jsonb)','EXECUTE') and not has_function_privilege('alliance_avatar_executor','alliance_avatar.valid_upload_result(uuid,jsonb,boolean)','EXECUTE'),'receipt validators remain private helpers');
select public.fixture_assert(to_regprocedure('alliance_avatar.claim_upload(uuid,uuid,integer)') is null and to_regprocedure('alliance_avatar.commit_upload(uuid,uuid)') is null and to_regprocedure('alliance_avatar.settle_unpublished(uuid)') is null and to_regprocedure('alliance_avatar.ack_deleted(uuid)') is null,'receipt-free overloads do not exist');
select gen_random_uuid() as receipt_op1 \gset
select alliance_avatar.reserve('dddddddd-dddd-4ddd-8ddd-dddddddddddd',:'receipt_op1',0)->>'objectId' as receipt_o1 \gset
select public.avatar_expect_denied(format('select alliance_avatar.commit_upload(%L,%L,null)','dddddddd-dddd-4ddd-8ddd-dddddddddddd',:'receipt_op1'),'missing acknowledgement cannot publish a reservation');

select public.avatar_expect_denied(format('select alliance_avatar.claim_upload(%L,%L,%L::jsonb)','dddddddd-dddd-4ddd-8ddd-dddddddddddd',:'receipt_op1',bad),'malformed descriptor: '||label)
from(values
 ('null'::jsonb,'null'),
 (public.avatar_descriptor(1024)-'sha256','missing hash'),
 (jsonb_set(public.avatar_descriptor(1024),'{bytes}','"1024"'::jsonb),'string bytes'),
 (jsonb_set(public.avatar_descriptor(1024),'{width}','0'::jsonb),'zero width'),
 (jsonb_set(public.avatar_descriptor(1024),'{height}','257'::jsonb),'oversized height'),
 (jsonb_set(public.avatar_descriptor(1024),'{bytes}','44'::jsonb),'undersized PNG'),
 (jsonb_set(public.avatar_descriptor(1024),'{sha256}','"invalid"'::jsonb),'invalid hash'),
 (public.avatar_descriptor(1024)||'{"sourceUrl":"https://example.invalid"}'::jsonb,'unexpected metadata')
)x(bad,label);
select public.fixture_assert((alliance_avatar.operation_receipt('dddddddd-dddd-4ddd-8ddd-dddddddddddd',:'receipt_op1')->'descriptor')='null'::jsonb,'failed descriptors leave no dispatch or stored derivative');
select alliance_avatar.claim_upload('dddddddd-dddd-4ddd-8ddd-dddddddddddd',:'receipt_op1',public.avatar_descriptor(1024));
select public.fixture_assert((alliance_avatar.operation_receipt('dddddddd-dddd-4ddd-8ddd-dddddddddddd',:'receipt_op1')->'descriptor')=public.avatar_descriptor(1024),'pre-dispatch descriptor is durable and recoverable');
select public.avatar_expect_denied(format('select alliance_avatar.claim_upload(%L,%L,%L::jsonb)','dddddddd-dddd-4ddd-8ddd-dddddddddddd',:'receipt_op1',jsonb_set(public.avatar_descriptor(1024),'{sha256}',to_jsonb(repeat('b',64)))),'dispatch replay cannot change checksum');

select public.avatar_expect_denied(format('select alliance_avatar.commit_upload(%L,%L,%L::jsonb)','dddddddd-dddd-4ddd-8ddd-dddddddddddd',:'receipt_op1',bad),'altered upload proof: '||label)
from(values
 (jsonb_set(public.avatar_upload_result(:'receipt_op1'),'{writeSettled}','false'::jsonb),'unsettled'),
 (public.avatar_upload_result(:'receipt_op1',false),'unverified'),
 (jsonb_set(public.avatar_upload_result(:'receipt_op1'),'{receipt,key}','"v1/other.png"'::jsonb),'key'),
 (jsonb_set(public.avatar_upload_result(:'receipt_op1'),'{receipt,objectId}',to_jsonb(gen_random_uuid())),'object'),
 (jsonb_set(public.avatar_upload_result(:'receipt_op1'),'{receipt,profileId}',to_jsonb(gen_random_uuid())),'profile'),
 (jsonb_set(public.avatar_upload_result(:'receipt_op1'),'{receipt,sha256}',to_jsonb(repeat('b',64))),'checksum'),
 (jsonb_set(public.avatar_upload_result(:'receipt_op1'),'{receipt,bytes}','2048'::jsonb),'length'),
 (jsonb_set(public.avatar_upload_result(:'receipt_op1'),'{receipt,width}','2'::jsonb),'width'),
 (jsonb_set(public.avatar_upload_result(:'receipt_op1'),'{receipt,mime}','"text/html"'::jsonb),'MIME'),
 (jsonb_set(public.avatar_upload_result(:'receipt_op1'),'{receipt,providerId}','"invalid"'::jsonb),'provider ID'),
 (public.avatar_upload_result(:'receipt_op1')||'{"credential":"must-not-store"}'::jsonb,'extra private field')
)x(bad,label);
select public.fixture_assert((alliance_avatar.operation_receipt('dddddddd-dddd-4ddd-8ddd-dddddddddddd',:'receipt_op1')->>'writeSettled')='false','invalid upload proof never settles the writer');
select public.avatar_expect_denied(format('select alliance_avatar.operation_receipt(%L,%L)','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',:'receipt_op1'),'foreign actor cannot recover an operation receipt');
select alliance_avatar.commit_upload('dddddddd-dddd-4ddd-8ddd-dddddddddddd',:'receipt_op1',public.avatar_upload_result(:'receipt_op1'));
select public.fixture_assert((alliance_avatar.operation_receipt('dddddddd-dddd-4ddd-8ddd-dddddddddddd',:'receipt_op1')->>'verified')='true' and (alliance_avatar.operation_receipt('dddddddd-dddd-4ddd-8ddd-dddddddddddd',:'receipt_op1')->'receipt')=(public.avatar_upload_result(:'receipt_op1')->'receipt'),'confirmed receipt survives independent recovery read');
select public.avatar_expect_denied(format('select alliance_avatar.commit_upload(%L,%L,%L::jsonb)','dddddddd-dddd-4ddd-8ddd-dddddddddddd',:'receipt_op1',jsonb_set(public.avatar_upload_result(:'receipt_op1'),'{receipt,providerId}',to_jsonb(gen_random_uuid()))),'commit replay cannot change provider receipt identity');
select public.fixture_assert((alliance_avatar.commit_upload('dddddddd-dddd-4ddd-8ddd-dddddddddddd',:'receipt_op1',public.avatar_upload_result(:'receipt_op1'))->>'version')='1','matching receipt replay remains version-idempotent');
select alliance_avatar.remove_image('dddddddd-dddd-4ddd-8ddd-dddddddddddd',gen_random_uuid(),1);
select public.fixture_assert(exists(select 1 from jsonb_array_elements(alliance_avatar.cleanup_batch(20)) row where row->>'objectId'=:'receipt_o1' and row->'receipt'=public.avatar_upload_result(:'receipt_op1')->'receipt'),'cleanup recovers exact durable receipt');

select public.avatar_expect_denied(format('select alliance_avatar.ack_deleted(%L,%L::jsonb)',:'receipt_o1',bad),'altered deletion proof: '||label)
from(values
 ('null'::jsonb,'null'),
 ('{"state":"unknown"}'::jsonb,'unknown'),
 ('{"code":"NoSuchKey"}'::jsonb,'absence only'),
 (jsonb_set(public.avatar_deletion_result(:'receipt_o1'),'{receipt,providerId}',to_jsonb(gen_random_uuid())),'wrong provider'),
 (jsonb_set(public.avatar_deletion_result(:'receipt_o1'),'{writeSettled}','false'::jsonb),'unsettled'),
 (public.avatar_deletion_result(:'receipt_o1')||'{"message":"extra"}'::jsonb,'extra field')
)x(bad,label);
select public.fixture_assert(exists(select 1 from jsonb_array_elements(alliance_avatar.cleanup_batch(20)) row where row->>'objectId'=:'receipt_o1'),'invalid deletion proof retains cleanup capacity');
select alliance_avatar.ack_deleted(:'receipt_o1',public.avatar_deletion_result(:'receipt_o1'));
select alliance_avatar.ack_deleted(:'receipt_o1',public.avatar_deletion_result(:'receipt_o1'));
select public.fixture_assert((alliance_avatar.operation_receipt('dddddddd-dddd-4ddd-8ddd-dddddddddddd',:'receipt_op1')->'deletionReceipt')=public.avatar_deletion_result(:'receipt_o1'),'matching deletion proof is retained and replay-idempotent');

select gen_random_uuid() as receipt_op2 \gset
select alliance_avatar.reserve('dddddddd-dddd-4ddd-8ddd-dddddddddddd',:'receipt_op2',2)->>'objectId' as receipt_o2 \gset
select alliance_avatar.claim_upload('dddddddd-dddd-4ddd-8ddd-dddddddddddd',:'receipt_op2',public.avatar_descriptor(2048));
select public.avatar_expect_denied(format('select alliance_avatar.commit_upload(%L,%L,%L::jsonb)','dddddddd-dddd-4ddd-8ddd-dddddddddddd',:'receipt_op2',jsonb_set(public.avatar_upload_result(:'receipt_op2'),'{receipt,providerId}',to_jsonb(:'receipt_o1'::text))),'provider receipt ID cannot be reused by another object');
select public.avatar_expect_denied(format('select alliance_avatar.settle_unpublished(%L,%L::jsonb)',:'receipt_op2','{"state":"unknown","writeSettled":false}'::jsonb),'unknown upload cannot be converted into cleanup settlement');
select alliance_avatar.settle_unpublished(:'receipt_op2',public.avatar_upload_result(:'receipt_op2',false));
select public.fixture_assert((alliance_avatar.operation_receipt('dddddddd-dddd-4ddd-8ddd-dddddddddddd',:'receipt_op2')->>'verified')='false' and (alliance_avatar.mine('dddddddd-dddd-4ddd-8ddd-dddddddddddd')->>'objectId') is null,'unverified settled upload keeps its receipt but cannot become visible');
select public.fixture_assert((alliance_avatar.commit_upload('dddddddd-dddd-4ddd-8ddd-dddddddddddd',:'receipt_op2',public.avatar_upload_result(:'receipt_op2'))->>'state')='stale','later receipt replay cannot resurrect an unpublished cleanup image');
select alliance_avatar.ack_deleted(:'receipt_o2',public.avatar_deletion_result(:'receipt_o2'));
select alliance_avatar.settle_unpublished(:'receipt_op2',public.avatar_upload_result(:'receipt_op2',false));
select public.fixture_assert((alliance_avatar.operation_receipt('dddddddd-dddd-4ddd-8ddd-dddddddddddd',:'receipt_op2')->'deletionReceipt')=public.avatar_deletion_result(:'receipt_o2'),'late settlement replay preserves completed deletion');
reset role;
select public.fixture_assert((select state='deleted' and receipt is not null and deletion_receipt is not null and settled_at is not null and deleted_at is not null from alliance_avatar.objects where id=:'receipt_o2'),'durable cleanup records preserve acknowledgements and database times');
select public.fixture_assert((select attempts=2 from alliance_avatar.daily where actor_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd'),'receipt/deletion replays never refund or spend another processing attempt');
