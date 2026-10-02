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
  // Round the aggregate target up. Individual-position rounding can cost more.
  return (cap * ratePercent + 99n) / 100n;
}

export function calculate(caps, vault, cycles = [1n, 1n, 1n]) {
  if (caps.length !== TERMS.length || cycles.length !== TERMS.length ||
      cycles.some(value => typeof value !== 'bigint' || value < 1n)) {
    throw new Error('Supply one positive whole-number cycle count per term.');
  }
  const rows = TERMS.map(({ name, rate }, index) => ({
    name,
    rate,
    cap: caps[index],
    cycles: cycles[index],
    reward: obligation(caps[index], rate) * cycles[index],
  }));
  const totalCap = rows.reduce((sum, row) => sum + row.cap, 0n);
  const totalReward = rows.reduce((sum, row) => sum + row.reward, 0n);
  return { rows, totalCap, totalReward, vault, shortfall: vault === undefined ? undefined : totalReward - vault };
}

function parseCycles(value) {
  if (typeof value !== 'string' || !/^[1-9]\\d*$/.test(value)) {
    throw new Error('Cycle counts must be positive whole numbers.');
  }
  return BigInt(value);
}

function cli(argv) {
  const flags = new Map();
  const amountFlags = ['--one', '--six', '--twelve', '--vault'];
  const cycleFlags = ['--one-cycles', '--six-cycles', '--twelve-cycles'];
  for (let i = 0; i < argv.length; i += 2) {
    if (![...amountFlags, ...cycleFlags].includes(argv[i]) || !argv[i + 1] || flags.has(argv[i])) {
      throw new Error('Usage: node scripts/staking-budget.mjs --one CAP --six CAP --twelve CAP [--one-cycles N --six-cycles N --twelve-cycles N] [--vault FUNDED_REWARDS]');
    }
    flags.set(argv[i], amountFlags.includes(argv[i]) ? parseTokens(argv[i + 1]) : parseCycles(argv[i + 1]));
  }
  if (TERMS.some(term => !flags.has(term.flag))) {
    throw new Error('Supply all three term caps, using zero for a closed term.');
  }
  const result = calculate(
    TERMS.map(term => flags.get(term.flag)),
    flags.get('--vault'),
    TERMS.map(term => flags.get(term.flag + '-cycles') ?? 1n),
  );
  if (result.totalCap === 0n) throw new Error('At least one term cap must be positive.');
  for (const row of result.rows) {
    console.log(`${row.name}: cap ${formatTokens(row.cap)} GFOF; ${row.rate}% total term target; ${row.cycles} assumed cohort(s); gross scenario obligation ${formatTokens(row.reward)} GFOF`);
  }
  console.log(`Aggregate cap: ${formatTokens(result.totalCap)} GFOF`);
  console.log(`Aggregate gross scenario estimate: ${formatTokens(result.totalReward)} GFOF`);
  if (result.vault !== undefined) {
    console.log(`Proposed reward vault: ${formatTokens(result.vault)} GFOF`);
    console.log(result.shortfall > 0n
      ? `SHORTFALL against aggregate estimate: ${formatTokens(result.shortfall)} GFOF before rounding by position, fees and buffer`
      : `Aggregate estimate covered; excess ${formatTokens(-result.shortfall)} GFOF before rounding by position, fees and buffer`);
    if (result.shortfall > 0n) process.exitCode = 2;
  }
  console.log('Planning sensitivity only. Reuse of cap and cycle timing are unverified; this is not a sufficient-vault proof. Per-position rounding, provider formula, expiry, fees and actual funded vault require verification.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { cli(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
