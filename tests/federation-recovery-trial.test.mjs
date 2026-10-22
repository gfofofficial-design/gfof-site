import test from 'node:test';
import assert from 'node:assert/strict';
import {createRecoveryTrial,TRIAL_URL} from '../assets/federation/fed-recovery-trial.mjs';
const TRIAL_EMAIL='recovery@example.invalid';
const user={id:'synthetic-test-user',email:TRIAL_EMAIL,email_confirmed_at:'2026-10-22T00:00:00Z',is_anonymous:false};
const tokens={access_token:'synthetic-access',refresh_token:'synthetic-refresh',user};
function fixture(override){const calls=[];const trial=createRecoveryTrial({key:'sb_publishable_synthetic',email:TRIAL_EMAIL,fetcher:async(url,init)=>{calls.push({url,init});if(override)return override(url,init);return url.endsWith('logout?scope=local')?new Response(null,{status:204}):Response.json(url.endsWith('/user')?user:/\/verify$|grant_type=password/.test(url)?tokens:{});}});return {trial,calls};}
test('secret/legacy/missing keys are refused',()=>{for(const key of [undefined,'sb_secret_example','eyJsynthetic'])assert.throws(()=>createRecoveryTrial({key,email:TRIAL_EMAIL}));});
test('one exact existing identity completes recovery, update, password login and logout',async()=>{
 const {trial,calls}=fixture();await trial.requestCode();await trial.verifyCode('12345678');await trial.setPassword('synthetic-test-password');await trial.login('synthetic-test-password');await trial.logout();assert.equal(trial.state(),'complete');
 assert.equal(calls.length,8);assert.ok(calls.every(c=>c.url.startsWith(TRIAL_URL+'/auth/v1/')&&c.init.credentials==='omit'&&c.init.redirect==='error'));
 assert.deepEqual(JSON.parse(calls[0].init.body),{email:TRIAL_EMAIL});assert.equal(JSON.parse(calls[1].init.body).type,'recovery');assert.equal(calls.filter(c=>c.url.endsWith('/recover')).length,1);
 assert.equal(calls.some(c=>/signup|\/otp/.test(c.url)),false);
});
test('recovery cannot resend and failure is not retried',async()=>{const {trial,calls}=fixture(()=>new Response('private error',{status:429}));await assert.rejects(trial.requestCode(),/rate limit/);await assert.rejects(trial.requestCode());assert.equal(calls.length,1);assert.equal(trial.state(),'stopped');});
test('foreign or unconfirmed returned identity cannot update a password',async()=>{
 for(const changed of [{...user,email:'other@example.invalid'},{...user,email_confirmed_at:null},{...user,is_anonymous:true}]){const {trial,calls}=fixture(url=>Response.json(url.endsWith('/user')?changed:url.endsWith('/verify')?tokens:{}));await trial.requestCode();await assert.rejects(trial.verifyCode('12345678'),/identity/);await assert.rejects(trial.setPassword('synthetic-test-password'));assert.equal(calls.some(c=>c.init.method==='PUT'),false);}
});
test('disposed page ignores late verification and permits no password request',async()=>{
 let release;const gate=new Promise(r=>release=r);const {trial,calls}=fixture(async url=>{if(url.endsWith('/verify')){await gate;return Response.json(tokens);}return Response.json({});});await trial.requestCode();const pending=trial.verifyCode('12345678');trial.dispose();release();await assert.rejects(pending);await assert.rejects(trial.setPassword('synthetic-test-password'));assert.equal(calls.some(c=>c.init.method==='PUT'),false);
});
test('oversized provider data stops before issuing a test session',async()=>{const {trial}=fixture(url=>new Response(url.endsWith('/verify')?'x'.repeat(65537):'{}'));await trial.requestCode();await assert.rejects(trial.verifyCode('12345678'),/too large/);assert.equal(trial.state(),'stopped');});
