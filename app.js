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

// ---------- Seed 25 Drivers if Empty ----------
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
//     seed: null
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
  const contact = e.target.regContact.value.trim();
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
    contact,                // store the contact
    q1Rig: null, q1BestRaw: "", q1Best: null, status: "in",
    q2Rig: null, q2BestRaw: "", q2Best: null,
    q3Rig: null, q3BestRaw: "", q3Best: null,
    seed: null
  });
  saveState();
  e.target.reset();
  alert(`Added Driver #${next}`);
  renderAll();
};


// ---------- 2. Drivers List & Assign Q1 ----------
document.getElementById('assignQ1Btn').onclick = () => {
  state.drivers.forEach(d => {
    d.q1Rig = cockpits[(d.id - 1) % cockpits.length];
    d.status = "in";
  });
  saveState(); renderDriversList();
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

  // 2) Compute number to eliminate (30% of total, rounded up)
  const eliminateCount = Math.ceil(totalCount * 0.3);

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
};

document.getElementById('assignQ2Btn').onclick = () => {
  state.drivers.filter(d => d.status === "in")
    .forEach(d => d.q2Rig = cockpits[(d.id) % cockpits.length]);
  saveState(); renderAll();
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

  list.forEach((d, idx) => {
    const tr = document.createElement('tr');
    if (d.status === 'out') tr.classList.add('eliminated');

    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${d.name}</td>
      <td>${d.q1Rig}</td>
      <td><input type="text" value="${d.q1BestRaw || ''}" placeholder="m:ss:ms or DNF"></td>
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
}

// ---------- 4. Q2 – Eval & Assign Q3 ----------
document.getElementById('evalQ2Btn').onclick = () => {
  // 1) Full Q2 field
  const participants = state.drivers.filter(d => d.q2Rig);
  const totalCount = participants.length;
  const keepCount = 16;
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
};

document.getElementById('assignQ3Btn').onclick = () => {
  state.drivers.filter(d => d.status === "in")
    .forEach(d => d.q3Rig = cockpits[(d.id + 1) % cockpits.length]);
  saveState(); renderAll();
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

  list.forEach((d, idx) => {
    const tr = document.createElement('tr');
    if (d.status === 'out') tr.classList.add('eliminated');

    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${d.name}</td>
      <td>${d.q2Rig}</td>
      <td><input type="text" value="${d.q2BestRaw || ''}" placeholder="m:ss:ms or DNF"></td>
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
    d.status = 'seeded';
  });

  saveState();
  renderAll();
  showMessage(`✅ Q3 evaluated (seeded ${Math.min(seeds.length, seedCount)} of ${totalCount})`);
};

document.getElementById('prepBracketBtn').onclick = () => {
  state.matches = [];
  const seeds = state.drivers.filter(d => d.seed).sort((a, b) => a.seed - b.seed);
  // QF Heats
  [[1, 8, 9], [2, 7, 10], [3, 6, 11], [4, 5, 12]].forEach((grp, i) => {
    state.matches.push({
      id: `QF${i + 1}`, phase: 'QF', heat: i + 1,
      participants: grp.map(s => seeds.find(d => d.seed === s).id),
      winner: null, runnerUp: null, ruTimeRaw: ""
    });
  });
  // QF Duels
  state.matches.push({ id: 'QF_DUEL1', phase: 'QF_DUEL', heat: 1, participants: [], winner: null });
  state.matches.push({ id: 'QF_DUEL2', phase: 'QF_DUEL', heat: 2, participants: [], winner: null });
  // SF Heats
  state.matches.push({ id: 'SF1', phase: 'SF', heat: 1, participants: [], winner: null, runnerUp: null });
  state.matches.push({ id: 'SF2', phase: 'SF', heat: 2, participants: [], winner: null, runnerUp: null });
  // SF Duel
  state.matches.push({ id: 'SF_DUEL1', phase: 'SF_DUEL', heat: 1, participants: [], winner: null });
  // Final
  state.matches.push({ id: 'FINAL1', phase: 'FINAL', heat: 1, participants: [], winner: null, runnerUp: null });
  saveState();
  renderBracketManager();
  showMessage('✅ Race Format Prepared!');
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

  list.forEach((d, idx) => {
    const tr = document.createElement('tr');
    if (d.status === 'out') tr.classList.add('eliminated');

    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${d.name}</td>
      <td>${d.q3Rig}</td>
      <td><input type="text" value="${d.q3BestRaw || ''}" placeholder="m:ss:ms or DNF"></td>
      <td>${d.seed || ''}</td>
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
}

// ---------- 6. Bracket Manager ----------
document.getElementById('bracketPhase').onchange = renderBracketManager;
function renderBracketManager() {
  const phase = document.getElementById('bracketPhase').value;
  const cont = document.getElementById('bracketManager');
  cont.innerHTML = '';
  const mset = state.matches.filter(m => m.phase === phase);
  if (!mset.length) {
    cont.textContent = 'No matches in this phase.';
    return;
  }

  if (phase === 'QF') {
    mset.forEach(m => {
      const div = document.createElement('div');
      div.className = 'bracket-heat';
      div.innerHTML = `<h3>${m.id}</h3>`;
      // seeds
      const names = m.participants.map(pid => {
        const d = state.drivers.find(x => x.id === pid);
        return d ? d.name : 'TBD';
      });
      const p = document.createElement('p');
      p.className = 'match-participants';
      p.textContent = names.join(' vs ');
      div.appendChild(p);
      // winner
      const wL = document.createElement('label');
      wL.textContent = 'Winner: ';
      const wS = document.createElement('select');
      wS.innerHTML = '<option>–</option>';
      m.participants.forEach(pid => {
        const d = state.drivers.find(x => x.id === pid);
        if (d) wS.add(new Option(d.name, pid));
      });
      wS.value = m.winner || '';
      wL.appendChild(wS);
      div.appendChild(wL);
      // runnerUp
      const rL = document.createElement('label');
      rL.textContent = 'Runner-Up: ';
      const rS = document.createElement('select');
      rS.innerHTML = '<option>–</option>';
      m.participants.forEach(pid => {
        const d = state.drivers.find(x => x.id === pid);
        if (d) rS.add(new Option(d.name, pid));
      });
      rS.value = m.runnerUp || '';
      rL.appendChild(rS);
      div.appendChild(rL);
      // RU time
      const tL = document.createElement('label');
      tL.textContent = 'RU Time: ';
      const tI = document.createElement('input');
      tI.type = 'text'; tI.placeholder = 'm:ss:ms'; tI.value = m.ruTimeRaw || '';
      tI.onchange = () => {
        m.ruTimeRaw = tI.value.trim();
        saveState();
      };
      tL.appendChild(tI);
      div.appendChild(tL);

      // change handlers
      wS.onchange = () => {
        m.winner = +wS.value || null;
        Array.from(rS.options).forEach(o => o.disabled = (o.value === wS.value));
        saveState();
      };
      rS.onchange = () => {
        m.runnerUp = +rS.value || null;
        saveState();
      };

      cont.appendChild(div);
    });
    const btn = document.createElement('button');
    btn.textContent = 'Evaluate QF Duels';
    btn.onclick = evaluateQFDuels;
    cont.appendChild(btn);
    return;
  }

  // QF DUEL
  if (phase === 'QF_DUEL') {
    mset.forEach(m => {
      const div = document.createElement('div');
      div.className = 'bracket-heat';
      div.innerHTML = `<h3>${m.id}</h3>`;
      const names = m.participants.map(pid => {
        const d = state.drivers.find(x => x.id === pid);
        return d ? d.name : 'TBD';
      });
      const p = document.createElement('p');
      p.className = 'match-participants';
      p.textContent = names.join(' vs ');
      div.appendChild(p);
      const wL = document.createElement('label');
      wL.textContent = 'Winner: ';
      const wS = document.createElement('select');
      wS.innerHTML = '<option>–</option>';
      m.participants.forEach(pid => {
        const d = state.drivers.find(x => x.id === pid);
        if (d) wS.add(new Option(d.name, pid));
      });
      wS.value = m.winner || '';
      wL.appendChild(wS); div.appendChild(wL);
      wS.onchange = () => {
        m.winner = +wS.value || null;
        slotToMatch((m.heat === 1 ? 'SF1' : 'SF2'), m.winner);
        saveState(); renderBracketManager();
      };
      cont.appendChild(div);
    });
    return;
  }

  // SF
  if (phase === 'SF') {
    mset.forEach(m => {
      const div = document.createElement('div');
      div.className = 'bracket-heat';
      div.innerHTML = `<h3>${m.id}</h3>`;
      const names = m.participants.map(pid => {
        const d = state.drivers.find(x => x.id === pid);
        return d ? d.name : 'TBD';
      });
      const p = document.createElement('p');
      p.className = 'match-participants';
      p.textContent = names.join(' vs ');
      div.appendChild(p);
      // winner
      const wL = document.createElement('label');
      wL.textContent = 'Winner: ';
      const wS = document.createElement('select');
      wS.innerHTML = '<option>–</option>';
      m.participants.forEach(pid => {
        const d = state.drivers.find(x => x.id === pid);
        if (d) wS.add(new Option(d.name, pid));
      });
      wS.value = m.winner || '';
      wL.appendChild(wS); div.appendChild(wL);
      // runnerUp
      const rL = document.createElement('label');
      rL.textContent = 'Runner-Up: ';
      const rS = document.createElement('select');
      rS.innerHTML = '<option>–</option>';
      m.participants.forEach(pid => {
        const d = state.drivers.find(x => x.id === pid);
        if (d) rS.add(new Option(d.name, pid));
      });
      rS.value = m.runnerUp || '';
      rL.appendChild(rS); div.appendChild(rL);
      // handlers
      wS.onchange = () => {
        m.winner = +wS.value || null;
        Array.from(rS.options).forEach(o => o.disabled = (o.value === wS.value));
        saveState();
      };
      rS.onchange = () => {
        m.runnerUp = +rS.value || null;
        slotToMatch('FINAL1', m.winner);
        slotToMatch('SF_DUEL1', m.runnerUp);
        saveState(); renderBracketManager();
      };
      cont.appendChild(div);
    });
    return;
  }

  // SF_DUEL
  if (phase === 'SF_DUEL') {
    mset.forEach(m => {
      const div = document.createElement('div');
      div.className = 'bracket-heat';
      div.innerHTML = `<h3>${m.id}</h3>`;
      const names = m.participants.map(pid => {
        const d = state.drivers.find(x => x.id === pid);
        return d ? d.name : 'TBD';
      });
      const p = document.createElement('p');
      p.className = 'match-participants';
      p.textContent = names.join(' vs ');
      div.appendChild(p);
      const wL = document.createElement('label');
      wL.textContent = 'Winner: ';
      const wS = document.createElement('select');
      wS.innerHTML = '<option>–</option>';
      m.participants.forEach(pid => {
        const d = state.drivers.find(x => x.id === pid);
        if (d) wS.add(new Option(d.name, pid));
      });
      wS.value = m.winner || '';
      wL.appendChild(wS); div.appendChild(wL);
      wS.onchange = () => {
        m.winner = +wS.value || null;
        slotToMatch('FINAL1', m.winner);
        saveState(); renderBracketManager();
      };
      cont.appendChild(div);
    });
    return;
  }

  // FINAL
  if (phase === 'FINAL') {
    mset.forEach(m => {
      const div = document.createElement('div');
      div.className = 'bracket-heat';
      div.innerHTML = `<h3>${m.id}</h3>`;
      const names = m.participants.map(pid => {
        const d = state.drivers.find(x => x.id === pid);
        return d ? d.name : 'TBD';
      });
      const p = document.createElement('p');
      p.className = 'match-participants';
      p.textContent = names.join(' vs ');
      div.appendChild(p);
      // Winner
      const wL = document.createElement('label');
      wL.textContent = 'Winner: ';
      const wS = document.createElement('select');
      wS.innerHTML = '<option>–</option>';
      m.participants.forEach(pid => {
        const d = state.drivers.find(x => x.id === pid);
        if (d) wS.add(new Option(d.name, pid));
      });
      wS.value = m.winner || '';
      wL.appendChild(wS); div.appendChild(wL);
      // RunnerUp
      const rL = document.createElement('label');
      rL.textContent = 'Runner-Up: ';
      const rS = document.createElement('select');
      rS.innerHTML = '<option>–</option>';
      m.participants.forEach(pid => {
        const d = state.drivers.find(x => x.id === pid);
        if (d) rS.add(new Option(d.name, pid));
      });
      rS.value = m.runnerUp || '';
      rL.appendChild(rS); div.appendChild(rL);
      // handlers
      wS.onchange = () => {
        m.winner = +wS.value || null;
        Array.from(rS.options).forEach(o => o.disabled = (o.value === wS.value));
        saveState();
      };
      rS.onchange = () => {
        m.runnerUp = +rS.value || null;
        // bronze is the remaining ID
        const [a, b, c] = m.participants;
        const podium = [m.winner, m.runnerUp, [a, b, c].find(x => x !== m.winner && x !== m.runnerUp)];
        alert(`🥇 ${state.drivers.find(d => d.id === podium[0]).name}\n🥈 ${state.drivers.find(d => d.id === podium[1]).name}\n🥉 ${state.drivers.find(d => d.id === podium[2]).name}`);
      };
      cont.appendChild(div);
    });
  }
}

// ---------- Evaluate QF Duels ----------
function evaluateQFDuels() {
  const qf = state.matches.filter(m => m.phase === 'QF');
  for (const m of qf) {
    if (!m.winner || !m.runnerUp || !m.ruTimeRaw) {
      return alert(`Fill Winner, Runner-Up & RU Time for ${m.id}`);
    }
  }
  // slot QF winners → SF
  qf.forEach(m => {
    const sf = (m.heat === 1 || m.heat === 4) ? 'SF1' : 'SF2';
    slotToMatch(sf, m.winner);
  });
  // collect RU times
  const rus = qf.map(m => ({
    id: m.runnerUp,
    time: parseTimeString(m.ruTimeRaw)
  })).sort((a, b) => a.time - b.time);
  // Duel A: fastest vs slowest
  slotToMatch('QF_DUEL1', rus[0].id);
  slotToMatch('QF_DUEL1', rus[rus.length - 1].id);
  // Duel B: middle two
  slotToMatch('QF_DUEL2', rus[1].id);
  slotToMatch('QF_DUEL2', rus[2].id);

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


// ---------- Initial Render ----------
function renderAll() {
  renderDriversList();
  renderQ1(); renderQ2(); renderQ3();
  renderBracketManager();
}
renderAll();
scheduleAlignedBackups();