let plays = [];
let pending = null;
let history = [];
let state = {q:1, down:1, distance:10, drive:1};

const $ = id => document.getElementById(id);
const KEY = "varsityQBScorerV3";

function load(){
  try{
    const s = JSON.parse(localStorage.getItem(KEY) || "null");
    if(s){
      plays = Array.isArray(s.plays) ? s.plays : [];
      history = Array.isArray(s.history) ? s.history : [];
      state = {...state, ...(s.state || {})};
      const m=s.meta||{};
      ["qb","opp","team","score"].forEach(id=>{ if(m[id]!==undefined) $(id).value=m[id]; });
    }
  }catch(e){}
  $("quarter").value = ({1:"1st",2:"2nd",3:"3rd",4:"4th"})[state.q] || "1st";
  $("down").value = ({1:"1st",2:"2nd",3:"3rd",4:"4th"})[state.down] || "1st";
  $("distance").value = state.distance;
  $("drive").value = state.drive;
  render();
}

function save(){
  const meta={};
  ["qb","opp","team","score"].forEach(id=>meta[id]=$(id).value);
  localStorage.setItem(KEY, JSON.stringify({plays,history,state,meta}));
}

["qb","opp","team","score"].forEach(id=>$(id).addEventListener("input",save));

$("quarter").addEventListener("change",()=>{
  state.q={"1st":1,"2nd":2,"3rd":3,"4th":4}[$("quarter").value];
  save(); render();
});
$("down").addEventListener("change",()=>{
  state.down={"1st":1,"2nd":2,"3rd":3,"4th":4}[$("down").value];
  save(); render();
});
$("distance").addEventListener("input",()=>{
  const n=parseFloat($("distance").value);
  if(Number.isFinite(n)) state.distance=n;
  save(); render();
});
$("drive").addEventListener("input",()=>{
  const n=parseInt($("drive").value,10);
  if(Number.isFinite(n)) state.drive=n;
  save(); render();
});

function snapshot(){ return JSON.parse(JSON.stringify(state)); }

function startPass(result){
  pending={kind:"pass",result};
  $("passPrompt").textContent = result==="Complete" ? "Passing yards — COMPLETE" : "Passing yards — INCOMPLETE";
  $("passYds").value="";
  $("passBox").classList.remove("hidden");
  $("passYds").focus();
  window.scrollTo({top:$("passBox").getBoundingClientRect().top+window.scrollY-100,behavior:"smooth"});
}

function savePass(){
  if(!pending || pending.kind!=="pass") return;
  const raw=$("passYds").value.trim();
  if(raw===""){alert("Enter the passing yards. Use 0 for no gain, or a negative number for a loss."); return;}
  const y=Number(raw);
  if(!Number.isFinite(y)){alert("Please enter a valid number.");return;}
  addPlay({
    play:pending.result,
    category:"pass",
    yds:y,
    passYds:y,
    rushYds:0,
    int:false
  });
  pending=null; $("passBox").classList.add("hidden"); $("passYds").value="";
}

function recordInstant(type){
  if(type==="Spike"){
    addPlay({play:"Spike",category:"pass",yds:0,passYds:0,rushYds:0,int:false});
  } else {
    addPlay({play:"Interception",category:"pass",yds:0,passYds:0,rushYds:0,int:true});
  }
}

function startRush(type){
  pending={kind:"rush",type};
  $("rushPrompt").textContent = type==="Sack" ? "Sack yards" : type==="Rush for Loss" ? "Rush for loss yards" : type==="Fumble" ? "Fumble play yards" : "Rushing yards";
  $("rushYds").value="";
  $("rushBox").classList.remove("hidden");
  $("rushYds").focus();
  window.scrollTo({top:$("rushBox").getBoundingClientRect().top+window.scrollY-100,behavior:"smooth"});
}

function saveRush(){
  if(!pending || pending.kind!=="rush") return;
  const raw=$("rushYds").value.trim();
  if(raw===""){alert("Enter the yards. Use a negative number for a loss.");return;}
  const y=Number(raw);
  if(!Number.isFinite(y)){alert("Please enter a valid number.");return;}
  const type=pending.type;
  addPlay({
    play:type,
    category:(type==="Sack"?"sack":"rush"),
    yds:y,
    passYds:0,
    rushYds:y,
    int:false,
    fumble:type==="Fumble"
  });
  pending=null; $("rushBox").classList.add("hidden"); $("rushYds").value="";
}

function addPlay(data){
  history.push(snapshot());
  const p={
    n:plays.length+1,
    q:state.q,
    drive:state.drive,
    down:state.down,
    distance:Number(state.distance),
    play:data.play,
    category:data.category,
    yds:Number(data.yds)||0,
    passYds:Number(data.passYds)||0,
    rushYds:Number(data.rushYds)||0,
    td:false,
    int:!!data.int,
    fumble:!!data.fumble,
    first:false,
    note:""
  };
  plays.push(p);
  advanceDown(p);
  save(); render();
}

function advanceDown(p){
  // First down or touchdown resets to 1st & 10.
  if(p.td || p.first){
    state.down=1; state.distance=10; return;
  }
  const gained = Number(p.yds)||0;
  const remaining = Math.max(0, Number(state.distance)-gained);
  if(gained >= Number(state.distance)){
    state.down=1; state.distance=10;
  }else{
    state.down = state.down>=4 ? 1 : state.down+1;
    state.distance = Math.max(1, remaining);
  }
}

function markTD(){
  if(!plays.length){alert("Save a play first.");return;}
  plays[plays.length-1].td=true;
  state.down=1; state.distance=10;
  save(); render();
}
function addFirstDown(){
  if(!plays.length){alert("Save a play first.");return;}
  plays[plays.length-1].first=true;
  state.down=1; state.distance=10;
  save(); render();
}

function openNote(){
  $("noteText").value="";
  noteDialog.showModal();
  $("noteText").focus();
}
function saveNote(){
  const t=$("noteText").value.trim();
  if(t){
    history.push(snapshot());
    plays.push({n:plays.length+1,q:state.q,drive:state.drive,down:state.down,distance:Number(state.distance),play:"NOTE",category:"note",yds:0,passYds:0,rushYds:0,td:false,int:false,fumble:false,first:false,note:t});
    save(); render();
  }
  noteDialog.close();
}

function undo(){
  if(!plays.length){alert("There are no saved plays to undo.");return;}
  plays.pop();
  const prev=history.pop();
  if(prev) state=prev;
  pending=null;
  $("passBox").classList.add("hidden");
  $("rushBox").classList.add("hidden");
  save(); render();
}

function stats(){
  const pass=plays.filter(p=>p.category==="pass");
  const comp=pass.filter(p=>p.play==="Complete").length;
  const att=pass.filter(p=>["Complete","Incomplete","Interception","Spike"].includes(p.play)).length;
  const passyds=pass.filter(p=>["Complete","Incomplete","Interception","Spike"].includes(p.play)).reduce((a,p)=>a+p.passYds,0);
  const ptd=plays.filter(p=>p.td && p.category==="pass").length;
  const ints=plays.filter(p=>p.int).length;
  const rush=plays.filter(p=>p.category==="rush");
  const rushatt=rush.filter(p=>["QB Run","Scramble","Rush for Loss","Fumble"].includes(p.play)).length;
  const rushyds=rush.reduce((a,p)=>a+p.rushYds,0);
  return {comp,att,passyds,ptd,ints,rushatt,rushyds,pct:att?Math.round(comp/att*100):0};
}

function render(){
  const s=stats();
  $("comp").textContent=s.comp;
  $("att").textContent=s.att;
  $("pct").textContent=s.pct+"%";
  $("passyds").textContent=s.passyds;
  $("ptd").textContent=s.ptd;
  $("int").textContent=s.ints;
  $("rushatt").textContent=s.rushatt;
  $("rushyds").textContent=s.rushyds;
  $("next").textContent=`Next: ${ord(state.down)} & ${fmtNum(state.distance)}`;

  $("recent").innerHTML=plays.slice(-12).reverse().map(p=>{
    const flags=[p.td?"TD":"",p.int?"INT":"",p.first?"1D":"",p.fumble?"FUMBLE":""].filter(Boolean).join(" • ");
    const yards=p.yds!==0 ? ` ${p.yds>0?"+":""}${fmtNum(p.yds)} yds` : " 0 yds";
    return `<div class="playrow"><b>${p.n}. ${ord(p.q)} • ${ord(p.down)} & ${fmtNum(p.distance)} • ${esc(p.play)}</b>${yards}${flags?" • "+flags:""}${p.note?" • "+esc(p.note):""}</div>`;
  }).join("") || `<div class="playrow" style="color:#777">No plays saved yet.</div>`;
}

function ord(n){return n===1?"1st":n===2?"2nd":n===3?"3rd":"4th";}
function fmtNum(n){return Number.isInteger(Number(n))?String(Number(n)):String(Number(n).toFixed(1)).replace(/\.0$/,"");}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));}

function openSummary(){
  const s=stats();
  $("summary").innerHTML=
    `<div><b>${esc($("qb").value||"QB")}</b> vs. <b>${esc($("opp").value||"Opponent")}</b></div>
     <div>Passing: <b>${s.comp}/${s.att}</b> (${s.pct}%) for <b>${s.passyds}</b> yds, <b>${s.ptd}</b> TD, <b>${s.ints}</b> INT</div>
     <div>Rushing: <b>${s.rushatt}</b> att for <b>${s.rushyds}</b> yds</div>
     <div>Plays saved: <b>${plays.length}</b></div>`;
  summaryDialog.showModal();
}

function exportCSV(){
  const rows=[["Play #","Quarter","Drive","Down","Distance","Play","Yards","Pass Yds","Rush Yds","TD","INT","Fumble","First Down","Note"]];
  plays.forEach(p=>rows.push([p.n,ord(p.q),p.drive,ord(p.down),fmtNum(p.distance),p.play,p.yds,p.passYds,p.rushYds,p.td?"Yes":"No",p.int?"Yes":"No",p.fumble?"Yes":"No",p.first?"Yes":"No",p.note||""]));
  const csv=rows.map(r=>r.map(x=>`"${String(x).replaceAll('"','""')}"`).join(",")).join("\n");
  const blob=new Blob([csv],{type:"text/csv"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download=`QB_${($("opp").value||"Game").replace(/[^a-z0-9_-]/gi,"_")}.csv`;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

function newGame(){
  if(!confirm("Start a new game? Current game will be cleared.")) return;
  plays=[]; history=[]; pending=null; state={q:1,down:1,distance:10,drive:1};
  ["qb","opp","team","score"].forEach(id=>$(id).value="");
  $("quarter").value="1st";$("down").value="1st";$("distance").value=10;$("drive").value=1;
  save();render();
}

load();

if("serviceWorker" in navigator){
  window.addEventListener("load",()=>navigator.serviceWorker.register("service-worker.js?v=3").catch(()=>{}));
}
