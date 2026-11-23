import {createCommunitySandbox} from '../../assets/federation/fed-alliance-community-core.mjs';

export const XP_RULES = Object.freeze({
  learning: Object.freeze({label: 'Learning activity', xp: 10, limit: 2}),
  creation: Object.freeze({label: 'Accepted creation', xp: 20, limit: 1}),
  help: Object.freeze({label: 'Useful response', xp: 15, limit: 2}),
  collaboration: Object.freeze({label: 'Reviewed collaboration', xp: 30, limit: 1}),
});
export const WEEKLY_CAP = 100;

// Fictional review events exercise the proposed rules. The sandbox supplies no
// authentication or independent evidence, and is never a production score source.
export function createPresencePreview() {
  const community = createCommunitySandbox();
  const explorer = community.createMember({
    name: 'Preview Explorer', community: '', bio: 'I am finding my place and learning with the crew.',
    role: 'explorer', listed: false,
  }, {example: true});
  const artist = community.createMember({
    name: 'Aster', community: 'Example creative crew', bio: 'I turn questionable docking decisions into memes.',
    role: 'builder', listed: true,
  }, {example: true});
  const researcher = community.createMember({
    name: 'Kai', community: 'Example research crew', bio: 'I follow public claims back to their sources.',
    role: 'researcher', listed: true,
  }, {example: true});
  const memberIds = Object.freeze([explorer.id, artist.id, researcher.id]);
  const events = new Map();

  function awardReviewedExample(memberId, category, evidenceId) {
    community.getMember(memberId);
    if (!Object.hasOwn(XP_RULES, category) || typeof evidenceId !== 'string' ||
        !/^[a-z0-9-]{1,80}$/.test(evidenceId)) throw Error('Choose a valid fictional review example.');
    const previous = events.get(evidenceId);
    if (previous) {
      if (previous.memberId !== memberId || previous.category !== category) {
        throw Error('This example evidence already belongs to another contribution.');
      }
      return {...previous, repeated: true};
    }
    const rule = XP_RULES[category];
    const owned = [...events.values()].filter(event => event.memberId === memberId);
    if (owned.filter(event => event.category === category).length >= rule.limit ||
        owned.reduce((total, event) => total + event.xp, 0) + rule.xp > WEEKLY_CAP) {
      throw Error('The weekly limit for this example activity has been reached.');
    }
    const event = Object.freeze({evidenceId, memberId, category, xp: rule.xp, review: 'fictional'});
    events.set(evidenceId, event);
    return {...event, repeated: false};
  }

  function summary(memberId) {
    const member = community.getMember(memberId);
    const awards = [...events.values()].filter(event => event.memberId === memberId);
    const xp = awards.reduce((total, event) => total + event.xp, 0);
    return {...member, xp, awards: awards.map(event => ({...event})), rank: xp >= 50 ? 'Crew member' : 'Explorer'};
  }

  function standings() {
    return community.directory().map(member => summary(member.id))
      .sort((a, b) => b.xp - a.xp || a.name.localeCompare(b.name));
  }

  awardReviewedExample(artist.id, 'creation', 'aster-creation');
  awardReviewedExample(artist.id, 'help', 'aster-explanation');
  awardReviewedExample(artist.id, 'learning', 'aster-learning');
  awardReviewedExample(researcher.id, 'help', 'kai-correction');
  awardReviewedExample(researcher.id, 'learning', 'kai-learning');
  community.invite(explorer.id, artist.id, {
    kit: 'remix', scope: 'members', days: 14, goal: 1,
    note: 'Write an alternate ending to The Wrong Moon. Credit the original and explain what your crew learns.',
  });
  return Object.freeze({community, memberIds, awardReviewedExample, summary, standings});
}
