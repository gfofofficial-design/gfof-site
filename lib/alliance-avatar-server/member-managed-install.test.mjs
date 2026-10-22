import test from 'node:test';
import assert from 'node:assert/strict';
import {managedMemberInstallSql,managedMemberInstallManifest,managedMemberClosedInspectionSql,MEMBER_INSTALL_SOURCES,MANAGED_SESSION_GUARD_BODY} from './member-managed-install.mjs';
test('managed installer is one closed transaction, preserves source manifest and introduces no credential or authority transition',()=>{
  const sql=managedMemberInstallSql(),manifest=managedMemberInstallManifest();assert.equal(manifest.length,14);assert.equal(MEMBER_INSTALL_SOURCES.length,14);assert.ok(manifest.every(r=>/^[a-f0-9]{64}$/.test(r.sha256)));assert.match(sql,/BEGIN;[\s\S]*COMMIT;\s*$/);
  assert.doesNotMatch(sql,/\blogin\s+password|alter\s+role|update\s+alliance_avatar\.control|grant usage on schema auth to alliance_avatar_owner/i);assert.match(sql,/REVOKE alliance_avatar_owner FROM postgres GRANTED BY postgres/);
  assert.ok(sql.includes('as $$'+MANAGED_SESSION_GUARD_BODY+'$$;'));assert.ok(sql.includes('Managed member installed state refused'));assert.ok(sql.includes('supabase_admin",true,false,false'));
});
test('private verifier reveals no rows, has no dynamic SQL, and checks current session plus account status',()=>{
  assert.doesNotMatch(MANAGED_SESSION_GUARD_BODY,/\bexecute\b|\binsert\b|\bupdate\b|\bdelete\b|user_metadata|return query/i);
  for(const condition of ['s.id=p_session','s.user_id=p_actor','email_confirmed_at is not null','is_anonymous is false','deleted_at is null','banned_until','not_after'])assert.ok(MANAGED_SESSION_GUARD_BODY.includes(condition));
  const sql=managedMemberInstallSql();assert.match(sql,/require_current_session\(p_actor uuid,p_session uuid\) returns void/);assert.match(sql,/security definer set search_path=''/);assert.match(sql,/prosrc[\s\S]+IS DISTINCT FROM \$guard\$/);assert.match(sql,/count\(\*\) FROM auth.users\)<>/);
});
