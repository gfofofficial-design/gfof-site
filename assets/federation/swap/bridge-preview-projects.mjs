import {GFOF} from './token-registry.mjs';

// Each entry needs a reviewed station identity and a saved route fixture.
const projects = new Map([['gfof', {solanaMint: GFOF.mint, pair: 'cross'}]]);

export function stationBridgePreview(station) {
  const project = projects.get(station?.id);
  if (!project || project.solanaMint !== station.mint) return null;
  return '/bridge-preview.html?project=' + encodeURIComponent(station.id);
}

export function previewProjectPair(search) {
  const slugs = new URLSearchParams(search).getAll('project');
  return slugs.length === 1 ? projects.get(slugs[0])?.pair ?? null : null;
}
