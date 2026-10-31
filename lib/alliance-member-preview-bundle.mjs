// Explicit ownership for one finite preview. No handler, ambient credentials,
// preparation, authority transition, installation or deployment.
import {createAvatarLedger} from './alliance-avatar-server/ledger.mjs';
import {createAllianceCommunityStore} from './alliance-avatar-server/community-store.mjs';
import {createAllianceFeedbackStore} from './alliance-avatar-server/feedback-store.mjs';
import {createAllianceReportReviewStore} from './alliance-avatar-server/report-review-store.mjs';
import {createDeletionJournalStore} from './alliance-avatar-server/journal-store.mjs';
import {createAllianceAnchorStore} from './alliance-avatar-server/control-store.mjs';
import {createNetlifyGatewaySigningRuntime} from './alliance-avatar-server/netlify-signing-runtime.mjs';
import {createMemberAuthorityTransport} from './alliance-avatar-server/member-authority-transport.mjs';
import {createAllianceReportReviewApplication} from './alliance-member-application.mjs';

const fail=()=>Error('alliance_preview_bundle_unavailable');
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const retire=async value=>{try{await value?.close?.();}catch{/* Never expose private driver errors. */}};

export async function createManagedAlliancePreviewBundle(options={}){
  if(options.enabled===undefined||options.enabled===false){
    const application=createAllianceReportReviewApplication();
    return Object.freeze({application,close:async()=>application.close()});
  }
  let closed=false,closing,inputSignal;
  const owned=[],lifetime=new AbortController();
  const close=()=>{
    if(closed)return closing;
    closed=true;lifetime.abort();
    // Retire the application first so no new work can reach its dependencies.
    // Start every remaining shutdown even when another component fails.
    closing=Promise.allSettled([...owned].reverse().map(retire)).then(()=>{});
    inputSignal?.removeEventListener('abort',close);
    return closing;
  };
  const take=async value=>{
    if(!value||typeof value.close!=='function'||closed||inputSignal?.aborted){
      await retire(value);throw fail();
    }
    owned.push(value);return value;
  };
  try{
    if(options.enabled!==true||typeof options.readCallerSecret!=='function'||typeof options.openMedia!=='function'||
      options.openPool!==undefined&&typeof options.openPool!=='function'||
      options.signal!==undefined&&!(options.signal instanceof AbortSignal))throw fail();
    inputSignal=options.signal;
    if(inputSignal?.aborted)throw fail();
    const c=structuredClone(options.configuration);
    if(!exact(c,['origin','key','scope','minimum','minimumRevision','expectedInstallation','reviewerActor','gateway','resource','callerKey','controlVerificationKey','journalVerificationKey'])||
      !/^https:\/\/deploy-preview-[1-9][0-9]*--gfof\.netlify\.app$/.test(c.origin)||
      !exact(c.scope,['memberProjectRef','journalProjectRef','controlProjectRef','epoch'])||
      c.expectedInstallation?.context!=='deploy-preview'||
      !exact(options.connections,['member','journal','anchor']))throw fail();
    const {scope}=c,connections={};
    for(const [name,project] of [['member',scope.memberProjectRef],['journal',scope.journalProjectRef],['anchor',scope.controlProjectRef]]){
      const connection=options.connections[name];
      if(!/^[a-z0-9]{20}$/.test(project)||!exact(connection,['host','password','ca'])||connection.host!==`db.${project}.supabase.co`)throw fail();
      connections[name]={...connection};
    }
    inputSignal?.addEventListener('abort',close,{once:true});
    const signal=inputSignal?AbortSignal.any([inputSignal,lifetime.signal]):lifetime.signal;
    const signing=await take(createNetlifyGatewaySigningRuntime({enabled:true,expectedInstallation:c.expectedInstallation,callerKey:c.callerKey,readSecret:options.readCallerSecret}));
    const authority=await take(createMemberAuthorityTransport({enabled:true,gateway:c.gateway,resource:c.resource,scope,callerKey:c.callerKey,
      controlVerificationKey:c.controlVerificationKey,journalVerificationKey:c.journalVerificationKey,signingKey:signing.signingKey,
      ...(options.transport===undefined?{}:{transport:options.transport})}));
    const memberOptions={enabled:true,deploymentProfile:'supabase-managed',connection:connections.member,openPool:options.openPool};
    const ledger=await take(await createAvatarLedger(memberOptions));
    const communityStore=await take(await createAllianceCommunityStore(memberOptions));
    const feedbackStore=await take(await createAllianceFeedbackStore(memberOptions));
    const reportReviewStore=await take(await createAllianceReportReviewStore(memberOptions));
    const journalStore=await take(await createDeletionJournalStore({enabled:true,projectRef:scope.memberProjectRef,journalProjectRef:scope.journalProjectRef,epoch:scope.epoch,
      connection:connections.journal,openPool:options.openPool}));
    const anchorStore=await take(await createAllianceAnchorStore({enabled:true,writeEnabled:true,deploymentProfile:'supabase-managed',...scope,
      connection:connections.anchor,openPool:options.openPool}));
    const media=await take(await options.openMedia({signal}));
    const core=await take(createAllianceReportReviewApplication({enabled:true,origin:c.origin,url:`https://${scope.memberProjectRef}.supabase.co`,key:c.key,
      scope:{memberProjectRef:scope.memberProjectRef,journalProjectRef:scope.journalProjectRef,epoch:scope.epoch},minimum:c.minimum,minimumRevision:c.minimumRevision,
      expectedInstallation:c.expectedInstallation,startupVerificationKey:c.controlVerificationKey,journalVerificationKey:c.journalVerificationKey,reviewerActor:c.reviewerActor,
      ledger,communityStore,feedbackStore,reportReviewStore,journalStore,anchorStore,signingRuntime:signing,readDecision:authority.readDecision,readWitness:authority.readWitness,
      processor:media.processor,storage:media.storage,...(options.fetcher===undefined?{}:{fetcher:options.fetcher})}));
    const application=Object.freeze({prepare:core.prepare,handle:core.handle,close});
    return Object.freeze({application,close});
  }catch{
    await close();throw fail();
  }
}
