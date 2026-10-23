import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import sharp from 'sharp';
import {createAvatarProcessor} from './processor.mjs';
import {AVATAR_LIMITS,pngChunks,validateAvatarInput,validatedDerivative} from './limits.mjs';

// Synthetic pixels only. No member files, credentials or network requests.
const image=(width=80,height=40)=>sharp({create:{width,height,channels:4,background:{r:17,g:93,b:128,alpha:0.8}}});
const png=await image().png().toBuffer();
const derivative={ok:true,bytes:png,width:80,height:40};
const enabled=()=>createAvatarProcessor({enabled:true});
const refused=(promise,code)=>assert.rejects(promise,{message:code});
class Child extends EventEmitter {
  pid=123; sent=[]; kills=[];
  send(message,callback){this.sent.push(message);this.callback=callback;}
  kill(signal){this.kills.push(signal);return true;}
}
function harness(options={}){
  const child=new Child();let spawns=0;
  const processor=createAvatarProcessor({enabled:true,spawnWorker:()=>{spawns++;return child;},...options});
  return {child,processor,spawns:()=>spawns};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function insertChunk(bytes,type){
  const chunk=Buffer.alloc(12);chunk.write(type,4,'ascii');
  setCrc(chunk,0);return Buffer.concat([bytes.subarray(0,33),chunk,bytes.subarray(33)]);
}
function setCrc(bytes,at){
  const size=bytes.readUInt32BE(at);let crc=0xffffffff;for(const byte of bytes.subarray(at+4,at+8+size)){
    crc^=byte;for(let bit=0;bit<8;bit++)crc=crc&1?0xedb88320^(crc>>>1):crc>>>1;
  }
  bytes.writeUInt32BE((crc^0xffffffff)>>>0,at+8+size);
}

test('default is closed and invalid configuration cannot open processing',async()=>{
  await refused(createAvatarProcessor().process(png,'image/png'),'avatar_unavailable');
  await refused(createAvatarProcessor({enabled:'true'}).process(png,'image/png'),'avatar_unavailable');
  for(const timeoutMs of [0,-1,8001,NaN,1.5])assert.throws(()=>createAvatarProcessor({timeoutMs}),/avatar_configuration_invalid/);
});
for(const [mime,format] of [['image/png','png'],['image/jpeg','jpeg'],['image/webp','webp']]){
  test(`native child decodes ${format}, preserves aspect ratio and emits fresh PNG`,async()=>{
    const input=await image(900,450)[format]().toBuffer();
    const result=await enabled().process(input,mime);
    assert.deepEqual([result.mime,result.width,result.height],['image/png',256,128]);
    assert.ok(result.bytes.length<=AVATAR_LIMITS.outputBytes);
    const decoded=await sharp(result.bytes).raw().toBuffer({resolveWithObject:true});
    assert.deepEqual([decoded.info.width,decoded.info.height],[256,128]);
    assert.notDeepEqual(Buffer.from(result.bytes),input);
  });
}
test('small transparent image is not enlarged or cropped',async()=>{
  const result=await enabled().process(png,'image/png');
  assert.deepEqual([result.width,result.height],[80,40]);
  const info=await sharp(result.bytes).metadata();assert.equal(info.hasAlpha,true);
});
test('native child does not inherit application Node preload settings',async()=>{
  const previous=process.env.NODE_OPTIONS;
  try{
    process.env.NODE_OPTIONS='--require ./this-synthetic-preload-must-not-run.cjs';
    assert.equal((await enabled().process(png,'image/png')).width,80);
  }finally{if(previous===undefined)delete process.env.NODE_OPTIONS;else process.env.NODE_OPTIONS=previous;}
});
test('EXIF orientation is applied and identifying metadata is removed',async()=>{
  const input=await image(80,40).withMetadata({orientation:6}).withExif({IFD0:{Artist:'PRIVATE SYNTHETIC ARTIST'},IFD2:{GPSLatitudeRef:'N',GPSLatitude:'1/1 2/1 3/1'}}).jpeg().toBuffer();
  assert.ok((await sharp(input).metadata()).exif);
  const result=await enabled().process(input,'image/jpeg');
  assert.deepEqual([result.width,result.height],[40,80]);
  const metadata=await sharp(result.bytes).metadata();
  for(const field of ['exif','icc','xmp','iptc','orientation'])assert.equal(metadata[field],undefined,field);
  assert.equal(Buffer.from(result.bytes).includes(Buffer.from('PRIVATE SYNTHETIC')),false);
});
test('native decoder refuses corrupt content despite plausible signature',async()=>{
  const bad=Buffer.from(png);let at=8;
  while(bad.toString('ascii',at+4,at+8)!=='IDAT')at+=bad.readUInt32BE(at)+12;
  bad.fill(0,at+8,at+8+bad.readUInt32BE(at));setCrc(bad,at);
  assert.equal(validateAvatarInput(bad,'image/png'),true);
  await refused(enabled().process(bad,'image/png'),'avatar_invalid');
  await refused(enabled().process(Buffer.from([255,216,255,0,0,0,0,0,0,0,255,217]),'image/jpeg'),'avatar_invalid');
});
test('native decoder refuses JPEG dimensions beyond limit',async()=>{
  const input=await image(4097,1).jpeg().toBuffer();
  await refused(enabled().process(input,'image/jpeg'),'avatar_invalid');
});
test('type, length, MIME, path and URL refusals occur before child creation',async()=>{
  const {processor,spawns}=harness();
  const cases=[
    ['https://example.invalid/a.png','image/png'],['C:/private/avatar.png','image/png'],
    [png,'image/svg+xml'],[png,'image/gif'],[png,'image/heic'],[png,'IMAGE/PNG'],[png,'image/png; charset=utf-8'],
    [png,'image/jpeg'],[png,'image/webp'],[Buffer.from('<svg></svg>'),'image/png'],
    [new Uint8Array(AVATAR_LIMITS.inputBytes+1),'image/png'],[png.subarray(0,25),'image/png'],
    [Buffer.concat([png,Buffer.from('tail')]),'image/png'],[new ArrayBuffer(40),'image/png'],
  ];
  for(const [bytes,mime] of cases)await refused(processor.process(bytes,mime),'avatar_invalid');
  assert.equal(spawns(),0);
});
test('oversized PNG dimensions and animation chunks refuse before child creation',async()=>{
  const {processor,spawns}=harness();const huge=await image(4097,1).png().toBuffer();
  await refused(processor.process(huge,'image/png'),'avatar_invalid');
  for(const type of ['acTL','fcTL','fdAT'])await refused(processor.process(insertChunk(png,type),'image/png'),'avatar_invalid');
  assert.equal(spawns(),0);
});
test('WebP animation, bad container sizes and truncation refuse before decode',async()=>{
  const input=await image().webp().toBuffer();const {processor,spawns}=harness();
  assert.equal(validateAvatarInput(input,'image/webp'),true);
  const animated=Buffer.alloc(30);animated.write('RIFF');animated.writeUInt32LE(22,4);animated.write('WEBP',8);animated.write('VP8X',12);animated.writeUInt32LE(10,16);animated[20]=2;
  const animChunk=Buffer.alloc(20);animChunk.write('RIFF');animChunk.writeUInt32LE(12,4);animChunk.write('WEBP',8);animChunk.write('ANIM',12);
  const badSize=Buffer.from(input);badSize.writeUInt32LE(0,4);
  for(const bytes of [animated,animChunk,badSize,input.subarray(0,input.length-1)])await refused(processor.process(bytes,'image/webp'),'avatar_invalid');
  assert.equal(spawns(),0);
});
test('derivative validator refuses metadata, dimensions, excessive bytes and invalid output',()=>{
  assert.equal(validatedDerivative(derivative).width,80);
  for(const message of [null,{ok:false},{...derivative,mime:'image/jpeg',width:0},{...derivative,width:81},{...derivative,height:257},{...derivative,bytes:new Uint8Array(AVATAR_LIMITS.outputBytes+1)},{...derivative,bytes:insertChunk(png,'eXIf')},{...derivative,bytes:insertChunk(png,'tEXt')}])assert.throws(()=>validatedDerivative(message),/avatar_invalid/);
});
test('one slot, no queue, copied input and success only after actual exit',async()=>{
  const {processor,child,spawns}=harness();let settled=false;const input=Buffer.from(png);
  const pending=processor.process(input,'image/png').then(value=>{settled=true;return value;});
  input[0]=0;assert.equal(child.sent[0].bytes[0],137);assert.deepEqual(Object.keys(child.sent[0]),['bytes','mime']);
  await refused(processor.process(png,'image/png'),'avatar_busy');assert.equal(spawns(),1);
  child.emit('message',derivative);await tick();assert.equal(settled,false);
  child.emit('exit',0);assert.equal((await pending).width,80);
});
test('already cancelled work does not create a child',async()=>{
  const {processor,spawns}=harness();const controller=new AbortController();controller.abort();
  await refused(processor.process(png,'image/png',{signal:controller.signal}),'avatar_cancelled');assert.equal(spawns(),0);
});
test('cancellation refuses late success and keeps slot busy until exit',async()=>{
  const {processor,child}=harness();const controller=new AbortController();const pending=processor.process(png,'image/png',{signal:controller.signal});
  controller.abort();await refused(pending,'avatar_cancelled');assert.deepEqual(child.kills,['SIGKILL']);
  child.emit('message',derivative);await refused(processor.process(png,'image/png'),'avatar_busy');child.emit('exit',0);
  const next=processor.process(png,'image/png');child.emit('message',derivative);child.emit('exit',0);assert.equal((await next).width,80);
});
test('deadline kills worker and keeps slot closed even if kill throws',async()=>{
  const {processor,child}=harness({timeoutMs:15});child.kill=()=>{throw Error('private native detail');};
  await refused(processor.process(png,'image/png'),'avatar_timeout');
  await refused(processor.process(png,'image/png'),'avatar_busy');child.emit('exit',1);
});
test('synchronous exit during cancellation preserves cancellation status',async()=>{
  const {processor,child}=harness();child.kill=()=>child.emit('exit',1);const controller=new AbortController();
  const pending=processor.process(png,'image/png',{signal:controller.signal});controller.abort();await refused(pending,'avatar_cancelled');
});
test('native child is terminated when its hard deadline expires',async()=>{
  await refused(createAvatarProcessor({enabled:true,timeoutMs:1}).process(png,'image/png'),'avatar_timeout');
});
test('worker crash, malformed reply, spawn and send errors have fixed safe errors',async()=>{
  await refused(createAvatarProcessor({enabled:true,spawnWorker(){throw Error('private');}}).process(png,'image/png'),'avatar_unavailable');
  for(const event of ['crash','malformed','send','error']){
    const {processor,child}=harness();const pending=processor.process(png,'image/png');
    if(event==='crash')child.emit('exit',1);
    if(event==='malformed')child.emit('message',{...derivative,bytes:Buffer.from('private parser detail')});
    if(event==='send')child.callback(Error('private send detail'));
    if(event==='error')child.emit('error',Error('private child detail'));
    await refused(pending,event==='malformed'?'avatar_invalid':'avatar_unavailable');
    child.emit('exit',1);
  }
});
