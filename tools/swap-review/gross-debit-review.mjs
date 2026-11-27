import {createReadStream} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {unsignedMessageSha256} from './transaction-envelope.mjs';

const U64_MAX = 18_446_744_073_709_551_615n;
const MAX_RECEIPT_BYTES = 8192;
const DEBIT_FIELDS = [
  'inputLamports',
  'baseFeeLamports',
  'priorityFeeLamports',
  'tipLamports',
  'accountFundingLamports',
  'otherDebitsLamports',
];
const RECEIPT_FIELDS = ['capLamports', 'debits', 'knownGrossMinimumLamports', 'message'];
const invalid = () => new Error('gross_debit_receipt_invalid');

function hasFields(value, required, allowed = required) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    required.every(key => Object.hasOwn(value, key)) &&
    Object.keys(value).every(key => allowed.includes(key));
}

function lamports(value) {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]{0,19})$/.test(value)) throw invalid();
  const amount = BigInt(value);
  if (amount > U64_MAX) throw invalid();
  return amount;
}

function bindMessage(message) {
  if (message === undefined) return null;
  if (!hasFields(message, ['transactionBase64', 'sha256']) ||
      typeof message.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(message.sha256)) throw invalid();
  if (unsignedMessageSha256(message.transactionBase64) !== message.sha256) {
    throw new Error('gross_debit_message_mismatch');
  }
  return message.sha256;
}

// Each debit belongs to one category. A previously verified gross minimum is
// another lower bound on the same debit, so it is compared to the subtotal.
export function reviewGrossDebit(receipt) {
  if (!hasFields(receipt, ['capLamports', 'debits'], RECEIPT_FIELDS) ||
      !hasFields(receipt.debits, DEBIT_FIELDS)) throw invalid();
  const cap = lamports(receipt.capLamports);
  if (cap === 0n) throw invalid();
  const messageSha256 = bindMessage(receipt.message);
  const reportedMinimum = receipt.knownGrossMinimumLamports === undefined
    ? 0n : lamports(receipt.knownGrossMinimumLamports);

  const unknownDebits = [];
  let subtotal = 0n;
  for (const field of DEBIT_FIELDS) {
    const amount = receipt.debits[field];
    if (amount === null) unknownDebits.push(field);
    else subtotal += lamports(amount);
  }
  const knownMinimum = subtotal > reportedMinimum ? subtotal : reportedMinimum;
  let status = 'within_cap';
  if (!unknownDebits.length && reportedMinimum > subtotal) status = 'inconsistent';
  else if (knownMinimum > cap) status = 'over_cap';
  else if (unknownDebits.length) status = 'incomplete';

  return Object.freeze({
    status,
    capLamports: cap.toString(),
    reportedSubtotalLamports: subtotal.toString(),
    knownGrossMinimumLamports: knownMinimum.toString(),
    headroomLamports: status === 'within_cap' ? (cap - subtotal).toString() : null,
    minimumExcessLamports: knownMinimum > cap ? (knownMinimum - cap).toString() : null,
    unknownDebits: Object.freeze(unknownDebits),
    messageSha256,
    tradeAllowed: false,
  });
}

async function readReceipt(filename) {
  const chunks = [];
  let length = 0;
  for await (const chunk of createReadStream(filename, {end: MAX_RECEIPT_BYTES})) {
    length += chunk.length;
    if (length > MAX_RECEIPT_BYTES) throw invalid();
    chunks.push(chunk);
  }
  return JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(Buffer.concat(chunks)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length !== 3) {
    process.stderr.write('Usage: node tools/swap-review/gross-debit-review.mjs <receipt-file>\n');
    process.exitCode = 2;
  } else {
    try {
      const result = reviewGrossDebit(await readReceipt(process.argv[2]));
      process.stdout.write(JSON.stringify(result, null, 2) + '\n');
      process.exitCode = result.status === 'within_cap' ? 0 : 1;
    } catch (error) {
      const reason = error.message === 'gross_debit_message_mismatch'
        ? 'The receipt hash does not match the unsigned message.'
        : error.message === 'swap_transaction_envelope_invalid'
          ? 'The supplied transaction is incomplete, signed, or outside the reviewed unsigned v0 format.'
          : 'Could not read a valid debit receipt.';
      process.stderr.write(reason + '\n');
      process.exitCode = 2;
    }
  }
}
