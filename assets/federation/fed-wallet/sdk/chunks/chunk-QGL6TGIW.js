import{d as n,n as c}from"./chunk-5FBZWUWN.js";import{f as l}from"./chunk-LRLIBYHZ.js";import{i as a}from"./chunk-SRCTCGYB.js";import{b as i}from"./chunk-IKBUFKJ4.js";import{a as x,b as y}from"./chunk-TKNV7UDP.js";import{c as g}from"./chunk-DCANE7XH.js";var e=g(y(),1);var t=g(x(),1);var S=({address:r,showCopyIcon:p,url:m,className:d})=>{let[o,f]=(0,t.useState)(!1);function h(s){s.stopPropagation(),navigator.clipboard.writeText(r).then((()=>f(!0))).catch(console.error)}return(0,t.useEffect)((()=>{if(o){let s=setTimeout((()=>f(!1)),3e3);return()=>clearTimeout(s)}}),[o]),(0,e.jsxs)(u,m?{children:[(0,e.jsx)(C,{title:r,className:d,href:`${m}/address/${r}`,target:"_blank",children:a(r)}),p&&(0,e.jsx)(l,{onClick:h,size:"sm",style:{gap:"0.375rem"},children:(0,e.jsxs)(e.Fragment,o?{children:["Copied",(0,e.jsx)(n,{size:16})]}:{children:["Copy",(0,e.jsx)(c,{size:16})]})})]}:{children:[(0,e.jsx)(z,{title:r,className:d,children:a(r)}),p&&(0,e.jsx)(l,{onClick:h,size:"sm",style:{gap:"0.375rem",fontSize:"14px"},children:(0,e.jsxs)(e.Fragment,o?{children:["Copied",(0,e.jsx)(n,{size:14})]}:{children:["Copy",(0,e.jsx)(c,{size:14})]})})]})},u=i.span`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
`,z=i.span`
  font-size: 14px;
  font-weight: 500;
  color: var(--privy-color-foreground);
`,C=i.a`
  font-size: 14px;
  color: var(--privy-color-foreground);
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;export{S as a};
