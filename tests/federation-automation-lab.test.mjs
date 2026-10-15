import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {runInNewContext} from 'node:vm';
import {missionHint} from '../lib/mission-coach-core.mjs';import {replayWatchtower} from '../lib/watchtower-core.mjs';import {inspectAgentRecord} from '../lib/agent-record-core.mjs';
function lab(){
 const elements=new Map();
 function node(){return {children:[],textContent:'',value:'',listeners:{},append(x){this.children.push(x);if(!this.value&&x.value)this.value=x.value;},replaceChildren(){this.children=[];},addEventListener(t,f){this.listeners[t]=f;}};}
 const element=id=>{if(!elements.has(id))elements.set(id,node());return elements.get(id);};element('level').value='0';
 const script=readFileSync(new URL('../assets/federation/fed-automation-lab.mjs',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
 runInNewContext(script,{document:{getElementById:element,createElement:node},missionHint,replayWatchtower,inspectAgentRecord,fetch:()=>{throw Error('network forbidden');}});
 return element;
}
test('mission controls offer existing IDs and update help without progress state',()=>{
 const e=lab();assert.equal(e('mission').children.length,11);assert.match(e('hint').textContent,/reserve/);
 e('mission').value='keys-to-the-gate';e('level').value='2';e('level').listeners.change();assert.match(e('hint').textContent,/permission/);
});
test('fictional replay and permission viewer replace outputs and preserve limitations',()=>{
 const e=lab();e('replay').listeners.click();assert.match(e('watch-output').children[0].textContent,/1 duplicate; 1 awaiting finality/);
 const count=e('watch-output').children.length;e('replay').listeners.click();assert.equal(e('watch-output').children.length,count);
 e('audit').listeners.click();assert.match(e('audit-output').children[0].textContent,/1 attempt outside/);
 assert.match(e('audit-output').children.at(-1).textContent,/does not enforce/);
});
