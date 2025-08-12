(() => {
  'use strict';

  // --- DOM refs
  const canvas = document.getElementById('board');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const overlayEl = document.getElementById('overlay');
  const newGameBtn = document.getElementById('newGameBtn');
  const pauseBtn = document.getElementById('pauseBtn');

  // --- Config
  const GRID = 21;                 // grid cells per side
  const BASE_SPEED = 8;            // moves per second
  const STEP_MS = 1000 / BASE_SPEED;
  const GROWTH = 1;                // segments to grow per apple
  const COLORS = {
    grid: 'rgba(148,163,184,0.08)',
    snakeHead: '#22c55e',
    snakeBody: '#16a34a',
    food: '#ef4444',
    foodGlow: 'rgba(239,68,68,0.25)'
  };

  // --- Game state
  let cell;                // pixel size of a cell; computed from canvas
  let dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  let lastTime = 0;
  let acc = 0;
  let running = false;
  let paused = false;
  let gameOver = false;
  let score = 0;
  let best = Number(localStorage.getItem('snake_best') || 0);
  bestEl.textContent = String(best);

  // snake is an array of {x,y} with head at index 0
  let snake = [];
  let growth = 0;
  let dir = { x: 1, y: 0 };
  const queue = []; // queued direction inputs to apply on next ticks
  let food = { x: 10, y: 10 };

  function setCanvasSize() {
    // Canvas CSS size is responsive; sync internal resolution to CSS size * dpr
    const cssSize = Math.min(canvas.clientWidth, canvas.clientHeight);
    const target = Math.floor(cssSize * dpr);
    if (canvas.width !== target || canvas.height !== target) {
      canvas.width = target;
      canvas.height = target;
    }
    cell = Math.floor(canvas.width / GRID);
  }

  function resetGame() {
    score = 0;
    scoreEl.textContent = '0';
    snake = [center(), { x: center().x - 1, y: center().y }];
    growth = 0;
    dir = { x: 1, y: 0 };
    queue.length = 0;
    food = randomEmptyCell();
    running = true;
    paused = false;
    gameOver = false;
    overlayEl.classList.add('hidden');
    overlayEl.textContent = '';
    lastTime = 0;
    acc = 0;
  }

  function center() {
    const c = Math.floor(GRID / 2);
    return { x: c, y: c };
  }

  function randomInt(n) { return (Math.random() * n) | 0; }

  function randomEmptyCell() {
    const occupied = new Set(snake.map(p => p.x + ',' + p.y));
    let tries = 0;
    while (tries++ < 1000) {
      const p = { x: randomInt(GRID), y: randomInt(GRID) };
      if (!occupied.has(p.x + ',' + p.y)) return p;
    }
    // Fallback (shouldn't happen in normal play)
    return { x: 0, y: 0 };
  }

  function same(a, b) { return a.x === b.x && a.y === b.y; }

  function step() {
    // apply queued direction change if any (one per step)
    if (queue.length) {
      const next = queue.shift();
      // prevent 180° turns
      if (!(next.x === -dir.x && next.y === -dir.y)) dir = next;
    }

    const head = snake[0];
    let nextHead = { x: head.x + dir.x, y: head.y + dir.y };

    // wrap around walls
    if (nextHead.x < 0) nextHead.x = GRID - 1;
    if (nextHead.x >= GRID) nextHead.x = 0;
    if (nextHead.y < 0) nextHead.y = GRID - 1;
    if (nextHead.y >= GRID) nextHead.y = 0;

    // self collision (after wrapping)
    for (let i = 0; i < snake.length; i++) {
      if (same(nextHead, snake[i])) return endGame();
    }

    // move
    snake.unshift(nextHead);
    if (same(nextHead, food)) {
      score += 1;
      scoreEl.textContent = String(score);
      best = Math.max(best, score);
      bestEl.textContent = String(best);
      localStorage.setItem('snake_best', String(best));
      growth += GROWTH;
      food = randomEmptyCell();
    }

    if (growth > 0) {
      growth -= 1;
    } else {
      snake.pop();
    }
  }

  function endGame() {
    running = false;
    gameOver = true;
    overlayEl.textContent = 'Game Over — Press New Game';
    overlayEl.classList.remove('hidden');
  }

  function draw() {
    // clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // grid
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = Math.max(1, Math.floor(cell * 0.03));
    ctx.beginPath();
    for (let i = 1; i < GRID; i++) {
      const p = i * cell + 0.5;
      ctx.moveTo(p, 0); ctx.lineTo(p, canvas.height);
      ctx.moveTo(0, p); ctx.lineTo(canvas.width, p);
    }
    ctx.stroke();

    // food glow
    const fx = food.x * cell + cell / 2;
    const fy = food.y * cell + cell / 2;
    const grad = ctx.createRadialGradient(fx, fy, 0, fx, fy, cell);
    grad.addColorStop(0, COLORS.foodGlow);
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(fx, fy, cell * 0.9, 0, Math.PI * 2);
    ctx.fill();

    // food
    roundRect(food.x * cell + 2, food.y * cell + 2, cell - 4, cell - 4, Math.floor(cell * 0.25), COLORS.food);

    // snake
    for (let i = snake.length - 1; i >= 0; i--) {
      const s = snake[i];
      const isHead = i === 0;
      const r = isHead ? Math.floor(cell * 0.3) : Math.floor(cell * 0.2);
      const color = isHead ? COLORS.snakeHead : COLORS.snakeBody;
      roundRect(s.x * cell + 1.5, s.y * cell + 1.5, cell - 3, cell - 3, r, color);
    }
  }

  function roundRect(x, y, w, h, r, fill) {
    const maxR = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + maxR, y);
    ctx.arcTo(x + w, y, x + w, y + h, maxR);
    ctx.arcTo(x + w, y + h, x, y + h, maxR);
    ctx.arcTo(x, y + h, x, y, maxR);
    ctx.arcTo(x, y, x + w, y, maxR);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function loop(ts) {
    if (!running) { draw(); return; }
    if (!lastTime) lastTime = ts;
    const dt = ts - lastTime;
    lastTime = ts;
    acc += dt;

    while (acc >= STEP_MS) {
      if (!paused) step();
      acc -= STEP_MS;
    }

    draw();
    requestAnimationFrame(loop);
  }

  function enqueueDirection(d) {
    const last = queue.length ? queue[queue.length - 1] : dir;
    if (d.x === last.x && d.y === last.y) return; // same direction
    if (d.x === -last.x && d.y === -last.y) return; // 180°
    queue.push(d);
  }

  // Input handlers
  function onKey(e) {
    if (e.repeat) return; // avoid rapid repeats when holding a key
    switch (e.key) {
      case 'ArrowUp': case 'w': case 'W': e.preventDefault(); enqueueDirection({ x: 0, y: -1 }); break;
      case 'ArrowDown': case 's': case 'S': e.preventDefault(); enqueueDirection({ x: 0, y: 1 }); break;
      case 'ArrowLeft': case 'a': case 'A': e.preventDefault(); enqueueDirection({ x: -1, y: 0 }); break;
      case 'ArrowRight': case 'd': case 'D': e.preventDefault(); enqueueDirection({ x: 1, y: 0 }); break;
      case ' ': // space
        // Prevent default so focused buttons don't get a synthetic click
        e.preventDefault();
        togglePause();
        break;
      case 'Enter':
        if (gameOver) { e.preventDefault(); resetGame(); }
        break;
    }
  }

  function togglePause() {
    if (!running) return;
    paused = !paused;
    pauseBtn.textContent = paused ? 'Resume' : 'Pause';
    overlayEl.textContent = paused ? 'Paused — Press Space' : '';
    overlayEl.classList.toggle('hidden', !paused);
  }

  // Mobile buttons
  document.querySelectorAll('.control').forEach(btn => {
    btn.addEventListener('click', () => {
      const d = btn.getAttribute('data-dir');
      if (d === 'up') enqueueDirection({ x: 0, y: -1 });
      if (d === 'down') enqueueDirection({ x: 0, y: 1 });
      if (d === 'left') enqueueDirection({ x: -1, y: 0 });
      if (d === 'right') enqueueDirection({ x: 1, y: 0 });
    });
  });

  // Swipe controls (simple)
  let touchStart = null;
  canvas.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0];
    touchStart = { x: t.clientX, y: t.clientY };
  }, { passive: true });
  canvas.addEventListener('touchend', (e) => {
    if (!touchStart) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    const ax = Math.abs(dx), ay = Math.abs(dy);
    if (Math.max(ax, ay) < 16) return; // ignore tiny swipes
    if (ax > ay) enqueueDirection({ x: Math.sign(dx), y: 0 });
    else enqueueDirection({ x: 0, y: Math.sign(dy) });
    touchStart = null;
  }, { passive: true });

  // Wire up UI
  newGameBtn.addEventListener('click', () => { resetGame(); requestAnimationFrame(loop); newGameBtn.blur(); });
  pauseBtn.addEventListener('click', () => { togglePause(); pauseBtn.blur(); });
  window.addEventListener('keydown', onKey);
  window.addEventListener('resize', () => { setCanvasSize(); draw(); });

  // Init
  setCanvasSize();
  draw();
  overlayEl.textContent = 'Press New Game to start';
  overlayEl.classList.remove('hidden');
})();
