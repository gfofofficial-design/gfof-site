import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createWalletPreview, validAccount} from '../assets/federation/swap/wallet-preview.mjs';
const flush = async () => { for (let i=0;i<5;i++) await new Promise(r=>setImmediate(r)); };
const account = {address:'11111111111111111111111111111111', publicKey:new Uint8Array(32), chains:['solana:mainnet']};
function fixture(connect = async () => ({accounts:[account]}), disconnect = async () => {}) {
  let change; const states=[], calls=[], timers=new Map(), events=new Map(); let next=0;
  const wallet={name:'Fake wallet', chains:['solana:mainnet'], accounts:[account], features:{
    'standard:connect':{version:'1.0.0',connect:(...args)=>{calls.push(args);return connect(...args);}},
    'standard:disconnect':{version:'1.0.0',disconnect},
    'standard:events':{version:'1.0.0',on:(event,fn)=>{change=fn;return ()=>{change=null;};}},
    'solana:signTransaction':{signTransaction:()=>assert.fail('must never sign')}
  }};
  let wallets=[wallet]; const registry={get:()=>wallets,on:(event,fn)=>{events.set(event,fn);return ()=>events.delete(event);}};
  const api=createWalletPreview({registry,onState:s=>states.push(s),setTimer:(fn,ms)=>{timers.set(++next,{fn,ms});return next;},clearTimer:id=>timers.delete(id)});
  return {api,wallet,states,calls,timers,change:()=>change?.(),remove:()=>{wallets=[];events.get('unregister')?.();},last:()=>states.at(-1),events};
}
test('address validation binds base58 to the 32 public-key bytes and mainnet',()=>{
  assert.equal(validAccount(account),true);
  for(const change of [{address:'1111111111111111111111111111111'},{publicKey:new Uint8Array(32).fill(1)},{chains:['solana:devnet']},{address:'0'.repeat(32)}, {publicKey:new Uint8Array(31)}]) assert.equal(validAccount({...account,...change}),false);
});
test('discovery ignores preauthorized accounts; only explicit connect displays an address',async()=>{
  const f=fixture(); assert.equal(f.calls.length,0);assert.equal(f.last().address,'');
  await f.api.connect(0); assert.equal(f.last().phase,'connected');assert.equal(f.last().address,account.address);
  assert.deepEqual(f.calls,[[{silent:false}]]);await f.api.disconnect();assert.equal(f.last().phase,'disconnected');f.api.dispose();
});
test('wrong-chain or mismatched account cannot become connected',async()=>{
  const f=fixture(async()=>({accounts:[{...account,chains:['solana:devnet']}]}));await f.api.connect(0);
  assert.equal(f.last().phase,'uncertain');assert.equal(f.last().address,'');f.api.dispose();
});
test('account changes clear address and require disconnect before a fresh connection',async()=>{
  const f=fixture();await f.api.connect(0);f.change();assert.equal(f.last().phase,'changed');assert.equal(f.last().address,'');
  await f.api.connect(0);assert.equal(f.calls.length,1);await f.api.disconnect();await f.api.connect(0);assert.equal(f.calls.length,2);f.api.dispose();
});
test('late accepted prompt after timeout never displays an address or permits reconnect',async()=>{
  let resolve, cleanups=0;const f=fixture(()=>new Promise(r=>{resolve=r;}),async()=>{cleanups++;});
  const pending=f.api.connect(0);await flush();[...f.timers.values()].find(t=>t.ms===60000).fn();await pending;
  assert.equal(f.last().phase,'uncertain');resolve({accounts:[account]});await flush();assert.equal(cleanups,1);assert.equal(f.last().address,'');
  await f.api.disconnect();await f.api.connect(0);assert.equal(f.calls.length,1);f.api.dispose();
});
test('page invalidation during prompt cannot restore the account',async()=>{
  let resolve;const f=fixture(()=>new Promise(r=>{resolve=r;}));const pending=f.api.connect(0);await flush();f.api.invalidate();resolve({accounts:[account]});await pending;assert.equal(f.last().address,'');assert.notEqual(f.last().phase,'connected');f.api.dispose();
});
test('failed or stalled disconnect clears display without claiming disconnect',async()=>{
  for(const disconnect of [async()=>{throw Error('private provider error');},()=>new Promise(()=>{})]) {
    const f=fixture(undefined,disconnect);await f.api.connect(0);const pending=f.api.disconnect();await flush();for(const timer of f.timers.values())if(timer.ms===5000)timer.fn();await pending;assert.equal(f.last().phase,'uncertain');assert.equal(f.last().address,'');f.api.dispose();
  }
});
test('unregistration and disposal clear listeners and suppress late account presentation',async()=>{
  const f=fixture();await f.api.connect(0);f.remove();assert.equal(f.last().address,'');assert.equal(f.last().phase,'uncertain');f.api.dispose();assert.equal(f.events.size,0);
  let resolve;const g=fixture(()=>new Promise(r=>{resolve=r;}));const pending=g.api.connect(0);await flush();g.api.dispose();const count=g.states.length;resolve({accounts:[account]});await pending;await flush();assert.equal(g.states.length,count);
});
test('shipped vendor files match their reviewed byte hashes',()=>{
  const manifest=JSON.parse(readFileSync(new URL('../assets/federation/swap/vendor/manifest.json',import.meta.url)));
  for(const [path,hash] of Object.entries(manifest.sha256)) assert.equal(createHash('sha256').update(readFileSync(new URL('../assets/federation/swap/vendor/'+path,import.meta.url))).digest('hex'),hash);
});
