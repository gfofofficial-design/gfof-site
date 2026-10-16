import {HOST_STATION, publishedStations, stationChoice, stationLinks, matchingStations} from './fed-alliance-registry.mjs';

export function mountAlliance(document, location, history, stations = publishedStations()) {
  const byId = id => document.getElementById(id);
  const picker = byId('station-picker');
  const search = byId('station-search');
  const directory = byId('station-directory');
  const notice = byId('station-message');
  const count = stations.filter(station => station.relationship === 'partner').length;
  byId('partner-count').textContent = String(count);
  byId('partner-state').textContent = count ? 'Published partner stations' : 'Partner stations await agreement';
  const options = stations.map(station => {
    const option = document.createElement('option');
    option.value = station.id;
    option.textContent = station.name + (station.relationship === 'host' ? ' · host' : ' · partner');
    return option;
  });
  picker.replaceChildren(...options);

  function select(station, updateUrl = false) {
    const links = stationLinks(station);
    picker.value = station.id;
    byId('station-name').textContent = station.name;
    byId('station-symbol').textContent = '$' + station.symbol;
    byId('station-badge').textContent = station.badge;
    byId('station-relationship').textContent = station.relationship === 'host' ? 'FEDERATION HOST' : 'COMMUNITY PARTNER';
    byId('station-summary').textContent = station.summary;
    byId('station-mint').textContent = station.mint;
    byId('station-evidence-label').textContent = station.relationship === 'host' ? 'Published lock disclosures' : 'Project-published evidence';
    byId('station-evidence-note').textContent = station.relationship === 'host'
      ? 'Review the dated GFOF lock snapshot and its sources on Treasury.'
      : 'Review this project’s published source. A linked disclosure is not independently established by its inclusion here.';
    for (const name of ['lens','explorer','website','evidence']) byId(name === 'explorer' ? 'station-explorer-link' : 'station-' + name).href = links[name];
    const website = byId('station-website');
    if (station.relationship === 'host') website.removeAttribute('target');
    else website.setAttribute('target','_blank');
    for (const card of directory.children) card.setAttribute('aria-pressed',String(card.dataset.station === station.id));
    if (updateUrl) {
      // Preserve only the reviewed station slug, with no wallet/account data or arbitrary query parameters.
      try { history.replaceState(null, '', '/alliance?station=' + encodeURIComponent(station.id) + '#station-explorer'); } catch {}
    }
  }

  function renderDirectory() {
    const matches = matchingStations(search.value, stations);
    const cards = matches.map(station => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'station-card';
      card.dataset.station = station.id;
      card.setAttribute('aria-pressed',String(picker.value === station.id));
      const badge = document.createElement('span'); badge.className = 'station-mark'; badge.textContent = station.badge;
      const title = document.createElement('strong'); title.textContent = station.name;
      const scope = document.createElement('span'); scope.className = 'station-meta';
      scope.textContent = '$' + station.symbol + (station.relationship === 'host' ? ' · Host station' : ' · Community partner');
      card.append(badge, title, scope);
      card.addEventListener('click', () => {
        select(station, true);
        notice.textContent = station.name + ' selected. Shared tools are ready below.';
        byId('station-detail').focus();
      });
      return card;
    });
    directory.replaceChildren(...cards);
    byId('station-filter-status').textContent = matches.length
      ? matches.length + (matches.length === 1 ? ' published station matches.' : ' published stations match.')
      : 'No published station matches. Clear your search to explore the host station.';
  }

  let id;
  try { id = new URL(location.href).searchParams.get('station'); } catch {}
  const initial = stationChoice(id, stations);
  select(initial.station);
  renderDirectory();
  if (initial.unavailable) notice.textContent = 'That station is not published. Showing the Federation host station.';
  else notice.textContent = 'Choose a station, then open a tool. Selecting a community does not establish membership or wallet ownership.';
  picker.addEventListener('change', () => {
    const choice = stationChoice(picker.value, stations);
    select(choice.station, true);
    renderDirectory();
    notice.textContent = choice.unavailable ? 'That station is not published. Showing the Federation host station.' : choice.station.name + ' selected. Shared tools are ready below.';
  });
  search.addEventListener('input', renderDirectory);
  byId('station-search-clear').addEventListener('click', () => {
    search.value = ''; renderDirectory(); search.focus();
  });
  byId('station-controls').hidden = false;
  byId('station-empty-note').hidden = count > 0;
}

if (typeof document !== 'undefined') {
  try { mountAlliance(document, location, history); }
  catch {
    const message = document.getElementById('station-message');
    if (message) message.textContent = 'The station selector is unavailable. The Federation host links below remain available.';
  }
}
