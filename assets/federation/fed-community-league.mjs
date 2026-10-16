import {publishedStations} from './fed-alliance-registry.mjs';
import {METRICS, metricChoice, readLeagueSnapshot, rankLeagueRows, exampleLeague} from './fed-community-league-core.mjs';
import {LEAGUE_SNAPSHOT} from './fed-community-league-data.mjs';

export const LEAGUE_LINK='https://galacticfederation.co/alliance#community-league';
const format=value => value === null ? '—' : new Intl.NumberFormat('en-US').format(value);
export function mountCommunityLeague(document, {stations=publishedStations(),snapshot=LEAGUE_SNAPSHOT,now=Date.now(),copy=link=>globalThis.navigator.clipboard.writeText(link)} = {}) {
  const byId=id=>document.getElementById(id), root=byId('community-league');
  if(!root) return;
  const released=readLeagueSnapshot(snapshot,stations,now);
  let example=false, copyAttempt=0;
  const metric=byId('league-metric'), toggle=byId('league-example');
  function render() {
    const model=example ? exampleLeague() : released;
    const choice=metricChoice(metric.value); metric.value=choice;
    const available=model.kind === 'published' || example;
    root.dataset.kind=model.kind;
    byId('league-mode').textContent=example ? 'EXAMPLE ONLY · FICTIONAL COUNTS' : model.kind === 'published' ? 'DATED AGGREGATE STANDINGS' : model.kind === 'prelaunch' ? 'PRELAUNCH · ENROLLMENT CLOSED' : 'STANDINGS UNAVAILABLE';
    byId('league-season').textContent=model.title;
    byId('league-asof').textContent=model.asOfUtc ? 'Snapshot: '+model.asOfUtc.replace('T',' ').replace('.000Z',' UTC')+(model.stale ? ' · Older than 48 hours; not a current count.' : ' · Dated totals, not a live feed.') : example ? 'Fictional teams and numbers. This does not enroll anyone.' : 'Season dates are not announced. No member counts are being collected.';
    byId('league-caption').textContent=example ? 'Example standings only · no real members or partner communities' : available ? 'Published community aggregates · ranks use '+METRICS[choice].label.toLowerCase() : 'Published station roster · no ranks or measured member totals yet';
    byId('league-description').textContent=METRICS[choice].description;
    byId('league-total-note').textContent=example ? 'Illustrative totals only' : available ? 'Totals in this dated publication' : 'No measured totals yet';
    byId('league-status').textContent=example ? 'Example mode. Change the ranking metric to explore the board; return to launch status for the actual project roster.' : available ? 'Ranks are based on the selected metric. Equal positive scores share a place; zero is unranked.' : model.kind === 'prelaunch' ? 'The GFOF host is listed, but no competition has started. Partner stations require agreement; eligible account enrollment is not open.' : 'The standings file could not be validated. No score or rank is shown.';
    for(const key of Object.keys(METRICS)) {
      byId('league-total-'+key).textContent=available ? format(model.rows.reduce((sum,row)=>sum+row[key],0)) : '—';
    }
    const rows=rankLeagueRows(model.rows,choice), leader=Math.max(1,...rows.map(row=>row[choice]||0));
    const elements=rows.map(row=>{
      const tr=document.createElement('tr');
      const rank=document.createElement('td'); rank.className='league-place'; rank.textContent=row.rank === null ? '—' : String(row.rank).padStart(2,'0');
      const name=document.createElement('th'); name.setAttribute('scope','row');
      const title=document.createElement('strong'); title.textContent=row.station.name;
      const note=document.createElement('span'); note.className='league-team-note'; note.textContent=example ? 'FICTIONAL TEAM' : '$'+row.station.symbol+(row.station.relationship === 'host' ? ' · Federation host' : ' · Community partner');
      name.append(title,note); tr.append(rank,name);
      for(const key of Object.keys(METRICS)) {
        const cell=document.createElement('td'); cell.className='league-score'+(choice === key ? ' current' : ''); cell.textContent=format(row[key]); tr.append(cell);
      }
      const comparison=document.createElement('td');
      if(available) {
        const bar=document.createElement('meter'); bar.min=0; bar.max=leader; bar.value=row[choice];
        bar.setAttribute('aria-label',row.station.name+': '+format(row[choice])+' '+METRICS[choice].label.toLowerCase()+(example ? ', fictional example' : ', dated count'));
        bar.textContent=format(row[choice])+'; leading score '+format(leader); comparison.append(bar);
      } else comparison.textContent='Awaiting season';
      tr.append(comparison); return tr;
    });
    byId('league-rows').replaceChildren(...elements);
    toggle.textContent=example ? 'Return to launch status' : 'Preview example standings';
    toggle.setAttribute('aria-pressed',String(example));
  }
  toggle.addEventListener('click',()=>{example=!example;render();});
  metric.addEventListener('change',render);
  byId('league-copy').addEventListener('click',async()=>{
    const attempt=++copyAttempt;
    const fallback=byId('league-share-link'); fallback.value=LEAGUE_LINK; fallback.hidden=false;
    byId('league-copy-status').textContent='The public link is shown below. It does not track an invite or count a join.';
    try {
      await copy(LEAGUE_LINK);
      if(attempt !== copyAttempt) return;
      byId('league-copy-status').textContent='Public League link copied. Enrollment is not open; sharing does not count a join.';
    } catch {
      if(attempt !== copyAttempt) return;
      byId('league-copy-status').textContent='Select and copy the public link shown below. Enrollment is not open.';
      fallback.focus(); fallback.select();
    }
  });
  byId('league-controls').hidden=false;
  byId('league-share-controls').hidden=false;
  render();
}
if(typeof document !== 'undefined') {
  try { mountCommunityLeague(document); }
  catch {
    const status=document.getElementById('league-status');
    if(status) status.textContent='Interactive standings are unavailable. The prelaunch roster and counting rules remain below.';
  }
}
