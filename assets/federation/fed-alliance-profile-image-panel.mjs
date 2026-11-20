import { imageId, profileImageInputLimit, profileImageTypes } from './fed-alliance-profile-image-contract.mjs';

const definiteFailure = new Set(['invalid', 'forbidden', 'rejected', 'cancelled', 'stale', 'cleanup_pending']);
const unknown = 'The image change could not be confirmed. Check its status before starting another change.';

export function mountProfileImagePanel(document, { client, onProfileChanged, decode = globalThis.createImageBitmap,
  makeOperationId = () => globalThis.crypto.randomUUID() }) {
  const root = document.getElementById('ap-image');
  const get = name => document.getElementById('ap-image-' + name);
  const status = get('status');
  const canvas = get('preview');
  const file = get('file');
  const load = get('load');
  const save = get('save');
  const confirm = get('confirm');
  const remove = get('remove');
  const cancel = get('cancel');
  if (![root, status, canvas, file, load, save, confirm, remove, cancel].every(Boolean)) throw Error('profile_image_panel_unavailable');

  let profileId = null, head = null, drawnVersion = null, pending = null, flight = null, disposed = false;
  const say = message => { status.textContent = message; };
  const listeners = [];
  const listen = (node, name, callback) => {
    node.addEventListener(name, callback);
    listeners.push(() => node.removeEventListener(name, callback));
  };
  const enabled = node => node.getAttribute('aria-disabled') !== 'true';
  const setEnabled = (node, value) => node.setAttribute('aria-disabled', String(!value));

  function controls() {
    const canChange = profileId !== null && head !== null && head.version < Number.MAX_SAFE_INTEGER && !flight && !pending;
    file.disabled = !canChange;
    confirm.disabled = !canChange || !head?.hasImage;
    setEnabled(load, profileId !== null && !flight);
    load.textContent = pending ? 'Check image change' : 'Load my profile image';
    setEnabled(save, canChange && file.files?.length === 1);
    setEnabled(remove, canChange && !!head?.hasImage && confirm.checked);
    cancel.hidden = !flight;
  }

  function clearImage() {
    canvas.hidden = true;
    // Reset the drawing buffer as well as the element's visibility.
    canvas.width = 1;
    canvas.height = 1;
    drawnVersion = null;
  }

  function setProfile(profile) {
    if (disposed) return;
    const next = imageId(profile?.id) ? profile.id : null;
    if (profileId === next && !root.hidden) return;
    flight?.controller.abort();
    flight = null;
    profileId = next;
    head = pending = null;
    file.value = '';
    confirm.checked = false;
    clearImage();
    root.hidden = false;
    say(profileId ? 'Load your saved image to see or change it.' : 'Save your profile to add a photo later.');
    controls();
  }

  const current = turn => !disposed && flight === turn && profileId === turn.profileId && !turn.controller.signal.aborted;

  async function run(message, task) {
    if (!profileId || disposed || flight) return;
    const turn = { profileId, controller: new AbortController() };
    flight = turn;
    say(message);
    controls();
    try { await task(turn, turn.controller.signal); }
    catch {
      if (current(turn)) say(pending ? unknown : 'Could not load your saved image. Try Load my profile image again.');
    } finally {
      if (flight === turn) {
        const restoreFocus = document.activeElement === cancel;
        flight = null;
        controls();
        if (restoreFocus) load.focus();
      }
    }
  }

  function changed(result, turn) {
    if (!current(turn)) return true;
    if (result.state !== 'profile_changed') return false;
    onProfileChanged();
    return true;
  }

  async function draw(version, turn, signal) {
    const result = await client.content(turn.profileId, version, signal);
    if (changed(result, turn) || result.state !== 'readable') return false;
    if (typeof decode !== 'function') return false;
    const bitmap = await decode(result.image);
    try {
      if (!current(turn) || !Number.isInteger(bitmap.width) || bitmap.width < 1 || bitmap.width > 256 ||
          !Number.isInteger(bitmap.height) || bitmap.height < 1 || bitmap.height > 256) return false;
      const context = canvas.getContext('2d');
      if (!context) return false;
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      context.drawImage(bitmap, 0, 0);
      drawnVersion = version;
      canvas.hidden = false;
      return true;
    } finally { bitmap.close(); }
  }

  async function loadCurrent(turn, signal) {
    const result = await client.read(turn.profileId, signal);
    if (changed(result, turn)) return;
    if (result.state !== 'ready') {
      head = null;
      say(pending ? unknown : 'Your saved image could not be checked. Try Load my profile image again.');
      return;
    }
    head = result;
    if (!result.hasImage || drawnVersion !== result.version) clearImage();
    if (pending?.kind === 'remove' && !result.hasImage && result.version > pending.version) pending = null;
    if (!result.hasImage) {
      say(pending ? unknown : 'You have no saved profile image.');
      return;
    }
    const displayed = drawnVersion === result.version || await draw(result.version, turn, signal);
    if (current(turn)) say(pending ? unknown : displayed ? 'Your saved image is shown.' : 'You have a saved image. Its preview is unavailable.');
  }

  listen(load, 'click', () => {
    if (!enabled(load)) return;
    return run('Checking your profile image…', async (turn, signal) => {
      if (pending?.kind === 'replace') {
        const result = await client.status(turn.profileId, pending.operationId, signal);
        if (changed(result, turn)) return;
        if (result.state !== 'committed' && !definiteFailure.has(result.state)) { say(unknown); return; }
        pending = null;
      }
      await loadCurrent(turn, signal);
    });
  });
  listen(file, 'change', controls);
  listen(confirm, 'change', controls);

  function mutate(kind) {
    const button = kind === 'replace' ? save : remove;
    if (!enabled(button) || !head || pending || flight) return;
    const image = kind === 'replace' ? file.files?.[0] : null;
    if (kind === 'replace' && (!image || !profileImageTypes.includes(image.type) || image.size < 12 || image.size > profileImageInputLimit)) {
      say('Choose a PNG, JPEG or WebP image up to 2 MB.');
      file.focus();
      return;
    }
    return run(kind === 'replace' ? 'Saving your profile image…' : 'Removing your profile image…', async (turn, signal) => {
      const operationId = makeOperationId();
      if (!imageId(operationId)) throw Error('profile_image_operation_unavailable');
      const { version } = head;
      pending = { kind, operationId, version };
      const result = kind === 'replace' ? await client.replace(turn.profileId, version, operationId, image, signal) :
        await client.remove(turn.profileId, version, operationId, signal);
      if (changed(result, turn)) return;
      if (result.state === 'committed') {
        pending = null;
        head = { version: result.version, hasImage: kind === 'replace' };
        file.value = '';
        confirm.checked = false;
        clearImage();
        if (kind === 'remove') { say('Image removed from your profile. Your profile details are still saved.'); return; }
        say('Image saved. Loading it for you…');
        const displayed = await draw(head.version, turn, signal);
        if (current(turn)) say(displayed ? 'Your saved image is shown.' : 'Image saved. Load it again to see it.');
      } else if (definiteFailure.has(result.state)) {
        pending = null;
        head = null;
        say('The image change was refused. Check your saved image before trying again.');
      } else say(unknown);
    });
  }

  listen(save, 'click', () => mutate('replace'));
  listen(remove, 'click', () => mutate('remove'));
  listen(cancel, 'click', () => {
    if (!flight) return;
    flight.controller.abort();
    flight = null;
    say(pending ? unknown : 'Image request stopped.');
    controls();
    load.focus();
  });

  return Object.freeze({ setProfile, dispose() {
    if (disposed) return;
    disposed = true;
    flight?.controller.abort();
    flight = null;
    profileId = head = pending = null;
    file.value = '';
    confirm.checked = false;
    clearImage();
    say('');
    root.hidden = true;
    for (const stop of listeners) stop();
  } });
}
