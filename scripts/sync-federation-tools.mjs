import {readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {renderToolSlot} from './_shared/federation-tools.mjs';

const pages = Object.freeze({'command-deck.html': ['deck', 'deck-account'], 'alliance.html': ['alliance', 'alliance-account']});

export async function syncToolPages(root, {write = false} = {}) {
  const prepared = [];
  for (const [path, slots] of Object.entries(pages)) {
    const file = resolve(root, path), original = await readFile(file, 'utf8');
    let next = original;
    for (const slot of slots) {
      const start = `<!-- federation-tools:${slot} -->`, end = `<!-- /federation-tools:${slot} -->`;
      const from = next.indexOf(start), to = next.indexOf(end);
      if (from < 0 || to < from || next.indexOf(start, from + start.length) !== -1 || next.indexOf(end, to + end.length) !== -1) {
        throw Error(`Review Federation tool markers in ${path}`);
      }
      next = next.slice(0, from + start.length) + '\n' + renderToolSlot(slot) + '\n' + next.slice(to);
    }
    prepared.push({path, file, original, next});
  }
  const changed = prepared.filter(p => p.original !== p.next);
  if (!write && changed.length) throw Error('Federation tool copy drift: ' + changed.map(p => p.path).join(', '));
  if (write) for (const p of changed) await writeFile(p.file, p.next);
  return {checked: prepared.map(p => p.path), updated: write ? changed.map(p => p.path) : []};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3 || !['--check', '--write'].includes(process.argv[2])) {
    console.error('Use --check to verify public tool copy or --write to update its marked source regions.');
    process.exitCode = 1;
  } else {
    try {
      const result = await syncToolPages(fileURLToPath(new URL('..', import.meta.url)), {write: process.argv[2] === '--write'});
      console.log(`Federation tool copy checked in ${result.checked.length} pages; ${result.updated.length} updated.`);
    } catch (error) {
      console.error(error.message); process.exitCode = 1;
    }
  }
}
