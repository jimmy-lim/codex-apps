(() => {
  const boardEl = document.getElementById('board');
  const overlayEl = document.getElementById('overlay');
  const newGameBtn = document.getElementById('newGameBtn');
  const resetScoresBtn = document.getElementById('resetScoresBtn');
  const cpuToggle = document.getElementById('cpuToggle');
  const xWinsEl = document.getElementById('xWins');
  const oWinsEl = document.getElementById('oWins');
  const drawsEl = document.getElementById('draws');

  const WINS = [
    [0,1,2], [3,4,5], [6,7,8], // rows
    [0,3,6], [1,4,7], [2,5,8], // cols
    [0,4,8], [2,4,6]           // diagonals
  ];

  const state = {
    board: Array(9).fill(null),
    turn: 'X',
    over: false,
    vsCpu: false,
    scores: { X: 0, O: 0, D: 0 },
  };

  // Load scores from localStorage
  try {
    const saved = JSON.parse(localStorage.getItem('ttt-scores') || 'null');
    if (saved && typeof saved === 'object') {
      state.scores = { ...state.scores, ...saved };
    }
  } catch {}

  function saveScores() {
    try { localStorage.setItem('ttt-scores', JSON.stringify(state.scores)); } catch {}
  }

  function updateScoresUI() {
    xWinsEl.textContent = String(state.scores.X);
    oWinsEl.textContent = String(state.scores.O);
    drawsEl.textContent = String(state.scores.D);
  }

  function cellButton(i) {
    const b = document.createElement('button');
    b.className = 'cell';
    b.type = 'button';
    b.setAttribute('role', 'gridcell');
    b.setAttribute('aria-label', `Cell ${i + 1}`);
    b.dataset.index = i;
    b.addEventListener('click', () => onPlayerMove(i));
    return b;
  }

  function render() {
    // Render marks and interactivity
    for (let i = 0; i < 9; i++) {
      const btn = boardEl.children[i];
      btn.textContent = state.board[i] || '';
      btn.classList.toggle('blocked', !!state.board[i] || state.over);
    }
  }

  function setOverlay(msg) {
    if (!msg) {
      overlayEl.classList.add('hidden');
      overlayEl.textContent = '';
    } else {
      overlayEl.textContent = msg;
      overlayEl.classList.remove('hidden');
    }
  }

  function lineWinner(b, a, c, d) {
    const v = b[a];
    return v && v === b[c] && v === b[d] ? v : null;
  }

  function getWinner(b) {
    for (const [a, c, d] of WINS) {
      const w = lineWinner(b, a, c, d);
      if (w) return { winner: w, line: [a, c, d] };
    }
    if (b.every(Boolean)) return { winner: null, line: null, draw: true };
    return null;
  }

  function onPlayerMove(i) {
    if (state.over || state.board[i]) return;
    state.board[i] = state.turn;
    const outcome = getWinner(state.board);
    if (outcome) return endGame(outcome);
    state.turn = state.turn === 'X' ? 'O' : 'X';
    render();
    maybeCpuMove();
  }

  function endGame(outcome) {
    state.over = true;
    render();
    if (outcome.draw) {
      state.scores.D++;
      setOverlay('Draw!');
    } else if (outcome.winner) {
      state.scores[outcome.winner]++;
      setOverlay(`${outcome.winner} wins!`);
      // Highlight win line
      if (outcome.line) {
        for (const i of outcome.line) {
          boardEl.children[i].classList.add('win');
        }
      }
    }
    updateScoresUI();
    saveScores();
  }

  function resetBoard(next = 'X') {
    state.board.fill(null);
    state.turn = next;
    state.over = false;
    setOverlay('');
    for (const c of boardEl.children) c.classList.remove('win');
    render();
  }

  function maybeCpuMove() {
    if (!state.vsCpu || state.over) return;
    if (state.turn !== 'O') return; // Human is X, CPU is O

    // Slight delay for UX
    setTimeout(() => {
      const idx = bestCpuMove(state.board);
      if (idx != null && state.board[idx] == null) {
        state.board[idx] = 'O';
      }
      const outcome = getWinner(state.board);
      if (outcome) return endGame(outcome);
      state.turn = 'X';
      render();
    }, 120);
  }

  function bestCpuMove(b) {
    const me = 'O', you = 'X';
    const empties = [];
    for (let i = 0; i < 9; i++) if (!b[i]) empties.push(i);
    // 1) Win if possible
    for (const i of empties) {
      b[i] = me; if (getWinner(b)?.winner === me) { b[i] = null; return i; } b[i] = null;
    }
    // 2) Block if needed
    for (const i of empties) {
      b[i] = you; if (getWinner(b)?.winner === you) { b[i] = null; return i; } b[i] = null;
    }
    // 3) Center
    if (b[4] == null) return 4;
    // 4) Corners
    for (const i of [0,2,6,8]) if (b[i] == null) return i;
    // 5) Sides
    for (const i of [1,3,5,7]) if (b[i] == null) return i;
    return empties[0] ?? null;
  }

  // Init UI
  boardEl.innerHTML = '';
  for (let i = 0; i < 9; i++) boardEl.appendChild(cellButton(i));
  updateScoresUI();
  render();

  newGameBtn.addEventListener('click', () => {
    const next = state.over ? 'X' : (state.turn === 'X' ? 'O' : 'X');
    resetBoard(next);
  });
  resetScoresBtn.addEventListener('click', () => {
    state.scores = { X: 0, O: 0, D: 0 };
    updateScoresUI();
    saveScores();
  });
  cpuToggle.addEventListener('change', (e) => {
    state.vsCpu = !!e.target.checked;
    if (state.vsCpu && state.turn === 'O' && !state.over) maybeCpuMove();
  });
})();

