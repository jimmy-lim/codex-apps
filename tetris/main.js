(() => {
  const canvas = document.getElementById('board');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const linesEl = document.getElementById('lines');
  const levelEl = document.getElementById('level');
  const newGameBtn = document.getElementById('newGameBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const overlay = document.getElementById('overlay');

  // HiDPI-aware canvas sizing
  function fitCanvas() {
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  fitCanvas();
  window.addEventListener('resize', fitCanvas);

  // Grid
  const COLS = 10, ROWS = 22; // 2 hidden rows at top
  const VISIBLE_START = ROWS - 20; // index 2..21 visible

  // Pieces: 4x4 matrices for 4 rotations
  // Each matrix is array of 16 numbers (row-major), using 0/1.
  const SHAPES = {
    I: [
      [0,0,0,0, 1,1,1,1, 0,0,0,0, 0,0,0,0],
      [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
      [0,0,0,0, 1,1,1,1, 0,0,0,0, 0,0,0,0],
      [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
    ],
    O: [
      [0,1,1,0, 0,1,1,0, 0,0,0,0, 0,0,0,0],
      [0,1,1,0, 0,1,1,0, 0,0,0,0, 0,0,0,0],
      [0,1,1,0, 0,1,1,0, 0,0,0,0, 0,0,0,0],
      [0,1,1,0, 0,1,1,0, 0,0,0,0, 0,0,0,0],
    ],
    T: [
      [0,1,0,0, 1,1,1,0, 0,0,0,0, 0,0,0,0],
      [0,1,0,0, 0,1,1,0, 0,1,0,0, 0,0,0,0],
      [0,0,0,0, 1,1,1,0, 0,1,0,0, 0,0,0,0],
      [0,1,0,0, 1,1,0,0, 0,1,0,0, 0,0,0,0],
    ],
    L: [
      [0,0,1,0, 1,1,1,0, 0,0,0,0, 0,0,0,0],
      [0,1,0,0, 0,1,0,0, 0,1,1,0, 0,0,0,0],
      [0,0,0,0, 1,1,1,0, 1,0,0,0, 0,0,0,0],
      [1,1,0,0, 0,1,0,0, 0,1,0,0, 0,0,0,0],
    ],
    J: [
      [1,0,0,0, 1,1,1,0, 0,0,0,0, 0,0,0,0],
      [0,1,1,0, 0,1,0,0, 0,1,0,0, 0,0,0,0],
      [0,0,0,0, 1,1,1,0, 0,0,1,0, 0,0,0,0],
      [0,1,0,0, 0,1,0,0, 1,1,0,0, 0,0,0,0],
    ],
    S: [
      [0,1,1,0, 1,1,0,0, 0,0,0,0, 0,0,0,0],
      [0,1,0,0, 0,1,1,0, 0,0,1,0, 0,0,0,0],
      [0,1,1,0, 1,1,0,0, 0,0,0,0, 0,0,0,0],
      [0,1,0,0, 0,1,1,0, 0,0,1,0, 0,0,0,0],
    ],
    Z: [
      [1,1,0,0, 0,1,1,0, 0,0,0,0, 0,0,0,0],
      [0,0,1,0, 0,1,1,0, 0,1,0,0, 0,0,0,0],
      [1,1,0,0, 0,1,1,0, 0,0,0,0, 0,0,0,0],
      [0,0,1,0, 0,1,1,0, 0,1,0,0, 0,0,0,0],
    ],
  };

  const COLORS = {
    I: '#60a5fa',
    O: '#fbbf24',
    T: '#c084fc',
    L: '#f59e0b',
    J: '#38bdf8',
    S: '#22c55e',
    Z: '#ef4444',
  };

  function gravityIntervalMs(level) {
    const base = 1000;
    return Math.max(60, Math.floor(base * Math.pow(0.85, level - 1)));
  }

  const S = {
    running: false,
    paused: false,
    score: 0,
    lines: 0,
    level: 1,
    grid: Array.from({ length: ROWS }, () => Array(COLS).fill(null)),
    cur: null, // {type, rot, x, y}
    queue: [],
    dropAccum: 0, // ms accumulator for gravity
  };

  function setOverlay(msg) {
    if (!msg) overlay.classList.add('hidden');
    else { overlay.textContent = msg; overlay.classList.remove('hidden'); }
  }

  function updateUI() {
    scoreEl.textContent = String(S.score);
    linesEl.textContent = String(S.lines);
    levelEl.textContent = String(S.level);
  }

  function newGame() {
    S.running = true; S.paused = false;
    S.score = 0; S.lines = 0; S.level = 1; S.dropAccum = 0;
    for (let r = 0; r < ROWS; r++) S.grid[r].fill(null);
    S.queue.length = 0; refillBag(); spawnNext();
    setOverlay('');
    updateUI();
  }

  function refillBag() {
    const bag = ['I','O','T','L','J','S','Z'];
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    S.queue.push(...bag);
  }

  function spawnNext() {
    if (S.queue.length < 4) refillBag();
    const type = S.queue.shift();
    const rot = 0;
    const x = 3; // centered for 10 cols
    const y = 0; // top (may overlap hidden rows)
    S.cur = { type, rot, x, y };
    if (!canPlace(x, y, rot, type)) {
      // Game over
      S.running = false;
      setOverlay('Game Over — Space or New Game');
    }
  }

  function eachCell(type, rot, x, y, cb) {
    const mat = SHAPES[type][rot];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (mat[r*4 + c]) cb(x + c, y + r);
      }
    }
  }

  function canPlace(x, y, rot, type) {
    let ok = true;
    eachCell(type, rot, x, y, (cx, cy) => {
      if (cx < 0 || cx >= COLS || cy >= ROWS) { ok = false; return; }
      if (cy >= 0 && S.grid[cy][cx]) { ok = false; return; }
    });
    return ok;
  }

  function move(dx, dy) {
    if (!S.running || S.paused) return false;
    const { type, rot, x, y } = S.cur;
    const nx = x + dx, ny = y + dy;
    if (canPlace(nx, ny, rot, type)) { S.cur.x = nx; S.cur.y = ny; return true; }
    return false;
  }

  function rotate(delta) {
    if (!S.running || S.paused) return;
    const { type } = S.cur;
    const nrot = (S.cur.rot + delta + 4) % 4;
    // basic wall kicks: try offsets
    const kicks = [ [0,0], [-1,0], [1,0], [0,-1], [-2,0], [2,0] ];
    for (const [kx, ky] of kicks) {
      const nx = S.cur.x + kx, ny = S.cur.y + ky;
      if (canPlace(nx, ny, nrot, type)) {
        S.cur.x = nx; S.cur.y = ny; S.cur.rot = nrot; return true;
      }
    }
    return false;
  }

  function hardDrop() {
    if (!S.running || S.paused) return;
    let dist = 0;
    while (move(0, 1)) { dist++; }
    S.score += dist * 2; // hard drop points
    lockPiece();
  }

  function softDrop() {
    if (!S.running || S.paused) return;
    if (move(0, 1)) { S.score += 1; } else { lockPiece(); }
  }

  function lockPiece() {
    const { type, rot, x, y } = S.cur;
    eachCell(type, rot, x, y, (cx, cy) => {
      if (cy >= 0 && cy < ROWS && cx >= 0 && cx < COLS) S.grid[cy][cx] = COLORS[type];
    });
    clearLines();
    spawnNext();
    updateUI();
  }

  function clearLines() {
    let cleared = 0;
    for (let r = 0; r < ROWS; r++) {
      if (S.grid[r].every(Boolean)) {
        S.grid.splice(r, 1);
        S.grid.unshift(Array(COLS).fill(null));
        cleared++;
      }
    }
    if (cleared > 0) {
      const base = [0, 100, 300, 500, 800][cleared] || (cleared * 200);
      S.score += base * S.level;
      S.lines += cleared;
      const newLevel = Math.floor(S.lines / 10) + 1;
      if (newLevel !== S.level) S.level = newLevel;
    }
  }

  // Input
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { move(-1, 0); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { move(1, 0); e.preventDefault(); }
    else if (e.key === 'ArrowDown') { softDrop(); e.preventDefault(); }
    else if (e.code === 'Space') { hardDrop(); e.preventDefault(); }
    else if (e.key === 'z' || e.key === 'Z') { rotate(-1); e.preventDefault(); }
    else if (e.key === 'x' || e.key === 'X' || e.key === 'ArrowUp') { rotate(1); e.preventDefault(); }
    else if (e.key === 'p' || e.key === 'P') { togglePause(); e.preventDefault(); }
    updateUI();
  });

  canvas.addEventListener('click', () => {
    if (!S.running) { newGame(); return; }
    if (S.paused) return;
    hardDrop();
  });

  newGameBtn.addEventListener('click', newGame);
  pauseBtn.addEventListener('click', togglePause);

  function togglePause() {
    if (!S.running) return;
    S.paused = !S.paused;
    setOverlay(S.paused ? 'Paused (P to resume)' : '');
  }

  // Game tick for gravity
  let last = performance.now();
  function loop(now) {
    const dt = now - last; last = now;
    if (S.running && !S.paused) {
      S.dropAccum += dt;
      const interval = gravityIntervalMs(S.level);
      while (S.dropAccum >= interval) {
        S.dropAccum -= interval;
        if (!move(0, 1)) lockPiece();
      }
    }
    draw();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  function draw() {
    const W = canvas.clientWidth, H = canvas.clientHeight;
    ctx.clearRect(0, 0, W, H);
    const cellSize = Math.min(W / COLS, H / 20); // fit 20 visible rows
    const ox = Math.floor((W - cellSize * COLS) / 2);
    const oy = Math.floor((H - cellSize * 20) / 2);

    // Draw grid background
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(ox, oy, cellSize * COLS, cellSize * 20);

    // Helper to draw a cell
    const drawCell = (cx, cy, color) => {
      const x = ox + cx * cellSize;
      const y = oy + (cy - VISIBLE_START) * cellSize;
      if (y + cellSize < 0 || y > H) return;
      ctx.fillStyle = color;
      const r = Math.max(2, Math.floor(cellSize * 0.18));
      roundRect(ctx, x+1, y+1, cellSize-2, cellSize-2, r);
      ctx.fill();
    };

    // Existing grid
    for (let r = VISIBLE_START; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const col = S.grid[r][c];
        if (col) drawCell(c, r, col);
      }
    }

    // Active piece
    if (S.cur) {
      const { type, rot, x, y } = S.cur;
      eachCell(type, rot, x, y, (cx, cy) => {
        if (cy >= VISIBLE_START) drawCell(cx, cy, COLORS[type]);
      });
    }

    // Grid lines (subtle)
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let c = 0; c <= COLS; c++) {
      const gx = ox + c * cellSize;
      ctx.beginPath(); ctx.moveTo(gx, oy); ctx.lineTo(gx, oy + cellSize * 20); ctx.stroke();
    }
    for (let r = 0; r <= 20; r++) {
      const gy = oy + r * cellSize;
      ctx.beginPath(); ctx.moveTo(ox, gy); ctx.lineTo(ox + cellSize * COLS, gy); ctx.stroke();
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Idle state
  updateUI();
  setOverlay('Press Space or New Game to start');

})();

