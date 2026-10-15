import test from 'node:test';
import assert from 'node:assert/strict';
import {mountMissionHelp} from '../journey/mission-help.mjs';
function fixture(){
 const nodes=[];const main={children:[],querySelector:()=>null,prepend(node){this.children.unshift(node);}};
 const document={querySelector:()=>main,getElementById:id=>nodes.find(n=>n.id===id),createElement(tag){
  const n={tag,children:[],attrs:{},events:{},textContent:'',hidden:false,disabled:false,
   append(...children){this.children.push(...children);},setAttribute(k,v){this.attrs[k]=v;},addEventListener(k,v){this.events[k]=v;},focus(){this.focused=true;}};
  nodes.push(n);return n;
 }};return {document,main,nodes};
}
test('three-step help and reset do not write progress or storage',()=>{
 const {document,nodes}=fixture();assert.equal(mountMissionHelp(document,'the-signal'),true);
 const next=nodes.find(n=>n.textContent==='Show first hint'),reset=nodes.find(n=>n.textContent==='Reset hints'),output=document.getElementById('mission-help-output');
 assert.equal(output.attrs['aria-live'],'polite');assert.equal(output.attrs['aria-atomic'],'true');
 for(let i=1;i<=3;i++){next.events.click();assert.ok(output.textContent.startsWith('Hint '+i+' of 3:'));}
 assert.equal(next.disabled,true);const last=output.textContent;next.events.click();assert.equal(output.textContent,last);
 reset.events.click();assert.equal(next.disabled,false);assert.equal(next.focused,true);assert.equal(reset.hidden,true);
 next.events.click();assert.match(output.textContent,/Hint 1 of 3/);
 assert.equal(mountMissionHelp(document,'the-signal'),false);
});
test('unsupported page or missing main produces no panel',()=>{
 const {document,nodes}=fixture();assert.equal(mountMissionHelp(document,'index'),false);assert.equal(nodes.length,0);
 document.querySelector=()=>null;assert.equal(mountMissionHelp(document,'the-signal'),false);assert.equal(nodes.length,0);
});
