// Offline review helper only. Not imported by the public quote page.
// Passing metadata checks NEVER authorizes signing or confirms fee collection.
export const FEE_POLICY = Object.freeze({integratorBps:50, jupiterShareBps:2000,
  expectedFederationRateBps:40, tradingEnabled:false, collectionEnabled:false});
const SOL='So11111111111111111111111111111111111111112';
const GFOF='Dc9CeuctqvP947ipnCJb8fSf6HhNWDooAQxsVHj2RNBV';
const BASE58='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function publicAddress(value) {
  if(typeof value!=='string'||!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value))return false;
  let number=0n;for(const char of value)number=number*58n+BigInt(BASE58.indexOf(char));
  let bytes=0;while(number){bytes++;number>>=8n;}
  for(const char of value){if(char!=='1')break;bytes++;}return bytes===32;
}
const blocked = reason => Object.freeze({status:'blocked',reason,tradeAllowed:false,collectionConfirmed:false});
export function createFeeMetadataReview(config) {
  const fields=['ownerWallet','referralAccount','feeMint','referralTokenAccount'];
  if(!config||typeof config!=='object'||Array.isArray(config)||Object.keys(config).length!==fields.length||
    Object.keys(config).some(key=>!fields.includes(key))||fields.some(key=>!publicAddress(config[key]))||
    ![SOL,GFOF].includes(config.feeMint))throw new Error('Explicit reviewed public account bindings required');
  const binding=Object.freeze(Object.fromEntries(fields.map(key=>[key,config[key]])));
  return Object.freeze({binding, review(order) {
    try {
      if(!order||typeof order!=='object'||Array.isArray(order)||order.error||order.errorCode!=null)return blocked('order-unavailable');
      const pair=(order.inputMint===SOL&&order.outputMint===GFOF)||(order.inputMint===GFOF&&order.outputMint===SOL);
      if(!pair)return blocked('wrong-token-pair');
      if(order.referralAccount!==binding.referralAccount)return blocked('referral-mismatch');
      if(order.feeMint!==binding.feeMint)return blocked('fee-mint-mismatch');
      // Refuse silent referral fallback and extra percentage charges. A different
      // supported total-cost policy would require explicit review, never an auto bump.
      if(order.feeBps!==FEE_POLICY.integratorBps)return blocked('fee-rate-mismatch');
      return Object.freeze({status:'metadata-matches',integratorFeeBps:50,feeMint:binding.feeMint,
        tradeAllowed:false,collectionConfirmed:false,
        limitation:'Transaction validation, on-chain referral ownership/account checks and fee receipt proof are still required.'});
    }catch{return blocked('order-unavailable');}
  }});
}
