import{a as z}from"./chunk-UHBLGKM6.js";import{a as M}from"./chunk-FVAZNPEK.js";import{a as $}from"./chunk-BDRVB4TV.js";import{a as S}from"./chunk-YLHRZO5I.js";import{a as W}from"./chunk-LQURKWOQ.js";import{a as g}from"./chunk-QGL6TGIW.js";import{a as m}from"./chunk-FBBEB3YN.js";import"./chunk-5FBZWUWN.js";import{d as f,f as A,j as h,l as p}from"./chunk-LRLIBYHZ.js";import"./chunk-SRCTCGYB.js";import"./chunk-AFPITI7X.js";import"./chunk-AIOKECSZ.js";import"./chunk-H4RJIX63.js";import{b as s}from"./chunk-IKBUFKJ4.js";import{Bb as k,Fb as C,Ha as b}from"./chunk-2UDMLWY7.js";import"./chunk-ZIWEZIIE.js";import{a as B,b as N}from"./chunk-TKNV7UDP.js";import"./chunk-E7RJ6JIK.js";import"./chunk-HAS3FVRU.js";import"./chunk-Z2TDV7WW.js";import"./chunk-JMG6CDSR.js";import"./chunk-GAZWDLP6.js";import"./chunk-XEWNBKME.js";import{c as w}from"./chunk-DCANE7XH.js";var e=w(N(),1);var u=w(B(),1);var P=s.span`
  && {
    width: 82px;
    height: 82px;
    border-width: 4px;
    border-style: solid;
    border-color: ${r=>r.color??"var(--privy-color-accent)"};
    border-radius: 50%;
    display: inline-block;
    box-sizing: border-box;
    animation: rotation 1.2s linear infinite;
    transition: border-color 800ms;
  }
`;function F(r){return(0,e.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"24",height:"24",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor","stroke-width":"2","stroke-linecap":"round","stroke-linejoin":"round",...r,children:[(0,e.jsx)("circle",{cx:"12",cy:"12",r:"10"}),(0,e.jsx)("line",{x1:"12",x2:"12",y1:"8",y2:"12"}),(0,e.jsx)("line",{x1:"12",x2:"12.01",y1:"16",y2:"16"})]})}var j=({onTransfer:r,isTransferring:t,transferSuccess:n})=>(0,e.jsx)(f,{...n?{success:!0,children:"Success!"}:{warn:!0,loading:t,onClick:r,children:"Transfer and delete account"}}),E=s.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding-bottom: 16px;
`,x=s.div`
  display: flex;
  flex-direction: column;
  && p {
    font-size: 14px;
  }
  width: 100%;
  gap: 16px;
`,D=s.div`
  display: flex;
  cursor: pointer;
  align-items: center;
  width: 100%;
  border: 1px solid var(--privy-color-foreground-4) !important;
  border-radius: var(--privy-border-radius-md);
  padding: 8px 10px;
  font-size: 14px;
  font-weight: 500;
  gap: 8px;
`,U=s(S)`
  position: relative;
  width: ${({$iconSize:r})=>`${r}px`};
  height: ${({$iconSize:r})=>`${r}px`};
  color: var(--privy-color-foreground-3);
  margin-left: auto;
`,_=s($)`
  position: relative;
  width: 15px;
  height: 15px;
  color: var(--privy-color-foreground-3);
  margin-left: auto;
`,V=s.ol`
  display: flex;
  flex-direction: column;
  font-size: 14px;
  width: 100%;
  text-align: left;
`,I=s.li`
  font-size: 14px;
  list-style-type: auto;
  list-style-position: outside;
  margin-left: 1rem;
  margin-bottom: 0.5rem; /* Adjust the margin as needed */

  &:last-child {
    margin-bottom: 0; /* Remove margin from the last item */
  }
`,q=s.div`
  position: relative;
  width: 60px;
  height: 60px;
  margin: 10px;
  display: flex;
  justify-content: center;
  align-items: center;
`,G=()=>(0,e.jsx)(q,{children:(0,e.jsx)(U,{$iconSize:60})}),H=({address:r,onClose:t,onRetry:n,onTransfer:c,isTransferring:l,transferSuccess:d})=>{let{defaultChain:o}=k(),a=o.blockExplorers?.default.url??"https://etherscan.io";return(0,e.jsxs)(e.Fragment,{children:[(0,e.jsx)(h,{onClose:t,backFn:n}),(0,e.jsxs)(E,{children:[(0,e.jsx)(G,{}),(0,e.jsxs)(x,{children:[(0,e.jsx)("h3",{children:"Check account assets before transferring"}),(0,e.jsx)("p",{children:"Before transferring, ensure there are no assets in the other account. Assets in that account will not transfer automatically and may be lost."}),(0,e.jsxs)(V,{children:[(0,e.jsx)("p",{children:" To check your balance, you can:"}),(0,e.jsx)(I,{children:"Log out and log back into the other account, or "}),(0,e.jsxs)(I,{children:["Copy your wallet address and use a"," ",(0,e.jsx)("u",{children:(0,e.jsx)("a",{target:"_blank",href:a,children:"block explorer"})})," ","to see if the account holds any assets."]})]}),(0,e.jsxs)(D,{onClick:()=>navigator.clipboard.writeText(r).catch(console.error),children:[(0,e.jsx)(m,{color:"var(--privy-color-foreground)",strokeWidth:2,height:"28px",width:"28px"}),(0,e.jsx)(g,{address:r,showCopyIcon:!1}),(0,e.jsx)(_,{})]}),(0,e.jsx)(j,{onTransfer:c,isTransferring:l,transferSuccess:d})]})]}),(0,e.jsx)(p,{})]})},ie={component:()=>{let{initiateAccountTransfer:r,closePrivyModal:t}=b(),{data:n,navigate:c,lastScreen:l,setModalData:d}=C(),[o,a]=(0,u.useState)(void 0),[i,L]=(0,u.useState)(!1),[y,T]=(0,u.useState)(!1),v=async()=>{try{if(!n?.accountTransfer?.nonce||!n?.accountTransfer?.account)throw Error("missing account transfer inputs");T(!0),await r({nonce:n?.accountTransfer?.nonce,account:n?.accountTransfer?.account,accountType:n?.accountTransfer?.linkMethod,externalWalletMetadata:n?.accountTransfer?.externalWalletMetadata,telegramWebAppData:n?.accountTransfer?.telegramWebAppData,telegramAuthResult:n?.accountTransfer?.telegramAuthResult,farcasterEmbeddedAddress:n?.accountTransfer?.farcasterEmbeddedAddress,oAuthUserInfo:n?.accountTransfer?.oAuthUserInfo}),L(!0),T(!1),setTimeout(t,1e3)}catch(R){d({errorModalData:{error:R,previousScreen:l||"LinkConflictScreen"}}),c("ErrorScreen",!0)}};return o?(0,e.jsx)(H,{address:o,onClose:t,onRetry:()=>a(void 0),onTransfer:v,isTransferring:y,transferSuccess:i}):(0,e.jsx)(J,{onClose:t,onInfo:()=>a(n?.accountTransfer?.embeddedWalletAddress),onContinue:()=>a(n?.accountTransfer?.embeddedWalletAddress),onTransfer:v,isTransferring:y,transferSuccess:i,data:n})}},J=({onClose:r,onContinue:t,onInfo:n,onTransfer:c,transferSuccess:l,isTransferring:d,data:o})=>{if(!o?.accountTransfer?.linkMethod||!o?.accountTransfer?.displayName)return;let a={method:o?.accountTransfer?.linkMethod,handle:o?.accountTransfer?.displayName,disclosedAccount:o?.accountTransfer?.embeddedWalletAddress?{type:"wallet",handle:o?.accountTransfer?.embeddedWalletAddress}:void 0};return(0,e.jsxs)(e.Fragment,{children:[(0,e.jsx)(h,{closeable:!0}),(0,e.jsxs)(E,{children:[(0,e.jsx)(M,{children:(0,e.jsxs)("div",{children:[(0,e.jsx)(P,{color:"var(--privy-color-error)"}),(0,e.jsx)(W,{height:38,width:38,stroke:"var(--privy-color-error)"})]})}),(0,e.jsxs)(x,{children:[(0,e.jsxs)("h3",{children:[(function(i){switch(i){case"sms":return"Phone number";case"email":return"Email address";case"siwe":return"Wallet address";case"siws":return"Solana wallet address";case"linkedin":return"LinkedIn profile";case"google":case"apple":case"discord":case"github":case"instagram":case"spotify":case"tiktok":case"line":case"twitch":case"twitter":case"telegram":case"farcaster":return`${z(i.replace("_oauth",""))} profile`;default:return i.startsWith("privy:")?"Cross-app account":i}})(a.method)," is associated with another account"]}),(0,e.jsxs)("p",{children:["Do you want to transfer",(0,e.jsx)("b",{children:a.handle?` ${a.handle}`:""})," to this account instead? This will delete your other account."]}),(0,e.jsx)(K,{onClick:n,disclosedAccount:a.disclosedAccount})]}),(0,e.jsxs)(x,{style:{gap:12,marginTop:12},children:[o?.accountTransfer?.embeddedWalletAddress?(0,e.jsx)(f,{onClick:t,children:"Continue"}):(0,e.jsx)(j,{onTransfer:c,transferSuccess:l,isTransferring:d}),(0,e.jsx)(A,{onClick:r,children:"No thanks"})]})]}),(0,e.jsx)(p,{})]})};function K({disclosedAccount:r,onClick:t}){return r?(0,e.jsxs)(D,{onClick:t,children:[(0,e.jsx)(m,{color:"var(--privy-color-foreground)",strokeWidth:2,height:"28px",width:"28px"}),(0,e.jsx)(g,{address:r.handle,showCopyIcon:!1}),(0,e.jsx)(F,{width:15,height:15,color:"var(--privy-color-foreground-3)",style:{marginLeft:"auto"}})]}):null}export{ie as LinkConflictScreen,J as LinkConflictScreenView,ie as default};
