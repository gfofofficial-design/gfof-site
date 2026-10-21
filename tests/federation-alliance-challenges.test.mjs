import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {PUBLISHED_CHALLENGES,publishedChallenges,mountChallengeBoard} from '../assets/federation/fed-alliance-challenges.mjs';
const partner=()=>({id:'example',name:'Synthetic test community',symbol:'EX',badge:'EX',relationship:'partner',summary:'Synthetic fixture, not an actual partner.',mint:'So11111111111111111111111111111111111111112',website:'https://example.com/',evidence:'https://example.com/evidence',review:{consent:'confirmed',identity:'confirmed',publication:'approved',date:'2026-10-21',reference:'ALLIANCE-FIXTURE-0001'}});
const record=()=>({id:'ARENA-0001',title:'Synthetic competition fixture',format:'creative',teams:['gfof','example'],status:'announced',startsAt:'2026-11-01T12:00:00.000Z',closesAt:'2026-11-15T12:00:00.000Z',updatedAt:'2026-10-21T18:00:00.000Z',rulesPath:'/arena/arena-0001-rules',resultsPath:null,review:{bothTeamsAccepted:true,publication:'approved',reviewedAt:'2026-10-21T17:00:00.000Z',publicReference:'ARENA-REVIEW-FIXTURE-0001'}});
const pub=r=>publishedChallenges([r],[partner()]);
test('shipping board has no invented matches and actual published paths must exist',()=>{
 assert.deepEqual(PUBLISHED_CHALLENGES,[]);assert.deepEqual(publishedChallenges(),[]);
 for(const r of publishedChallenges())for(const path of [r.rulesPath,r.resultsPath].filter(Boolean))assert.ok(existsSync(new URL('..'+path+'.html',import.meta.url)));
});
test('only two distinct published stations and explicit publication/acceptance can appear',()=>{
 assert.equal(pub(record()).length,1);
 for(const teams of [['gfof','gfof'],['gfof','unknown'],['gfof'],['gfof','example','other']])assert.equal(pub({...record(),teams}).length,0);
 for(const review of [{...record().review,bothTeamsAccepted:false},{...record().review,publication:'pending'},{...record().review,reviewedAt:'2026-11-02T12:00:00.000Z'}])assert.equal(pub({...record(),review}).length,0);
 assert.equal(publishedChallenges([record()],[{...partner(),review:{...partner().review,consent:'pending'}}]).length,0);
});
test('malformed records, duplicates and private extra fields never render',()=>{
 for(const r of [null,{}, {...record(),email:'private@example.com'},{...record(),format:'__proto__'},{...record(),status:'active'},{...record(),title:'Hidden\u202e text'},{...record(),rulesPath:'https://example.com/private?token=x'}])assert.equal(pub(r).length,0);
 assert.deepEqual(publishedChallenges([record(),record()],[partner()]),[]);assert.deepEqual(publishedChallenges(null),[]);assert.deepEqual(publishedChallenges(Array(49).fill(record()),[partner()]),[]);
});
test('UTC dates, ordering and results publication are explicit and coherent',()=>{
 for(const patch of [{startsAt:'2026-02-30T12:00:00.000Z'},{closesAt:record().startsAt},{updatedAt:'2026-10-21T18:00:00+00:00'},{status:'results'},{status:'judging'}])assert.equal(pub({...record(),...patch}).length,0);
 const result={...record(),status:'results',updatedAt:'2026-11-16T12:00:00.000Z',resultsPath:'/arena/arena-0001-results'};assert.equal(pub(result).length,1);
 assert.equal(pub({...result,resultsPath:'/arena/other-results'}).length,0);assert.equal(pub({...record(),status:'cancelled'}).length,1);
});
test('public projections are immutable copies and omit review metadata',()=>{
 const r=record(),out=pub(r)[0];r.title='Changed';r.teams[0]='unknown';assert.equal(out.title,'Synthetic competition fixture');assert.equal(out.teams[0].id,'gfof');assert.ok(Object.isFrozen(out)&&Object.isFrozen(out.teams)&&Object.isFrozen(out.teams[0]));assert.equal(Object.hasOwn(out,'review'),false);
});
function fixture(){class E{constructor(){this.children=[];this._text='';}set textContent(t){this._text=t;}get textContent(){return this._text+this.children.map(c=>c.textContent).join(' ');}append(...c){this.children.push(...c);}replaceChildren(...c){this.children=c;this._text='';}set innerHTML(_){throw Error('Unsafe interpolation');}}
 const board=new E(),status=new E();return {board,status,doc:{getElementById:id=>id==='arena-matches'?board:id==='arena-match-status'?status:null,createElement:()=>new E()}};
}
test('empty board is honest and performs no member/provider lookup',()=>{const f=fixture();mountChallengeBoard(f.doc);assert.match(f.board.textContent,/No project matches/);assert.match(f.status.textContent,/No announced matches, live scores/);});
test('published cards show stable identity, teams, UTC dates and only reviewed local links',()=>{const f=fixture();mountChallengeBoard(f.doc,[record()],[partner()]);assert.match(f.board.textContent,/ARENA-0001 · Announced/);assert.match(f.board.textContent,/Galactic Federation of Finance vs Synthetic test community/);assert.equal(f.board.children[0].children.at(-1).href,'/arena/arena-0001-rules');assert.match(f.status.textContent,/not inferred from a running clock/);});
