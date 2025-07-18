// ---------- Helpers for Time Parsing & Formatting ----------
function parseTimeString(str) {
  const parts = str.split(':').map(s => s.trim());
  if (parts.length === 3) {
    const [m, s, ms] = parts.map(Number);
    return (m || 0) * 60000 + (s || 0) * 1000 + (ms || 0);
  }
  const num = parseFloat(str);
  return isNaN(num) ? null : Math.round(num * 1000);
}
function formatTime(ms) {
  if (ms == null) return '';
  const m = Math.floor(ms / 60000),
    s = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0'),
    r = String(ms % 1000).padStart(3, '0');
  return `${m}:${s}:${r}`;
}

function showMessage(txt, duration = 3000) {
  const b = document.getElementById('msgBanner');
  b.textContent = txt;
  b.classList.remove('hidden');
  b.classList.add('show');
  setTimeout(() => {
    b.classList.remove('show');
    setTimeout(() => b.classList.add('hidden'), 300);
  }, duration);
}

function formatGap(ms) {
  return '+' + (ms / 1000).toFixed(3);
}

function computeDayBest() {
  const arr = state.drivers.map(d => {
    const times = [d.q1Best, d.q2Best, d.q3Best].filter(t => t != null);
    const bestMs = times.length ? Math.min(...times) : null;
    return { name: d.name, bestMs };
  }).filter(x => x.bestMs != null)
    .sort((a, b) => a.bestMs - b.bestMs);

  return arr[0]; // the fastest driver
}

/**
 * Assigns A→B→C cockpits to one match, based on each driver.lastRig,
 * bumping on conflicts so everyone in that match has a unique seat.
 * Also updates each driver.lastRig for the next round.
 */
function assignRigsForMatch(match) {
  const cockpits = ['A', 'B', 'C'];
  match.rigAssignments = match.rigAssignments || {};
  const taken = new Set();

  match.participants.forEach(pid => {
    const driver = state.drivers.find(d => d.id === pid);
    // compute next cockpit after their true lastRig
    let idx = driver.lastRig != null
      ? (cockpits.indexOf(driver.lastRig) + 1) % cockpits.length
      : 0;
    let rig = cockpits[idx];

    // bump until it’s not already taken in this match
    while (taken.has(rig)) {
      idx = (idx + 1) % cockpits.length;
      rig = cockpits[idx];
    }

    // record it
    match.rigAssignments[pid] = rig;
    taken.add(rig);

    // update driver for future rounds
    driver.lastRig = rig;
    driver.sessionCount = (driver.sessionCount || 3) + 1;
  });
}


function validateSession(tableId, buttonEl) {
  const rows = document.querySelectorAll(`#${tableId} tbody tr`);
  // if there are no rows, we’re definitely not ready
  if (rows.length === 0) {
    buttonEl.disabled = true;
    return;
  }
  const allFilled = Array.from(rows).every(tr => {
    const v = tr.querySelector('input').value.trim().toUpperCase();
    return v === 'DNF' || parseTimeString(v) != null;
  });
  buttonEl.disabled = !allFilled;
}


// session‑specific wrappers
function validateQ1() { validateSession('q1Table', evalQ1Btn); }
function validateQ2() { validateSession('q2Table', evalQ2Btn); }
function validateQ3() { validateSession('q3Table', evalQ3Btn); }




// ---------- State & Persistence ----------
let state = { drivers: [], matches: [] };
function saveState() {
  localStorage.setItem('eventState', JSON.stringify(state));
}
function loadState() {
  const j = localStorage.getItem('eventState');
  if (j) state = JSON.parse(j);
}
// ---------- Reset All Data ----------
document.getElementById('resetBtn').onclick = () => {
  if (confirm("⚠️ This will clear ALL event data and restart from scratch. Continue?")) {
    localStorage.removeItem('eventState');
    location.href = window.location.pathname; // strip query so button hides again
  }
};
loadState();

const evalQ1Btn = document.getElementById('evalQ1Btn');
const evalQ2Btn = document.getElementById('evalQ2Btn');
const evalQ3Btn = document.getElementById('evalQ3Btn');
const assignQ2Btn = document.getElementById('assignQ2Btn');
const assignQ3Btn = document.getElementById('assignQ3Btn');
const bracketManager = document.getElementById('prepBracketBtn');

// start disabled
evalQ1Btn.disabled = true;
evalQ2Btn.disabled = true;
evalQ3Btn.disabled = true;
assignQ2Btn.disabled = true;
assignQ3Btn.disabled = true;
bracketManager.disabled = true;

// Only show Reset if ?admin=1 is in the URL
const params = new URLSearchParams(window.location.search);
const isAdmin = params.get('admin') === '1';
if (isAdmin) {
  document.getElementById('adminTabBtn').classList.remove('hidden');
}

// Export handler
document.getElementById('exportBtn').onclick = () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `event-backup-${new Date().toISOString()}.json`;
  a.click();
};

// Import handler (opens file picker)
document.getElementById('importBtn').onclick = () => {
  document.getElementById('importFile').click();
};
document.getElementById('importFile').onchange = e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    state = JSON.parse(reader.result);
    saveState();
    renderAll();
    alert('Imported backup successfully');
  };
  reader.readAsText(file);
};

// ----------Seed 25 Drivers if Empty----------
// if (!state.drivers.length) {
//   const demoNames = [
//     'Aarav Mehta', 'Saanvi Sharma', 'Rohan Gupta', 'Isha Patel', 'Arjun Reddy',
//     'Kavya Singh', 'Neel Desai', 'Ananya Nair', 'Siddharth Kumar', 'Priya Bose',
//     'Rajat Verma', 'Tara Menon', 'Vihaan Joshi', 'Niharika Rao', 'Advait Shah',
//     'Sneha Kapoor', 'Karan Malhotra', 'Mira Khanna', 'Dev Das', 'Amrita Roy',
//     'Vikram Das', 'Pooja Jain', 'Harsh Vardhan', 'Rhea Sinha', 'Aditya Yadav'
//   ];

//   state.drivers = demoNames.map((name, i) => ({
//     id: i + 1,
//     name,
//     contact: "",
//     q1Rig: null, q1BestRaw: "", q1Best: null, status: "in",
//     q2Rig: null, q2BestRaw: "", q2Best: null,
//     q3Rig: null, q3BestRaw: "", q3Best: null,
//     seed: null,
//     lastRig: null,
//     sessionCount: 0
//   }));

//   saveState();
// }


// ---------- Cockpits ----------
const cockpits = ['A', 'B', 'C'];

// ---------- Tab Navigation ----------
document.querySelectorAll('nav button[data-tab]').forEach(btn => {
  btn.onclick = () => {
    // 1) remove active from all tabs
    document.querySelectorAll('nav button[data-tab]')
      .forEach(b => b.classList.remove('active'));
    // 2) add active to the clicked button
    btn.classList.add('active');

    // 3) show/hide the tab panels
    document.querySelectorAll('.tab')
      .forEach(s => s.classList.add('hidden'));
    document.getElementById(btn.dataset.tab)
      .classList.remove('hidden');

    renderAll();
  };
});

// Start on Register
document.querySelector('button[data-tab="register"]').click();

// ---------- 1. Register Driver ----------
document.getElementById('registerForm').onsubmit = e => {
  e.preventDefault();
  const name = e.target.regName.value.trim();
  // const contact = e.target.regContact.value.trim();
  if (!name) return;

  // **new**: prevent duplicate names (case-insensitive)
  if (state.drivers.some(d => d.name.toLowerCase() === name.toLowerCase())) {
    return alert('That driver name is already registered.');
  }

  const next = state.drivers.length
    ? Math.max(...state.drivers.map(d => d.id)) + 1
    : 1;
  state.drivers.push({
    id: next,
    name,
    // contact,                // store the contact
    q1Rig: null, q1BestRaw: "", q1Best: null, status: "in",
    q2Rig: null, q2BestRaw: "", q2Best: null,
    q3Rig: null, q3BestRaw: "", q3Best: null,
    seed: null,
    lastRig: null,
    sessionCount: 0
  });
  saveState();
  e.target.reset();
  alert(`Added Driver #${next} - ${name}`);
  renderAll();
};





// ---------- 2. Drivers List & Assign Q1 ----------
document.getElementById('assignQ1Btn').onclick = () => {
  state.drivers.forEach((d, i) => {
    const rig = cockpits[i % cockpits.length];
    d.q1Rig = rig;
    d.lastRig = rig;
    d.sessionCount = 1;
    d.status = "in";
  });
  saveState();
  renderDriversList();
  showMessage('✅ Q1 rigs assigned');
};
function renderDriversList() {
  const tb = document.querySelector('#driversTable tbody');
  tb.innerHTML = '';
  state.drivers.forEach(d => {
    tb.innerHTML += `
      <tr>
        <td>${d.id}</td>
        <td>${d.name}</td>
        <td>${d.q1Rig || ''}</td>
        <td>${d.status}</td>
      </tr>`;
  });
}

// ---------- 3. Q1 – Eval & Assign Q2 ----------
document.getElementById('evalQ1Btn').onclick = () => {
  // 1) Gather all Q1 participants
  const participants = state.drivers.filter(d => d.q1Rig);
  const totalCount = participants.length;
  const keepCount = 24;
  // 2) Compute number to eliminate (30% of total, rounded up)
  const eliminateCount = Math.max(0, totalCount - keepCount);

  // 3) Mark any “DNF” as out immediately
  participants.forEach(d => {
    if ((d.q1BestRaw || '').toUpperCase() === 'DNF') {
      d.status = 'out';
      d.q1Best = null;
    }
  });

  // 4) Count how many are already out (DNF)
  const alreadyOut = participants.filter(d => d.status === 'out').length;

  // 5) How many more to drop?
  const needToEliminate = Math.max(0, eliminateCount - alreadyOut);

  if (needToEliminate > 0) {
    // 6) From the remaining “in” drivers, sort by time and eliminate the slowest
    const survivors = participants
      .filter(d => d.status === 'in' && d.q1Best != null)
      .sort((a, b) => a.q1Best - b.q1Best);

    // take the slowest `needToEliminate` and mark them out
    survivors
      .slice(-needToEliminate)
      .forEach(d => d.status = 'out');
  }

  // 7) Persist, re-render, and confirm
  saveState();
  renderAll();
  showMessage(`✅ Q1 evaluated (eliminated ${eliminateCount} of ${totalCount})`);
  assignQ2Btn.disabled = false;
};

document.getElementById('assignQ2Btn').onclick = () => {
  const inDrivers = state.drivers.filter(d => d.status === 'in');

  // if every in‑driver already has a q2Rig, skip
  if (inDrivers.every(d => d.q2Rig)) {
    showMessage('✅ Q2 rigs already assigned - No Change.');
    return;
  }

  // … existing logic to pick next after lastRig …
  inDrivers.forEach(d => {
    const idx = (cockpits.indexOf(d.lastRig) + 1) % cockpits.length;
    const rig = cockpits[idx];
    d.q2Rig = rig;
    d.lastRig = rig;
    d.sessionCount++;
  });

  saveState();
  renderAll();
  showMessage('✅ Q2 rigs assigned');
};
function renderQ1() {
  const tb = document.querySelector('#q1Table tbody');
  tb.innerHTML = '';

  const list = state.drivers
    .filter(d => d.q1Rig)
    .slice()
    .sort((a, b) => {
      if (a.q1Best == null && b.q1Best == null) return 0;
      if (a.q1Best == null) return 1;
      if (b.q1Best == null) return -1;
      return a.q1Best - b.q1Best;
    });

  // Identify pole time (fastest valid lap)
  const leader = list.find(d => d.q1Best != null);
  const poleTime = leader ? leader.q1Best : null;

  list.forEach((d, idx) => {
    const tr = document.createElement('tr');
    if (d.status === 'out') tr.classList.add('eliminated');

    // compute the gap display
    let gapDisplay = '';
    if (poleTime != null && d.q1Best != null) {
      gapDisplay = formatGap(d.q1Best - poleTime);
    }

    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${d.name}</td>
      <td>${d.q1Rig}</td>
      <td><input type="text" value="${d.q1BestRaw || ''}" placeholder="m:ss:ms or DNF"></td>
      <td>${gapDisplay}</td>
      <td>${d.status}</td>
    `;

    const inp = tr.querySelector('input');
    if (d.status === 'out') {
      inp.disabled = true;
    } else {
      inp.onchange = () => {
        const raw = inp.value.trim().toUpperCase();
        if (raw === 'DNF') {
          // immediate DNF handling
          d.q1BestRaw = 'DNF';
          d.q1Best = null;
          d.status = 'out';
        } else {
          d.q1BestRaw = inp.value.trim();
          d.q1Best = parseTimeString(d.q1BestRaw);
        }
        saveState();
        renderQ1();
      };
    }

    tb.appendChild(tr);
  });
  validateQ1();
}

// ---------- 4. Q2 – Eval & Assign Q3 ----------
document.getElementById('evalQ2Btn').onclick = () => {
  // 1) Full Q2 field
  const participants = state.drivers.filter(d => d.q2Rig);
  const totalCount = participants.length;
  const keepCount = 18;
  const eliminateTarget = Math.max(0, totalCount - keepCount);

  // 2) Auto-DNF elimination
  participants.forEach(d => {
    if ((d.q2BestRaw || '').toUpperCase() === 'DNF') {
      d.status = 'out';
      d.q2Best = null;
    }
  });

  // 3) How many left to eliminate?
  const alreadyOutCount = participants.filter(d => d.status === 'out').length;
  const needToEliminate = Math.max(0, eliminateTarget - alreadyOutCount);

  // 4) Knock out the slowest of the remainder
  if (needToEliminate > 0) {
    participants
      .filter(d => d.status === 'in' && d.q2Best != null)
      .sort((a, b) => a.q2Best - b.q2Best)
      .slice(-needToEliminate)
      .forEach(d => d.status = 'out');
  }

  saveState();
  renderAll();
  showMessage(`✅ Q2 evaluated (eliminated ${eliminateTarget} of ${totalCount})`);
  assignQ3Btn.disabled = false;
};

document.getElementById('assignQ3Btn').onclick = () => {
  const inDrivers = state.drivers.filter(d => d.status === 'in');

  if (inDrivers.every(d => d.q3Rig)) {
    showMessage('✅ Q3 rigs already assigned - No Change.');
    return;
  }

  inDrivers.forEach(d => {
    const idx = (cockpits.indexOf(d.lastRig) + 1) % cockpits.length;
    const rig = cockpits[idx];
    d.q3Rig = rig;
    d.lastRig = rig;
    d.sessionCount++;
  });

  saveState();
  renderAll();
  showMessage('✅ Q3 rigs assigned');
};
function renderQ2() {
  const tb = document.querySelector('#q2Table tbody');
  tb.innerHTML = '';

  const list = state.drivers
    .filter(d => d.q2Rig)
    .slice()
    .sort((a, b) => {
      if (a.q2Best == null && b.q2Best == null) return 0;
      if (a.q2Best == null) return 1;
      if (b.q2Best == null) return -1;
      return a.q2Best - b.q2Best;
    });

  // Identify pole time (fastest valid lap)
  const leader = list.find(d => d.q2Best != null);
  const poleTime = leader ? leader.q2Best : null;

  list.forEach((d, idx) => {
    const tr = document.createElement('tr');
    if (d.status === 'out') tr.classList.add('eliminated');

    // compute the gap display
    let gapDisplay = '';
    if (poleTime != null && d.q2Best != null) {
      gapDisplay = formatGap(d.q2Best - poleTime);
    }

    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${d.name}</td>
      <td>${d.q2Rig}</td>
      <td><input type="text" value="${d.q2BestRaw || ''}" placeholder="m:ss:ms or DNF"></td>
      <td>${gapDisplay}</td>
      <td>${d.status}</td>
    `;

    const inp = tr.querySelector('input');
    if (d.status === 'out') {
      inp.disabled = true;
    } else {
      inp.onchange = () => {
        const raw = inp.value.trim().toUpperCase();
        if (raw === 'DNF') {
          d.q2BestRaw = 'DNF';
          d.q2Best = null;
          d.status = 'out';
        } else {
          d.q2BestRaw = inp.value.trim();
          d.q2Best = parseTimeString(d.q2BestRaw);
        }
        saveState();
        renderQ2();
      };
    }

    tb.appendChild(tr);
  });
  validateQ2();
}

// ---------- 5. Q3 – Eval & Prep Bracket ----------
document.getElementById('evalQ3Btn').onclick = () => {
  // 1) Full Q3 field
  const participants = state.drivers.filter(d => d.q3Rig);
  const totalCount = participants.length;
  const seedCount = 12;
  const eliminateTarget = Math.max(0, totalCount - seedCount);

  // 2) Auto-DNF elimination
  participants.forEach(d => {
    if ((d.q3BestRaw || '').toUpperCase() === 'DNF') {
      d.status = 'out';
      d.q3Best = null;
    }
  });

  // 3) How many left to eliminate?
  const alreadyOutCount = participants.filter(d => d.status === 'out').length;
  const needToEliminate = Math.max(0, eliminateTarget - alreadyOutCount);

  // 4) Knock out the slowest of the remainder
  if (needToEliminate > 0) {
    participants
      .filter(d => d.status === 'in' && d.q3Best != null)
      .sort((a, b) => a.q3Best - b.q3Best)
      .slice(-needToEliminate)
      .forEach(d => d.status = 'out');
  }

  // 5) Seed the survivors (fastest first)
  const seeds = participants
    .filter(d => d.status === 'in' && d.q3Best != null)
    .sort((a, b) => a.q3Best - b.q3Best);

  seeds.forEach((d, i) => {
    d.seed = i + 1;
    d.status = 'RACE!';
  });

  saveState();
  renderAll();
  showMessage(`✅ Q3 evaluated (eliminated ${eliminateTarget} of ${totalCount})`);
  bracketManager.disabled = false;
};

document.getElementById('prepBracketBtn').onclick = () => {
  // — only run once —
  if (
    state.matches.length > 0 &&
    state.matches[0].rigAssignments &&
    Object.keys(state.matches[0].rigAssignments).length > 0
  ) {
    showMessage('✅ Race format already prepared - Rigs Locked.');
    return;
  }

  // 1) Build bracket matches
  state.matches = [];
  const seeds = state.drivers
    .filter(d => d.seed)
    .sort((a, b) => a.seed - b.seed);

  // Quarter‑Finals
  [[1, 8, 9], [2, 7, 10], [3, 6, 11], [4, 5, 12]].forEach((grp, i) => {
    state.matches.push({
      id: `QF${i + 1}`,
      phase: 'QF',
      heat: i + 1,
      participants: grp.map(s => seeds.find(d => d.seed === s).id),
      winner: null,
      runnerUp: null,
      ruTimeRaw: "",
      rigAssignments: {}
    });
  });
  // QF Runner‑Up Duels
  state.matches.push({ id: 'QF_DUEL1', phase: 'QF_DUEL', heat: 1, participants: [], winner: null, rigAssignments: {} });
  state.matches.push({ id: 'QF_DUEL2', phase: 'QF_DUEL', heat: 2, participants: [], winner: null, rigAssignments: {} });

  // Semi‑Finals
  state.matches.push({ id: 'SF1', phase: 'SF', heat: 1, participants: [], winner: null, runnerUp: null, rigAssignments: {} });
  state.matches.push({ id: 'SF2', phase: 'SF', heat: 2, participants: [], winner: null, runnerUp: null, rigAssignments: {} });

  // SF Runner‑Up Duel
  state.matches.push({ id: 'SF_DUEL1', phase: 'SF_DUEL', heat: 1, participants: [], winner: null, rigAssignments: {} });

  // Grand Final
  state.matches.push({ id: 'FINAL', phase: 'FINAL', heat: 1, participants: [], winner: null, runnerUp: null, rigAssignments: {} });

  // 2) Rig rotation: next after each driver.lastRig, bump conflicts
  const cockpits = ['A', 'B', 'C'];
  state.matches.forEach(match => {
    const taken = new Set();
    match.participants.forEach(pid => {
      const driver = state.drivers.find(d => d.id === pid);

      // compute desired = next after lastRig
      let idx = driver.lastRig
        ? (cockpits.indexOf(driver.lastRig) + 1) % cockpits.length
        : 0;
      let rig = cockpits[idx];

      // bump until free
      while (taken.has(rig)) {
        idx = (idx + 1) % cockpits.length;
        rig = cockpits[idx];
      }

      // assign & record
      match.rigAssignments[pid] = rig;
      taken.add(rig);

      // update for following rounds
      driver.lastRig = rig;
      driver.sessionCount = (driver.sessionCount || 3) + 1;
    });
  });

  saveState();
  renderBracketManager();
  showMessage('✅ Race Format Prepared! Cockpit rotation locked in.');
};

function renderQ3() {
  const tb = document.querySelector('#q3Table tbody');
  tb.innerHTML = '';

  const list = state.drivers
    .filter(d => d.q3Rig)
    .slice()
    .sort((a, b) => {
      if (a.q3Best == null && b.q3Best == null) return 0;
      if (a.q3Best == null) return 1;
      if (b.q3Best == null) return -1;
      return a.q3Best - b.q3Best;
    });

  // Identify pole time (fastest valid lap)
  const leader = list.find(d => d.q3Best != null);
  const poleTime = leader ? leader.q3Best : null;

  list.forEach((d, idx) => {
    const tr = document.createElement('tr');
    if (d.status === 'out') tr.classList.add('eliminated');

    // compute the gap display
    let gapDisplay = '';
    if (poleTime != null && d.q3Best != null) {
      gapDisplay = formatGap(d.q3Best - poleTime);
    }

    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${d.name}</td>
      <td>${d.q3Rig}</td>
      <td><input type="text" value="${d.q3BestRaw || ''}" placeholder="m:ss:ms or DNF"></td>
      <td>${gapDisplay}</td>
      <td>${d.status}</td>
    `;

    const inp = tr.querySelector('input');
    if (d.status === 'out') {
      inp.disabled = true;
    } else {
      inp.onchange = () => {
        const raw = inp.value.trim().toUpperCase();
        if (raw === 'DNF') {
          d.q3BestRaw = 'DNF';
          d.q3Best = null;
          d.status = 'out';
        } else {
          d.q3BestRaw = inp.value.trim();
          d.q3Best = parseTimeString(d.q3BestRaw);
        }
        saveState();
        renderQ3();
      };
    }

    tb.appendChild(tr);
  });
  validateQ3();
}

// ---------- 6. Bracket Manager ----------
document.getElementById('bracketPhase').onchange = renderBracketManager;

// ————————————————————
// 1) Bracket Manager UI
// ————————————————————
function renderBracketManager() {
  const phase = document.getElementById('bracketPhase').value;
  const cont = document.getElementById('bracketManager');
  cont.innerHTML = '';

  // all matches in this phase
  const mset = state.matches.filter(m => m.phase === phase);
  if (!mset.length) {
    cont.textContent = 'No matches in this phase.';
    return;
  }

  // helper: render each heat
  function renderHeat(m) {
    const div = document.createElement('div');
    div.className = 'bracket-heat';
    div.innerHTML = `<h3>${m.id}</h3>`;

    // participants line
    const names = m.participants.map(pid => {
      const d = state.drivers.find(x => x.id === pid);
      const rig = m.rigAssignments?.[pid] || '–';
      return d ? `${d.name} (Rig ${rig})` : `TBD (Rig ${rig})`;
    }).join(' vs ');
    const p = document.createElement('p');
    p.className = 'match-participants';
    p.textContent = names;
    div.appendChild(p);

    return div;
  }

  // ───────────────────────────────────────
  // Phase = QF → Winner + RunnerUp + RUTime
  // ───────────────────────────────────────
  if (phase === 'QF') {
    mset.forEach(m => {
      const div = renderHeat(m);

      // Winner select
      const wL = document.createElement('label');
      wL.textContent = 'Winner: ';
      const wS = document.createElement('select');
      wS.innerHTML = '<option value="">–</option>';
      m.participants.forEach(pid => {
        const d = state.drivers.find(x => x.id === pid);
        if (d) wS.add(new Option(d.name, pid));
      });
      wS.value = m.winner || '';
      wL.appendChild(wS);
      div.appendChild(wL);

      // Runner-Up select
      const rL = document.createElement('label');
      rL.textContent = 'Runner‑Up: ';
      const rS = document.createElement('select');
      rS.innerHTML = '<option value="">–</option>';
      m.participants.forEach(pid => {
        const d = state.drivers.find(x => x.id === pid);
        if (d) rS.add(new Option(d.name, pid));
      });
      rS.value = m.runnerUp || '';
      rL.appendChild(rS);
      div.appendChild(rL);


      // enforce mutual exclusion in the render step:
      if (m.runnerUp) {
        Array.from(wS.options).forEach(opt => opt.disabled = (opt.value === String(m.runnerUp)));
      }
      if (m.winner) {
        Array.from(rS.options).forEach(opt => opt.disabled = (opt.value === String(m.winner)));
      }

      // RU Time input
      const tL = document.createElement('label');
      tL.textContent = 'RU Time: ';
      const tI = document.createElement('input');
      tI.type = 'text';
      tI.placeholder = 'm:ss:ms or DNF';
      tI.value = m.ruTimeRaw || '';
      tI.onchange = () => {
        m.ruTimeRaw = tI.value.trim();
        saveState();
        renderBracketManager();
      };
      tL.appendChild(tI);
      div.appendChild(tL);

      // on-change handlers (disable opposite pick)
      wS.onchange = () => {
        m.winner = +wS.value || null;
        Array.from(rS.options).forEach(o => o.disabled = (o.value === wS.value));
        saveState();
        renderBracketManager();
      };
      rS.onchange = () => {
        m.runnerUp = +rS.value || null;
        Array.from(wS.options).forEach(o => o.disabled = (o.value === rS.value));
        saveState();
        renderBracketManager();
      };

      cont.appendChild(div);
    });

    // QF Duels auto‑populated? (we check presence of any QF_DUEL participants)
    const qfDuelsDone = state.matches.some(x => x.phase === 'QF_DUEL' && x.participants.length);
    if (!qfDuelsDone) {
      const btn = document.createElement('button');
      btn.classList.add('btn');
      btn.textContent = '▶️ Evaluate QF Heats';
      btn.disabled = mset.some(m => !m.winner || !m.runnerUp || !m.ruTimeRaw);
      btn.onclick = () => {
        evaluateQFDuels();
        showMessage('✅ QF Heats Evaluated');
        document.getElementById('bracketPhase').value = 'QF_DUEL';
        renderBracketManager();
      };
      cont.appendChild(wrapButton(btn));
    } else {
      cont.appendChild(makeDoneLabel('QF Heats'));
    }
    return;
  }

  // ───────────────────────────────────────
  // Phase = QF_DUEL → Winner only + one‑shot button
  // ───────────────────────────────────────
  if (phase === 'QF_DUEL') {
    // 1) Render both duel heats exactly as before
    mset.forEach(m => {
      const div = document.createElement('div');
      div.className = 'bracket-heat';
      div.innerHTML = `<h3>${m.id}</h3>`;

      // participants
      const names = m.participants.map(pid => {
        const d = state.drivers.find(x => x.id === pid);
        const rig = m.rigAssignments?.[pid] || '–';
        return d ? `${d.name} (Rig ${rig})` : `TBD (Rig ${rig})`;
      }).join(' vs ');
      const p = document.createElement('p');
      p.className = 'match-participants';
      p.textContent = names;
      div.appendChild(p);

      // Winner select
      const wL = document.createElement('label');
      wL.textContent = 'Winner: ';
      const wS = document.createElement('select');
      wS.innerHTML = '<option value="">–</option>';
      m.participants.forEach(pid => {
        const d = state.drivers.find(x => x.id === pid);
        if (d) wS.add(new Option(d.name, pid));
      });
      wS.value = m.winner || '';
      wL.appendChild(wS);
      div.appendChild(wL);

      wS.onchange = () => {
        m.winner = +wS.value || null;
        saveState();
        renderBracketManager();
      };

      cont.appendChild(div);
    });

    // 2) Decide if "Evaluate QF Duel" has *really* been done
    //    We know it's done when *both* SF heats now have 3 participants
    const sfHeats = state.matches.filter(m => m.phase === 'SF');
    const duelDone = sfHeats.every(m => m.participants.length === 3);

    if (!duelDone) {
      const btn = document.createElement('button');
      btn.classList.add('btn');
      btn.textContent = '▶️ Evaluate QF Duel';
      // only enable once both duels have a winner
      btn.disabled = mset.some(m => !m.winner);
      btn.onclick = () => {
        evaluateQFDuel();    // your existing function that slots duel winners → SF
        showMessage('✅ QF Duel Evaluated');
        document.getElementById('bracketPhase').value = 'SF';
        renderBracketManager();
      };
      cont.appendChild(wrapButton(btn));
    } else {
      // show a green "done" label instead of a button
      cont.appendChild(makeDoneLabel('QF Duel'));
    }

    return;
  }


  // ───────────────────────────────────────
  // Phase = SF → Winner + RunnerUp
  // ───────────────────────────────────────
  if (phase === 'SF') {
    mset.forEach(m => {
      const div = renderHeat(m);

      // Winner
      const wL = document.createElement('label');
      wL.textContent = 'Winner: ';
      const wS = document.createElement('select');
      wS.innerHTML = '<option value="">–</option>';
      m.participants.forEach(pid => {
        const d = state.drivers.find(x => x.id === pid);
        if (d) wS.add(new Option(d.name, pid));
      });
      wS.value = m.winner || '';
      wL.appendChild(wS);
      div.appendChild(wL);

      // Runner‑Up
      const rL = document.createElement('label');
      rL.textContent = 'Runner‑Up: ';
      const rS = document.createElement('select');
      rS.innerHTML = '<option value="">–</option>';
      m.participants.forEach(pid => {
        const d = state.drivers.find(x => x.id === pid);
        if (d) rS.add(new Option(d.name, pid));
      });
      rS.value = m.runnerUp || '';
      rL.appendChild(rS);
      div.appendChild(rL);


      // enforce mutual exclusion in the render step:
      if (m.runnerUp) {
        Array.from(wS.options).forEach(opt => opt.disabled = (opt.value === String(m.runnerUp)));
      }
      if (m.winner) {
        Array.from(rS.options).forEach(opt => opt.disabled = (opt.value === String(m.winner)));
      }


      wS.onchange = () => {
        m.winner = +wS.value || null;
        Array.from(rS.options).forEach(o => o.disabled = (o.value === wS.value));
        saveState();
        renderBracketManager();
      };
      rS.onchange = () => {
        m.runnerUp = +rS.value || null;
        Array.from(wS.options).forEach(o => o.disabled = (o.value === rS.value));
        saveState();
        renderBracketManager();
      };

      cont.appendChild(div);
    });

    // SF Runner‑Up Duel auto?
    const sfDuelDone = state.matches.some(x => x.phase === 'SF_DUEL' && x.participants.length);
    if (!sfDuelDone) {
      const btn = document.createElement('button');
      btn.classList.add('btn');
      btn.textContent = '▶️ Evaluate SF Heats';
      btn.disabled = state.matches
        .filter(x => x.phase === 'SF')
        .some(m => !m.winner || !m.runnerUp);

      btn.onclick = () => {
        evaluateSFHeats();
        document.getElementById('bracketPhase').value = 'SF_DUEL';
        showMessage('✅ SF Heats Evaluated');
        renderBracketManager();
      };
      cont.appendChild(wrapButton(btn));
    } else {
      cont.appendChild(makeDoneLabel('SF Heats'));
    }
    return;
  }

  // ───────────────────────────────────────
  // Phase = SF_DUEL → Winner only + one‑shot button
  // ───────────────────────────────────────
  if (phase === 'SF_DUEL') {
    // 1) Render the single SF_DUEL heat
    mset.forEach(m => {
      const div = document.createElement('div');
      div.className = 'bracket-heat';
      div.innerHTML = `<h3>${m.id}</h3>`;

      // participants line
      const names = m.participants.map(pid => {
        const d = state.drivers.find(x => x.id === pid);
        const rig = m.rigAssignments?.[pid] || '–';
        return d ? `${d.name} (Rig ${rig})` : `TBD (Rig ${rig})`;
      }).join(' vs ');
      const p = document.createElement('p');
      p.className = 'match-participants';
      p.textContent = names;
      div.appendChild(p);

      // Winner select
      const wL = document.createElement('label');
      wL.textContent = 'Winner: ';
      const wS = document.createElement('select');
      wS.innerHTML = '<option value="">–</option>';
      m.participants.forEach(pid => {
        const d = state.drivers.find(x => x.id === pid);
        if (d) wS.add(new Option(d.name, pid));
      });
      wS.value = m.winner || '';
      wL.appendChild(wS);
      div.appendChild(wL);

      wS.onchange = () => {
        m.winner = +wS.value || null;
        saveState();
        renderBracketManager();
      };

      cont.appendChild(div);
    });

    // 2) Only once the Final has all 3 slots filled do we hide the button
    const finalMatch = state.matches.find(x => x.phase === 'FINAL');
    const duelDone = finalMatch && finalMatch.participants.length === 3;

    if (!duelDone) {
      const btn = document.createElement('button');
      btn.classList.add('btn');
      btn.textContent = '▶️ Evaluate SF Duel';
      // only enabled once a winner is picked
      btn.disabled = !mset[0].winner;
      btn.onclick = () => {
        evaluateSFDuel();       // slots duel winner → Final + rigs
        showMessage('✅ SF Duel Evaluated');
        document.getElementById('bracketPhase').value = 'FINAL';
        renderBracketManager(); // re‑draw (button → ✅ label)
      };
      cont.appendChild(wrapButton(btn));
    } else {
      cont.appendChild(makeDoneLabel('SF Duel'));
    }

    return;
  }


  // ——————————————————————————————————————————————————————————
  // Phase = FINAL → Winner + Runner‑Up + “Show Podium” button
  // ——————————————————————————————————————————————————————————
  if (phase === 'FINAL') {
    mset.forEach(m => {
      const div = document.createElement('div');
      div.className = 'bracket-heat';
      div.innerHTML = `<h3>${m.id}</h3>`;

      // participants line
      const names = m.participants.map(pid => {
        const d = state.drivers.find(x => x.id === pid);
        const rig = m.rigAssignments?.[pid] || '–';
        return d ? `${d.name} (Rig ${rig})` : `TBD (Rig ${rig})`;
      }).join(' vs ');
      const p = document.createElement('p');
      p.className = 'match-participants';
      p.textContent = names;
      div.appendChild(p);

      // Winner select
      const wL = document.createElement('label');
      wL.textContent = 'Winner: ';
      const wS = document.createElement('select');
      wS.innerHTML = '<option value="">–</option>';
      m.participants.forEach(pid => {
        const d = state.drivers.find(x => x.id === pid);
        if (d) wS.add(new Option(d.name, pid));
      });
      wS.value = m.winner || '';
      wL.appendChild(wS);
      div.appendChild(wL);

      // Runner‑Up select
      const rL = document.createElement('label');
      rL.textContent = 'Runner‑Up: ';
      const rS = document.createElement('select');
      rS.innerHTML = '<option value="">–</option>';
      m.participants.forEach(pid => {
        const d = state.drivers.find(x => x.id === pid);
        if (d) rS.add(new Option(d.name, pid));
      });
      rS.value = m.runnerUp || '';
      rL.appendChild(rS);
      div.appendChild(rL);

      // enforce mutual exclusion in the render step:
      if (m.runnerUp) {
        Array.from(wS.options).forEach(opt => opt.disabled = (opt.value === String(m.runnerUp)));
      }
      if (m.winner) {
        Array.from(rS.options).forEach(opt => opt.disabled = (opt.value === String(m.winner)));
      }


      // on‑change handlers now only save & re-render
      wS.onchange = () => {
        m.winner = +wS.value || null;
        // disable the same choice in runner‑up
        Array.from(rS.options).forEach(o => o.disabled = (o.value === wS.value));
        saveState();
        renderBracketManager();
      };
      rS.onchange = () => {
        m.runnerUp = +rS.value || null;
        // disable the same choice in winner
        Array.from(wS.options).forEach(o => o.disabled = (o.value === rS.value));
        saveState();
        renderBracketManager();
      };

      cont.appendChild(div);
    });

    // Add the “Show Podium” button below
    const finalMatch = state.matches.find(x => x.phase === 'FINAL');
    const btn = document.createElement('button');
    btn.classList.add('btn');
    btn.textContent = '▶️ Show Podium';
    // only enable once both slots are picked
    btn.disabled = !(finalMatch.winner && finalMatch.runnerUp);
    btn.onclick = () => {
      const [a, b, c] = finalMatch.participants;
      const first = finalMatch.winner;
      const second = finalMatch.runnerUp;
      const third = [a, b, c].find(x => x !== first && x !== second);
      showPodiumCeremony(first, second, third);
    };
    cont.appendChild(wrapButton(btn));

    return;
  }

}

// ————————————————————
// 2) Evaluation Routines
// ————————————————————

function evaluateQFDuels() {
  state.matches
    .filter(m => m.phase === 'QF')
    .forEach(m => {
      // winners → SF
      const sfId = (m.heat === 1 || m.heat === 4) ? 'SF1' : 'SF2';
      slotToMatch(sfId, m.winner);
      assignRigsForMatch(state.matches.find(x => x.id === sfId));
    });

  // runner‑ups → QF_DUEL1 & QF_DUEL2 by RU time
  const rus = state.matches
    .filter(m => m.phase === 'QF')
    .map(m => ({ id: m.runnerUp, time: parseTimeString(m.ruTimeRaw) }))
    .sort((a, b) => a.time - b.time);
  slotToMatch('QF_DUEL1', rus[0].id);
  slotToMatch('QF_DUEL1', rus[rus.length - 1].id);
  slotToMatch('QF_DUEL2', rus[1].id);
  slotToMatch('QF_DUEL2', rus[2].id);
  ['QF_DUEL1', 'QF_DUEL2']
    .forEach(id => assignRigsForMatch(state.matches.find(x => x.id === id)));

  saveState();
}

function evaluateQFDuel() {
  state.matches
    .filter(m => m.phase === 'QF_DUEL')
    .forEach(m => {
      const sfId = (m.id === 'QF_DUEL1' ? 'SF1' : 'SF2');
      slotToMatch(sfId, m.winner);
      assignRigsForMatch(state.matches.find(x => x.id === sfId));
    });
  saveState();
}

function evaluateSFHeats() {
  // 1) Handle each semi-final heat in turn
  state.matches
    .filter(m => m.phase === 'SF')
    .forEach(m => {
      // slot winners into Final and runner-ups into SF_DUEL1
      slotToMatch('FINAL', m.winner);
      slotToMatch('SF_DUEL1', m.runnerUp);

      // **assign rigs for THIS SF heat** and bump each driver.lastRig
      assignRigsForMatch(m);
    });

  // 2) Only once both runner-ups are in SF_DUEL1, assign that duel its rigs
  const sfDuel = state.matches.find(m => m.phase === 'SF_DUEL');
  if (sfDuel && sfDuel.participants.length === 2) {
    assignRigsForMatch(sfDuel);
  }

  saveState();

  // 3) Move you on to the duel view
  document.getElementById('bracketPhase').value = 'SF_DUEL';
  renderBracketManager();
  showMessage('✅ SF Heats Evaluated');
}


function evaluateSFDuel() {
  const duel = state.matches.find(m => m.phase === 'SF_DUEL');
  slotToMatch('FINAL', duel.winner);
  assignRigsForMatch(state.matches.find(x => x.id === 'FINAL'));
  saveState();
}

// ————————————————————
// 3) Utility Helpers
// ————————————————————

/** Add .button-group wrapper for consistent styling */
function wrapButton(btn) {
  const wrap = document.createElement('div');
  wrap.className = 'button-group';
  wrap.appendChild(btn);
  return wrap;
}

/** Show green “✅ [name] Already Evaluated” label */
function makeDoneLabel(name) {
  const lbl = document.createElement('div');
  lbl.className = 'evaluated-label';
  lbl.textContent = `✅ ${name} Already Evaluated`;
  return lbl;
}




// ---------- Evaluate QF Duels ----------
function evaluateQFDuels() {

  // — bail out if QF‑Duels already have rigs assigned —
  const duel1 = state.matches.find(m => m.id === 'QF_DUEL1');
  if (
    duel1 &&
    duel1.rigAssignments &&
    Object.keys(duel1.rigAssignments).length > 0
  ) {
    showMessage('✅ QF Duels already evaluated - Rigs Locked.');
    return;
  }

  // 1) Validate all QF heats have a winner, runner‑up & RU time
  const qfMatches = state.matches.filter(m => m.phase === 'QF');
  for (const m of qfMatches) {
    if (!m.winner || !m.runnerUp || !m.ruTimeRaw) {
      return alert(`Fill Winner, Runner-Up & RU Time for ${m.id}`);
    }
  }

  // 2) Slot QF winners into Semis
  qfMatches.forEach(m => {
    const targetSF = (m.heat === 1 || m.heat === 4) ? 'SF1' : 'SF2';
    slotToMatch(targetSF, m.winner);
  });

  // 3) Collect & sort runner‑ups by their RU time
  const sortedRUs = qfMatches
    .map(m => ({ id: m.runnerUp, time: parseTimeString(m.ruTimeRaw) }))
    .sort((a, b) => a.time - b.time)
    .map(x => x.id);

  // 4) Slot fastest/slower into the two Duels
  slotToMatch('QF_DUEL1', sortedRUs[0]);
  slotToMatch('QF_DUEL1', sortedRUs[sortedRUs.length - 1]);
  slotToMatch('QF_DUEL2', sortedRUs[1]);
  slotToMatch('QF_DUEL2', sortedRUs[2]);

  // 5) NOW assign cockpits for each Duel match
  state.matches
    .filter(m => m.phase === 'QF_DUEL')
    .forEach(match => {
      match.rigAssignments = {};        // reset in case
      const taken = new Set();

      match.participants.forEach(pid => {
        const driver = state.drivers.find(d => d.id === pid);
        // compute next after lastRig
        let idx = driver.lastRig
          ? (cockpits.indexOf(driver.lastRig) + 1) % cockpits.length
          : 0;
        let rig = cockpits[idx];

        // bump until free
        while (taken.has(rig)) {
          idx = (idx + 1) % cockpits.length;
          rig = cockpits[idx];
        }

        // record it
        match.rigAssignments[pid] = rig;
        taken.add(rig);

        // update driver for next phase
        driver.lastRig = rig;
        driver.sessionCount = (driver.sessionCount || 4) + 1;
      });
    });

  // 6) Save & re‑render Duels
  saveState();
  document.getElementById('bracketPhase').value = 'QF_DUEL';
  renderBracketManager();
  showMessage('✅ QF Duels evaluated');
}

// ---------- Slot Helper ----------
function slotToMatch(matchId, pid) {
  const m = state.matches.find(x => x.id === matchId);
  if (m && !m.participants.includes(pid)) {
    m.participants.push(pid);
  }
}

// ---------- Automated Download Backup (with local‐time filename) ----------
function autoBackup() {
  // 1) Serialize state to JSON
  const dataStr = JSON.stringify(state, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });

  // 2) Build a local‐time timestamp string: YYYY-MM-DDTHH-mm-ss-SSS
  const d = new Date();
  const pad2 = n => String(n).padStart(2, '0');
  const pad3 = n => String(n).padStart(3, '0');
  const ts = [
    d.getFullYear(),
    pad2(d.getMonth() + 1),
    pad2(d.getDate())
  ].join('-') +
    'T' + [
      pad2(d.getHours()),
      pad2(d.getMinutes()),
      pad2(d.getSeconds())
    ].join('-') +
    '-' + pad3(d.getMilliseconds());

  // 3) Create the download link and click it
  const filename = `race-backup-${ts}.json`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}


// ---------- Clock-Aligned 15-Minute Backups ----------
function scheduleAlignedBackups() {
  const now = new Date();
  const minute = now.getMinutes();
  const second = now.getSeconds();
  const millisecond = now.getMilliseconds();

  // Calculate ms until the next quarter-hour (0,15,30,45)
  const minsToNext = 10 - (minute % 10);
  const initialDelay = ((minsToNext * 60) - second) * 1000 - millisecond;

  // First backup at the next quarter-hour mark…
  setTimeout(() => {
    autoBackup();

    // …then every 10 minutes on the quarter
    setInterval(autoBackup, 10 * 60 * 1000);
  }, initialDelay);
}

function showPodiumCeremony(winnerId, runnerUpId, thirdId) {
  const first = state.drivers.find(d => d.id === winnerId)?.name || 'TBD';
  const second = state.drivers.find(d => d.id === runnerUpId)?.name || 'TBD';
  const third = state.drivers.find(d => d.id === thirdId)?.name || 'TBD';

  document.getElementById('podium-first').textContent = first;
  document.getElementById('podium-second').textContent = second;
  document.getElementById('podium-third').textContent = third;

  // compute & display the day’s fastest
  const leader = computeDayBest();  // your helper that returns { name, bestMs }
  const fastEl = document.getElementById('fastest-of-day');
  if (leader) {
    fastEl.textContent =
      `🏎️ Fastest Driver of the Day: ${leader.name} (${formatTime(leader.bestMs)})`;
  } else {
    fastEl.textContent = '';
  }

  const pod = document.getElementById('podium');
  pod.classList.remove('hidden');
  // trigger fade‑in
  setTimeout(() => pod.classList.add('visible'), 50);
}


// ---------- Initial Render ----------
function renderAll() {
  renderDriversList();
  renderQ1(); renderQ2(); renderQ3();
  renderBracketManager();
}
renderAll();
scheduleAlignedBackups();

// Helper: load an <img> into a base64 string
function loadImageAsDataURL(url) {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      c.getContext('2d').drawImage(img, 0, 0);
      resolve(c.toDataURL('image/png'));
    };
    img.src = url;
  });
}

// Compute each driver’s absolute best among Q1/Q2/Q3
function getDriversBestSorted() {
  const arr = state.drivers.map(d => {
    // gather all valid times
    const times = [d.q1Best, d.q2Best, d.q3Best].filter(t => t != null);
    const bestMs = times.length ? Math.min(...times) : null;
    return { name: d.name, bestMs };
  })
    // drop anyone with no valid time, sort ascending
    .filter(x => x.bestMs != null)
    .sort((a, b) => a.bestMs - b.bestMs);
  return arr;
}

// Main: build & download the PDF
async function generateReportPDF() {
  const { jsPDF } = window.jspdf;
  // 1. Create a true A4‑landscape doc in “points” so we have plenty of room
  const doc = new jsPDF({
    unit: 'pt',
    format: 'a4',
    orientation: 'portrait'
  });

  // 2. Draw the RAW logo at top‑left (40pt margin)
  // const logoEl = document.querySelector('.raw-logo');
  // if (logoEl) {
  //   const imgData = await loadImageAsDataURL(logoEl.src);
  //   doc.addImage(imgData, 'PNG', 40, 30, 60, 0);
  // }

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // 1) Centered Title
  doc.setFontSize(20);
  doc.text(
    'RAW F1 Tournament - Spa-Francorchamps Sim-Race Report',
    pageWidth / 2,
    60,
    {
      align: 'center',
      fontStyle: 'bold'
    }
  );

  // 4. Build table data
  const data = getDriversBestSorted(); // as before
  const leaderTime = data.length ? data[0].bestMs : 0;
  const body = data.map((d, i) => [
    i + 1,
    d.name,
    formatTime(d.bestMs),
    '+' + formatTime(d.bestMs - leaderTime)
  ]);

  // Compute margins and total table width
  const margin = { left: 40, right: 40, bottom: 40 };
  const tableWidth = pageWidth - margin.left - margin.right;

  // Assign column widths (in points)
  const col0 = 24;   // “#”
  const col2 = 60;  // “Best Lap”
  const col3 = 60;  // “Gap”
  const col1 = tableWidth - col0 - col2 - col3; // “Driver” fills the rest

  // 5. AutoTable: single‑page layout
  doc.autoTable({
    startY: 80,
    margin,
    tableWidth,
    head: [['#', 'Driver', 'Best Lap', 'Gap']],
    body,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 4,
      overflow: 'linebreak'
    },
    headStyles: {
      fillColor: [21, 101, 192],
      textColor: 255,
      fontStyle: 'bold'
    },
    columnStyles: {
      0: { cellWidth: col0, halign: 'center' },
      1: { cellWidth: col1, halign: 'left' },
      2: { cellWidth: col2, halign: 'center' },
      3: { cellWidth: col3, halign: 'center' }
    },
    pageBreak: 'avoid'
  });

  // 6. Footer
  doc.setFontSize(8);
  doc.text(
    '© 2025 Race At Will',
    40,
    doc.internal.pageSize.getHeight() - 30
  );

  // 7. Save
  doc.save('RAW_F1_Tournament_SpaSimRace_Report.pdf');
}

// hook it up
document
  .getElementById('downloadReportBtn')
  .addEventListener('click', generateReportPDF);


// hook it up
document
  .getElementById('downloadReportBtn')
  .addEventListener('click', generateReportPDF);


// wire the button
document
  .getElementById('downloadReportBtn')
  .addEventListener('click', generateReportPDF);
