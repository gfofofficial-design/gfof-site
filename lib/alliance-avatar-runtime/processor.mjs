// Unmounted candidate. The caller must verify account ownership and durably
// reserve image-processing/storage allowance BEFORE invoking this processor.
import {fork} from 'node:child_process';
import {AVATAR_LIMITS,validateAvatarInput,validatedDerivative} from './limits.mjs';
const fail=code=>new Error(code);
function nativeWorker(){return fork(new URL('./worker.mjs',import.meta.url),[],{execArgv:['--max-old-space-size=64'],env:{},stdio:['ignore','ignore','ignore','ipc'],serialization:'advanced',windowsHide:true});}
export function createAvatarProcessor({enabled=false,spawnWorker=nativeWorker,timeoutMs=AVATAR_LIMITS.deadlineMs}={}){
  if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>AVATAR_LIMITS.deadlineMs)throw fail('avatar_configuration_invalid');
  let active=false;
  return Object.freeze({
    async process(bytes,mime,{signal}={}){
      if(enabled!==true)throw fail('avatar_unavailable');
      if(signal?.aborted)throw fail('avatar_cancelled');
      validateAvatarInput(bytes,mime);
      if(active)throw fail('avatar_busy');
      active=true;let child;
      try{child=spawnWorker();}catch{active=false;throw fail('avatar_unavailable');}
      return new Promise((resolve,reject)=>{
        let finished=false,received=null,exitSeen=false;
        const finish=(error,value)=>{if(finished)return;finished=true;clearTimeout(timer);signal?.removeEventListener('abort',cancel);error?reject(error):resolve(value);};
        const kill=()=>{try{child.kill('SIGKILL');}catch{/* Keep the slot closed until actual exit. */}};
        const stop=code=>{finish(fail(code));kill();};
        const cancel=()=>stop('avatar_cancelled');
        const timer=setTimeout(()=>stop('avatar_timeout'),timeoutMs);
        child.once('message',message=>{
          try{received=validatedDerivative(message);}catch{received=null;stop('avatar_invalid');}
        });
        child.once('error',()=>{if(!child.pid)active=false;stop('avatar_unavailable');});
        child.once('exit',(code)=>{exitSeen=true;active=false;if(finished)return;if(code!==0||!received)finish(fail('avatar_unavailable'));else finish(null,received);});
        signal?.addEventListener('abort',cancel,{once:true});
        if(signal?.aborted){cancel();return;}
        try{child.send({bytes:new Uint8Array(bytes),mime},error=>{if(error&&!exitSeen)stop('avatar_unavailable');});}catch{stop('avatar_unavailable');}
      });
    },
  });
}
