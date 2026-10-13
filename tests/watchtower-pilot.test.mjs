import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {inspectWatchtowerPilot} from '../scripts/check-watchtower-pilot.mjs';
const config=JSON.parse(await readFile(new URL('../config/watchtower-pilot.json',import.meta.url),'utf8'));
test('approved four-address preparation remains inactive and zero-extra-spend',()=>{
 const r=inspectWatchtowerPilot(config);assert.equal(r.status,'prepared_not_activated');assert.equal(r.accountCount,4);assert.equal(r.additionalProviderSpendUsd,0);assert.equal(r.gates.length,3);
});
test('broader scope, paid upgrades and activation cannot pass the preparation check',()=>{
 for(const change of [{enabled:true},{additionalProviderSpendUsd:49},{planUpgradeAllowed:true},{notificationsEnabled:true},{accounts:[...config.accounts,config.accounts[0]]}])assert.throws(()=>inspectWatchtowerPilot({...config,...change}),/Invalid pilot preparation/);
 const changed=structuredClone(config);changed.accounts[0].address='1'.repeat(32);assert.throws(()=>inspectWatchtowerPilot(changed));
});
