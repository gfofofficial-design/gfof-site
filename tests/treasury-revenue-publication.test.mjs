import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {checkRevenuePublication} from '../tools/treasury-review/check-publication.mjs';
const row = {month:'2026-09', source:'swap', asset:'USDC', gross:'10000000', refunds:'0', costs:'0', reconciledOn:'2026-10-02', evidence:'/record/fictional-test.json'};
const data = statements => ({version:1, statements});
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'revenue-publication-'));
  t.after(() => rm(root, {recursive:true, force:true}));
  await mkdir(join(root, 'record'));
  return {root, today:'2026-10-30'};
}
test('empty reporting stays unreported; a completed statement needs built evidence', async t => {
  const options = await fixture(t);
  assert.deepEqual(await checkRevenuePublication(data([]), options), {statements:0});
  await writeFile(join(options.root, 'record/fictional-test.json'), '{"fixture":true}');
  assert.deepEqual(await checkRevenuePublication(data([row]), options), {statements:1});
});
test('missing or empty evidence refuses publication', async t => {
  const options = await fixture(t);
  await assert.rejects(checkRevenuePublication(data([row]), options));
  await writeFile(join(options.root, 'record/fictional-test.json'), '');
  await assert.rejects(checkRevenuePublication(data([row]), options), /nonempty published file/);
});
test('future reconciliation refuses even when evidence exists', async t => {
  const options = await fixture(t);
  await writeFile(join(options.root, 'record/fictional-test.json'), '{"fixture":true}');
  await assert.rejects(checkRevenuePublication(data([{...row, reconciledOn:'2026-11-01'}]), options), /in the future/);
});
