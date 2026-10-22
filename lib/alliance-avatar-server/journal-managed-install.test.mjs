import test from 'node:test';
import assert from 'node:assert/strict';
import {managedJournalExtensionSql,managedJournalClosedInspectionSql,journalManagedBoundarySql,journalExtensionManifest} from './journal-managed-install.mjs';
test('closed journal upgrade and rollback-only inspection cannot enable login, configure a scope or commit inspection rights',()=>{
 const sql=managedJournalExtensionSql(),inspection=managedJournalClosedInspectionSql();
 assert.match(sql,/^--[^\n]*\nBEGIN;[\s\S]*COMMIT;\s*$/);
 assert.ok(inspection.endsWith('ROLLBACK;\n'));assert.doesNotMatch(inspection,/\bCOMMIT\s*;/i);
 for(const source of [sql,inspection])assert.doesNotMatch(source,/\bALTER\s+ROLE\b|\bCREATE\s+ROLE\b|\bPASSWORD\b|\bUPDATE\s+alliance_journal\.control\b|\bGRANT\s+pg_read_all_data\b/i);
 assert.equal(journalExtensionManifest().length,3);
});
test('fixed baseline and extended catalogue checks are distinct; invalid stage is refused',()=>{
 assert.notEqual(journalManagedBoundarySql('base'),journalManagedBoundarySql('extended'));
 assert.throws(()=>journalManagedBoundarySql('anything'));
});
