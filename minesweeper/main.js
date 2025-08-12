(() => {
  const boardEl = document.getElementById('board');
  const overlayEl = document.getElementById('overlay');
  const minesLeftEl = document.getElementById('minesLeft');
  const timeEl = document.getElementById('time');
  const statusEl = document.getElementById('status');
  const difficultySel = document.getElementById('difficulty');
  const newGameBtn = document.getElementById('newGameBtn');

  // Difficulty presets
  const PRESETS = {
    beginner: { cols: 9, rows: 9, mines: 10 },
    intermediate: { cols: 16, rows: 16, mines: 40 },
    expert: { cols: 30, rows: 16, mines: 99 },
  };

  const S = {
    cols: PRESETS.beginner.cols,
    rows: PRESETS.beginner.rows,
    mines: PRESETS.beginner.mines,
    firstClick: true,
    grid: [], // {mine:boolean, rev:boolean, flag:boolean, n:number}
    alive: true,
    startedAt: 0,
    time: 0,
    timerHandle: null,
    flags: 0,
    revealed: 0,
  };

  function setOverlay(msg) {
    if (!msg) overlayEl.classList.add('hidden');
    else { overlayEl.textContent = msg; overlayEl.classList.remove('hidden'); }
  }

  function setStatus(msg) { statusEl.textContent = msg; }

  function updateCounters() {
    minesLeftEl.textContent = String(Math.max(0, S.mines - S.flags));
    timeEl.textContent = String(S.time);
  }

  function stopTimer() { if (S.timerHandle) { clearInterval(S.timerHandle); S.timerHandle = null; } }
  function startTimer() {
    S.startedAt = Date.now() - S.time * 1000;
    if (!S.timerHandle) S.timerHandle = setInterval(() => {
      S.time = Math.floor((Date.now() - S.startedAt) / 1000);
      updateCounters();
    }, 250);
  }

  function newGame() {
    const preset = PRESETS[difficultySel.value] || PRESETS.beginner;
    S.cols = preset.cols; S.rows = preset.rows; S.mines = preset.mines;
    S.firstClick = true; S.alive = true; S.flags = 0; S.revealed = 0; S.time = 0;
    stopTimer(); updateCounters(); setStatus('Ready');
    // Setup grid
    S.grid = Array.from({ length: S.rows }, () => Array.from({ length: S.cols }, () => ({ mine: false, rev: false, flag: false, n: 0 })));
    // Render cells
    boardEl.style.setProperty('--cols', String(S.cols));
    boardEl.style.setProperty('--rows', String(S.rows));
    boardEl.innerHTML = '';
    for (let r = 0; r < S.rows; r++) {
      for (let c = 0; c < S.cols; c++) {
        const btn = document.createElement('button');
        btn.className = 'cell';
        btn.type = 'button';
        btn.setAttribute('role', 'gridcell');
        btn.dataset.r = String(r);
        btn.dataset.c = String(c);
        btn.addEventListener('click', onRevealClick);
        btn.addEventListener('contextmenu', onFlagContext);
        btn.addEventListener('auxclick', (e) => { if (e.button === 1) onChord(r, c); });
        btn.addEventListener('mousedown', (e) => { if (e.shiftKey && e.button === 0) { e.preventDefault(); toggleFlag(r, c); } });
        btn.addEventListener('dblclick', () => onChord(r, c));
        boardEl.appendChild(btn);
      }
    }
    setOverlay('');
  }

  function inBounds(r, c) { return r >= 0 && r < S.rows && c >= 0 && c < S.cols; }
  function forNeighbors(r, c, cb) {
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr, nc = c + dc;
      if (inBounds(nr, nc)) cb(nr, nc);
    }
  }

  function placeMines(avoidR, avoidC) {
    let placed = 0;
    const forbidden = new Set();
    forbidden.add(avoidR + ',' + avoidC);
    forNeighbors(avoidR, avoidC, (r, c) => forbidden.add(r + ',' + c)); // make first click area safe
    while (placed < S.mines) {
      const r = Math.floor(Math.random() * S.rows);
      const c = Math.floor(Math.random() * S.cols);
      const key = r + ',' + c;
      if (forbidden.has(key) || S.grid[r][c].mine) continue;
      S.grid[r][c].mine = true; placed++;
    }
    // Compute numbers
    for (let r = 0; r < S.rows; r++) {
      for (let c = 0; c < S.cols; c++) {
        if (S.grid[r][c].mine) continue;
        let n = 0; forNeighbors(r, c, (nr, nc) => { if (S.grid[nr][nc].mine) n++; });
        S.grid[r][c].n = n;
      }
    }
  }

  function onRevealClick(e) {
    if (!S.alive) { newGame(); return; }
    const btn = e.currentTarget;
    const r = Number(btn.dataset.r), c = Number(btn.dataset.c);
    if (S.grid[r][c].flag) return; // flagged
    if (S.firstClick) { placeMines(r, c); startTimer(); S.firstClick = false; setStatus('Playing'); }
    reveal(r, c);
    checkWin();
  }

  function onFlagContext(e) {
    e.preventDefault();
    const btn = e.currentTarget;
    const r = Number(btn.dataset.r), c = Number(btn.dataset.c);
    toggleFlag(r, c);
  }

  function toggleFlag(r, c) {
    if (!S.alive) return;
    const cell = S.grid[r][c];
    if (cell.rev) return;
    cell.flag = !cell.flag;
    S.flags += cell.flag ? 1 : -1;
    paintCell(r, c);
    updateCounters();
  }

  function reveal(r, c) {
    if (!inBounds(r, c)) return;
    const cell = S.grid[r][c];
    if (cell.rev || cell.flag) return;
    cell.rev = true; S.revealed++;
    if (cell.mine) { onMine(r, c); return; }
    paintCell(r, c);
    if (cell.n === 0) {
      // Flood fill
      const q = [[r, c]]; const seen = new Set([r + ',' + c]);
      while (q.length) {
        const [cr, cc] = q.shift();
        forNeighbors(cr, cc, (nr, nc) => {
          const k = nr + ',' + nc;
          const ncell = S.grid[nr][nc];
          if (seen.has(k) || ncell.rev || ncell.flag) return;
          ncell.rev = true; S.revealed++; paintCell(nr, nc);
          if (!ncell.mine && ncell.n === 0) { q.push([nr, nc]); seen.add(k); }
        });
      }
    }
  }

  function onChord(r, c) {
    if (!S.alive || !inBounds(r, c)) return;
    const cell = S.grid[r][c];
    if (!cell.rev || cell.n <= 0) return;
    let flags = 0; forNeighbors(r, c, (nr, nc) => { if (S.grid[nr][nc].flag) flags++; });
    if (flags !== cell.n) return;
    forNeighbors(r, c, (nr, nc) => { if (!S.grid[nr][nc].flag && !S.grid[nr][nc].rev) reveal(nr, nc); });
    checkWin();
  }

  function onMine(r, c) {
    S.alive = false; stopTimer(); setStatus('Boom!');
    paintAll(true, r, c);
    setOverlay('Game Over — click New Game to try again');
  }

  function checkWin() {
    const totalSafe = S.rows * S.cols - S.mines;
    if (S.revealed >= totalSafe && S.alive) {
      S.alive = false; stopTimer(); setStatus('Cleared!');
      // Auto-flag remaining
      for (let r = 0; r < S.rows; r++) for (let c = 0; c < S.cols; c++) {
        const cell = S.grid[r][c];
        if (!cell.rev && cell.mine) { cell.flag = true; S.flags++; paintCell(r, c); }
      }
      updateCounters();
      setOverlay('You win!');
    }
  }

  function paintAll(showMines = false, boomR = -1, boomC = -1) {
    for (let r = 0; r < S.rows; r++) for (let c = 0; c < S.cols; c++) paintCell(r, c, showMines, boomR, boomC);
  }

  function paintCell(r, c, showMines = false, boomR = -1, boomC = -1) {
    const i = r * S.cols + c;
    const btn = boardEl.children[i];
    const cell = S.grid[r][c];
    btn.className = 'cell';
    btn.textContent = '';
    if (cell.rev) {
      btn.classList.add('revealed');
      if (cell.mine) {
        btn.classList.add('mine');
        btn.textContent = '💣';
        if (r === boomR && c === boomC) btn.classList.add('boom');
      } else if (cell.n > 0) {
        btn.textContent = String(cell.n);
        btn.classList.add('n' + cell.n);
      }
    } else {
      if (cell.flag) { btn.classList.add('flag'); btn.textContent = '🚩'; }
      if (showMines && cell.mine && !cell.flag) { btn.classList.add('mine'); btn.textContent = '💣'; }
      if (showMines && cell.flag && !cell.mine) { btn.classList.add('wrong'); btn.textContent = '✖'; }
    }
  }

  // Events
  newGameBtn.addEventListener('click', newGame);
  difficultySel.addEventListener('change', newGame);

  // Prevent context menu on the board to allow right-click flagging
  boardEl.addEventListener('contextmenu', (e) => e.preventDefault());

  // Boot
  newGame();
})();

