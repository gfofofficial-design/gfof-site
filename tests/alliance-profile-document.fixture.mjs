import {readFileSync} from 'node:fs';
export const profileHtml=readFileSync(new URL('../alliance-profile.html',import.meta.url),'utf8');
export const origin='https://deploy-preview-124--gfof.netlify.app';
export function profileDocument(){
 const nodes=new Map();let doc;
 class Element{
  constructor(tag){this.tag=tag;this.children=[];this.events={};this.attributes={};this.value='';this.checked=false;this.hidden=false;this.disabled=false;this._text='';}
  get ownerDocument(){return doc;}set textContent(v){this._text=String(v);this.children=[];}get textContent(){return this._text+this.children.map(n=>n.textContent).join('');}
  append(...v){this.children.push(...v);}replaceChildren(...v){this.children=[...v];this._text='';}
  querySelectorAll(tag){return this.children.flatMap(c=>[...(c.tag===tag?[c]:[]),...c.querySelectorAll(tag)]);}
  contains(node){return node===this||this.children.some(child=>child.contains(node));}
  setAttribute(k,v){this.attributes[k]=String(v);if(k==='id')nodes.set(v,this);}getAttribute(k){return this.attributes[k]??null;}removeAttribute(k){delete this.attributes[k];}
  addEventListener(k,f){(this.events[k]??=new Set()).add(f);}removeEventListener(k,f){this.events[k]?.delete(f);}focus(){doc.activeElement=this;}
  async emit(k){for(const f of this.events[k]||[])await f({preventDefault(){}});}
 }
 for(const m of profileHtml.matchAll(/<([a-z][a-z0-9-]*)\b[^>]*\bid="([^"]+)"[^>]*>/gi)){
  const n=new Element(m[1]);n.disabled=/\sdisabled(?:\s|>)/.test(m[0]);n.hidden=/\shidden(?:\s|>)/.test(m[0]);nodes.set(m[2],n);
 }
 const target=new EventTarget();
 doc={activeElement:null,body:new Element('body'),visibilityState:'visible',location:{origin},getElementById:id=>nodes.get(id)||null,createElement:tag=>new Element(tag),
  addEventListener:target.addEventListener.bind(target),removeEventListener:target.removeEventListener.bind(target),emit:type=>target.dispatchEvent(new Event(type))};
 const get=id=>nodes.get('ap-'+id);get('role').value='explorer';get('member-surface').append(get('name'),get('feedback'),get('collaboration'),get('report-review'));return {doc,get};
}
