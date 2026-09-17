(() => {
  const $ = id => document.getElementById(id);
  const state = { plays: [], pending: null, negative: false };

  const metaIds = ["qb","opponent","team","score","quarter","drive","down","distance"];
  metaIds.forEach(id => {
    const el = $(id);
    const saved = localStorage.getItem("qb_" + id);
    if (saved !== null) el.value = saved;
    el.addEventListener("input", () => localStorage.setItem("qb_" + id, el.value));
    el.addEventListener("change", () => localStorage.setItem("qb_" + id, el.value));
  });

  const savedPlays = localStorage.getItem("qb_plays");
  if (savedPlays) {
    try { state.plays = JSON.parse(savedPlays) || []; } catch(e) { state.plays = []; }
  }

  function saveState() {
    localStorage.setItem("qb_plays", JSON.stringify(state.plays));
  }

  function yardsValue() {
    const raw = $("yards").value.trim().replace(",", ".");
    if (!raw) return 0;
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    return state.negative ? -Math.abs(n) : Math.abs(n);
  }

  function isPassing(type) {
    return ["COMPLETE","INCOMPLETE","INTERCEPTION","SPIKE"].includes(type);
  }

  function openYardModal(type) {
    state.pending = {
      type,
      quarter: $("quarter").value,
      drive: $("drive").value,
      down: $("down").value,
      distance: $("distance").value
    };
    state.negative = false;
    $("signBtn").textContent = "+";
    $("signBtn").classList.remove("negative");
    $("signHelp").textContent = "Positive yards";
    $("yards").value = "";
    $("yardTitle").textContent =
      type === "SACK" ? "Sack yards" :
      type === "FUMBLE" ? "Fumble / rushing yards" :
      isPassing(type) ? "Passing yards" : "Rushing yards";
    $("yardModal").classList.add("show");
    document.body.style.overflow = "hidden";
    setTimeout(() => $("yards").focus(), 180);
  }

  function closeYardModal() {
    $("yardModal").classList.remove("show");
    state.pending = null;
    document.body.style.overflow = "";
  }

  function toggleSign() {
    state.negative = !state.negative;
    $("signBtn").textContent = state.negative ? "−" : "+";
    $("signBtn").classList.toggle("negative", state.negative);
    $("signHelp").textContent = state.negative ? "Negative yards" : "Positive yards";
  }

  function advanceDown(yards) {
    const oldDist = Number($("distance").value || 10);
    if (yards >= oldDist) {
      $("down").value = "1st";
      $("distance").value = "10";
    } else {
      const downs = ["1st","2nd","3rd","4th"];
      const idx = Math.max(0, downs.indexOf($("down").value));
      const next = Math.min(idx + 1, 3);
      $("down").value = downs[next];
      const gainedForDown = Math.max(0, yards);
      $("distance").value = String(Math.max(1, oldDist - gainedForDown));
    }
    localStorage.setItem("qb_down", $("down").value);
    localStorage.setItem("qb_distance", $("distance").value);
  }

  function commitPlay() {
    const p = state.pending;
    if (!p) return;
    const y = yardsValue();
    if (y === null) {
      alert("Please enter a valid number of yards.");
      return;
    }

    const play = {
      id: Date.now(),
      type: p.type,
      yards: y,
      quarter: p.quarter,
      drive: p.drive,
      down: p.down,
      distance: p.distance,
      td: false,
      firstDown: false,
      note: ""
    };

    state.plays.push(play);
    saveState();
    closeYardModal();
    advanceDown(y);
    render();
  }

  document.querySelectorAll("[data-play]").forEach(btn => {
    btn.addEventListener("click", () => openYardModal(btn.dataset.play));
  });

  $("signBtn").addEventListener("click", toggleSign);
  $("savePlay").addEventListener("click", commitPlay);
  $("cancelPlay").addEventListener("click", closeYardModal);

  $("yardModal").addEventListener("click", e => {
    if (e.target === $("yardModal")) closeYardModal();
  });

  $("yards").addEventListener("keydown", e => {
    if (e.key === "Enter") commitPlay();
  });

  $("noteBtn").addEventListener("click", () => {
    $("noteText").value = "";
    $("noteModal").classList.add("show");
    document.body.style.overflow = "hidden";
    setTimeout(() => $("noteText").focus(), 180);
  });
  $("cancelNote").addEventListener("click", () => {
    $("noteModal").classList.remove("show");
    document.body.style.overflow = "";
  });
  $("noteModal").addEventListener("click", e => {
    if (e.target === $("noteModal")) {
      $("noteModal").classList.remove("show");
      document.body.style.overflow = "";
    }
  });
  $("saveNote").addEventListener("click", () => {
    const text = $("noteText").value.trim();
    if (text) {
      state.plays.push({
        id: Date.now(), type: "NOTE", yards: 0,
        quarter: $("quarter").value, drive: $("drive").value,
        down: $("down").value, distance: $("distance").value,
        td: false, firstDown: false, note: text
      });
      saveState();
      render();
    }
    $("noteModal").classList.remove("show");
    document.body.style.overflow = "";
  });

  $("undoBtn").addEventListener("click", () => {
    if (!state.plays.length) { alert("There is no saved play to undo."); return; }
    state.plays.pop();
    saveState();
    render();
  });

  $("newBtn").addEventListener("click", () => {
    if (!confirm("Start a new game? This clears the current game's plays from this phone.")) return;
    state.plays = [];
    saveState();
    $("down").value = "1st";
    $("distance").value = "10";
    $("drive").value = "1";
    localStorage.setItem("qb_down","1st");
    localStorage.setItem("qb_distance","10");
    localStorage.setItem("qb_drive","1");
    render();
  });

  $("exportBtn").addEventListener("click", () => {
    const headers = ["#","Quarter","Drive","Down","Distance","Play","Yards","TD","First Down","Note"];
    const lines = [headers.join(",")];
    state.plays.forEach((p,i) => {
      const row = [i+1,p.quarter,p.drive,p.down,p.distance,p.type,p.yards,p.td,p.firstDown,p.note]
        .map(v => `"${String(v ?? "").replace(/"/g,'""')}"`);
      lines.push(row.join(","));
    });
    const blob = new Blob([lines.join("\n")], {type:"text/csv;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "qb_game_stats.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  $("summaryBtn").addEventListener("click", () => {
    const s = totals();
    alert(
      `QB SUMMARY\n\n` +
      `Passing: ${s.comp}/${s.att} (${s.pct}%) for ${s.passYds} yds\n` +
      `Pass TD: ${s.passTd}   INT: ${s.ints}\n` +
      `Rushing: ${s.rushAtt} attempts for ${s.rushYds} yds`
    );
  });

  function totals() {
    let comp=0,att=0,passYds=0,passTd=0,ints=0,rushAtt=0,rushYds=0;
    state.plays.forEach(p => {
      if (p.type === "COMPLETE") { comp++; att++; passYds += p.yards; }
      else if (p.type === "INCOMPLETE") { att++; }
      else if (p.type === "INTERCEPTION") { att++; ints++; passYds += p.yards; }
      else if (p.type === "SPIKE") { att++; }
      else if (["QB RUN","SCRAMBLE"].includes(p.type)) { rushAtt++; rushYds += p.yards; }
      else if (p.type === "SACK") { rushYds += p.yards; }
      else if (p.type === "FUMBLE") { rushAtt++; rushYds += p.yards; }
    });
    return {comp,att,pct:att ? Math.round(comp/att*100) : 0,passYds,passTd,ints,rushAtt,rushYds};
  }

  function render() {
    const s = totals();
    $("comp").textContent=s.comp;
    $("att").textContent=s.att;
    $("cmpPct").textContent=s.pct+"%";
    $("passYds").textContent=s.passYds;
    $("passTd").textContent=s.passTd;
    $("ints").textContent=s.ints;
    $("rushAtt").textContent=s.rushAtt;
    $("rushYds").textContent=s.rushYds;
    $("next").textContent = `Next: ${$("down").value} & ${$("distance").value}`;

    const recent = state.plays.slice(-10).reverse();
    $("recent").innerHTML = recent.length ? recent.map((p,i) => {
      const num = state.plays.length - i;
      if (p.type === "NOTE") return `<div class="row">${num}. ${p.quarter} • NOTE • ${escapeHtml(p.note)}</div>`;
      const yd = p.yards > 0 ? `+${p.yards}` : String(p.yards);
      return `<div class="row">${num}. ${p.quarter} • ${p.down} & ${p.distance} • <b>${p.type}</b> ${yd} yds${p.firstDown ? " • 1D" : ""}${p.td ? " • TD" : ""}</div>`;
    }).join("") : `<div class="hint">No plays yet.</div>`;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
    }[c]));
  }

  render();
})();
