// Owned fictional PostgreSQL/TLS fixture only; no hosted data or owner input.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {secondCreationFixture} from './creation-second-fixture.mjs';
import {prepareCommunityMemberFixture} from './community-database.fixture.mjs';
import {managedCommunityExtensionSql} from './community-managed-install.mjs';
import {managedFeedbackExtensionSql} from './feedback-managed-install.mjs';
import {managedReportReviewExtensionSql} from './report-review-install.mjs';
import {createAllianceReportReviewStore} from './report-review-store.mjs';

const seed=`
INSERT INTO auth.users VALUES('08000001-1111-4111-8111-111111111111',clock_timestamp(),false,null,null),('08000002-1111-4111-8111-111111111111',clock_timestamp(),false,null,null);
INSERT INTO public.alliance_member_owners(id,user_id) VALUES('08000001-1111-4111-8111-111111111111','08000001-1111-4111-8111-111111111111'),('08000002-1111-4111-8111-111111111111','08000002-1111-4111-8111-111111111111');
INSERT INTO public.alliance_profiles(id,display_name,bio,community,contribution_role,listed) VALUES('08000001-1111-4111-8111-111111111111','Fictional reporter','Disposable fixture.','Fixture','builder',true),('08000002-1111-4111-8111-111111111111','Fictional target','Disposable fixture.','Fixture','builder',true);
INSERT INTO alliance_feedback.reports(id,reporter,target_owner,kind,target,created_at) VALUES('08000003-1111-4111-8111-111111111111','08000001-1111-4111-8111-111111111111','08000002-1111-4111-8111-111111111111','challenge','08000004-1111-4111-8111-111111111111',current_timestamp-interval '1 day');
INSERT INTO alliance_report_review.reviews(report_id,first_reviewed_at,disposition) VALUES('08000003-1111-4111-8111-111111111111',current_timestamp-interval '1 hour','no_action');`;

export async function reportReviewInventoryFormatNative({secondOptions}){
 if(process.env.ALLIANCE_AVATAR_SERVER_TEST_CONFIRM!=='disposable_server_fixture')throw Error('Wrong inventory fixture');
 const d=await secondCreationFixture({...secondOptions,purpose:'replacement-member'}),root=q=>d.admin(q,'fixture_root');
 const checks=[],stores=[];
 try{
  prepareCommunityMemberFixture(d);d.admin(managedCommunityExtensionSql());d.admin(managedFeedbackExtensionSql());d.admin(managedReportReviewExtensionSql());
  root(seed);
  root(`DO $$DECLARE a jsonb;b jsonb;BEGIN
   PERFORM set_config('TimeZone','UTC',true);a:=alliance_report_review.recovery_inventory();
   PERFORM set_config('TimeZone','America/Chicago',true);b:=alliance_report_review.recovery_inventory();
   IF a->'tables'->1->>'sha256'=b->'tables'->1->>'sha256' THEN RAISE EXCEPTION 'Caller formatting defect not reproduced';END IF;
   END$$;`);
  checks.push('nonempty_review_hash_defect_reproduced_in_unchanged_sql_function');
  const metadata=()=>root("SELECT jsonb_build_array(oid,proowner,proacl::text,proconfig,prosrc) FROM pg_proc WHERE oid='alliance_report_review.recovery_inventory()'::regprocedure;");
  const original=metadata(),password='synthetic-review-format-'+randomUUID();
  root(`ALTER ROLE alliance_avatar_executor LOGIN PASSWORD '${password}';`);
  const connection={...d.connection,password};let expected;
  for(const [zone,style]of [['UTC','ISO, YMD'],['America/Chicago','German, DMY']]){
   root(`ALTER DATABASE postgres SET timezone='${zone}';ALTER DATABASE postgres SET datestyle='${style}';`);
   let pool;
   const store=await createAllianceReportReviewStore({enabled:true,deploymentProfile:'supabase-managed',connection,openPool:config=>(pool=d.openPool(config))});stores.push(store);
   const inventory=await store.inventory();assert.equal(inventory.tables[1].rows,1);
   if(expected)assert.deepEqual(inventory,expected);else expected=inventory;
   const c=await pool.connect();
   try{
    const r=await c.query("SELECT current_setting('TimeZone') AS zone,current_setting('DateStyle') AS style");
    assert.deepEqual(r.rows,[{zone,style}]);
   }finally{c.release();}
   await store.close();
  }
  checks.push('actual_restricted_store_matches_utc_inventory_across_timezone_and_datestyle');
  assert.equal(metadata(),original);
  assert.match(root('SELECT NOT enabled AND reviewer_actor IS NULL AS closed FROM alliance_report_review.control;'),/\bt\b/);
  checks.push('transaction_restores_caller_defaults_and_preserves_function_identity_permissions_and_closed_review');
  return checks;
 }finally{for(const s of stores)await s.close();await d.close();}
}
