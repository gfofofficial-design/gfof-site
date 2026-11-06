import{a as u}from"./chunk-KDML74VA.js";import{h as f}from"./chunk-5TVVMJXO.js";import{b as l,c,e as d,f as x}from"./chunk-NIYJOSIV.js";import{i as h}from"./chunk-SRCTCGYB.js";import{b as a}from"./chunk-IKBUFKJ4.js";import{b}from"./chunk-TKNV7UDP.js";import{na as p}from"./chunk-Z2TDV7WW.js";import{c as v}from"./chunk-DCANE7XH.js";var e=v(b(),1);var Q=({weiQuantities:t,tokenPrice:n,tokenSymbol:o})=>{let i=d(t),r=n?l(i,n):void 0,s=c(i,o);return(0,e.jsx)(m,{children:r||s})},U=({weiQuantities:t,tokenPrice:n,tokenSymbol:o})=>{let i=d(t),r=n?l(i,n):void 0,s=c(i,o);return(0,e.jsx)(m,{children:r?(0,e.jsxs)(e.Fragment,{children:[(0,e.jsx)(w,{children:"USD"}),r==="<$0.01"?(0,e.jsxs)(k,{children:[(0,e.jsx)(g,{children:"<"}),"$0.01"]}):r]}):s})},q=({quantities:t,tokenPrice:n,tokenSymbol:o="SOL",tokenDecimals:i=9})=>{let r=t.reduce(((S,$)=>S+$),0n),s=n&&o==="SOL"&&i===9?f(r,n):void 0,y=o==="SOL"&&i===9?u(r):`${p(r,i)} ${o}`;return(0,e.jsx)(m,{children:s?(0,e.jsx)(e.Fragment,{children:s==="<$0.01"?(0,e.jsxs)(k,{children:[(0,e.jsx)(g,{children:"<"}),"$0.01"]}):s}):y})},m=a.span`
  font-size: 14px;
  line-height: 140%;
  display: flex;
  gap: 4px;
  align-items: center;
`,w=a.span`
  font-size: 12px;
  line-height: 12px;
  color: var(--privy-color-foreground-3);
`,g=a.span`
  font-size: 10px;
`,k=a.span`
  display: flex;
  align-items: center;
`;function P(t,n){return`https://explorer.solana.com/account/${t}?chain=${n}`}var F=t=>(0,e.jsx)(z,{href:t.chainType==="ethereum"?x(t.chainId,t.walletAddress):P(t.walletAddress,t.chainId),target:"_blank",children:h(t.walletAddress)}),z=a.a`
  &:hover {
    text-decoration: underline;
  }
`;export{Q as a,U as b,q as c,F as d};
