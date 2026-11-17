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
  const controls = document.getElementById('moon-controls');
  const save = document.getElementById('moon-save');
  const status = document.getElementById('moon-status');
  if (!context || typeof canvas.toBlob !== 'function') {
    status.textContent = 'To add a caption, download the blank image and open it in your favorite meme editor.';
    return;
  }
  let fileUrl;
  let revision = 0;

  function render() {
    const current = ++revision;
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    fileUrl = undefined;
    save.removeAttribute('href');
    save.setAttribute('aria-disabled', 'true');
    status.textContent = '';
    const text = caption.value.trim();
    canvas.hidden = !text;
    art.hidden = Boolean(text);
    if (!text) return;

    const width = 1200;
    const artHeight = Math.round(width * art.naturalHeight / art.naturalWidth);
    const font = 'bold 54px system-ui, sans-serif';
    context.font = font;
    const lines = captionLines(text, value => context.measureText(value).width, width - 96);
    const lineHeight = 68;
    canvas.width = width;
    canvas.height = artHeight + lines.length * lineHeight + 56;
    context.drawImage(art, 0, 0, width, artHeight);
    context.fillStyle = '#f5f1e6';
    context.fillRect(0, artHeight, width, canvas.height - artHeight);
    context.fillStyle = '#101827';
    context.font = font;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.direction = document.defaultView.getComputedStyle(caption).direction;
    lines.forEach((line, index) => context.fillText(line, width / 2, artHeight + 28 + (index + .5) * lineHeight));
    canvas.setAttribute('aria-label', art.alt + ' Caption: ' + text);

    // Encoding may finish out of order when a visitor types quickly.
    canvas.toBlob(blob => {
      if (current !== revision) return;
      if (!blob) {
        status.textContent = 'The captioned image could not be saved. You can still download the blank image.';
        return;
      }
      fileUrl = URL.createObjectURL(blob);
      save.href = fileUrl;
      save.removeAttribute('aria-disabled');
    }, 'image/jpeg', .9);
  }

  function ready() {
    controls.hidden = false;
    caption.addEventListener('input', render);
    render();
  }
  if (art.complete && art.naturalWidth > 0) ready();
  else art.addEventListener('load', ready, {once: true});
}

if (typeof document !== 'undefined') mountMoonEditor(document);
