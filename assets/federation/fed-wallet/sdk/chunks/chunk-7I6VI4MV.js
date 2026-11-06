import{a as c}from"./chunk-JDWEFZ4P.js";import{a as s,b as l,d as a}from"./chunk-IKBUFKJ4.js";import{b as g}from"./chunk-TKNV7UDP.js";import{c as d}from"./chunk-DCANE7XH.js";var n=d(g(),1);var m=({children:o,color:i,isLoading:r,isPulsing:e,...t})=>(0,n.jsx)($,{$color:i,$isLoading:r,$isPulsing:e,...t,children:o}),$=l.span`
  padding: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1rem; /* 150% */
  border-radius: var(--privy-border-radius-xs);
  display: flex;
  align-items: center;
  ${o=>{let i,r;o.$color==="green"&&(i="var(--privy-color-success-dark)",r="var(--privy-color-success-light)"),o.$color==="red"&&(i="var(--privy-color-error)",r="var(--privy-color-error-light)"),o.$color==="gray"&&(i="var(--privy-color-foreground-2)",r="var(--privy-color-background-2)");let e=a`
      from, to {
        background-color: ${r};
      }

      50% {
        background-color: rgba(${r}, 0.8);
      }
    `;return s`
      color: ${i};
      background-color: ${r};
      ${o.$isPulsing&&s`
        animation: ${e} 3s linear infinite;
      `};
    `}}

  ${c}
`;export{m as a};
