// Local previews only. This module never uploads, stores or publishes a file.
export const ARTWORK_LIMITS = Object.freeze({bytes:2*1024*1024,dimension:4096,waitMs:8000});
const types=Object.freeze({'image/png':'PNG','image/jpeg':'JPEG','image/webp':'WebP'});
export function artworkFileProblem(file) {
  if(!file || !Object.hasOwn(types,file.type)) return 'Choose a PNG, JPEG or WebP image. SVG, GIF and HEIC are not supported here.';
  if(!Number.isSafeInteger(file.size) || file.size<1 || file.size>ARTWORK_LIMITS.bytes) return 'Choose an image up to 2 MB.';
  return '';
}
export function artworkSignature(bytes) {
  if(!(bytes instanceof Uint8Array)) return '';
  if([137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n)) return 'image/png';
  if(bytes[0]===255 && bytes[1]===216 && bytes[2]===255) return 'image/jpeg';
  if([82,73,70,70].every((n,i)=>bytes[i]===n) && [87,69,66,80].every((n,i)=>bytes[i+8]===n)) return 'image/webp';
  return '';
}
export function artworkDimensions(bytes,type) {
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(type==='image/png' && bytes.length>=24 && view.getUint32(8)===13 && view.getUint32(12)===0x49484452) return {width:view.getUint32(16),height:view.getUint32(20)};
  if(type==='image/jpeg') {
    let at=2;
    while(at+3<bytes.length) {
      if(bytes[at++]!==255)return null;
      while(bytes[at]===255)at++;
      const marker=bytes[at++];
      if(marker===0xda || marker===0xd9)return null;
      if(marker===1 || (marker>=0xd0&&marker<=0xd8))continue;
      if(at+2>bytes.length)return null;
      const length=view.getUint16(at);
      if(length<2 || at+length>bytes.length)return null;
      if(marker>=0xc0&&marker<=0xcf&&![0xc4,0xc8,0xcc].includes(marker)) {
        return length>=8 ? {width:view.getUint16(at+5),height:view.getUint16(at+3)} : null;
      }
      at+=length;
    }
  }
  if(type==='image/webp' && bytes.length>=30 && view.getUint32(4,true)+8===bytes.length) {
    const chunk=String.fromCharCode(...bytes.slice(12,16));
    const u24=at=>bytes[at]+(bytes[at+1]<<8)+(bytes[at+2]<<16);
    if(chunk==='VP8X' && view.getUint32(16,true)>=10)return {width:1+u24(24),height:1+u24(27)};
    if(chunk==='VP8L' && bytes[20]===0x2f)return {width:1+((bytes[22]&0x3f)<<8)+bytes[21],height:1+((bytes[24]&0x0f)<<10)+(bytes[23]<<2)+(bytes[22]>>6)};
    if(chunk==='VP8 ' && bytes[23]===0x9d && bytes[24]===1 && bytes[25]===0x2a)return {width:view.getUint16(26,true)&0x3fff,height:view.getUint16(28,true)&0x3fff};
  }
  return null;
}
function validDimensions(size) {
  return size && ['width','height'].every(key=>Number.isSafeInteger(size[key])&&size[key]>=1&&size[key]<=ARTWORK_LIMITS.dimension);
}
function publicFilename(name,type) {
  return typeof name==='string' && name.length>0 && name.length<=100 && !/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069<>/\\]/.test(name)
    ? name : 'project-image.'+(type==='image/jpeg'?'jpg':type==='image/webp'?'webp':'png');
}
function inspectImage(url) {
  const image=new Image();let rejectWait;
  const promise=new Promise((resolve,reject)=>{
    rejectWait=reject;
    image.onload=()=>resolve({width:image.naturalWidth,height:image.naturalHeight});
    image.onerror=()=>reject(Error('unreadable'));
    image.src=url;
  });
  return {promise,cancel(){image.onload=null;image.onerror=null;image.removeAttribute('src');rejectWait(Error('cancelled'));}};
}
export function artworkBrief(image) {
  if(!image) return '';
  return '\n\nProject artwork selected on this device: '+image.name+' ('+types[image.type]+', '+image.width+' × '+image.height+').\nAttach the original image separately if you choose to share this brief. The image is not embedded in this text file, uploaded, saved or published by the worksheet. Confirm permission to use the artwork before publication.';
}
export function createArtworkSelection(options={}) {
  const createUrl=options.createUrl || (file=>URL.createObjectURL(file));
  const revokeUrl=options.revokeUrl || (url=>URL.revokeObjectURL(url));
  const inspect=options.inspect || inspectImage;
  const schedule=options.setTimeout || globalThis.setTimeout;
  const unschedule=options.clearTimeout || globalThis.clearTimeout;
  const update=options.update || (()=>{});
  let current=null,pending=null,disposed=false;
  const release=url=>{if(url)try{revokeUrl(url);}catch{}};
  function reset() {
    if(pending) {const old=pending;pending=null;old.cancel();}
    if(current) {release(current.url);current=null;}
  }
  return {
    get current(){return current;},get pending(){return !!pending;},
    clear(){reset();if(!disposed)update({status:'empty'});},
    dispose(){disposed=true;reset();},
    async select(file) {
      if(disposed || !file) return;
      reset();
      const problem=artworkFileProblem(file);
      if(problem){update({status:'error',message:problem});return;}
      const token={url:null};pending=token;
      const interrupted=new Promise((_,reject)=>{
        token.cancel=()=>{unschedule(token.timer);token.decoder?.cancel();release(token.url);token.url=null;reject(Error('cancelled'));};
        token.timer=schedule(()=>reject(Error('timeout')),ARTWORK_LIMITS.waitMs);
      });
      update({status:'pending'});
      try {
        const image=await Promise.race([(async()=>{
          const header=new Uint8Array(await file.arrayBuffer());
          if(pending!==token)throw Error('cancelled');
          if(header.length!==file.size || artworkSignature(header)!==file.type)throw Error('format');
          const dimensions=artworkDimensions(header,file.type);
          if(!dimensions)throw Error('format');
          if(!validDimensions(dimensions))throw Error('dimensions');
          token.url=createUrl(file);
          if(typeof token.url!=='string' || !token.url.startsWith('blob:'))throw Error('unavailable');
          token.decoder=inspect(token.url);
          const {width,height}=await token.decoder.promise;
          if(!validDimensions({width,height}))throw Error('dimensions');
          return Object.freeze({url:token.url,name:publicFilename(file.name,file.type),type:file.type,bytes:file.size,width,height});
        })(),interrupted]);
        if(pending!==token || disposed)return;
        current=image;token.url=null;pending=null;
        update({status:'ready',image});
      } catch(error) {
        if(pending!==token || disposed)return;
        pending=null;
        const message=error.message==='timeout' ? 'Image checking took too long. Choose the image again, or continue without one.'
          : error.message==='dimensions' ? 'Choose an image no larger than 4096 × 4096 pixels.'
          : 'This image could not be read as a supported picture. Try another PNG, JPEG or WebP file.';
        update({status:'error',message});
      } finally {
        unschedule(token.timer);token.decoder?.cancel();release(token.url);token.url=null;
      }
    },
  };
}
