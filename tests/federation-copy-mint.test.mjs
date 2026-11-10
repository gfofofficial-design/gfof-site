import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {runInNewContext} from 'node:vm';
import {GFOF,USDC} from '../assets/federation/swap/token-registry.mjs';

const asset = readFileSync(new URL('../assets/federation/fed-copy-mint.js',import.meta.url),'utf8');
function fixture(writeText, linked=false) {
  const added=[];
  const anchor={after: node=>added.push(node)};
  const address={textContent:GFOF.mint,after:node=>added.push(node),closest:()=>linked?anchor:null};
  const document={
    querySelectorAll: selector=>selector==='[data-copy-mint]'?[address]:[],
    createElement:()=>({after:node=>added.push(node),setAttribute(){},addEventListener(event,listener){this[event]=listener;}})
  };
  runInNewContext(asset,{document,navigator:{clipboard:{writeText}},clearTimeout});
  return {address,button:added[0],status:added[1]};
}
test('the copy button writes the exact displayed address after a click, including after a pair change',async()=>{
  const copied=[];
  const {address,button,status}=fixture(value=>copied.push(value),true);
  assert.deepEqual(copied,[]);
  assert.equal(button.type,'button');
  await button.click();
  assert.deepEqual(copied,[GFOF.mint]);
  assert.equal(status.textContent,'Copied!');
  address.textContent=USDC.mint;
  await button.click();
  assert.deepEqual(copied,[GFOF.mint,USDC.mint]);
});
test('invalid text and a denied clipboard never report a copy',async()=>{
  const {address,button,status}=fixture(()=>{throw Error('denied');});
  await button.click();
  assert.match(status.textContent,/manually/);
  address.textContent='Native SOL';
  await button.click();
  assert.equal(status.textContent,'No contract address to copy.');
});
test('the homepage places the current address copy control in the hero',()=>{
  const config=readFileSync(new URL('../netlify.toml',import.meta.url),'utf8');
  const home=config.match(/from = "\/"\s+to = "\/([^"]+\.html)"/)?.[1];
  assert.equal(home,'command-preview.html');
  for(const [page,actions] of [[home,'cmd-hero__actions'],['index.html','hero-btns']]){
    const html=readFileSync(new URL('../'+page,import.meta.url),'utf8');
    assert.ok(html.includes('<code id="hero-gfof-mint" data-copy-mint>'+GFOF.mint+'</code>'));
    assert.ok(html.indexOf('id="hero-gfof-mint"')<html.indexOf('class="'+actions+'"'));
  }
});
