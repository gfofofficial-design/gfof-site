// Called only by the guarded disposable two-server runner. No hosted inputs,
// runtime review endpoint, new SQL privilege or automatic reopen is added.
import assert from 'node:assert/strict';
export async function profileReviewNative({admin,ja,openPool,memberPoolConfig,actor,status,stopWorkers}){
  if(process.env.ALLIANCE_AVATAR_SERVER_TEST_CONFIRM!=='disposable_server_fixture')throw Error('Wrong profile review fixture');
  const scalar=(run,sql)=>{
    const output=run(`select 'GF_REVIEW_PROBE:'||(${sql})::text;`);
    const values=output.split('\n').map(x=>x.trim()).filter(x=>x.startsWith('GF_REVIEW_PROBE:'));
    assert.equal(values.length,1);return JSON.parse(values[0].slice('GF_REVIEW_PROBE:'.length));
  };
  const receipt=()=>scalar(admin,`select jsonb_build_object('sequence',profile_write_sequence,'pending',profile_write_pending,'inputSha256',profile_write_input_sha256,'resultSha256',profile_write_result_sha256) from alliance_avatar.creation_plans where actor_id='${actor}' and kind='profile'`);
  const original=receipt();assert.equal(original.pending,true);assert.equal(original.sequence,status.sequence);
  const current=()=>scalar(admin,`select alliance_avatar.profile_write_current('${status.profileId}')`),before=current();
  const call=`alliance_avatar.review_profile_write('${actor}',${status.sequence},'${status.inputSha256}','${status.resultSha256}')`;
  const memberClosed=()=>scalar(admin,"select not rolcanlogin and (select not enabled and not creation_enabled and not cleanup_enabled from alliance_avatar.control where id) from pg_roles where rolname='alliance_avatar_executor'");
  const journalClosed=()=>scalar(ja,"select not rolcanlogin and (select not enabled and not admission_enabled from alliance_journal.control where id) from pg_roles where rolname='alliance_journal_executor'");
  const sessions=(run,role)=>scalar(run,`select count(*) from pg_stat_activity where usename='${role}'`);
  const pool=openPool({...memberPoolConfig,max:1,idle_in_transaction_session_timeout:15000});
  pool.on('error',()=>{});let client;
  try{
    client=await pool.connect();await client.query('BEGIN');await client.query('SELECT 1');
    // These commits are separate from review. NOLOGIN stops new direct login;
    // the retained connection proves it does not disconnect admitted work.
    admin('begin;alter role alliance_avatar_executor nologin;update alliance_avatar.control set enabled=false,creation_enabled=false,cleanup_enabled=false;commit;');
    ja('begin;alter role alliance_journal_executor nologin;update alliance_journal.control set enabled=false,admission_enabled=false;commit;');
    assert.equal(memberClosed(),true);assert.equal(journalClosed(),true);
    assert.equal((await client.query('SELECT 1 AS admitted')).rows[0].admitted,1);
    assert.ok(sessions(admin,'alliance_avatar_executor')>0);assert.deepEqual(receipt(),original);
    const refused=openPool({...memberPoolConfig,max:1});refused.on('error',()=>{});
    try{await assert.rejects(refused.connect(),e=>e.code==='28000');}finally{await refused.end();}
    console.log('PASS separately committed profile review freeze blocks new executor login but preserves existing sessions; an active connection is not drain evidence');
    await stopWorkers();await client.query('ROLLBACK');client.release();client=null;await pool.end();
    // Fresh owner observations, after shutdown and disconnect, on both servers.
    assert.equal(sessions(admin,'alliance_avatar_executor'),0);assert.equal(sessions(ja,'alliance_journal_executor'),0);
    for(const run of [admin,ja])assert.equal(scalar(run,"select count(*) from pg_prepared_xacts where database=current_database()"),0);
    assert.equal(memberClosed(),true);assert.equal(journalClosed(),true);assert.deepEqual(receipt(),original);
    // Interrupted owner review rolls back: it cannot silently release the hold.
    admin(`begin isolation level read committed;set local synchronous_commit=on;set local role alliance_avatar_owner;select ${call};rollback;`);
    assert.deepEqual(receipt(),original);assert.deepEqual(current(),before);
    admin(`begin isolation level read committed;set local synchronous_commit=on;set local statement_timeout='2000ms';set local role alliance_avatar_owner;select ${call};commit;`);
    assert.deepEqual(receipt(),{...original,pending:false});assert.deepEqual(current(),before);
    assert.equal(memberClosed(),true);assert.equal(journalClosed(),true);
    assert.equal(sessions(admin,'alliance_avatar_executor'),0);assert.equal(sessions(ja,'alliance_journal_executor'),0);
    console.log('PASS drained two-server profile review rolls back an interrupted clear, commits only the exact known receipt and leaves logins/features closed without automatic restart');
  }finally{
    if(client){try{await client.query('ROLLBACK');}catch{}client.release(true);}
    if(!pool.ended)await pool.end();
  }
}
