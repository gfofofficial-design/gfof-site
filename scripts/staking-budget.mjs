import { pathToFileURL } from 'node:url';

const SCALE = 1_000_000n; // GFOF has six decimal places; verify the mint before pool creation.
const TERMS = [
  { flag: '--one', name: '1 month', rate: 1n },
  { flag: '--six', name: '6 months', rate: 6n },
  { flag: '--twelve', name: '12 months', rate: 12n },
];

export function parseTokens(value) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)(?:\.\d{1,6})?$/.test(value)) {
    throw new Error('Enter a nonnegative GFOF amount with at most six decimals, without commas.');
  }
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * SCALE + BigInt((fraction + '000000').slice(0, 6));
}

export function formatTokens(raw) {
  const whole = raw / SCALE;
  const fraction = (raw % SCALE).toString().padStart(6, '0').replace(/0+$/, '');
  return whole.toLocaleString('en-US') + (fraction ? '.' + fraction : '');
}

export function obligation(cap, ratePercent) {
  // Round *up* to the nearest GFOF base unit so the worksheet never understates a liability.
  return (cap * ratePercent + 99n) / 100n;
}

export function calculate(caps, vault) {
  const rows = TERMS.map(({ name, rate }, index) => ({
    name,
    rate,
    cap: caps[index],
    reward: obligation(caps[index], rate),
  }));
  const totalCap = rows.reduce((sum, row) => sum + row.cap, 0n);
  const totalReward = rows.reduce((sum, row) => sum + row.reward, 0n);
  return { rows, totalCap, totalReward, vault, shortfall: vault === undefined ? undefined : totalReward - vault };
}

function cli(argv) {
  const flags = new Map();
  for (let i = 0; i < argv.length; i += 2) {
    if (!['--one', '--six', '--twelve', '--vault'].includes(argv[i]) || !argv[i + 1] || flags.has(argv[i])) {
      throw new Error('Usage: node scripts/staking-budget.mjs --one CAP --six CAP --twelve CAP [--vault FUNDED_REWARDS]');
    }
    flags.set(argv[i], parseTokens(argv[i + 1]));
  }
  if (TERMS.some(term => !flags.has(term.flag))) {
    throw new Error('Supply all three term caps, using zero for a closed term.');
  }
  const result = calculate(TERMS.map(term => flags.get(term.flag)), flags.get('--vault'));
  if (result.totalCap === 0n) throw new Error('At least one term cap must be positive.');
  for (const row of result.rows) {
    console.log(`${row.name}: cap ${formatTokens(row.cap)} GFOF; ${row.rate}% total term target; gross obligation ${formatTokens(row.reward)} GFOF`);
  }
  console.log(`Aggregate cap: ${formatTokens(result.totalCap)} GFOF`);
  console.log(`Gross initial obligation: ${formatTokens(result.totalReward)} GFOF`);
  if (result.vault !== undefined) {
    console.log(`Proposed reward vault: ${formatTokens(result.vault)} GFOF`);
    console.log(result.shortfall > 0n
      ? `SHORTFALL: ${formatTokens(result.shortfall)} GFOF before fees and buffer`
      : `Worksheet covered; excess ${formatTokens(-result.shortfall)} GFOF before fees and buffer`);
    if (result.shortfall > 0n) process.exitCode = 2;
  }
  console.log('Planning arithmetic only. Confirm provider formula, terms, token decimals, fees and actual funded vault before approval.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { cli(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
