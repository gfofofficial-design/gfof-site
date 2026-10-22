# Alliance project artwork

Project Prep now includes an optional project logo or image picker. Visitors can choose a PNG, JPEG or WebP, preview the complete image without cropping, replace it or remove it. Square artwork is recommended for a prospective station.

This extends the existing local discussion worksheet. It does **not** create an upload inbox, store an attachment, submit an application, publish a partner or open public registration. The UI says that the image stays on the device and must be attached separately if the visitor chooses to share the text draft. The exported brief includes the selected filename, format and dimensions with that reminder; it contains neither image bytes nor an object URL. Public project names and file information are rendered as text.

## File handling

- One file, up to 2 MiB, with PNG/JPEG/WebP MIME type and matching signature.
- Parse bounded image headers and refuse dimensions outside 1–4096 pixels per side before handing the file to the browser image decoder. Malformed headers and unreadable images are refused.
- The browser must also decode the picture and report acceptable dimensions. Reading and decoding share an eight-second deadline with a visible retry/continue-without-image message.
- Replacement, removal, failure, timeout and disposal release object URLs and suppress obsolete asynchronous results. A canceled native picker leaves the current selection alone.
- Any artwork change invalidates the previous text export and copy feedback. Clearing the worksheet also removes the preview. Preparing while a file is being checked asks the visitor to wait or remove it.
- Choosing an image grants no publication approval or confirmation of branding rights. Visitors are asked to choose artwork they have permission to use. File metadata is not removed or modified; the original remains on their device.

## Page policy

Only the Alliance page's image policy changes, from `img-src 'self'` to `img-src 'self' blob:`, in both the HTML meta policy and the existing `/alliance*` Netlify response policy. Local object URLs are needed for previews. `connect-src 'none'`, `form-action 'none'`, self-only scripts/styles, blocked frames/objects/workers, no-referrer, noindex and frame denial remain. No external image host, data URI, new package, cloud binding, environment variable, paid API or storage service is introduced.

References: [MDN File API examples](https://developer.mozilla.org/en-US/docs/Web/API/File_API/Using_files_from_web_applications), [file input behavior](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/file), [object URL cleanup](https://developer.mozilla.org/en-US/docs/Web/API/URL/revokeObjectURL_static). File-picker `accept` is a user-interface hint; type, signature, header and browser-decode checks are performed separately here. These local checks are not a substitute for server-side verification if a real submission service is added later.

## Verification

The Alliance/League/console suite passes 80 tests, including ten new artwork cases for refusal, image headers, text-only export, filenames, replacement/removal races, timeout cleanup, decode failure, draft invalidation, clearing and no network/storage operations. Real desktop and responsive-browser results are recorded in the accompanying pull request after the preview is ready.

Partner publication, enrollment, account sign-in, verified competition counts, Watchtower and financial operations retain their existing release gates.
