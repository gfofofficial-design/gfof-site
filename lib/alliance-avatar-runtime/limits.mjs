export const AVATAR_LIMITS=Object.freeze({inputBytes:2*1024*1024,inputDimension:4096,inputPixels:4096*4096,outputDimension:256,outputBytes:300*1024,deadlineMs:8000});
const error=()=>new Error('avatar_invalid');
const signature=[137,80,78,71,13,10,26,10];
const crcTable=Uint32Array.from({length:256},(_,value)=>{
  for(let bit=0;bit<8;bit++)value=value&1?0xedb88320^(value>>>1):value>>>1;
  return value>>>0;
});
function crc32(bytes,start,end){
  let crc=0xffffffff;for(let at=start;at<end;at++)crc=crcTable[(crc^bytes[at])&255]^(crc>>>8);
  return (crc^0xffffffff)>>>0;
}
export function pngChunks(bytes){
  if(bytes.length<45||!signature.every((value,index)=>bytes[index]===value))throw error();
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),chunks=[];let at=8;
  while(at<bytes.length){
    if(at+12>bytes.length)throw error();const size=view.getUint32(at);if(size>bytes.length-at-12)throw error();
    const type=String.fromCharCode(...bytes.subarray(at+4,at+8));if(!/^[A-Za-z]{4}$/.test(type))throw error();
    if(crc32(bytes,at+4,at+8+size)!==view.getUint32(at+8+size))throw error();
    chunks.push(type);if(type==='acTL'||type==='fcTL'||type==='fdAT')throw error();
    if(chunks.length===1&&(type!=='IHDR'||size!==13))throw error();
    at+=size+12;if(type==='IEND'){if(size!==0||at!==bytes.length)throw error();break;}
  }
  if(chunks.at(-1)!=='IEND'||!chunks.includes('IDAT'))throw error();
  return {chunks,width:view.getUint32(16),height:view.getUint32(20)};
}
export function validateAvatarInput(bytes,mime){
  if(!(bytes instanceof Uint8Array)||bytes.byteLength<12||bytes.byteLength>AVATAR_LIMITS.inputBytes)throw error();
  if(mime==='image/png'){
    const {width,height}=pngChunks(bytes);if(!validDimensions(width,height,AVATAR_LIMITS.inputDimension))throw error();
  }else if(mime==='image/jpeg'){
    if(bytes[0]!==255||bytes[1]!==216||bytes[2]!==255||bytes.at(-2)!==255||bytes.at(-1)!==217)throw error();
  }else if(mime==='image/webp'){
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    if(String.fromCharCode(...bytes.subarray(0,4))!=='RIFF'||String.fromCharCode(...bytes.subarray(8,12))!=='WEBP'||view.getUint32(4,true)+8!==bytes.length)throw error();
    let at=12;
    while(at<bytes.length){
      if(at+8>bytes.length)throw error();const type=String.fromCharCode(...bytes.subarray(at,at+4)),size=view.getUint32(at+4,true);
      if(size>bytes.length-at-8||type==='ANIM'||type==='ANMF'||type==='VP8X'&&size>0&&(bytes[at+8]&2)!==0)throw error();
      at+=8+size+(size%2);
    }
    if(at!==bytes.length)throw error();
  }else throw error();
  return true;
}
export function validDimensions(width,height,maximum){return Number.isSafeInteger(width)&&Number.isSafeInteger(height)&&width>0&&height>0&&width<=maximum&&height<=maximum;}
export function validatedDerivative(message){
  if(!message||message.ok!==true||!(message.bytes instanceof Uint8Array)||message.bytes.byteLength>AVATAR_LIMITS.outputBytes||!validDimensions(message.width,message.height,AVATAR_LIMITS.outputDimension))throw error();
  const result=pngChunks(message.bytes);
  if(result.width!==message.width||result.height!==message.height||result.chunks.some(type=>!['IHDR','IDAT','IEND','PLTE','tRNS','pHYs'].includes(type)))throw error();
  return {bytes:new Uint8Array(message.bytes),mime:'image/png',width:message.width,height:message.height};
}
