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
    const glyphs = typeof Intl.Segmenter === 'function'
      ? Array.from(new Intl.Segmenter(undefined, {granularity: 'grapheme'}).segment(word), part => part.segment)
      : Array.from(word);
    for (const glyph of glyphs) {
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

export function mountMoonEditor(document) {
  const art = document.getElementById('moon-art');
  const canvas = document.getElementById('moon-preview');
  const context = canvas.getContext('2d');
  const caption = document.getElementById('moon-caption');
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
    const text = caption.value.trim();
    const canDraw = supportsExport && art.complete && art.naturalWidth > 0;
    canvas.hidden = !text || !canDraw;
    art.hidden = !canvas.hidden;
    if (addressOption) addressOption.hidden = canvas.hidden;
    if (!text) return;
    if (!canDraw) {
      if (!supportsExport || art.complete) {
        status.textContent = 'Image export is unavailable. You can share your caption as text.';
      }
      return;
    }

    const width = 1200;
    const artHeight = Math.round(width * art.naturalHeight / art.naturalWidth);
    const font = 'bold 54px system-ui, sans-serif';
    context.font = font;
    const lines = captionLines(text, value => context.measureText(value).width, width - 96);
    const lineHeight = 68;
    const address = addressChoice?.checked ? addressChoice.value : '';
    canvas.width = width;
    canvas.height = artHeight + lines.length * lineHeight + 56 + (address ? 48 : 0);
    context.drawImage(art, 0, 0, width, artHeight);
    context.fillStyle = '#f5f1e6';
    context.fillRect(0, artHeight, width, canvas.height - artHeight);
    context.fillStyle = '#101827';
    context.font = font;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.direction = document.defaultView.getComputedStyle(caption).direction;
    lines.forEach((line, index) => context.fillText(line, width / 2, artHeight + 28 + (index + .5) * lineHeight));
    if (address) {
      context.direction = 'ltr';
      context.font = '600 38px system-ui, sans-serif';
      context.fillStyle = '#405465';
      context.fillText(address, width / 2, canvas.height - 32);
    }
    canvas.setAttribute('aria-label', art.alt + ' Caption: ' + text + (address ? ' ' + address : ''));

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
    const text = caption.value.trim();
    share.hidden = !text;
    if (!text) share.open = false;
    shareText.value = text ? text + '\n\nThe Wrong Moon · Federation Alliance\n' + publicLink : '';
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
      if (attempt !== copyAttempt || !share.open) return;
      copyStatus.textContent = 'Select the text above and use your device’s Copy command.';
      if (document.activeElement === copyButton) {
        shareText.focus();
        shareText.select();
      }
    }
  });
  controls.hidden = false;
  caption.addEventListener('input', updateCaption);
  addressChoice?.addEventListener('change', render);
  art.addEventListener('load', render, {once: true});
  art.addEventListener('error', render, {once: true});
  updateCaption();
}

if (typeof document !== 'undefined') mountMoonEditor(document);
