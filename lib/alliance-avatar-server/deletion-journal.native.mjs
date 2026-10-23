import assert from 'node:assert/strict';
import {journalFixture,event} from './deletion-journal.fixture.mjs';
export async function deletionJournalNative({admin,ledger}){
  const id=sql=>{const value=admin(sql).match(/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/)?.[0];assert.ok(value);return value;};
  const profileId=id('select profile_id from alliance_avatar.heads limit 1;');
  const objectId=id(`select id from alliance_avatar.objects where profile_id='${profileId}' and state='deleted' and verified and deletion_receipt is not null limit 1;`);
  const baseline=await ledger.restoreInventory();assert.equal(baseline.closed,true);
  admin('create table public.alliance_journal_fixture_heads as select * from alliance_avatar.heads;create table public.alliance_journal_fixture_objects as select * from alliance_avatar.objects;');
  const f=journalFixture({events:[event({profileId})]}),view=await f.client.review();assert.equal(view.state,'verified_evidence');
  try{
    assert.deepEqual(view.check({profileId,objectId}),{state:'blocked',scope:'profile'});assert.deepEqual(await ledger.restoreInventory(),baseline);
    admin(`update alliance_avatar.objects set state='active',deletion_receipt=null,deleted_at=null where id='${objectId}';update alliance_avatar.heads set removed_at=null,version=greatest(0,version-1),object_id='${objectId}' where profile_id='${profileId}';`);
    const restored=await ledger.restoreInventory();assert.notDeepEqual(restored,baseline);
    assert.deepEqual(view.check({profileId,objectId}),{state:'blocked',scope:'profile'});assert.deepEqual(await ledger.restoreInventory(),restored);
    console.log('PASS independently signed deletion intent still denies a synthetic older active image head with its database tombstone removed');
  }finally{
    view.close();f.client.close();
    admin('update alliance_avatar.heads a set removed_at=s.removed_at,version=s.version,object_id=s.object_id from public.alliance_journal_fixture_heads s where a.profile_id=s.profile_id;update alliance_avatar.objects a set state=s.state,deletion_receipt=s.deletion_receipt,deleted_at=s.deleted_at from public.alliance_journal_fixture_objects s where a.id=s.id;drop table public.alliance_journal_fixture_heads,public.alliance_journal_fixture_objects;');
  }
  assert.deepEqual(await ledger.restoreInventory(),baseline);assert.deepEqual(f.calls.map(x=>x.phase),['witness','records']);
  console.log('PASS deny-only journal inspection leaves all six ledger tables unchanged; exact synthetic old-backup simulation is undone with no provider call');
}
