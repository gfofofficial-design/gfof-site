import {createPresencePreview} from './pilot-core.mjs';
import {createMessagePreview} from './messages.mjs';

const el = id => document.getElementById(id);
const {community, memberIds} = createPresencePreview();
const members = new Map(memberIds.map(id => [id, community.getMember(id)]));
const name = id => members.get(id).name;
const account = el('message-actor');
const recipient = el('message-recipient');
const introduction = el('message-intro');
const draft = el('message-body');
const requestForm = el('message-request');
const replyForm = el('message-reply');
const decisions = el('message-decisions');
const options = el('message-safety');
let preview = createMessagePreview(memberIds);
let selection = null;
let composing = false;

function option(id) {
  const member = members.get(id);
  return new Option(member.community ? `${member.name} · ${member.community}` : member.name, id);
}

function other(thread) {
  return thread.sender === account.value ? thread.recipient : thread.sender;
}

function stateLabel(thread) {
  if (thread.status === 'pending') return thread.recipient === account.value ? 'Request received' : 'Awaiting response';
  return {active:'Open', declined:'Declined', closed:'Closed'}[thread.status];
}

function announce(text, error = false) {
  const status = el('message-status');
  status.toggleAttribute('data-error', error);
  status.textContent = text;
}

function render() {
  const threads = preview.list(account.value);
  const active = threads.find(thread => thread.id === selection);
  el('message-list-empty').hidden = threads.length !== 0;
  el('message-threads').replaceChildren(...threads.map(thread => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    if (thread.id === selection) button.setAttribute('aria-current', 'true');
    const label = document.createElement('strong');
    label.textContent = name(other(thread));
    const state = document.createElement('span');
    state.className = 'muted';
    state.textContent = stateLabel(thread);
    button.append(label, state);
    button.addEventListener('click', () => openThread(thread.id));
    item.append(button);
    return item;
  }));

  requestForm.hidden = !composing;
  el('message-thread').hidden = composing || !active;
  el('message-welcome').hidden = composing || Boolean(active);

  // Clear the previous account's rendered transcript as well as its unsent draft.
  const transcript = el('message-transcript');
  transcript.replaceChildren();
  if (composing || !active) return;

  el('message-thread-title').textContent = name(other(active));
  el('message-thread-state').textContent = stateLabel(active);
  transcript.replaceChildren(...active.messages.map(message => {
    const item = document.createElement('li');
    item.toggleAttribute('data-outgoing', message.author === account.value);
    const author = document.createElement('strong');
    author.textContent = message.author === account.value ? 'You' : name(message.author);
    const text = document.createElement('p');
    text.textContent = message.body;
    item.append(author, text);
    return item;
  }));
  const incoming = active.status === 'pending' && active.recipient === account.value;
  decisions.hidden = !incoming;
  replyForm.hidden = active.status !== 'active';
  options.hidden = active.status !== 'active' && active.status !== 'pending';
  el('message-thread-hint').textContent = {
    pending: incoming ? 'Accept to let both members reply.' : 'The recipient will see your introduction and can choose whether to reply.',
    active: '',
    declined: 'The recipient declined this request.',
    closed: 'This conversation is closed.',
  }[active.status];
}

function clearDrafts() {
  introduction.value = '';
  draft.value = '';
  introduction.removeAttribute('aria-invalid');
  draft.removeAttribute('aria-invalid');
  options.open = false;
}

function openThread(id) {
  announce('');
  clearDrafts();
  selection = id;
  composing = false;
  render();
  el('message-thread-title').focus();
}

function switchAccount() {
  clearDrafts();
  composing = false;
  selection = preview.list(account.value)[0]?.id ?? null;
  recipient.replaceChildren(...memberIds.filter(id => id !== account.value).map(option));
  render();
}

function run(action, success, focusOnError) {
  try {
    action();
    announce(success);
  } catch (error) {
    if (focusOnError) {
      focusOnError.setAttribute('aria-invalid', 'true');
      focusOnError.focus();
    }
    announce(error.message, true);
  }
}

account.replaceChildren(...memberIds.map(option));
switchAccount();
account.addEventListener('change', () => {
  switchAccount();
  announce(`Showing conversations for ${name(account.value)}.`);
});
el('message-reset').addEventListener('click', () => {
  preview = createMessagePreview(memberIds);
  account.value = memberIds[0];
  switchAccount();
  announce('Example messages cleared.');
  account.focus();
});
el('message-new').addEventListener('click', () => {
  selection = null;
  composing = true;
  clearDrafts();
  render();
  announce('');
  el('message-request-title').focus();
});
el('message-cancel').addEventListener('click', () => {
  composing = false;
  clearDrafts();
  render();
  announce('');
  el('message-new').focus();
});
requestForm.addEventListener('submit', event => {
  event.preventDefault();
  run(() => openThread(preview.request(account.value, recipient.value, introduction.value)),
    'Example request sent. Switch to the recipient’s account to respond.', introduction);
});
replyForm.addEventListener('submit', event => {
  event.preventDefault();
  run(() => {
    preview.reply(account.value, selection, draft.value);
    draft.value = '';
    draft.removeAttribute('aria-invalid');
    render();
    draft.focus();
  }, 'Example reply sent.', draft);
});
for (const action of ['accept', 'decline']) {
  el(`message-${action}`).addEventListener('click', () => {
    run(() => {
      preview.respond(account.value, selection, action);
      openThread(selection);
    }, action === 'accept' ? 'Request accepted. Both members can reply.' : 'Request declined.');
  });
}
el('message-block').addEventListener('click', () => {
  run(() => {
    preview.block(account.value, selection);
    openThread(selection);
  }, 'This example contact is blocked.');
});
for (const field of [introduction, draft]) {
  field.addEventListener('input', () => {
    if (!field.hasAttribute('aria-invalid')) return;
    field.removeAttribute('aria-invalid');
    announce('');
  });
}
