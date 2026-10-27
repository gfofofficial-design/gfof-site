import {getWallets} from './vendor/app/index.js';
import {StandardConnect, StandardDisconnect, StandardEvents} from './vendor/features/index.js';
const CHAIN = 'solana:mainnet';
const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
export function validAccount(account) {
  try {
    if (!account.chains.includes(CHAIN) || !(account.publicKey instanceof Uint8Array) || account.publicKey.length !== 32 || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(account.address)) return false;
    let n = 0n;
    for (const char of account.address) n = n * 58n + BigInt(alphabet.indexOf(char));
    const bytes = [];
    while (n) { bytes.unshift(Number(n & 255n)); n >>= 8n; }
    for (const char of account.address) { if (char !== '1') break; bytes.unshift(0); }
    return bytes.length === 32 && bytes.every((byte, i) => byte === account.publicKey[i]);
  } catch { return false; }
}
function compatible(wallet) {
  try { return wallet.chains.includes(CHAIN) && [[StandardConnect, 'connect'], [StandardDisconnect, 'disconnect'], [StandardEvents, 'on']].every(([feature, method]) => wallet.features[feature]?.version === '1.0.0' && typeof wallet.features[feature][method] === 'function'); } catch { return false; }
}
export function createWalletPreview({registry = getWallets(), onState = () => {}, setTimer = setTimeout, clearTimer = clearTimeout, now = () => performance.now()} = {}) {
  let disposed = false, selected = null, unsubscribe = null, busy = false, uncertain = false, generation = 0;
  let phase = 'idle', address = '', locked = false;
  const walletIds = new WeakMap(); let nextWalletId = 0;
  const walletId = wallet => { if (!walletIds.has(wallet)) walletIds.set(wallet, ++nextWalletId); return walletIds.get(wallet); };
  const name = wallet => { try { return typeof wallet.name === 'string' ? wallet.name.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 60) || 'Unnamed wallet' : 'Unnamed wallet'; } catch { return 'Unnamed wallet'; } };
  const list = () => { try { return registry.get().filter(compatible); } catch { return []; } };
  const emit = () => { if (!disposed) onState(Object.freeze({phase, address, busy, wallets: list().map(wallet => ({index: walletId(wallet), name: name(wallet)}))})); };
  const state = (next, value = '') => { phase = next; address = value; emit(); };
  const bounded = (operation, ms) => new Promise((resolve, reject) => {
    const started = now();
    const timer = setTimer(() => reject(new Error('timeout')), ms);
    Promise.resolve().then(operation).then(value => { clearTimer(timer); if (now() - started >= ms) reject(new Error('timeout')); else resolve(value); }, error => { clearTimer(timer); reject(error); });
  });
  const detach = () => { try { unsubscribe?.(); } catch {} unsubscribe = null; };
  async function disconnect() {
    if (busy || !selected || disposed) return;
    const wallet = selected; busy = true; uncertain = true; generation++; detach(); state('disconnecting');
    try {
      await bounded(() => wallet.features[StandardDisconnect].disconnect(), 5000);
      selected = null; uncertain = locked; busy = false; state(locked ? 'uncertain' : 'disconnected');
    } catch { locked = true; busy = false; state('uncertain'); }
  }
  async function connect(index) {
    if (disposed || busy || uncertain || selected) return;
    const wallet = list().find(item => walletIds.get(item) === index); if (!wallet) return;
    selected = wallet; busy = true; const id = ++generation; state('connecting');
    let active = true;
    // A timed-out extension prompt can still resolve. Its account must never be restored.
    const operation = Promise.resolve().then(() => wallet.features[StandardConnect].connect({silent: false}));
    operation.then(() => { if (!active || disposed || id !== generation) void Promise.resolve().then(() => wallet.features[StandardDisconnect].disconnect()).catch(() => {}); }, () => {});
    try {
      const result = await bounded(() => operation, 60000);
      if (disposed || id !== generation) return;
      const account = result?.accounts?.find(validAccount);
      if (!account) throw new Error('invalid account');
      unsubscribe = wallet.features[StandardEvents].on('change', () => {
        // Require a fresh explicit connection after any wallet account/chain change.
        generation++; locked = busy || locked; busy = false; uncertain = true; state('changed');
      });
      if (disposed || id !== generation) return;
      busy = false; state('connected', account.address);
    } catch {
      if (disposed || id !== generation) return;
      locked = true; uncertain = true; busy = false; state('uncertain');
    } finally { active = false; }
  }
  const refresh = () => {
    if (selected && !list().includes(selected)) { locked = busy || locked; busy = false; uncertain = true; generation++; detach(); state('uncertain'); }
    else emit();
  };
  let offRegister = () => {}, offUnregister = () => {};
  try { offRegister = registry.on('register', refresh); offUnregister = registry.on('unregister', refresh); }
  catch (error) { offRegister(); throw error; }
  emit();
  return Object.freeze({connect, disconnect, invalidate() { if (selected) { generation++; locked = busy || locked; busy = false; uncertain = true; state('changed'); } }, dispose() {
    if (disposed) return; disposed = true; generation++; detach(); offRegister(); offUnregister();
    // UI disposal clears local state, not wallet permission. No claim of revocation.
    address = ''; selected = null;
  }});
}
