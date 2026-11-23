import {CHALLENGE_KITS, PROFILE_ROLES} from '../../assets/federation/fed-alliance-community-core.mjs';
import {createPresencePreview, XP_RULES, WEEKLY_CAP} from './pilot-core.mjs';

const get = id => document.getElementById(id);
let preview = createPresencePreview();
let actor = preview.memberIds[0];

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function announce(message) {
  get('status').textContent = message;
}

function action(label, run) {
  const button = element('button', label);
  button.type = 'button';
  button.addEventListener('click', () => {
    try {
      run();
    } catch (error) {
      announce(error.message);
    }
  });
  return button;
}

function memberName(id) {
  return preview.community.getMember(id).name;
}

function loadProfileFields() {
  const member = preview.community.getMember(actor);
  for (const field of ['name', 'community', 'bio', 'role']) {
    get(field).value = member[field];
    get(field).removeAttribute('aria-invalid');
    get(field).removeAttribute('aria-describedby');
  }
  get('listed').checked = member.listed;
  get('profile-status').textContent = '';
  get('edit-details').open = false;
  get('proof').value = '';
  get('proof').removeAttribute('aria-invalid');
}

function renderMember() {
  const member = preview.summary(actor);
  get('member-name').textContent = member.name;
  get('member-bio').textContent = member.bio;
  get('member-role').textContent = PROFILE_ROLES[member.role];
  get('member-community').textContent = member.community || 'Independent explorer';
  get('initials').textContent = member.name.split(/\s+/u).slice(0, 2)
    .map(part => Array.from(part)[0]).join('').toLocaleUpperCase();
  get('xp').textContent = String(member.xp);
  get('rank').textContent = member.rank;
  get('xp-progress').value = member.xp;
  get('visibility').textContent = member.listed
    ? 'This fictional card is listed on the crew board.'
    : 'This fictional card is unlisted. You can still view your own progress.';
  get('awards').replaceChildren(...(member.awards.length
    ? member.awards.map(event => element('li', XP_RULES[event.category].label + ' · ' + event.xp + ' XP · fictional review'))
    : [element('li', 'No reviewed example contributions yet.')]));
}

function renderBoard() {
  const rows = preview.standings();
  let priorXP, position;
  const rendered = rows.map((member, index) => {
    if (member.xp !== priorXP) position = index + 1;
    priorXP = member.xp;
    const row = element('tr');
    const identity = element('td');
    identity.append(element('strong', String(position) + '. ' + member.name),
      element('span', member.community || 'Independent explorer'));
    row.append(identity, element('td', PROFILE_ROLES[member.role]), element('td', String(member.xp)));
    return row;
  });
  if (!rendered.length) {
    const cell = element('td', 'Every example member is unlisted.');
    cell.colSpan = 3;
    const row = element('tr');
    row.append(cell);
    rendered.push(row);
  }
  get('standings').replaceChildren(...rendered);
}

function renderReviews() {
  const member = preview.summary(actor);
  const buttons = Object.entries(XP_RULES).map(([category, rule]) => {
    const count = member.awards.filter(event => event.category === category).length;
    const selection = actor;
    const button = action(rule.label, () => {
      if (actor !== selection) return;
      if (count >= rule.limit || member.xp >= WEEKLY_CAP) {
        announce('The weekly limit for this example activity has been reached.');
        return;
      }
      const event = preview.awardReviewedExample(selection, category, selection + '-' + category + '-' + (count + 1));
      render();
      announce(event.repeated ? 'This fictional review already counted once.'
        : rule.xp + ' example XP added for ' + rule.label.toLocaleLowerCase() + '.');
      get('review-' + category).focus();
    });
    button.id = 'review-' + category;
    button.append(element('span', count >= rule.limit ? 'Limit reached' : '+' + rule.xp + ' XP'));
    button.setAttribute('aria-label', 'Try fictional review for ' + rule.label + '. ' + count + ' of ' + rule.limit + ' used.');
    // Keep the control keyboard reachable after the last accepted example.
    button.setAttribute('aria-disabled', String(count >= rule.limit || member.xp >= WEEKLY_CAP));
    return button;
  });
  get('review-options').replaceChildren(...buttons);
}

function renderChallenge() {
  const challenge = preview.community.challengeList(actor)[0];
  get('challenge-state').textContent = challenge.status;
  get('challenge-pair').textContent = memberName(challenge.from) + ' and ' + memberName(challenge.to);
  get('challenge-brief').textContent = challenge.note;
  const actions = [];
  if (challenge.status === 'invited' && challenge.from === actor) {
    actions.push(element('p', 'Waiting for ' + memberName(challenge.to) + '. Choose that example member above to try their response.', 'muted'));
  }
  if (challenge.status === 'invited' && challenge.to === actor) {
    actions.push(action('Accept example invitation', () => {
      preview.community.respond(actor, challenge.id, 'accept');
      render();
      announce('Example invitation accepted. Add your ending for the other participant to review.');
      get('proof').focus();
    }));
    actions.push(action('Decline example invitation', () => {
      preview.community.respond(actor, challenge.id, 'decline');
      render();
      announce('Example invitation declined.');
      get('challenge-title').focus();
    }));
  }
  get('challenge-actions').replaceChildren(...actions);
  get('proof-form').hidden = challenge.status !== 'active' || ![challenge.from, challenge.to].includes(actor);
  get('proofs').replaceChildren(...challenge.proofs.map(proof => {
    const entry = element('article');
    entry.append(element('strong', memberName(proof.owner) + ' · ' + proof.status), element('p', proof.note));
    if (challenge.status === 'active' && [challenge.from, challenge.to].includes(actor) &&
        proof.owner !== actor && proof.status === 'pending') {
      entry.append(action('Acknowledge example contribution', () => {
        preview.community.reviewProof(actor, challenge.id, proof.id, true);
        render();
        announce('The peer acknowledged this example contribution. XP stays with the separate fictional review controls.');
        get('challenge-title').focus();
      }));
    }
    return entry;
  }));
}

function render() {
  renderMember();
  renderBoard();
  renderReviews();
  renderChallenge();
}

function renderActorOptions() {
  get('actor').replaceChildren(...preview.memberIds.map(id => {
    const option = element('option', memberName(id) + ' · fictional');
    option.value = id;
    return option;
  }));
  get('actor').value = actor;
}

get('actor').addEventListener('change', () => {
  actor = get('actor').value;
  loadProfileFields();
  render();
  announce('Viewing ' + memberName(actor) + '. The previous example draft has cleared.');
});

get('profile').addEventListener('submit', event => {
  event.preventDefault();
  const input = Object.fromEntries(['name', 'community', 'bio', 'role'].map(field => [field, get(field).value]));
  input.listed = get('listed').checked;
  try {
    preview.community.updateMember(actor, actor, input);
    renderActorOptions();
    render();
    loadProfileFields();
    announce('Example profile saved in page memory.');
    get('member-name').focus();
  } catch (error) {
    get('profile-status').textContent = error.message;
    const input = error.field && get(error.field);
    if (input) {
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', 'profile-status');
      input.focus();
    }
  }
});

get('profile').addEventListener('input', event => {
  event.target.removeAttribute('aria-invalid');
  event.target.removeAttribute('aria-describedby');
});

get('proof-form').addEventListener('submit', event => {
  event.preventDefault();
  const challenge = preview.community.challengeList(actor)[0];
  try {
    preview.community.addProof(actor, challenge.id, get('proof').value);
    get('proof').value = '';
    get('proof').removeAttribute('aria-invalid');
    render();
    announce('Example contribution added. Switch to the other participant to try acknowledgement.');
    get('proof').focus();
  } catch (error) {
    announce(error.message);
    get('proof').setAttribute('aria-invalid', 'true');
    get('proof').focus();
  }
});

get('proof').addEventListener('input', () => get('proof').removeAttribute('aria-invalid'));
get('reset').addEventListener('click', () => {
  preview = createPresencePreview();
  actor = preview.memberIds[0];
  renderActorOptions();
  loadProfileFields();
  render();
  get('guide-answer').textContent = '';
  get('guide-link').href = '/alliance.html#community-hub';
  get('guide-link').textContent = 'Explore the Alliance activities';
  announce('Fictional profiles, drafts and points reset.');
  get('actor').focus();
});

const guideChoices = [
  ['Create something', 'remix', '/alliance-wrong-moon.html', 'Open the meme maker'],
  ['Investigate a claim', 'research', 'https://dossiertrack.co/token-structure', 'Open Dossier Lens'],
  ['Learn with the crew', 'teach-back', '/learn', 'Read the Federation lessons'],
];
get('guide-options').replaceChildren(...guideChoices.map(([label, id, href, link]) => action(label, () => {
  const kit = CHALLENGE_KITS.find(entry => entry.id === id);
  get('guide-answer').textContent = kit.title + '. ' + kit.brief;
  get('guide-link').href = href;
  get('guide-link').textContent = link;
})));

get('member-name').tabIndex = -1;
get('challenge-title').tabIndex = -1;
renderActorOptions();
loadProfileFields();
render();
announce('Try an example profile, invitation or contribution review.');
