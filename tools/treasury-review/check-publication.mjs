// Read-only publication preflight. Does not attest receipts or activate collection.
import {lstat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateRevenue} from '../../assets/federation/treasury-revenue-core.mjs';
import {REVENUE} from '../../assets/federation/treasury-revenue-data.mjs';

export async function checkRevenuePublication(data, {root, today = new Date().toISOString().slice(0, 10)} = {}) {
  if (typeof root !== 'string' || !root || !/^20\d{2}-\d{2}-\d{2}$/.test(today) ||
      new Date(today + 'T00:00:00Z').toISOString().slice(0, 10) !== today) throw Error('Invalid publication check options');
  const rows = validateRevenue(data);
  for (const row of rows) {
    if (row.reconciledOn > today) throw Error('Revenue reconciliation date is in the future');
    // validateRevenue restricts evidence to a single local /record/ filename.
    const evidence = await lstat(resolve(root, '.' + row.evidence));
    if (!evidence.isFile() || evidence.isSymbolicLink() || evidence.size === 0) throw Error('Revenue evidence must be a nonempty published file');
  }
  return {statements: rows.length};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 2) throw Error('This check accepts no arguments');
    const result = await checkRevenuePublication(REVENUE, {root: fileURLToPath(new URL('../../dist/', import.meta.url))});
    console.log(result.statements ? `${result.statements} revenue statement evidence links checked; receipt review remains manual.` : 'No revenue statements published; months remain unreported.');
  } catch {
    console.error('Revenue publication check failed: review dates and evidence in the built artifact.');
    process.exitCode = 1;
  }
}
