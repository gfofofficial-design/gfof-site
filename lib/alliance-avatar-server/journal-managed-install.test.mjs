import test from 'node:test';
import assert from 'node:assert/strict';
import {managedJournalExtensionSql,managedJournalClosedInspectionSql,journalManagedBoundarySql,journalExtensionManifest,managedJournalReaderExtensionSql,managedJournalReaderInspectionSql} from './journal-managed-install.mjs';
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
test('reader installation is a separate locked-role proposal; inspection never grants or writes',()=>{
 const sql=managedJournalReaderExtensionSql(),inspection=managedJournalReaderInspectionSql();
 assert.match(sql,/CREATE ROLE alliance_journal_reader NOLOGIN NOINHERIT NOSUPERUSER/);
 assert.doesNotMatch(sql,/\bALTER ROLE\b|\bPASSWORD\s+'|UPDATE alliance_journal|CREATE TABLE|CREATE FUNCTION/i);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION alliance_journal.tip\(text,uuid\),alliance_journal.records\(text,uuid,integer,text\) TO alliance_journal_reader;/);
 assert.match(sql,/REVOKE alliance_journal_owner FROM postgres GRANTED BY postgres;/);
 assert.match(inspection,/^BEGIN READ ONLY;/);assert.ok(inspection.endsWith('ROLLBACK;\n'));assert.doesNotMatch(inspection,/\bGRANT\b|\bCOMMIT\s*;|\bALTER\b/i);
 assert.notEqual(journalManagedBoundarySql('extended'),journalManagedBoundarySql('authority-reader'));
});
