const KEY='QBSCORER_V5';
let game=JSON.parse(localStorage.getItem(KEY)||'null')||{meta:{},plays:[]};
let pending=null;
const $=id=>document.getElementById(id);
const val=id=>$(id).value;
const ord=n=>n===1?'1st':n===2?'2nd':n===3?'3rd':'4th';
function save(){localStorage.setItem(KEY,JSON.stringify(game));render();}
['qb','opp','team','score'].forEach(id=>$(id).addEventListener('input',()=>{game.meta[id]=val(id);save();}));
function situation(){return {q:val('quarter'),drive:Number(val('drive'))||1,down:Number(val('down'))||1,dist:Number(val('distance'))||10};}
function startPlay(type){
 pending={type,...situation()};
 $('modalTitle').textContent=type==='INT'?'Interception':type==='FUMBLE'?'Fumble':type;
 $('context').textContent=`Current: ${ord(pending.down)} & ${pending.dist}  •  Q${pending.q.replace('st','').replace('nd','').replace('rd','').replace('th','')}`;
 $('yards').value=(type==='INCOMPLETE'||type==='INT'||type==='SPIKE')?'0':'';
 $('receiverWrap').style.display=(type==='COMPLETE'||type==='INCOMPLETE')?'block':'none';
 $('checks').style.display=['INCOMPLETE','INT','SPIKE'].includes(type)?'none':'grid';
 $('receiver').value='';$('playNote').value='';$('td').checked=false;$('fd').checked=false;
 $('modal').classList.remove('hidden');
 setTimeout(()=>{ $('yards').focus(); },100);
}
document.querySelectorAll('[data-play]').forEach(b=>b.addEventListener('click',()=>startPlay(b.dataset.play)));
$('cancelPlay').addEventListener('click',()=>{$('modal').classList.add('hidden');pending=null;});
$('savePlay').addEventListener('click',commit);
$('yards').addEventListener('keydown',e=>{if(e.key==='Enter')commit();});
function commit(){
 if(!pending)return;
 const x={...pending,yards:Number($('yards').value)||0,receiver:$('receiver').value.trim(),td:$('td').checked,fd:$('fd').checked,note:$('playNote').value.trim()};
 game.plays.push(x);advance(x);pending=null;$('modal').classList.add('hidden');save();
}
function advance(x){
 if(x.td||x.fd||x.yards>=x.dist){$('down').value='1';$('distance').value=10;return;}
 if(x.type==='INT'||x.type==='FUMBLE'){return;}
 if(x.down>=4){$('down').value='1';$('distance').value=10;return;}
 $('down').value=String(x.down+1);$('distance').value=String(Math.max(1,x.dist-x.yards));
}
function stats(){
 const s={comp:0,att:0,passYds:0,passTD:0,ints:0,rushAtt:0,rushYds:0};
 game.plays.forEach(x=>{
  if(['COMPLETE','INCOMPLETE','INT','SPIKE'].includes(x.type))s.att++;
  if(x.type==='COMPLETE'){s.comp++;s.passYds+=x.yards;if(x.td)s.passTD++;}
  if(x.type==='INT')s.ints++;
  if(['QB RUN','SCRAMBLE'].includes(x.type)){s.rushAtt++;s.rushYds+=x.yards;}
  if(x.type==='SACK')s.rushYds+=x.yards;
 });
 s.pct=s.att?Math.round(s.comp/s.att*100):0;return s;
}
function render(){
 const s=stats();
 Object.entries(s).forEach(([k,v])=>{const el=$(k==='pct'?'pct':k);if(el)el.textContent=k==='pct'?v+'%':v;});
 $('next').textContent=`Next: ${ord(Number(val('down'))||1)} & ${Number(val('distance'))||10}`;
 const rows=game.plays.slice(-12).reverse();
 $('recent').innerHTML=rows.length?rows.map((x,i)=>`${game.plays.length-i}. ${x.q} • ${ord(x.down)} & ${x.dist} • <b>${x.type}</b> ${x.yards>0?x.yards+' yds':x.yards<0?x.yards+' yds':''}${x.receiver?' • '+x.receiver:''}${x.td?' • TD':''}${x.fd?' • 1D':''}${x.note?' • '+x.note:''}`).join('<hr>'):'No plays yet.';
}
$('summaryBtn').addEventListener('click',()=>{const s=stats();alert(`${game.meta.qb||'QB'} vs ${game.meta.opp||'Opponent'}\n\nPassing: ${s.comp}/${s.att}, ${s.pct}%, ${s.passYds} yds, ${s.passTD} TD, ${s.ints} INT\nRushing: ${s.rushAtt} att, ${s.rushYds} yds`);});
$('csvBtn').addEventListener('click',()=>{
 const rows=[['Quarter','Drive','Down','Distance','Play','Yards','TD','First Down','Receiver','Note'],...game.plays.map(x=>[x.q,x.drive,ord(x.down),x.dist,x.type,x.yards,x.td?'Yes':'No',x.fd?'Yes':'No',x.receiver,x.note])];
 const csv=rows.map(r=>r.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\n');
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='QB_game_stats.csv';a.click();URL.revokeObjectURL(a.href);
});
$('newBtn').addEventListener('click',()=>{if(confirm('Start a new game? Export CSV first if you want a copy.')){game={meta:{},plays:[]};localStorage.removeItem(KEY);['qb','opp','team','score'].forEach(id=>$(id).value='');$('drive').value=1;$('quarter').value='1st';$('down').value=1;$('distance').value=10;render();}});
['qb','opp','team','score'].forEach(id=>$(id).value=game.meta[id]||'');
render();
if('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js?v=5').catch(()=>{});
