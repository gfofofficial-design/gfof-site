// Fixed child entry. Buffer input/output over IPC only; no filesystem, URL,
// credential, upload, profile or storage API. Errors never contain parser text.
import sharp from 'sharp';
import {AVATAR_LIMITS,validateAvatarInput,validDimensions} from './limits.mjs';
sharp.cache(false);sharp.concurrency(1);
process.once('message',async message=>{
  let result;
  try{
    validateAvatarInput(message?.bytes,message?.mime);
    const input=Buffer.from(message.bytes);
    const options={failOn:'warning',limitInputPixels:AVATAR_LIMITS.inputPixels,limitInputChannels:4,unlimited:false,sequentialRead:true};
    const metadata=await sharp(input,options).metadata();
    const expected={'image/png':'png','image/jpeg':'jpeg','image/webp':'webp'}[message.mime];
    if(metadata.format!==expected||!validDimensions(metadata.width,metadata.height,AVATAR_LIMITS.inputDimension)||(metadata.pages??1)!==1||metadata.loop!==undefined)throw Error();
    // Full decode/re-encode, not a copy of the source. Default sharp output drops
    // EXIF/ICC/XMP/IPTC. Auto-orientation precedes metadata removal. No cropping.
    const {data,info}=await sharp(input,options).rotate().resize({width:256,height:256,fit:'inside',withoutEnlargement:true}).png({compressionLevel:9,palette:false}).timeout({seconds:4}).toBuffer({resolveWithObject:true});
    if(info.format!=='png'||data.byteLength>AVATAR_LIMITS.outputBytes||!validDimensions(info.width,info.height,AVATAR_LIMITS.outputDimension))throw Error();
    result={ok:true,bytes:data,width:info.width,height:info.height};
  }catch{result={ok:false,code:'avatar_invalid'};}
  if(process.send)process.send(result,()=>process.exit(0));else process.exit(1);
});
