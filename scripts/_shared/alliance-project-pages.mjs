import {mkdir, writeFile} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {pathToFileURL} from 'node:url';

const federation = 'https://galacticfederation.co';
const requestListing = '/alliance?intent=project-profile#project-kit';
const entity = {'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'};
const html = value => value.replace(/[&<>"']/g, character => entity[character]);

function page({title, description, url, assets, navigation, mainId, skip, content}) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="referrer" content="no-referrer">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; script-src-attr 'none'; style-src 'self'; img-src 'self'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">
  <title>${html(title)}</title>
  <meta name="description" content="${html(description)}">
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Federation Alliance">
  <meta property="og:title" content="${html(title)}">
  <meta property="og:description" content="${html(description)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${federation}/logo-circle.png">
  <meta name="twitter:card" content="summary">
  <link rel="stylesheet" href="/assets/federation/fed-tokens.css">
  <link rel="stylesheet" href="/assets/federation/fed-tool-workbench.css">
  <link rel="stylesheet" href="/assets/federation/fed-project-profile.css">
  ${assets}
</head>
<body class="project-page">
  <a class="project-skip" href="#${mainId}">Skip to ${skip}</a>
  <header class="project-header">
    <a href="/alliance"><img src="/logo-circle.png" width="40" height="40" alt="">Federation Alliance</a>
    ${navigation}
  </header>
  <main id="${mainId}" tabindex="-1">
${content}
  </main>
</body>
</html>
`;
}

function profilePage(station, links) {
  const name = html(station.name);
  const about = html(station.summary);
  const url = federation + links.profile;
  const host = station.relationship === 'host';
  const social = links.socials.map(link => {
    const url = new URL(link.href);
    const channel = url.hostname + (url.pathname === '/' ? '' : url.pathname);
    const detail = channel === link.label ? '' : `<span>${html(channel)}</span>`;
    return `<li><a href="${html(link.href)}" rel="noopener noreferrer"><strong>${html(link.label)}</strong>${detail}</a></li>`;
  }).join('\n');
  const review = host ? 'Federation host' : 'Published partner station';
  const content = `    <article class="fed-workbench project-hero" aria-labelledby="project-title">
      <div class="project-identity">
        ${host ? '<img src="/logo-circle.png" width="72" height="72" alt="">' : `<span class="project-badge" aria-hidden="true">${html(station.badge)}</span>`}
        <div><p class="project-eyebrow">FEDERATION ALLIANCE</p><h1 id="project-title">${name}</h1></div>
      </div>
      <p class="fed-workbench-tag">${review}</p>
      <p class="project-lede">${about}</p>
      <div class="project-hero-actions">
        <a class="project-primary" href="${html(links.website)}" rel="noopener noreferrer">Official website</a>
        <a class="project-secondary" href="#project-sharing-title">Share profile</a>
      </div>
    </article>

    <div class="project-profile-grid">
      <section class="fed-workbench project-panel" aria-labelledby="project-links-title">
        <h2 id="project-links-title">Socials and community</h2>
        ${social ? `<ul class="project-socials">${social}</ul>` : '<p>Visit the official website for community links.</p>'}
      </section>
      <section class="fed-workbench project-panel" aria-labelledby="project-proof-title">
        <h2 id="project-proof-title">Token and sources</h2>
        <p class="project-mint-label">Solana · $${html(station.symbol)}</p>
        <code data-copy-mint>${html(station.mint)}</code>
        <ul class="project-source-links">
          <li><a href="${html(links.explorer)}" rel="noopener noreferrer">View mint on Solscan</a></li>
          <li><a href="${html(links.lens)}" rel="noopener noreferrer">Inspect in Dossier Lens</a></li>
          <li><a href="${html(links.evidence)}" rel="noopener noreferrer">${host ? 'Read published lock records' : 'Read project-published evidence'}</a></li>
        </ul>
        ${host ? '' : `<p class="project-review">Listing reviewed <time datetime="${html(station.review.date)}">${html(station.review.date)}</time></p>`}
      </section>
    </div>

    <section class="fed-workbench project-panel project-sharing" aria-labelledby="project-sharing-title">
      <h2 id="project-sharing-title" tabindex="-1">Share this profile</h2>
      <label for="project-permalink">Public profile link</label>
      <div class="project-copy-row"><input id="project-permalink" type="url" readonly value="${url}"><button id="project-copy-link" type="button" hidden>Copy link</button></div>
      <p id="project-share-status" role="status" aria-live="polite"></p>
      <a href="/alliance?profile=${station.id}#project-kit">Suggest an update to this profile</a>
    </section>
`;
  return page({
    title:`${station.name} · Federation Alliance`, description:station.summary, url, content,
    mainId:'profile-main', skip:'project profile', navigation:'<a href="/projects/">Browse projects</a>',
    assets:`<link rel="stylesheet" href="/assets/federation/fed-copy-mint.css">
  <script defer src="/assets/federation/fed-copy-mint.js"></script>
  <script defer src="/assets/federation/fed-project-profile.js"></script>`,
  });
}

function directoryCard({station, links}) {
  const name = html(station.name);
  const host = station.relationship === 'host';
  const platforms = [...new Set(links.socials.map(link => link.label))];
  const other = platforms.length - 3;
  const channels = platforms.slice(0, 3).join(' · ') + (other > 0 ? ` +${other} more` : '');
  return `<li data-project-id="${html(station.id)}">
  <article class="fed-workbench project-panel directory-card">
    <div class="project-identity">
      ${host ? '<img src="/logo-circle.png" width="48" height="48" alt="">' : `<span class="project-badge" aria-hidden="true">${html(station.badge)}</span>`}
      <div><p class="project-eyebrow">${host ? 'Federation host' : 'Alliance partner'}</p><h3>${name}</h3></div>
    </div>
    <p class="directory-description">${html(station.summary)}</p>
    <dl class="directory-facts">
      <div><dt>Token</dt><dd>$${html(station.symbol)} · Solana</dd></div>
      ${channels ? `<div><dt>Community</dt><dd>${html(channels)}</dd></div>` : ''}
    </dl>
    <a class="project-secondary" href="${html(links.profile)}" aria-label="View profile for ${name}">View profile</a>
  </article>
</li>`;
}

function directoryPage(catalog) {
  const description = 'Browse official project profiles, community channels, and token evidence from the Federation Alliance.';
  const searchable = catalog.length > 1;
  const content = `    <section class="fed-workbench project-hero" aria-labelledby="directory-title">
      <p class="project-eyebrow">FEDERATION ALLIANCE</p>
      <h1 id="directory-title">Project directory</h1>
      <p class="project-lede">Find a project’s official channels, token sources, and public profile.</p>
      <div class="project-hero-actions">
        <a class="project-primary" href="${requestListing}">Add your project</a>
        <a class="project-secondary" href="/alliance#station-explorer">Open Station Explorer</a>
      </div>
    </section>
    <section class="project-directory" aria-labelledby="directory-list-title">
      <h2 id="directory-list-title">Published projects</h2>
      <p class="directory-policy">${searchable ? 'Alliance reviews each partner’s public details with their team before listing.' : 'The Federation is the first listing. Partner projects appear after Alliance review.'}</p>
      ${searchable ? `
      <div id="project-filter" class="directory-filter" role="search" aria-labelledby="project-filter-label" hidden>
        <label id="project-filter-label" for="project-search">Find by name or token symbol</label>
        <div class="directory-filter-row"><input id="project-search" type="search" maxlength="60" autocomplete="off" spellcheck="false" autocapitalize="none" aria-controls="project-list"><button id="project-search-clear" class="project-secondary" type="button">Clear search</button></div>
      </div>
      <p id="project-search-status" class="directory-status" role="status" aria-live="polite" aria-atomic="true"></p>` : ''}
      <ul id="project-list" class="project-directory-list">${catalog.map(directoryCard).join('\n')}</ul>
    </section>`;
  return page({
    title:'Project Directory · Federation Alliance', description, url:federation + '/projects/', content,
    mainId:'directory-main', skip:'project directory', navigation:'<a href="/command-deck#tool-directory">Command Deck</a>',
    assets:`<link rel="stylesheet" href="/assets/federation/fed-project-directory.css">${searchable ? `
  <script type="module" src="/assets/federation/fed-project-directory.mjs"></script>` : ''}`,
  });
}

export async function stageAllianceProjectPages(stage) {
  const registry = await import(pathToFileURL(join(stage, 'assets/federation/fed-alliance-registry.mjs')));
  const stations = registry.publishedStations();
  if (stations.length !== registry.PARTNER_STATIONS.length + 1) {
    throw Error('The public project registry contains an invalid, unapproved, or duplicate station.');
  }
  const catalog = stations.map(station => ({station, links:registry.stationLinks(station)}));
  const directory = 'projects/index.html';
  await mkdir(join(stage, 'projects'), {recursive:true});
  await writeFile(join(stage, directory), directoryPage(catalog), {flag:'wx'});
  const staged = [directory];
  for (const {station, links} of catalog) {
    const path = links.profile.slice(1) + 'index.html';
    const destination = join(stage, path);
    await mkdir(dirname(destination), {recursive:true});
    await writeFile(destination, profilePage(station, links), {flag:'wx'});
    staged.push(path);
  }
  return staged;
}
