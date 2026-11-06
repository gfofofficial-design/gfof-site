import{a as Te}from"./chunk-T344EMDE.js";import{a as we}from"./chunk-HRBKK5BN.js";import{a as be}from"./chunk-HVNNR2S4.js";import{a as ve}from"./chunk-FYEFBEZB.js";import{a as b}from"./chunk-V2WU2LBN.js";import{a as Y,b as ge}from"./chunk-5HYP3NBV.js";import{a as ye}from"./chunk-YLHRZO5I.js";import{b as fe}from"./chunk-VL2IG54E.js";import{a as ne}from"./chunk-PXZRMT3D.js";import{a as ie}from"./chunk-ANPHFMDR.js";import{b as xe}from"./chunk-STIJMNVK.js";import{a as D,b as n,c as i,d as ke,e as o}from"./chunk-LT44UKLM.js";import{a}from"./chunk-QGL6TGIW.js";import{a as re}from"./chunk-JDWEFZ4P.js";import{a as ee}from"./chunk-ZTZMESTE.js";import{a as F}from"./chunk-G2H2FWXQ.js";import{a as me,d as B,i as ue,j as R,l as Z,m as pe}from"./chunk-LRLIBYHZ.js";import{b as K}from"./chunk-HWX6Y2N7.js";import{b as d}from"./chunk-IKBUFKJ4.js";import{Bb as X,Ha as he,S as G,V as ce,xa as Q}from"./chunk-2UDMLWY7.js";import{a as Xe,b as Ke}from"./chunk-TKNV7UDP.js";import{G as de}from"./chunk-GAZWDLP6.js";import{c as se}from"./chunk-DCANE7XH.js";var e=se(Ke(),1);var H=se(Xe(),1);var oe=d(i)`
  cursor: pointer;
  display: inline-flex;
  gap: 8px;
  align-items: center;
  color: var(--privy-color-accent);
  svg {
    fill: var(--privy-color-accent);
  }
`;var Ie=({iconUrl:s,value:c,symbol:l,usdValue:p,nftName:T,nftCount:f,decimals:t,$isLoading:u})=>{if(u)return(0,e.jsx)(Se,{$isLoading:u});let y=c&&p&&t?(function(I,E,$){let S=parseFloat(I),h=parseFloat($);if(S===0||h===0||Number.isNaN(S)||Number.isNaN(h))return I;let v=Math.ceil(-Math.log10(.01/(h/S))),k=Math.pow(10,v=Math.max(v=Math.min(v,E),1)),C=+(Math.floor(S*k)/k).toFixed(v).replace(/\.?0+$/,"");return Intl.NumberFormat(void 0,{maximumFractionDigits:E}).format(C)})(c,t,p):c;return(0,e.jsxs)("div",{children:[(0,e.jsxs)(Se,{$isLoading:u,children:[s&&(0,e.jsx)(Ye,{src:s,alt:"Token icon"}),f&&f>1?f+"x":void 0," ",T,y," ",l]}),p&&(0,e.jsxs)(Ze,{$isLoading:u,children:["$",p]})]})},Se=d.span`
  color: var(--privy-color-foreground);
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.375rem;
  word-break: break-all;
  text-align: right;
  display: flex;
  justify-content: flex-end;

  /**
   * @NOTE This is a code smell anti-pattern for styling components.
   * We are mixing JSX definitions with styled-components CSS definitions.
   * This is not ideal and should be refactored in the future to separate concerns.
   * This is also hard to read, as it makes it difficult to understand the structure
   * of the component and its styles by viewing the JSX.
   */

  ${re}
`,Ze=d.span`
  color: var(--privy-color-foreground-2);
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  word-break: break-all;
  text-align: right;
  display: flex;
  justify-content: flex-end;

  ${re}
`,Ye=d.img`
  height: 14px;
  width: 14px;
  margin-right: 4px;
  object-fit: contain;
`,er=s=>{let{chain:c,transactionDetails:l,isTokenContractInfoLoading:p,symbol:T}=s,{action:f,functionName:t}=l;return(0,e.jsx)(xe,{children:(0,e.jsxs)(D,{children:[f!=="transaction"&&(0,e.jsxs)(n,{children:[(0,e.jsx)(i,{children:"Action"}),(0,e.jsx)(o,{children:t})]}),t==="mint"&&"args"in l&&l.args.filter((u=>u)).map(((u,y)=>(0,e.jsxs)(n,{children:[(0,e.jsx)(i,{children:`Param ${y}`}),(0,e.jsx)(o,{children:typeof u=="string"&&de(u)?(0,e.jsx)(a,{address:u,url:c?.blockExplorers?.default?.url,showCopyIcon:!1}):u?.toString()})]},y))),t==="setApprovalForAll"&&l.operator&&(0,e.jsxs)(n,{children:[(0,e.jsx)(i,{children:"Operator"}),(0,e.jsx)(o,{children:(0,e.jsx)(a,{address:l.operator,url:c?.blockExplorers?.default?.url,showCopyIcon:!1})})]}),t==="setApprovalForAll"&&l.approved!==void 0&&(0,e.jsxs)(n,{children:[(0,e.jsx)(i,{children:"Set approval to"}),(0,e.jsx)(o,{children:l.approved?"true":"false"})]}),t==="transfer"||t==="transferWithMemo"||t==="transferFrom"||t==="safeTransferFrom"||t==="approve"?(0,e.jsxs)(e.Fragment,{children:["formattedAmount"in l&&l.formattedAmount&&(0,e.jsxs)(n,{children:[(0,e.jsx)(i,{children:"Amount"}),(0,e.jsxs)(o,{$isLoading:p,children:[l.formattedAmount," ",T]})]}),"tokenId"in l&&l.tokenId&&(0,e.jsxs)(n,{children:[(0,e.jsx)(i,{children:"Token ID"}),(0,e.jsx)(o,{children:l.tokenId.toString()})]})]}):null,t==="safeBatchTransferFrom"&&(0,e.jsxs)(e.Fragment,{children:["amounts"in l&&l.amounts&&(0,e.jsxs)(n,{children:[(0,e.jsx)(i,{children:"Amounts"}),(0,e.jsx)(o,{children:l.amounts.join(", ")})]}),"tokenIds"in l&&l.tokenIds&&(0,e.jsxs)(n,{children:[(0,e.jsx)(i,{children:"Token IDs"}),(0,e.jsx)(o,{children:l.tokenIds.join(", ")})]})]}),t==="approve"&&l.spender&&(0,e.jsxs)(n,{children:[(0,e.jsx)(i,{children:"Spender"}),(0,e.jsx)(o,{children:(0,e.jsx)(a,{address:l.spender,url:c?.blockExplorers?.default?.url,showCopyIcon:!1})})]}),(t==="transferFrom"||t==="safeTransferFrom"||t==="safeBatchTransferFrom")&&l.transferFrom&&(0,e.jsxs)(n,{children:[(0,e.jsx)(i,{children:"Transferring from"}),(0,e.jsx)(o,{children:(0,e.jsx)(a,{address:l.transferFrom,url:c?.blockExplorers?.default?.url,showCopyIcon:!1})})]}),(t==="transferFrom"||t==="safeTransferFrom"||t==="safeBatchTransferFrom")&&l.transferTo&&(0,e.jsxs)(n,{children:[(0,e.jsx)(i,{children:"Transferring to"}),(0,e.jsx)(o,{children:(0,e.jsx)(a,{address:l.transferTo,url:c?.blockExplorers?.default?.url,showCopyIcon:!1})})]})]})})},rr=({variant:s,setPreventMaliciousTransaction:c,colorScheme:l="light",preventMaliciousTransaction:p})=>s==="warn"?(0,e.jsx)(Ce,{children:(0,e.jsxs)(be,{theme:l,children:[(0,e.jsx)("span",{style:{fontWeight:"500"},children:"Warning: Suspicious transaction"}),(0,e.jsx)("br",{}),"This has been flagged as a potentially deceptive request. Approving could put your assets or funds at risk."]})}):s==="error"?(0,e.jsx)(e.Fragment,{children:(0,e.jsxs)(Ce,{children:[(0,e.jsx)(Te,{theme:l,children:(0,e.jsxs)("div",{children:[(0,e.jsx)("strong",{children:"This is a malicious transaction"}),(0,e.jsx)("br",{}),"This transaction transfers tokens to a known malicious address. Proceeding may result in the loss of valuable assets."]})}),(0,e.jsxs)(nr,{children:[(0,e.jsx)(we,{color:"var(--privy-color-error)",checked:!p,readOnly:!0,onClick:()=>c(!p)}),(0,e.jsx)("span",{children:"I understand and want to proceed anyways."})]})]})}):null,Ce=d.div`
  margin-top: 1.5rem;
`,nr=d.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.75rem;
`,ir=({transactionIndex:s,maxIndex:c})=>typeof s!="number"||c===0?"":` (${s+1} / ${c+1})`,Jr=({img:s,submitError:c,prepareError:l,onClose:p,action:T,title:f,subtitle:t,to:u,tokenAddress:y,network:I,missingFunds:E,fee:$,from:S,cta:h,disabled:v,chain:k,isSubmitting:C,isPreparing:g,isTokenPriceLoading:A,isTokenContractInfoLoading:L,isSponsored:P,symbol:U,balance:j,onClick:O,transactionDetails:M,transactionIndex:z,maxIndex:V,onBack:r,chainName:x,validation:W,hasScanDetails:te,setIsScanDetailsOpen:Pe,preventMaliciousTransaction:je,setPreventMaliciousTransaction:ze,tokensSent:le,tokensReceived:q,isScanning:Be,isCancellable:Re,functionName:He})=>{let{showTransactionDetails:J,setShowTransactionDetails:Ue,hasMoreDetails:Ve,isErc20Ish:We}=(m=>{let[N,_e]=(0,H.useState)(!1),_=!0,ae=!1;return(!m||m.isErc20Ish||m.action==="transaction")&&(_=!1),_&&(ae=Object.entries(m||{}).some((([Ge,Qe])=>Qe&&!["action","isErc20Ish","isNFTIsh"].includes(Ge)))),{showTransactionDetails:N,setShowTransactionDetails:_e,hasMoreDetails:_&&ae,isErc20Ish:m?.isErc20Ish}})(M),qe=X(),Je=We&&L||g||A||Be;return(0,e.jsxs)(e.Fragment,{children:[(0,e.jsx)(R,{onClose:p,backFn:r}),s&&(0,e.jsx)(Fe,{children:s}),(0,e.jsxs)(ie,{style:{marginTop:s?"1.5rem":0},children:[f,(0,e.jsx)(ir,{maxIndex:V,transactionIndex:z})]}),(0,e.jsx)(ne,{children:t}),(0,e.jsxs)(D,{style:{marginTop:"2rem"},children:[(!!le[0]||Je)&&(0,e.jsxs)(n,{children:[q.length>0?(0,e.jsx)(i,{children:"Send"}):(0,e.jsx)(i,{children:T==="approve"?"Approval amount":"Amount"}),(0,e.jsx)("div",{className:"flex flex-col",children:le.map(((m,N)=>(0,e.jsx)(Ie,{iconUrl:m.iconUrl,value:He==="setApprovalForAll"?"All":m.value,usdValue:m.usdValue,symbol:m.symbol,nftName:m.nftName,nftCount:m.nftCount,decimals:m.decimals},N)))})]}),q.length>0&&(0,e.jsxs)(n,{children:[(0,e.jsx)(i,{children:"Receive"}),(0,e.jsx)("div",{className:"flex flex-col",children:q.map(((m,N)=>(0,e.jsx)(Ie,{iconUrl:m.iconUrl,value:m.value,usdValue:m.usdValue,symbol:m.symbol,nftName:m.nftName,nftCount:m.nftCount,decimals:m.decimals},N)))})]}),M&&"spender"in M&&M?.spender?(0,e.jsxs)(n,{children:[(0,e.jsx)(i,{children:"Spender"}),(0,e.jsx)(o,{children:(0,e.jsx)(a,{address:M.spender,url:k?.blockExplorers?.default?.url})})]}):null,u&&(0,e.jsxs)(n,{children:[(0,e.jsx)(i,{children:"To"}),(0,e.jsx)(o,{children:(0,e.jsx)(a,{address:u,url:k?.blockExplorers?.default?.url,showCopyIcon:!0})})]}),y&&(0,e.jsxs)(n,{children:[(0,e.jsx)(i,{children:"Token address"}),(0,e.jsx)(o,{children:(0,e.jsx)(a,{address:y,url:k?.blockExplorers?.default?.url})})]}),(0,e.jsxs)(n,{children:[(0,e.jsx)(i,{children:"Network"}),(0,e.jsx)(o,{children:I})]}),(0,e.jsxs)(n,{children:[(0,e.jsx)(i,{children:"Estimated fee"}),(0,e.jsx)(o,{$isLoading:g||A||P===void 0,children:P?(0,e.jsxs)(De,{children:[(0,e.jsxs)(Le,{children:["Sponsored by ",qe.name]}),(0,e.jsx)(Y,{height:16,width:16})]}):$})]}),Ve&&!te&&(0,e.jsxs)(e.Fragment,{children:[(0,e.jsx)(n,{className:"cursor-pointer",onClick:()=>Ue(!J),children:(0,e.jsxs)(ke,{className:"flex items-center gap-x-1",children:["Details"," ",(0,e.jsx)(ee,{style:{width:"0.75rem",marginLeft:"0.25rem",transform:J?"rotate(180deg)":void 0}})]})}),J&&M&&(0,e.jsx)(er,{action:T,chain:k,transactionDetails:M,isTokenContractInfoLoading:L,symbol:U})]}),te&&(0,e.jsx)(n,{children:(0,e.jsxs)(oe,{onClick:()=>Pe(!0),children:[(0,e.jsx)("span",{className:"text-color-primary",children:"Details"}),(0,e.jsx)(me,{height:"14px",width:"14px",strokeWidth:"2"})]})})]}),(0,e.jsx)(K,{}),c?(0,e.jsx)(F,{style:{marginTop:"2rem"},children:c.message}):l&&z===0?(0,e.jsx)(F,{style:{marginTop:"2rem"},children:l.shortMessage??Ne}):null,(0,e.jsx)(rr,{variant:W,preventMaliciousTransaction:je,setPreventMaliciousTransaction:ze}),(0,e.jsx)(Oe,{$useSmallMargins:!(!l&&!c&&W!=="warn"&&W!=="error"),address:S,balance:j,errMsg:g||l||c||!E?void 0:`Add funds on ${k?.name??x} to complete transaction.`}),(0,e.jsx)(B,{style:{marginTop:"1rem"},loading:C,disabled:v||g,onClick:O,children:h}),Re&&(0,e.jsx)(ue,{style:{marginTop:"1rem"},onClick:p,isSubmitting:!1,children:"Not now"}),(0,e.jsx)(Z,{})]})},_r=({img:s,title:c,subtitle:l,cta:p,instructions:T,network:f,blockExplorerUrl:t,isMissingFunds:u,submitError:y,parseError:I,total:E,swap:$,transactingWalletAddress:S,fee:h,balance:v,disabled:k,isSubmitting:C,isPreparing:g,isTokenPriceLoading:A,onClick:L,onClose:P,onBack:U,isSponsored:j})=>{let O=g||A,[M,z]=(0,H.useState)(!1),V=X();return(0,e.jsxs)(e.Fragment,{children:[(0,e.jsx)(R,{onClose:P,backFn:U}),s&&(0,e.jsx)(Fe,{children:s}),(0,e.jsx)(ie,{style:{marginTop:s?"1.5rem":0},children:c}),(0,e.jsx)(ne,{children:l}),(0,e.jsxs)(D,{style:{marginTop:"2rem",marginBottom:".5rem"},children:[(E||O)&&(0,e.jsxs)(n,{children:[(0,e.jsx)(i,{children:"Amount"}),(0,e.jsx)(o,{$isLoading:O,children:E})]}),$&&(0,e.jsxs)(n,{children:[(0,e.jsx)(i,{children:"Swap"}),(0,e.jsx)(o,{children:$})]}),f&&(0,e.jsxs)(n,{children:[(0,e.jsx)(i,{children:"Network"}),(0,e.jsx)(o,{children:f})]}),(h||O||j!==void 0)&&(0,e.jsxs)(n,{children:[(0,e.jsx)(i,{children:"Estimated fee"}),(0,e.jsx)(o,{$isLoading:O,children:j&&!O?(0,e.jsxs)(De,{children:[(0,e.jsxs)(Le,{children:["Sponsored by ",V.name]}),(0,e.jsx)(Y,{height:16,width:16})]}):h})]})]}),(0,e.jsx)(n,{children:(0,e.jsxs)(oe,{onClick:()=>z((r=>!r)),children:[(0,e.jsx)("span",{children:"Advanced"}),(0,e.jsx)(ee,{height:"16px",width:"16px",strokeWidth:"2",style:{transition:"all 300ms",transform:M?"rotate(180deg)":void 0}})]})}),M&&(0,e.jsx)(e.Fragment,{children:T.map(((r,x)=>r.type==="sol-transfer"?(0,e.jsxs)(w,{children:[(0,e.jsx)(n,{children:(0,e.jsxs)(b,{children:["Transfer ",r.withSeed?"with seed":""]})}),(0,e.jsxs)(n,{children:[(0,e.jsx)(i,{children:"Amount"}),(0,e.jsxs)(o,{children:[Q({amount:r.value,decimals:r.token.decimals})," ",r.token.symbol]})]}),!!r.toAccount&&(0,e.jsxs)(n,{children:[(0,e.jsx)(i,{children:"Destination"}),(0,e.jsx)(o,{children:(0,e.jsx)(a,{address:r.toAccount,url:t})})]})]},x):r.type==="spl-transfer"?(0,e.jsxs)(w,{children:[(0,e.jsx)(n,{children:(0,e.jsxs)(b,{children:["Transfer ",r.token.symbol]})}),(0,e.jsxs)(n,{children:[(0,e.jsx)(i,{children:"Amount"}),(0,e.jsx)(o,{children:r.value.toString()})]}),!!r.fromAta&&(0,e.jsxs)(n,{children:[(0,e.jsx)(i,{children:"Source"}),(0,e.jsx)(o,{children:(0,e.jsx)(a,{address:r.fromAta,url:t})})]}),!!r.toAta&&(0,e.jsxs)(n,{children:[(0,e.jsx)(i,{children:"Destination"}),(0,e.jsx)(o,{children:(0,e.jsx)(a,{address:r.toAta,url:t})})]}),!!r.token.address&&(0,e.jsxs)(n,{children:[(0,e.jsx)(i,{children:"Token"}),(0,e.jsx)(o,{children:(0,e.jsx)(a,{address:r.token.address,url:t})})]})]},x):r.type==="ata-creation"?(0,e.jsxs)(w,{children:[(0,e.jsx)(n,{children:(0,e.jsx)(b,{children:"Create token account"})}),(0,e.jsxs)(n,{children:[(0,e.jsx)(i,{children:"Program ID"}),(0,e.jsx)(o,{children:(0,e.jsx)(a,{address:r.program,url:t})})]}),!!r.owner&&(0,e.jsxs)(n,{children:[(0,e.jsx)(i,{children:"Owner"}),(0,e.jsx)(o,{children:(0,e.jsx)(a,{address:r.owner,url:t})})]})]},x):r.type==="create-account"?(0,e.jsxs)(w,{children:[(0,e.jsx)(n,{children:(0,e.jsxs)(b,{children:["Create account ",r.withSeed?"with seed":""]})}),!!r.account&&(0,e.jsxs)(n,{children:[(0,e.jsx)(i,{children:"Account"}),(0,e.jsx)(o,{children:(0,e.jsx)(a,{address:r.account,url:t})})]}),(0,e.jsxs)(n,{children:[(0,e.jsx)(i,{children:"Amount"}),(0,e.jsxs)(o,{children:[Q({amount:r.value,decimals:9})," SOL"]})]})]},x):r.type==="spl-init-account"?(0,e.jsxs)(w,{children:[(0,e.jsx)(n,{children:(0,e.jsx)(b,{children:"Initialize token account"})}),!!r.account&&(0,e.jsxs)(n,{children:[(0,e.jsx)(i,{children:"Account"}),(0,e.jsx)(o,{children:(0,e.jsx)(a,{address:r.account,url:t})})]}),!!r.mint&&(0,e.jsxs)(n,{children:[(0,e.jsx)(i,{children:"Mint"}),(0,e.jsx)(o,{children:(0,e.jsx)(a,{address:r.mint,url:t})})]}),!!r.owner&&(0,e.jsxs)(n,{children:[(0,e.jsx)(i,{children:"Owner"}),(0,e.jsx)(o,{children:(0,e.jsx)(a,{address:r.owner,url:t})})]})]},x):r.type==="spl-close-account"?(0,e.jsxs)(w,{children:[(0,e.jsx)(n,{children:(0,e.jsx)(b,{children:"Close token account"})}),!!r.source&&(0,e.jsxs)(n,{children:[(0,e.jsx)(i,{children:"Source"}),(0,e.jsx)(o,{children:(0,e.jsx)(a,{address:r.source,url:t})})]}),!!r.destination&&(0,e.jsxs)(n,{children:[(0,e.jsx)(i,{children:"Destination"}),(0,e.jsx)(o,{children:(0,e.jsx)(a,{address:r.destination,url:t})})]}),!!r.owner&&(0,e.jsxs)(n,{children:[(0,e.jsx)(i,{children:"Owner"}),(0,e.jsx)(o,{children:(0,e.jsx)(a,{address:r.owner,url:t})})]})]},x):r.type==="spl-sync-native"?(0,e.jsxs)(w,{children:[(0,e.jsx)(n,{children:(0,e.jsx)(b,{children:"Sync native"})}),(0,e.jsxs)(n,{children:[(0,e.jsx)(i,{children:"Program ID"}),(0,e.jsx)(o,{children:(0,e.jsx)(a,{address:r.program,url:t})})]})]},x):r.type==="raydium-swap-base-input"?(0,e.jsxs)(w,{children:[(0,e.jsx)(n,{children:(0,e.jsxs)(b,{children:["Raydium swap"," ",r.tokenIn&&r.tokenOut?`${r.tokenIn.symbol} \u2192 ${r.tokenOut.symbol}`:""]})}),(0,e.jsxs)(n,{children:[(0,e.jsx)(i,{children:"Amount in"}),(0,e.jsx)(o,{children:r.amountIn.toString()})]}),(0,e.jsxs)(n,{children:[(0,e.jsx)(i,{children:"Minimum amount out"}),(0,e.jsx)(o,{children:r.minimumAmountOut.toString()})]}),r.mintIn&&(0,e.jsxs)(n,{children:[(0,e.jsx)(i,{children:"Token in"}),(0,e.jsx)(o,{children:(0,e.jsx)(a,{address:r.mintIn,url:t})})]}),r.mintOut&&(0,e.jsxs)(n,{children:[(0,e.jsx)(i,{children:"Token out"}),(0,e.jsx)(o,{children:(0,e.jsx)(a,{address:r.mintOut,url:t})})]})]},x):r.type==="raydium-swap-base-output"?(0,e.jsxs)(w,{children:[(0,e.jsx)(n,{children:(0,e.jsxs)(b,{children:["Raydium swap"," ",r.tokenIn&&r.tokenOut?`${r.tokenIn.symbol} \u2192 ${r.tokenOut.symbol}`:""]})}),(0,e.jsxs)(n,{children:[(0,e.jsx)(i,{children:"Max amount in"}),(0,e.jsx)(o,{children:r.maxAmountIn.toString()})]}),(0,e.jsxs)(n,{children:[(0,e.jsx)(i,{children:"Amount out"}),(0,e.jsx)(o,{children:r.amountOut.toString()})]}),r.mintIn&&(0,e.jsxs)(n,{children:[(0,e.jsx)(i,{children:"Token in"}),(0,e.jsx)(o,{children:(0,e.jsx)(a,{address:r.mintIn,url:t})})]}),r.mintOut&&(0,e.jsxs)(n,{children:[(0,e.jsx)(i,{children:"Token out"}),(0,e.jsx)(o,{children:(0,e.jsx)(a,{address:r.mintOut,url:t})})]})]},x):r.type==="jupiter-swap-shared-accounts-route"?(0,e.jsxs)(w,{children:[(0,e.jsx)(n,{children:(0,e.jsxs)(b,{children:["Jupiter swap"," ",r.tokenIn&&r.tokenOut?`${r.tokenIn.symbol} \u2192 ${r.tokenOut.symbol}`:""]})}),(0,e.jsxs)(n,{children:[(0,e.jsx)(i,{children:"In amount"}),(0,e.jsx)(o,{children:r.inAmount.toString()})]}),(0,e.jsxs)(n,{children:[(0,e.jsx)(i,{children:"Quoted out amount"}),(0,e.jsx)(o,{children:r.quotedOutAmount.toString()})]}),r.mintIn&&(0,e.jsxs)(n,{children:[(0,e.jsx)(i,{children:"Token in"}),(0,e.jsx)(o,{children:(0,e.jsx)(a,{address:r.mintIn,url:t})})]}),r.mintOut&&(0,e.jsxs)(n,{children:[(0,e.jsx)(i,{children:"Token out"}),(0,e.jsx)(o,{children:(0,e.jsx)(a,{address:r.mintOut,url:t})})]})]},x):r.type==="jupiter-swap-exact-out-route"?(0,e.jsxs)(w,{children:[(0,e.jsx)(n,{children:(0,e.jsxs)(b,{children:["Jupiter swap"," ",r.tokenIn&&r.tokenOut?`${r.tokenIn.symbol} \u2192 ${r.tokenOut.symbol}`:""]})}),(0,e.jsxs)(n,{children:[(0,e.jsx)(i,{children:"Quoted in amount"}),(0,e.jsx)(o,{children:r.quotedInAmount.toString()})]}),(0,e.jsxs)(n,{children:[(0,e.jsx)(i,{children:"Amount out"}),(0,e.jsx)(o,{children:r.outAmount.toString()})]}),r.mintIn&&(0,e.jsxs)(n,{children:[(0,e.jsx)(i,{children:"Token in"}),(0,e.jsx)(o,{children:(0,e.jsx)(a,{address:r.mintIn,url:t})})]}),r.mintOut&&(0,e.jsxs)(n,{children:[(0,e.jsx)(i,{children:"Token out"}),(0,e.jsx)(o,{children:(0,e.jsx)(a,{address:r.mintOut,url:t})})]})]},x):(0,e.jsxs)(w,{children:[(0,e.jsxs)(n,{children:[(0,e.jsx)(i,{children:"Program ID"}),(0,e.jsx)(o,{children:(0,e.jsx)(a,{address:r.program,url:t})})]}),(0,e.jsxs)(n,{children:[(0,e.jsx)(i,{children:"Data"}),(0,e.jsx)(o,{children:r.discriminator})]})]},x)))}),(0,e.jsx)(K,{}),y?(0,e.jsx)(F,{style:{marginTop:"2rem"},children:y.message}):I?(0,e.jsx)(F,{style:{marginTop:"2rem"},children:Ne}):null,(0,e.jsx)(Oe,{$useSmallMargins:!(!I&&!y),title:"",address:S,balance:v,errMsg:g||I||y||!u?void 0:"Add funds on Solana to complete transaction."}),(0,e.jsx)(B,{style:{marginTop:"1rem"},loading:C,disabled:k||g,onClick:L,children:p}),(0,e.jsx)(Z,{})]})},Oe=d(ve)`
  ${s=>s.$useSmallMargins?"margin-top: 0.5rem;":"margin-top: 2rem;"}
`,w=d(D)`
  margin-top: 0.5rem;
  border: 1px solid var(--privy-color-foreground-4);
  border-radius: var(--privy-border-radius-sm);
  padding: 0.5rem;
`,Ne="There was an error preparing your transaction. Your transaction request will likely fail.",Fe=d.div`
  display: flex;
  width: 100%;
  justify-content: center;
  max-height: 40px;

  > img {
    object-fit: contain;
    border-radius: var(--privy-border-radius-sm);
  }
`,De=d.span`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
`,Le=d.span`
  font-size: 14px;
  font-weight: 500;
  color: var(--privy-color-foreground);
`,Me=s=>s?.code===G.COMPLIANCE_BLOCKED,or=()=>(0,e.jsxs)(sr,{children:[(0,e.jsx)(cr,{}),(0,e.jsx)(dr,{})]}),Gr=({transactionError:s,chainId:c,onClose:l,onRetry:p,chainType:T,transactionHash:f})=>{let{chains:t}=he(),[u,y]=(0,H.useState)(!1),{errorCode:I,errorMessage:E}=((h,v)=>{if(h instanceof ce&&h.code===G.MISSING_MFA_ENROLLMENT)return{errorCode:"MFA enrollment required",errorMessage:h.message};if(v==="ethereum")return Me(h)?{errorCode:"Transaction blocked",errorMessage:h.message}:{errorCode:h.details??h.message,errorMessage:h.shortMessage};let k=h.txSignature,C=h?.transactionMessage||"Something went wrong.";if(Array.isArray(h.logs)){let g=h.logs.find((A=>/insufficient (lamports|funds)/gi.test(A)));g&&(C=g)}return{transactionHash:k,errorMessage:C}})(s,T),$=Me(s),S=(({chains:h,chainId:v,chainType:k,transactionHash:C})=>k==="ethereum"?h.find((g=>g.id===v))?.blockExplorers?.default.url??"https://etherscan.io":(function(g,A){return`https://explorer.solana.com/tx/${g}?chain=${A}`})(C||"",v))({chains:t,chainId:c,chainType:T,transactionHash:f});return(0,e.jsxs)(e.Fragment,{children:[(0,e.jsx)(R,{onClose:l}),(0,e.jsxs)(tr,{children:[(0,e.jsx)(or,{}),(0,e.jsx)(lr,{children:I}),(0,e.jsx)(ar,{children:$?"This transaction cannot be completed.":"Please try again."}),(0,e.jsxs)($e,{children:[(0,e.jsx)(Ee,{children:"Error message"}),(0,e.jsx)(Ae,{$clickable:!1,children:E})]}),f&&(0,e.jsxs)($e,{children:[(0,e.jsx)(Ee,{children:"Transaction hash"}),(0,e.jsxs)(mr,{children:["Copy this hash to view details about the transaction on a"," ",(0,e.jsx)("u",{children:(0,e.jsx)("a",{href:S,children:"block explorer"})}),"."]}),(0,e.jsxs)(Ae,{$clickable:!0,onClick:async()=>{await navigator.clipboard.writeText(f),y(!0)},children:[f,(0,e.jsx)(fr,{clicked:u})]})]}),!$&&(0,e.jsx)(hr,{onClick:()=>p({resetNonce:!!f}),children:"Retry transaction"})]}),(0,e.jsx)(pe,{})]})},tr=d.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`,lr=d.span`
  color: var(--privy-color-foreground);
  font-size: 1.125rem;
  font-weight: 500;
  line-height: 1.25rem; /* 111.111% */
  text-align: center;
  margin: 10px;
`,ar=d.span`
  margin-top: 4px;
  margin-bottom: 10px;
  color: var(--privy-color-foreground-3);
  text-align: center;

  font-size: 0.875rem;
  font-style: normal;
  font-weight: 400;
  line-height: 20px; /* 142.857% */
  letter-spacing: -0.008px;
`,sr=d.div`
  position: relative;
  width: 60px;
  height: 60px;
  margin: 10px;
  display: flex;
  justify-content: center;
  align-items: center;
`,dr=d(ye)`
  position: absolute;
  width: 35px;
  height: 35px;
  color: var(--privy-color-error);
`,cr=d.div`
  position: absolute;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background-color: var(--privy-color-error);
  opacity: 0.1;
`,hr=d(B)`
  && {
    margin-top: 24px;
  }
  transition:
    color 350ms ease,
    background-color 350ms ease;
`,Ee=d.span`
  width: 100%;
  text-align: left;
  font-size: 0.825rem;
  color: var(--privy-color-foreground);
  padding: 4px;
`,$e=d.div`
  width: 100%;
  margin: 5px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
`,mr=d.text`
  position: relative;
  width: 100%;
  padding: 5px;
  font-size: 0.8rem;
  color: var(--privy-color-foreground-3);
  text-align: left;
  overflow-wrap: break-word;
`,Ae=d.span`
  position: relative;
  width: 100%;
  background-color: var(--privy-color-background-2);
  padding: 8px 12px;
  border-radius: 10px;
  margin-top: 5px;
  font-size: 14px;
  color: var(--privy-color-foreground-3);
  text-align: left;
  overflow-wrap: break-word;
  ${s=>s.$clickable&&`cursor: pointer;
  transition: background-color 0.3s;
  padding-right: 45px;

  &:hover {
    background-color: var(--privy-color-foreground-4);
  }`}
`,ur=d(ge)`
  position: absolute;
  top: 13px;
  right: 13px;
  width: 24px;
  height: 24px;
`,pr=d(fe)`
  position: absolute;
  top: 13px;
  right: 13px;
  width: 24px;
  height: 24px;
`,fr=({clicked:s})=>(0,e.jsx)(s?pr:ur,{});export{Jr as a,_r as b,Gr as c};
