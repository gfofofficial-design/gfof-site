import{a as P,b as z,c as V}from"./chunk-GTJM6WTH.js";import{a as Y}from"./chunk-MQQ456JM.js";import"./chunk-RIZ3ULAG.js";import{b as F}from"./chunk-V2WI5OPB.js";import{J as I,d as W,l as U,u as D}from"./chunk-5FBZWUWN.js";import{a as h}from"./chunk-EOXZEZ7R.js";import"./chunk-C2BH62GT.js";import"./chunk-6DYT5C72.js";import"./chunk-LRLIBYHZ.js";import{c as L}from"./chunk-KVJE6SXW.js";import{a as _}from"./chunk-4IGG6W6J.js";import"./chunk-2M4UPM4V.js";import"./chunk-LD3GPA6C.js";import{a as Q}from"./chunk-SRCTCGYB.js";import"./chunk-AFPITI7X.js";import"./chunk-AIOKECSZ.js";import"./chunk-H4RJIX63.js";import{b}from"./chunk-IKBUFKJ4.js";import{Fb as T,Hb as j,ya as B}from"./chunk-2UDMLWY7.js";import"./chunk-ZIWEZIIE.js";import{a as G,b as J}from"./chunk-TKNV7UDP.js";import"./chunk-E7RJ6JIK.js";import"./chunk-HAS3FVRU.js";import"./chunk-Z2TDV7WW.js";import"./chunk-JMG6CDSR.js";import"./chunk-GAZWDLP6.js";import"./chunk-XEWNBKME.js";import{c as S}from"./chunk-DCANE7XH.js";var t=S(J(),1),p=S(G(),1);var $=S(Q(),1);var Z=e=>{try{return e.location.origin}catch{return}},ee=({data:e,onClose:a})=>(0,t.jsx)(h,{showClose:!0,onClose:a,title:"Initiate bank transfer",subtitle:"Use the details below to complete a bank transfer from your bank.",primaryCta:{label:"Done",onClick:a},watermark:!1,footerText:"Exchange rates and fees are set when you authorize and determine the amount you receive. You'll see the applicable rates and fees for your transaction separately",children:(0,t.jsx)(te,{children:(L[e.deposit_instructions.asset]||[]).map((([l,y],g)=>{let f=e.deposit_instructions[l];if(!f||Array.isArray(f))return null;let d=l==="asset"?f.toUpperCase():f,i=d.length>100?`${d.slice(0,9)}...${d.slice(-9)}`:d;return(0,t.jsxs)(re,{children:[(0,t.jsx)(se,{children:y}),(0,t.jsx)(F,{value:d,includeChildren:$.isMobile,children:(0,t.jsx)(oe,{children:i})})]},g)}))})}),te=b.ol`
  border-color: var(--privy-color-border-default);
  border-width: 1px;
  border-radius: var(--privy-border-radius-mdlg);
  border-style: solid;
  display: flex;
  flex-direction: column;

  && {
    padding: 0 1rem;
  }
`,re=b.li`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 0;

  &:not(:first-of-type) {
    border-top: 1px solid var(--privy-color-border-default);
  }

  & > {
    :nth-child(1) {
      flex-basis: 30%;
    }

    :nth-child(2) {
      flex-basis: 60%;
    }
  }
`,se=b.span`
  color: var(--privy-color-foreground);
  font-kerning: none;
  font-variant-numeric: lining-nums proportional-nums;
  font-feature-settings: 'calt' off;

  /* text-xs/font-regular */
  font-size: 0.75rem;
  font-style: normal;
  font-weight: 400;
  line-height: 1.125rem; /* 150% */

  text-align: left;
  flex-shrink: 0;
`,oe=b.span`
  color: var(--privy-color-foreground);
  font-kerning: none;
  font-feature-settings: 'calt' off;

  /* text-sm/font-medium */
  font-size: 0.875rem;
  font-style: normal;
  font-weight: 500;
  line-height: 1.375rem; /* 157.143% */

  text-align: right;
  word-break: break-all;
`,ae=({onClose:e})=>(0,t.jsx)(h,{showClose:!0,onClose:e,icon:U,iconVariant:"error",title:"Something went wrong",subtitle:"We couldn't complete account setup. This isn't caused by anything you did.",primaryCta:{label:"Close",onClick:e},watermark:!0}),ne=({onClose:e,reason:a})=>{let l=a?a.charAt(0).toLowerCase()+a.slice(1):void 0;return(0,t.jsx)(h,{showClose:!0,onClose:e,icon:U,iconVariant:"error",title:"Identity verification failed",subtitle:l?`We can't complete identity verification because ${l}. Please try again or contact support for assistance.`:"We couldn't verify your identity. Please try again or contact support for assistance.",primaryCta:{label:"Close",onClick:e},watermark:!0})},ie=({onClose:e,email:a})=>(0,t.jsx)(h,{showClose:!0,onClose:e,icon:D,title:"Identity verification in progress",subtitle:"We're waiting for Persona to approve your identity verification. This usually takes a few minutes, but may take up to 24 hours.",primaryCta:{label:"Done",onClick:e},watermark:!0,children:(0,t.jsxs)(Y,{theme:"light",children:["You'll receive an email at ",a," once approved with instructions for completing your deposit."]})}),le=({onClose:e,onAcceptTerms:a,isLoading:l})=>(0,t.jsx)(h,{showClose:!0,onClose:e,icon:I,title:"Verify your identity to continue",subtitle:"Finish verification with Persona \u2014 it takes just a few minutes and requires a government ID.",helpText:(0,t.jsxs)(t.Fragment,{children:[`This app uses Bridge to securely connect accounts and move funds. By clicking "Accept," you agree to Bridge's`," ",(0,t.jsx)("a",{href:"https://www.bridge.xyz/legal",target:"_blank",rel:"noopener noreferrer",children:"Terms of Service"})," ","and"," ",(0,t.jsx)("a",{href:"https://www.bridge.xyz/legal/row-privacy-policy/bridge-building-limited",target:"_blank",rel:"noopener noreferrer",children:"Privacy Policy"}),"."]}),primaryCta:{label:"Accept and continue",onClick:a,loading:l},watermark:!0}),ce=({onClose:e})=>(0,t.jsx)(h,{showClose:!0,onClose:e,icon:W,iconVariant:"success",title:"Identity verified successfully",subtitle:"We've successfully verified your identity. Now initiate a bank transfer to view instructions.",primaryCta:{label:"Initiate bank transfer",onClick:()=>{},loading:!0},watermark:!0}),ue=({opts:e,onClose:a,onBack:l,onEditSourceAsset:y,onSelectAmount:g,isLoading:f})=>(0,t.jsxs)(h,{showClose:!0,onClose:a,showBack:!!l,onBack:l,headerTitle:`Buy ${e.destination.asset.toLocaleUpperCase()}`,primaryCta:{label:"Continue",onClick:g,loading:f},watermark:!0,children:[(0,t.jsx)(P,{currency:e.source.selectedAsset,inputMode:"decimal",autoFocus:!0}),(0,t.jsx)(z,{selectedAsset:e.source.selectedAsset,onEditSourceAsset:y})]}),de=({onClose:e,onBack:a,onAcceptTerms:l,onSelectAmount:y,onSelectSource:g,onEditSourceAsset:f,opts:d,state:i,email:v,isLoading:n})=>i.status==="select-amount"?(0,t.jsx)(ue,{onClose:e,onBack:a,onSelectAmount:y,onEditSourceAsset:f,opts:d,isLoading:n}):i.status==="select-source-asset"?(0,t.jsx)(V,{onSelectSource:g,opts:d,isLoading:n}):i.status==="kyc-prompt"?(0,t.jsx)(le,{onClose:e,onAcceptTerms:l,opts:d,isLoading:n}):i.status==="kyc-incomplete"?(0,t.jsx)(ie,{onClose:e,email:v}):i.status==="kyc-success"?(0,t.jsx)(ce,{onClose:e}):i.status==="kyc-error"?(0,t.jsx)(ne,{onClose:e,reason:i.reason}):i.status==="account-details"?(0,t.jsx)(ee,{onClose:e,data:i.data}):i.status==="create-customer-error"||i.status==="get-customer-error"?(0,t.jsx)(ae,{onClose:e}):null,be={component:()=>{let{user:e}=j(),a=T().data;if(!a?.FundWithBankDepositScreen)throw Error("Missing data");let{onSuccess:l,onFailure:y,onBack:g,opts:f,createOrUpdateCustomer:d,getCustomer:i,getOrCreateVirtualAccount:v}=a.FundWithBankDepositScreen,[n,E]=(0,p.useState)(f),[k,r]=(0,p.useState)({status:"select-amount"}),[A,c]=(0,p.useState)(null),[M,o]=(0,p.useState)(!1),w=(0,p.useRef)(null),R=(0,p.useCallback)((async()=>{let s;o(!0),c(null);try{s=await i({kycRedirectUrl:window.location.origin})}catch(u){if(!u||typeof u!="object"||!("status"in u)||u.status!==404)return r({status:"get-customer-error"}),c(u),void o(!1)}if(!s)try{s=await d({hasAcceptedTerms:!1,kycRedirectUrl:window.location.origin})}catch(u){return r({status:"create-customer-error"}),c(u),void o(!1)}if(!s)return r({status:"create-customer-error"}),c(Error("Unable to create customer")),void o(!1);if(s.status==="not_started"&&s.kyc_url)return r({status:"kyc-prompt",kycUrl:s.kyc_url}),void o(!1);if(s.status==="not_started")return r({status:"get-customer-error"}),c(Error("Unexpected user state")),void o(!1);if(s.status==="rejected")return r({status:"kyc-error",reason:s.rejection_reasons?.[0]?.reason}),c(Error("User KYC rejected.")),void o(!1);if(s.status==="incomplete")return r({status:"kyc-incomplete"}),void o(!1);if(s.status!=="active")return r({status:"get-customer-error"}),c(Error("Unexpected user state")),void o(!1);s.status;try{let u=await v({destination:n.destination,provider:n.provider,source:{asset:n.source.selectedAsset}});r({status:"account-details",data:u})}catch(u){return r({status:"create-customer-error"}),c(u),void o(!1)}}),[n]),K=(0,p.useCallback)((async()=>{if(c(null),o(!0),k.status!=="kyc-prompt")return c(Error("Unexpected state")),void o(!1);let s=_({location:k.kycUrl});try{await d({hasAcceptedTerms:!0})}catch(m){return s&&!s.closed&&s.close(),r({status:"create-customer-error"}),c(m),void o(!1)}if(!s)return c(Error("Unable to begin kyc flow.")),o(!1),void r({status:"create-customer-error"});w.current=new AbortController;let u=await(async(m,H)=>{let x=await B({operation:async()=>({done:Z(m)===window.location.origin,closed:m.closed}),until:({done:N,closed:X})=>N||X,delay:0,interval:500,attempts:360,signal:H});return x.status==="aborted"?(m.close(),{status:"aborted"}):x.status==="max_attempts"?{status:"timeout"}:x.result.done?(m.close(),{status:"redirected"}):{status:"closed"}})(s,w.current.signal);if(u.status==="aborted")return;if(u.status==="closed")return void o(!1);u.status;let C=await B({operation:()=>i({}),until:m=>m.status==="active"||m.status==="rejected",delay:0,interval:2e3,attempts:60,signal:w.current.signal});if(C.status!=="aborted"){if(C.status==="max_attempts")return r({status:"kyc-incomplete"}),void o(!1);if(C.status,C.result.status==="rejected")return r({status:"kyc-error",reason:C.result.rejection_reasons?.[0]?.reason}),c(Error("User KYC rejected.")),void o(!1);if(C.result.status!=="active")return r({status:"kyc-incomplete"}),void o(!1);s.closed||s.close(),C.result.status;try{r({status:"kyc-success"});let m=await v({destination:n.destination,provider:n.provider,source:{asset:n.source.selectedAsset}});r({status:"account-details",data:m})}catch(m){r({status:"create-customer-error"}),c(m)}finally{o(!1)}}}),[r,c,o,d,v,k,n,w]),O=(0,p.useCallback)((s=>{r({status:"select-amount"}),E({...n,source:{...n.source,selectedAsset:s}})}),[r,E]),q=(0,p.useCallback)((()=>{r({status:"select-source-asset"})}),[r]);return(0,t.jsx)(de,{onClose:(0,p.useCallback)((async()=>{w.current?.abort(),!n.showBackButton||k.status!=="select-amount"&&k.status!=="select-source-asset"?A?y(A):await l():y(Error("User cancelled funding"))}),[A,w,y,l,n.showBackButton,k.status]),onBack:g,opts:n,state:k,isLoading:M,email:e.email.address,onAcceptTerms:K,onSelectAmount:R,onSelectSource:O,onEditSourceAsset:q})}};export{be as FundWithBankDepositScreen,be as default};
