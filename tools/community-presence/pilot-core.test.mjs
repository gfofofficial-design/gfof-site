import assert from 'node:assert/strict';
import test from 'node:test';
import {createPresencePreview, XP_RULES, WEEKLY_CAP} from './pilot-core.mjs';

test('the addition uses existing profile validation and starts with an unlisted explorer', () => {
  const p = createPresencePreview(), self = p.memberIds[0], profile = p.summary(self);
  assert.equal(profile.listed, false);
  assert.equal(profile.xp, 0);
  assert.equal(profile.rank, 'Explorer');
  assert.equal(p.standings().length, 2);
  assert.throws(() => p.community.updateMember(self, self, {...profile, role: 'admin'}));
  assert.throws(() => p.community.updateMember(self, self, {...profile, name: '<script>'}));
});

test('a fictional review counts once and cannot be reassigned to a different member', () => {
  const p = createPresencePreview(), [self, other] = p.memberIds;
  assert.equal(p.awardReviewedExample(self, 'creation', 'review-1').repeated, false);
  assert.equal(p.awardReviewedExample(self, 'creation', 'review-1').repeated, true);
  assert.equal(p.summary(self).xp, 20);
  assert.throws(() => p.awardReviewedExample(other, 'creation', 'review-1'));
  assert.throws(() => p.awardReviewedExample(self, 'help', 'review-1'));
});

test('the proposed category limits add up to exactly 100 weekly XP', () => {
  const p = createPresencePreview(), self = p.memberIds[0];
  for (const [category, rule] of Object.entries(XP_RULES)) {
    for (let i = 1; i <= rule.limit; i++) p.awardReviewedExample(self, category, category + '-' + i);
    assert.throws(() => p.awardReviewedExample(self, category, category + '-extra'));
  }
  assert.equal(p.summary(self).xp, WEEKLY_CAP);
  assert.equal(WEEKLY_CAP, 100);
  assert.equal(p.summary(self).rank, 'Crew member');
});

test('unlisting removes the example card from standings and retains the member own progress', () => {
  const p = createPresencePreview(), self = p.memberIds[0];
  const profile = p.summary(self);
  p.community.updateMember(self, self, {...profile, listed: true});
  p.awardReviewedExample(self, 'help', 'my-review');
  assert.equal(p.standings().find(member => member.id === self).xp, 15);
  p.community.updateMember(self, self, {...profile, listed: false});
  assert.equal(p.standings().some(member => member.id === self), false);
  assert.equal(p.summary(self).xp, 15);
});

test('the existing invitation needs consent and a peer acknowledgement grants no XP', () => {
  const p = createPresencePreview(), [self, artist] = p.memberIds;
  const c = p.community.challengeList(self)[0];
  assert.equal(c.kit, 'remix');
  assert.throws(() => p.community.respond(self, c.id, 'accept'));
  p.community.respond(artist, c.id, 'accept');
  const added = p.community.addProof(self, c.id, 'We returned the moon with a clearer plan for the crew.');
  assert.throws(() => p.community.reviewProof(self, c.id, added.proofs[0].id, true));
  p.community.reviewProof(artist, c.id, added.proofs[0].id, true);
  assert.equal(p.community.challengeList(self)[0].status, 'complete');
  assert.equal(p.summary(self).xp, 0);
});

test('mutating a returned score or member cannot change stored examples', () => {
  const p = createPresencePreview(), artist = p.memberIds[1];
  const before = p.summary(artist);
  before.xp = 1000;
  before.awards[0].xp = 1000;
  before.name = 'Other name';
  assert.equal(p.summary(artist).xp, 45);
  assert.equal(p.summary(artist).name, 'Aster');
});

test('a fresh preview starts again without carrying an earlier person or award', () => {
  const p = createPresencePreview(), self = p.memberIds[0];
  p.awardReviewedExample(self, 'help', 'old-review');
  p.community.updateMember(self, self, {...p.summary(self), name: 'Old example', listed: true});
  const fresh = createPresencePreview();
  assert.equal(fresh.summary(fresh.memberIds[0]).name, 'Preview Explorer');
  assert.equal(fresh.summary(fresh.memberIds[0]).xp, 0);
  assert.equal(fresh.standings().length, 2);
});
