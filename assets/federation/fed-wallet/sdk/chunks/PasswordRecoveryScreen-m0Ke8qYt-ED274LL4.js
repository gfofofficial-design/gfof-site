import{d as R,f as U,k as W,m as E,n as H}from"./chunk-VN4GZRNJ.js";import{a as T}from"./chunk-J7AJNGGA.js";import"./chunk-5BVQD7WX.js";import{h as _}from"./chunk-HBPTF4NG.js";import{a as o}from"./chunk-C2BH62GT.js";import"./chunk-6DYT5C72.js";import{d as I}from"./chunk-LRLIBYHZ.js";import{ka as N}from"./chunk-WHIEFJMU.js";import"./chunk-JTRRFXCR.js";import"./chunk-MZFBOHQW.js";import"./chunk-KVJE6SXW.js";import"./chunk-HWX6Y2N7.js";import"./chunk-7OBXUUAS.js";import"./chunk-4IGG6W6J.js";import"./chunk-2M4UPM4V.js";import"./chunk-LD3GPA6C.js";import"./chunk-SRCTCGYB.js";import"./chunk-AFPITI7X.js";import{j as P}from"./chunk-AIOKECSZ.js";import"./chunk-H4RJIX63.js";import{a as S,b as n}from"./chunk-IKBUFKJ4.js";import{Fb as C,Ha as x,Hb as k,Pa as A}from"./chunk-2UDMLWY7.js";import"./chunk-ZIWEZIIE.js";import{a as Y,b as q}from"./chunk-TKNV7UDP.js";import"./chunk-E7RJ6JIK.js";import"./chunk-HAS3FVRU.js";import"./chunk-Z2TDV7WW.js";import"./chunk-JMG6CDSR.js";import"./chunk-GAZWDLP6.js";import"./chunk-XEWNBKME.js";import{c as b}from"./chunk-DCANE7XH.js";var e=b(q(),1);var a=b(Y(),1);var ne={component:()=>{let[s,m]=(0,a.useState)(!0),{authenticated:p,user:O}=k(),{walletProxy:u,closePrivyModal:y,createAnalyticsEvent:v,client:V}=x(),{navigate:$,data:j,onUserCloseViaDialogOrKeybindRef:F}=C(),[l,z]=(0,a.useState)(void 0),[f,d]=(0,a.useState)(""),[c,w]=(0,a.useState)(!1),{entropyId:h,entropyIdVerifier:K,onCompleteNavigateTo:g,onSuccess:M,onFailure:B}=j.recoverWallet,i=(r="User exited before their wallet could be recovered")=>{y({shouldCallAuthOnSuccess:!1}),B(typeof r=="string"?new P(r):r)};return F.current=i,(0,a.useEffect)((()=>{if(!p)return i("User must be authenticated and have a Privy wallet before it can be recovered")}),[p]),(0,e.jsxs)(o,{children:[(0,e.jsx)(o.Header,{icon:T,title:"Enter your password",subtitle:"Please provision your account on this new device. To continue, enter your recovery password.",showClose:!0,onClose:i}),(0,e.jsx)(o.Body,{children:(0,e.jsx)(G,{children:(0,e.jsxs)("div",{children:[(0,e.jsxs)(U,{children:[(0,e.jsx)(R,{type:s?"password":"text",onChange:r=>(t=>{t&&z(t)})(r.target.value),disabled:c,style:{paddingRight:"2.3rem"}}),(0,e.jsx)(W,{style:{right:"0.75rem"},children:s?(0,e.jsx)(E,{onClick:()=>m(!1)}):(0,e.jsx)(H,{onClick:()=>m(!0)})})]}),!!f&&(0,e.jsx)(J,{children:f})]})})}),(0,e.jsxs)(o.Footer,{children:[(0,e.jsx)(o.HelpText,{children:(0,e.jsxs)(_,{children:[(0,e.jsx)("h4",{children:"Why is this necessary?"}),(0,e.jsx)("p",{children:"You previously set a password for this wallet. This helps ensure only you can access it"})]})}),(0,e.jsx)(o.Actions,{children:(0,e.jsx)(L,{loading:c||!u,disabled:!l,onClick:async()=>{w(!0);let r=await V.getAccessToken(),t=A(O,h);if(!r||!t||l===null)return i("User must be authenticated and have a Privy wallet before it can be recovered");try{v({eventName:"embedded_wallet_recovery_started",payload:{walletAddress:t.address}}),await u?.recover({accessToken:r,entropyId:h,entropyIdVerifier:K,recoveryPassword:l}),d(""),g?$(g):y({shouldCallAuthOnSuccess:!1}),M?.(t),v({eventName:"embedded_wallet_recovery_completed",payload:{walletAddress:t.address}})}catch(D){N(D)?d("Invalid recovery password, please try again."):d("An error has occurred, please try again.")}finally{w(!1)}},$hideAnimations:!h&&c,children:"Recover your account"})}),(0,e.jsx)(o.Watermark,{})]})]})}},G=n.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`,J=n.div`
  line-height: 20px;
  height: 20px;
  font-size: 13px;
  color: var(--privy-color-error);
  text-align: left;
  margin-top: 0.5rem;
`,L=n(I)`
  ${({$hideAnimations:s})=>s&&S`
      && {
        /* Remove animations because the recoverWallet task on the iframe partially
           blocks the renderer, so the animation stutters and doesn't look good */
        transition: none;
      }
    `}
`;export{ne as PasswordRecoveryScreen,ne as default};
