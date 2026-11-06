import{a as S,b as g}from"./chunk-NJIOMNAC.js";import{G as B,i as z,s as b}from"./chunk-5FBZWUWN.js";import{a as k}from"./chunk-EOXZEZ7R.js";import{k as L}from"./chunk-4IGG6W6J.js";import{a as x,h as y}from"./chunk-AIOKECSZ.js";import{a as w,b as o,h as N}from"./chunk-IKBUFKJ4.js";import{Fb as P,Ha as I,Hb as A}from"./chunk-2UDMLWY7.js";import{a as W,b as j}from"./chunk-TKNV7UDP.js";import{c as E}from"./chunk-DCANE7XH.js";var e=E(j(),1);var l=E(W(),1);var D=({passkeys:s,name:c,isLoading:h,errorReason:m,success:d,expanded:t,onLinkPasskey:u,onUnlinkPasskey:n,onExpand:r,onBack:i,onClose:a})=>d?(0,e.jsx)(k,{title:"Passkeys updated",icon:z,iconVariant:"success",primaryCta:{label:"Done",onClick:a},onClose:a,watermark:!0}):t?(0,e.jsx)(k,{icon:b,title:"Your passkeys",onBack:i,onClose:a,watermark:!0,children:(0,e.jsx)(T,{passkeys:s,expanded:t,onUnlink:n,onExpand:r})}):(0,e.jsxs)(k,{icon:b,title:"Set up passkey verification",subtitle:"Verify with passkey",primaryCta:{label:"Add new passkey",onClick:u,loading:h},onClose:a,watermark:!0,helpText:m||void 0,children:[s.length===0?(0,e.jsx)($,{}):(0,e.jsx)(_,{children:(0,e.jsx)(T,{passkeys:s,expanded:t,onUnlink:n,onExpand:r})}),c?(0,e.jsxs)(M,{children:[(0,e.jsx)(O,{children:"New Passkey Name"}),(0,e.jsx)(V,{children:c})]}):null]}),_=o.div`
  margin-bottom: 0.75rem;
`,M=o.div`
  margin-top: 0.25rem;
`,O=o.div`
  color: var(--privy-color-foreground-2);
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1rem;
  margin-bottom: 0.25rem;
`,V=o.div`
  color: var(--privy-color-foreground);
  font-size: 0.875rem;
  line-height: 1.25rem;
`,T=({passkeys:s,expanded:c,onUnlink:h,onExpand:m})=>{let[d,t]=(0,l.useState)([]),u=c?s.length:2;return(0,e.jsxs)("div",{children:[(0,e.jsx)(K,{children:"Your passkeys"}),(0,e.jsxs)(Y,{children:[s.slice(0,u).map((n=>{return(0,e.jsxs)(H,{children:[(0,e.jsxs)("div",{children:[(0,e.jsx)(q,{children:(r=n,r.authenticatorName?r.createdWithBrowser?`${r.authenticatorName} on ${r.createdWithBrowser}`:r.authenticatorName:r.createdWithBrowser?r.createdWithOs?`${r.createdWithBrowser} on ${r.createdWithOs}`:`${r.createdWithBrowser}`:"Unknown device")}),(0,e.jsxs)(G,{children:["Last used:"," ",(n.latestVerifiedAt??n.firstVerifiedAt)?.toLocaleString()??"N/A"]})]}),(0,e.jsx)(Q,{disabled:d.includes(n.credentialId),onClick:()=>(async i=>{t((a=>a.concat([i]))),await h(i),t((a=>a.filter((f=>f!==i))))})(n.credentialId),children:d.includes(n.credentialId)?(0,e.jsx)(N,{}):(0,e.jsx)(B,{size:16})})]},n.credentialId);var r})),s.length>2&&!c&&(0,e.jsx)(R,{onClick:m,children:"View all"})]})]})},$=()=>(0,e.jsxs)(S,{style:{color:"var(--privy-color-foreground)"},children:[(0,e.jsx)(g,{children:"Verify with Touch ID, Face ID, PIN, or hardware key"}),(0,e.jsx)(g,{children:"Takes seconds to set up and use"}),(0,e.jsx)(g,{children:"Use your passkey to verify transactions and login to your account"})]}),se={component:()=>{let{user:s}=A(),{unlink:c}=L(),{linkWithPasskey:h,closePrivyModal:m}=I(),{data:d}=P(),t=s?.linkedAccounts.filter((p=>p.type==="passkey")),[u,n]=(0,l.useState)(!1),[r,i]=(0,l.useState)(""),[a,f]=(0,l.useState)(!1),[U,v]=(0,l.useState)(!1);return(0,l.useEffect)((()=>{t.length===0&&v(!1)}),[t.length]),(0,e.jsx)(D,{passkeys:t,name:d?.passkeyAuthModalData?.name,isLoading:u,errorReason:r,success:a,expanded:U,onLinkPasskey:()=>{n(!0),h({name:d?.passkeyAuthModalData?.name}).then((()=>f(!0))).catch((p=>{if(p instanceof x){if(p.privyErrorCode===y.CANNOT_LINK_MORE_OF_TYPE)return void i("Cannot link more passkeys to account.");if(p.privyErrorCode===y.PASSKEY_NOT_ALLOWED)return void i("Passkey request timed out or rejected by user.")}i("Unknown error occurred.")})).finally((()=>{n(!1)}))},onUnlinkPasskey:async p=>(n(!0),await c({credentialId:p}).then((()=>f(!0))).catch((C=>{C instanceof x&&C.privyErrorCode===y.MISSING_MFA_CREDENTIALS?i("Cannot unlink a passkey enrolled in MFA"):i("Unknown error occurred.")})).finally((()=>{n(!1)}))),onExpand:()=>v(!0),onBack:()=>v(!1),onClose:()=>m()})}},le=o.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 180px;
  height: 90px;
  border-radius: 50%;
  svg + svg {
    margin-left: 12px;
  }
  > svg {
    z-index: 2;
    color: var(--privy-color-accent) !important;
    stroke: var(--privy-color-accent) !important;
    fill: var(--privy-color-accent) !important;
  }
`,F=w`
  && {
    width: 100%;
    font-size: 0.875rem;
    line-height: 1rem;

    /* Tablet and Up */
    @media (min-width: 440px) {
      font-size: 14px;
    }

    display: flex;
    gap: 12px;
    justify-content: center;

    padding: 6px 8px;
    background-color: var(--privy-color-background);
    transition: background-color 200ms ease;
    color: var(--privy-color-accent) !important;

    :focus {
      outline: none;
      box-shadow: none;
    }
  }
`,R=o.button`
  ${F}
`,Y=o.div`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.8rem;
  padding: 0.5rem 0 0;
  flex-grow: 1;
  width: 100%;
`,K=o.div`
  line-height: 20px;
  height: 20px;
  font-size: 1em;
  font-weight: 450;
  display: flex;
  justify-content: flex-start;
  width: 100%;
`,q=o.div`
  font-size: 1em;
  line-height: 1.3em;
  font-weight: 500;
  color: var(--privy-color-foreground-2);
  padding: 0.2em 0;
`,G=o.div`
  font-size: 0.875rem;
  line-height: 1rem;
  color: var(--privy-color-foreground-2);
  padding: 0.2em 0;
`,H=o.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1em;
  gap: 10px;
  font-size: 0.875rem;
  line-height: 1rem;
  text-align: left;
  border-radius: 8px;
  border: 1px solid var(--privy-color-border-default) !important;
  width: 100%;
  height: 5em;
`,J=w`
  :focus,
  :hover,
  :active {
    outline: none;
  }
  display: flex;
  width: 2em;
  height: 2em;
  justify-content: center;
  align-items: center;
  svg {
    color: var(--privy-color-error);
  }
  svg:hover {
    color: var(--privy-color-foreground-3);
  }
`,Q=o.button`
  ${J}
`;export{D as a,se as b,le as c,R as d};
