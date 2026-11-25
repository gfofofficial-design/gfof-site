export const MESSAGE_LIMIT = 1000;

export function createMessagePreview(memberIds) {
  const members = new Set(memberIds);
  const threads = new Map();
  let sequence = 0;

  function requireMember(memberId) {
    if (!members.has(memberId)) throw Error('Choose an example member.');
  }

  function messageBody(value) {
    const body = typeof value === 'string' ? value.trim() : '';
    if (!body || body.length > MESSAGE_LIMIT || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(body)) {
      throw Error(`Enter a message of 1 to ${MESSAGE_LIMIT} characters.`);
    }
    return body;
  }

  function isParticipant(thread, memberId) {
    return thread && (thread.sender === memberId || thread.recipient === memberId);
  }

  function getThread(memberId, id) {
    requireMember(memberId);
    const thread = threads.get(id);
    if (!isParticipant(thread, memberId)) throw Error('This conversation is unavailable.');
    return thread;
  }

  function snapshot(thread) {
    return {...thread, messages: thread.messages.map(message => ({...message}))};
  }

  function append(thread, author, body) {
    thread.lastActivity = ++sequence;
    thread.messages.push({author, body});
  }

  function request(sender, recipient, text) {
    requireMember(sender);
    requireMember(recipient);
    if (sender === recipient) throw Error('Choose another member.');
    if ([...threads.values()].some(thread => isParticipant(thread, sender) && isParticipant(thread, recipient))) {
      throw Error('A request already exists for these members. Check your conversations.');
    }

    const body = messageBody(text);
    const id = `conversation-${sequence + 1}`;
    const thread = {id, sender, recipient, status: 'pending', messages: []};
    append(thread, sender, body);
    threads.set(id, thread);
    return id;
  }

  function list(memberId) {
    requireMember(memberId);
    return [...threads.values()].filter(thread => isParticipant(thread, memberId))
      .sort((a, b) => b.lastActivity - a.lastActivity).map(snapshot);
  }

  function respond(memberId, id, action) {
    const thread = getThread(memberId, id);
    if (thread.status !== 'pending' || thread.recipient !== memberId) {
      throw Error('Only the recipient can respond to an open request.');
    }
    if (action !== 'accept' && action !== 'decline') throw Error('Choose how to respond.');
    thread.status = action === 'accept' ? 'active' : 'declined';
    thread.lastActivity = ++sequence;
  }

  function reply(memberId, id, text) {
    const thread = getThread(memberId, id);
    if (thread.status === 'pending') throw Error('Replies open after the request is accepted.');
    if (thread.status !== 'active') throw Error('This conversation is closed.');
    append(thread, memberId, messageBody(text));
  }

  function block(memberId, id) {
    const thread = getThread(memberId, id);
    if (thread.status === 'closed') return;
    thread.status = 'closed';
    thread.lastActivity = ++sequence;
  }

  return Object.freeze({
    request,
    list,
    read: (memberId, id) => snapshot(getThread(memberId, id)),
    respond,
    reply,
    block,
  });
}
