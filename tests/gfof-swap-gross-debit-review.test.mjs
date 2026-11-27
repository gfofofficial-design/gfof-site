import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {reviewGrossDebit} from '../tools/swap-review/gross-debit-review.mjs';

const example = {
  capLamports: '1000',
  debits: {
    inputLamports: '790',
    baseFeeLamports: '10',
    priorityFeeLamports: '30',
    tipLamports: '20',
    accountFundingLamports: '150',
    otherDebitsLamports: '0',
  },
};

function unsignedFixture() {
  const message = Buffer.concat([
    Buffer.from([128, 1, 0, 1, 2]),
    Buffer.alloc(32, 2),
    Buffer.alloc(32, 3),
    Buffer.alloc(32, 4),
    Buffer.from([1, 1, 1, 0, 1, 8, 0]),
  ]);
  const bytes = Buffer.concat([Buffer.from([1]), Buffer.alloc(64), message]);
  return {bytes, sha256:createHash('sha256').update(message).digest('hex')};
}

test('adds every known debit exactly and permits equality only for the arithmetic result', () => {
  const result = reviewGrossDebit(example);
  assert.equal(result.status, 'within_cap');
  assert.equal(result.reportedSubtotalLamports, '1000');
  assert.equal(result.headroomLamports, '0');
  assert.equal(result.messageSha256, null);
  assert.equal(result.tradeAllowed, false);
  assert.deepEqual(result.unknownDebits, []);
});

test('a lower bound above the cap stops a partial review without counting it twice', () => {
  const result = reviewGrossDebit({
    ...example,
    knownGrossMinimumLamports: '1200',
    debits: {...example.debits, accountFundingLamports:null},
  });
  assert.equal(result.status, 'over_cap');
  assert.equal(result.reportedSubtotalLamports, '850');
  assert.equal(result.knownGrossMinimumLamports, '1200');
  assert.equal(result.minimumExcessLamports, '200');
  assert.deepEqual(result.unknownDebits, ['accountFundingLamports']);
  assert.equal(result.tradeAllowed, false);
});

test('an unknown cost keeps the review incomplete even when known amounts fit', () => {
  const result = reviewGrossDebit({...example, debits:{...example.debits, tipLamports:null}});
  assert.equal(result.status, 'incomplete');
  assert.equal(result.headroomLamports, null);
  assert.equal(result.minimumExcessLamports, null);
});

test('a complete breakdown must agree with its separately verified minimum', () => {
  const result = reviewGrossDebit({...example, knownGrossMinimumLamports:'1001'});
  assert.equal(result.status, 'inconsistent');
  assert.equal(result.minimumExcessLamports, '1');
  assert.equal(result.headroomLamports, null);
});

test('sums large unsigned amounts without rounding or overflowing', () => {
  const amount = '18446744073709551615';
  const result = reviewGrossDebit({
    ...example,
    capLamports:amount,
    debits:{...example.debits, inputLamports:amount, accountFundingLamports:amount, tipLamports:null},
  });
  assert.equal(result.status, 'over_cap');
  assert.equal(result.reportedSubtotalLamports, '36893488147419103270');
  assert.equal(result.minimumExcessLamports, '18446744073709551655');
});

test('invalid, absent and ambiguous fields are refused', () => {
  for (const amount of ['-1', '01', '1.5', ' 1', '1e3', '18446744073709551616', 10, undefined]) {
    assert.throws(() => reviewGrossDebit({...example, debits:{...example.debits, tipLamports:amount}}));
  }
  assert.throws(() => reviewGrossDebit({...example, capLamports:'0'}));
  assert.throws(() => reviewGrossDebit({...example, extraLamports:'1'}));
  assert.throws(() => reviewGrossDebit({...example, debits:{inputLamports:'1'}}));
});

test('only the exact unsigned message may be bound to a debit receipt', () => {
  const {bytes, sha256} = unsignedFixture();
  const message = {transactionBase64:bytes.toString('base64'), sha256};
  const result = reviewGrossDebit({...example, message});
  assert.equal(result.messageSha256, sha256);
  assert.equal(result.tradeAllowed, false);

  const differentMessage = Buffer.from(bytes);
  differentMessage[differentMessage.length - 2] = 9;
  assert.throws(() => reviewGrossDebit({
    ...example, message:{...message, transactionBase64:differentMessage.toString('base64')},
  }), /gross_debit_message_mismatch/);

  bytes[1] = 1;
  assert.throws(() => reviewGrossDebit({
    ...example, message:{...message, transactionBase64:bytes.toString('base64')},
  }), /swap_transaction_envelope_invalid/);
});

test('the CLI returns machine-readable results and refuses oversized or unreadable files', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'federation-gross-debit-'));
  t.after(() => rm(directory, {recursive:true, force:true}));
  const file = join(directory, 'receipt with spaces.json');
  const cli = fileURLToPath(new URL('../tools/swap-review/gross-debit-review.mjs', import.meta.url));
  const run = path => spawnSync(process.execPath, [cli, path], {encoding:'utf8', timeout:5000});
  await writeFile(file, JSON.stringify(example));
  assert.equal(run(file).status, 0);
  await writeFile(file, JSON.stringify({...example, capLamports:'999'}));
  const over = run(file);
  assert.equal(over.status, 1);
  assert.equal(JSON.parse(over.stdout).minimumExcessLamports, '1');
  await writeFile(file, JSON.stringify(example) + ' '.repeat(8192));
  assert.equal(run(file).status, 2);
  assert.equal(run(join(directory, 'missing.json')).status, 2);
});
