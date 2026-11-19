const captionLimit = 90;
const segmenter = typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter(undefined, {granularity: 'grapheme'})
  : null;

function* captionCharacters(value) {
  if (segmenter) {
    for (const part of segmenter.segment(value)) yield part.segment;
  } else {
    yield* value;
  }
}

// Measure on the export canvas so the live preview and JPEG wrap identically.
export function captionLines(text, measure, limit) {
  const lines = [];
  let line = '';
  for (const word of text.trim().split(/\s+/u)) {
    const candidate = line ? line + ' ' + word : word;
    if (measure(candidate) <= limit) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = '';
    for (const glyph of captionCharacters(word)) {
      if (line && measure(line + glyph) > limit) {
        lines.push(line);
        line = '';
      }
      line += glyph;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function checkMoonImage(file) {
  if (!file || file.size === 0 || file.size > 10 * 1024 * 1024) {
    throw new Error('Choose an image up to 10 MB.');
  }
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value);
  const webp = String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
    && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  if (!(jpeg || png || webp)) throw new Error('Choose a JPG, PNG or WebP image.');
}

export function mountMoonEditor(document) {
  const art = document.getElementById('moon-art');
  const canvas = document.getElementById('moon-preview');
  const context = canvas.getContext('2d');
  const caption = document.getElementById('moon-caption');
  const countLabel = document.getElementById('moon-caption-count') ?? document.getElementById('caption-help');
  const limitNote = document.getElementById('moon-limit-note');
  const addressOption = document.getElementById('moon-address-option');
  const addressChoice = document.getElementById('moon-address');
  const controls = document.getElementById('moon-controls');
  const save = document.getElementById('moon-save');
  const shareImage = document.getElementById('moon-share-image');
  const status = document.getElementById('moon-status');
  const share = document.getElementById('moon-share');
  const shareText = document.getElementById('moon-share-text');
  const copyButton = document.getElementById('moon-copy');
  const copyStatus = document.getElementById('moon-copy-status');
  const imageControls = document.getElementById('moon-image-controls');
  const imagePicker = document.getElementById('moon-image');
  const imageReset = document.getElementById('moon-image-reset');
  const imageStatus = document.getElementById('moon-image-status');
  const publicLink = document.querySelector('link[rel="canonical"]').href;
  const {navigator, File, ClipboardItem} = document.defaultView;
  const canCopyImage = typeof ClipboardItem === 'function' && typeof navigator.clipboard?.write === 'function';
  const supportsExport = Boolean(context) && typeof canvas.toBlob === 'function';
  let copyAttempt = 0;
  let fileUrl;
  let shareData;
  let imageActionPending = false;
  let preferCopy = false;
  let revision = 0;
  let composing = false;
  let captionValid = true;
  let exportCaption = '';
  let sourceImage = art;
  let imageRevision = 0;

  function fileShareData(blob) {
    if (preferCopy || blob.type !== 'image/jpeg' || typeof File !== 'function' ||
        typeof navigator.canShare !== 'function' || typeof navigator.share !== 'function') return;
    try {
      const data = {files: [new File([blob], save.download, {type: blob.type})]};
      if (navigator.canShare(data)) return data;
    } catch {
      // A browser can deny file sharing while still supporting downloads.
    }
  }

  function updateImageAction() {
    if (!shareImage) return;
    shareImage.hidden = !fileUrl || (!shareData && !canCopyImage);
    shareImage.textContent = shareData ? 'Share image' : 'Copy image';
  }

  function copyImage() {
    // Start the clipboard write during the click. Encode the canvas only when someone copies it.
    const png = new Promise((resolve, reject) => canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('PNG export failed'));
    }, 'image/png'));
    const item = new ClipboardItem({'image/png': png});
    return navigator.clipboard.write([item]);
  }

  function render() {
    const current = ++revision;
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    fileUrl = undefined;
    shareData = undefined;
    updateImageAction();
    save.removeAttribute('href');
    save.setAttribute('aria-disabled', 'true');
    status.textContent = '';
    const text = exportCaption;
    const customImage = sourceImage !== art;
    const hasMeme = Boolean(text) || (customImage && captionValid && !composing);
    const canDraw = supportsExport && sourceImage.complete && sourceImage.naturalWidth > 0;
    canvas.hidden = !hasMeme || !canDraw;
    art.hidden = !canvas.hidden;
    if (addressOption) addressOption.hidden = canvas.hidden;
    if (!hasMeme) {
      canvas.removeAttribute('aria-label');
      return;
    }
    if (!canDraw) {
      if (!supportsExport || art.complete) {
        status.textContent = 'Image export is unavailable. You can share your caption as text.';
      }
      return;
    }

    const ratio = sourceImage.naturalWidth / sourceImage.naturalHeight;
    const width = customImage ? Math.max(1, Math.round(Math.min(1200, 2400 * ratio))) : 1200;
    const artHeight = Math.max(1, Math.round(width / ratio));
    const scale = width / 1200;
    const fontSize = Math.max(1, Math.round(54 * width / 1200));
    const font = 'bold ' + fontSize + 'px system-ui, sans-serif';
    context.font = font;
    const lines = captionLines(text, value => context.measureText(value).width, width * .92);
    const lineHeight = fontSize * 68 / 54;
    const address = addressChoice?.checked ? addressChoice.value : '';
    canvas.width = width;
    canvas.height = artHeight + lines.length * lineHeight + (text || address ? 56 * scale : 0) + (address ? 48 * scale : 0);
    context.drawImage(sourceImage, 0, 0, width, artHeight);
    context.fillStyle = '#f5f1e6';
    context.fillRect(0, artHeight, width, canvas.height - artHeight);
    context.fillStyle = '#101827';
    context.font = font;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.direction = document.defaultView.getComputedStyle(caption).direction;
    lines.forEach((line, index) => context.fillText(line, width / 2, artHeight + 28 * scale + (index + .5) * lineHeight));
    if (address) {
      context.direction = 'ltr';
      context.font = '600 ' + 38 * scale + 'px system-ui, sans-serif';
      context.fillStyle = '#405465';
      context.fillText(address, width / 2, canvas.height - 32 * scale);
    }
    canvas.setAttribute('aria-label', sourceImage.alt + (text ? ' Caption: ' + text : '') + (address ? ' ' + address : ''));

    // Encoding may finish out of order when a visitor types quickly.
    canvas.toBlob(blob => {
      if (current !== revision) return;
      if (!blob) {
        status.textContent = 'The captioned image could not be saved. You can share your caption as text.';
        return;
      }
      fileUrl = URL.createObjectURL(blob);
      save.href = fileUrl;
      save.removeAttribute('aria-disabled');
      if (shareImage) shareData = fileShareData(blob);
      updateImageAction();
    }, 'image/jpeg', .9);
  }

  function updateCaption() {
    copyAttempt++;
    copyStatus.textContent = '';
    exportCaption = '';
    captionValid = false;
    if (!composing) {
      let count = 0;
      for (const _ of captionCharacters(caption.value)) {
        if (++count > captionLimit) break;
      }
      const over = count > captionLimit;
      captionValid = !over;
      let label = (over ? 'Over ' : count + ' of ') + captionLimit + ' characters.';
      if (!segmenter) label += ' This browser counts some emoji in parts.';
      const note = over ? 'Shorten your caption to save or share.' : 'You choose what to share.';
      countLabel.textContent = limitNote ? label : label + ' ' + note;
      if (limitNote && limitNote.textContent !== note) limitNote.textContent = note;
      if (over) {
        caption.setAttribute('aria-invalid', 'true');
      } else {
        caption.removeAttribute('aria-invalid');
        exportCaption = caption.value.trim();
      }
    }
    share.hidden = !exportCaption;
    copyButton.hidden = !exportCaption;
    if (!exportCaption) share.open = false;
    shareText.value = exportCaption ? exportCaption + '\n\nThe Wrong Moon · Federation Alliance\n' + publicLink : '';
    render();
  }
  shareImage?.addEventListener('click', async () => {
    if (!fileUrl || imageActionPending || (!shareData && !canCopyImage)) return;
    const current = revision;
    const data = shareData;
    imageActionPending = true;
    shareImage.setAttribute('aria-disabled', 'true');
    status.textContent = '';
    try {
      if (data) await navigator.share(data);
      else await copyImage();
      if (current === revision) status.textContent = data ? 'Sharing options opened.' : 'Image copied. Paste it into your chat.';
    } catch (error) {
      if (current !== revision) return;
      if (data && error?.name === 'AbortError') {
        status.textContent = 'Sharing canceled.';
      } else if (data && canCopyImage) {
        preferCopy = true;
        shareData = undefined;
        updateImageAction();
        status.textContent = 'Sharing is unavailable. Choose Copy image, then paste it into your chat.';
      } else {
        status.textContent = 'Use Save my meme to download your picture, or Share as text for the caption.';
      }
    } finally {
      imageActionPending = false;
      shareImage.removeAttribute('aria-disabled');
    }
  });
  copyButton.addEventListener('click', async () => {
    if (!shareText.value) return;
    const attempt = ++copyAttempt;
    try {
      await document.defaultView.navigator.clipboard.writeText(shareText.value);
      if (attempt === copyAttempt) copyStatus.textContent = 'Copied. Paste it wherever you share with your crew.';
    } catch {
      if (attempt !== copyAttempt) return;
      copyStatus.textContent = 'Open Share as text and use your device’s Copy command.';
      if (document.activeElement === copyButton) {
        share.open = true;
        shareText.focus();
        shareText.select();
      }
    }
  });
  if (imageControls && imagePicker && imageReset && imageStatus && supportsExport && document.defaultView.Image) {
    imageControls.hidden = false;
    imagePicker.addEventListener('change', async () => {
      const file = imagePicker.files?.[0];
      if (!file) return;
      const request = ++imageRevision;
      imageStatus.textContent = 'Opening your image…';
      let objectUrl;
      try {
        await checkMoonImage(file);
        if (request !== imageRevision) return;
        const image = new document.defaultView.Image();
        objectUrl = URL.createObjectURL(file);
        await new Promise((resolve, reject) => {
          image.onload = resolve;
          image.onerror = () => reject(new Error('This image could not be opened. Try a different JPG, PNG or WebP.'));
          image.src = objectUrl;
        });
        if (request !== imageRevision) return;
        if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth > 12000
          || image.naturalHeight > 12000 || image.naturalWidth * image.naturalHeight > 24000000) {
          throw new Error('Choose an image up to 24 megapixels and 12,000 pixels on either side.');
        }
        image.alt = 'Your selected meme image.';
        sourceImage = image;
        imageReset.hidden = false;
        imageStatus.textContent = 'Your image is ready. Add a caption or save it as it is.';
        preferCopy = false;
        render();
      } catch (error) {
        if (request === imageRevision) imageStatus.textContent = error.message;
      } finally {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        if (request === imageRevision) imagePicker.value = '';
      }
    });
    imageReset.addEventListener('click', () => {
      ++imageRevision;
      sourceImage = art;
      imagePicker.value = '';
      imageReset.hidden = true;
      imageStatus.textContent = 'The Wrong Moon image is selected.';
      render();
      imagePicker.focus();
    });
  }
  // Replace the native UTF-16 limit only once the guest editor handles complete characters.
  caption.removeAttribute('maxlength');
  caption.addEventListener('input', () => {
    if (!composing) updateCaption();
  });
  caption.addEventListener('compositionstart', () => {
    composing = true;
    updateCaption();
  });
  caption.addEventListener('compositionend', () => {
    composing = false;
    updateCaption();
  });
  addressChoice?.addEventListener('change', render);
  art.addEventListener('load', render, {once: true});
  art.addEventListener('error', render, {once: true});
  updateCaption();
  controls.hidden = false;
}

if (typeof document !== 'undefined') mountMoonEditor(document);
