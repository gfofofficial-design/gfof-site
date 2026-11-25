import {matchingStations, publishedStations} from './fed-alliance-registry.mjs';

const filter = document.getElementById('project-filter');
const field = document.getElementById('project-search');
const clear = document.getElementById('project-search-clear');
const status = document.getElementById('project-search-status');
const cards = [...document.querySelectorAll('#project-list [data-project-id]')];
const stations = publishedStations();

function filterProjects() {
  const query = field.value.trim().replace(/^\$/, '').trim();
  const matches = new Set(matchingStations(query, stations).map(station => station.id));
  let shown = 0;
  for (const card of cards) {
    card.hidden = !matches.has(card.dataset.projectId);
    if (!card.hidden) shown++;
  }
  status.textContent = !query ? '' : shown
    ? `${shown} of ${cards.length} projects shown.`
    : 'No projects match. Try another name or token symbol.';
  status.toggleAttribute('data-empty', shown === 0);
}

filterProjects();
field.addEventListener('input', filterProjects);
clear.addEventListener('click', () => {
  field.value = '';
  filterProjects();
  field.focus();
});
filter.hidden = false;
