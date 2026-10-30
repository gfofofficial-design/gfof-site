import {REVENUE} from './treasury-revenue-data.mjs';
import {ASSETS,SOURCES,validateRevenue,revenueSeries,formatRevenue} from './treasury-revenue-core.mjs';
const root=document.querySelector('[data-revenue-report]');
if(root){
 try{
  const rows=validateRevenue(REVENUE);
  if(rows.length){
   const controls=document.createElement('div');controls.className='revenue-filters';
   const choice=(label,values)=>{const wrap=document.createElement('label');wrap.append(label+' ');const select=document.createElement('select');for(const [value,text]of Object.entries(values)){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);}wrap.append(select);controls.append(wrap);return select;};
   const assets=Object.fromEntries(Object.keys(ASSETS).filter(a=>rows.some(r=>r.asset===a)).map(a=>[a,a]));
   const asset=choice('Asset',assets),source=choice('Service',{all:'All services',...SOURCES});
   const status=document.createElement('p');status.setAttribute('role','status');
   const plot=document.createElement('div');plot.className='revenue-bars';plot.setAttribute('aria-hidden','true');
   const table=document.createElement('table');table.className='revenue-table';const caption=table.createCaption();caption.textContent='Verified monthly statements — exact amounts and evidence';
   const head=table.createTHead().insertRow();for(const text of ['Month / service','Gross','Refunds','Collection costs','Net receipts','Reconciled / evidence']){const th=document.createElement('th');th.scope='col';th.textContent=text;head.append(th);}
   const body=table.createTBody(),scroll=document.createElement('div');scroll.className='revenue-table-scroll';scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label','Revenue statements; scroll horizontally for all columns');scroll.append(table);
   const draw=()=>{
    const series=revenueSeries(rows,{asset:asset.value,source:source.value});plot.replaceChildren();body.replaceChildren();
    status.textContent=series.length?'Reported months only · '+asset.value+' · gaps are unreported, not zero.':'No verified statements for this selection.';
    const max=series.reduce((m,v)=>{const n=v.net<0n?-v.net:v.net;return n>m?n:m;},0n);
    for(const period of series){
     const line=document.createElement('div');line.className='revenue-bar-row';const label=document.createElement('span');label.textContent=period.month;const track=document.createElement('div');track.className='revenue-bar-track';const bar=document.createElement('div');bar.className='revenue-bar'+(period.net<0n?' negative':'');const magnitude=period.net<0n?-period.net:period.net;bar.style.width=(max?Number(magnitude*10000n/max)/100:0)+'%';track.append(bar);const amount=document.createElement('span');amount.textContent=formatRevenue(period.net,asset.value);line.append(label,track,amount);plot.append(line);
     for(const row of period.rows){const tr=body.insertRow();for(const text of [row.month+' / '+SOURCES[row.source],formatRevenue(row.gross,row.asset),formatRevenue(row.refunds,row.asset),formatRevenue(row.costs,row.asset),formatRevenue(row.net,row.asset)]){const td=tr.insertCell();td.textContent=text;}const td=tr.insertCell(),link=document.createElement('a');link.href=row.evidence;link.textContent=row.reconciledOn+' · Source';td.append(link);}
    }
   };
   root.replaceChildren(controls,status,plot,scroll);asset.addEventListener('change',draw);source.addEventListener('change',draw);draw();
   document.querySelector('#revenue-chart-caption').textContent='Monthly net receipts from published reconciled statements. Select one asset and service; values are not converted to dollars. Negative bars are labeled and represent refunds or costs exceeding gross fees. Read the table for exact amounts and dated source records.';
   document.querySelector('[data-revenue-total]').textContent='See statements by asset';
   document.querySelector('[data-revenue-total-note]').textContent='Verified statements are shown below. Different assets are not combined into one total.';
   document.querySelector('[data-revenue-log]').textContent='Published statements and their evidence links are included in the chart table. Net receipts are not profit.';
  }
 }catch{
  root.replaceChildren();const message=document.createElement('p');message.textContent='Revenue reporting is unavailable. No zero or estimated total has been substituted.';root.append(message);
 }
}
