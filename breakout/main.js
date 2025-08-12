(() => {
  const canvas = document.getElementById('board');
  const ctx = canvas.getContext('2d');
  const overlay = document.getElementById('overlay');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const livesEl = document.getElementById('lives');
  const levelEl = document.getElementById('level');
  const newGameBtn = document.getElementById('newGameBtn');
  const pauseBtn = document.getElementById('pauseBtn');

  // Handle high-DPI scaling
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

  const S = {
    running: false,
    paused: false,
    level: 1,
    score: 0,
    best: Number(localStorage.getItem('breakout-best') || '0') || 0,
    lives: 3,
    paddle: { x: 200, y: 0, w: 100, h: 14, speed: 380 },
    ball: { x: 240, y: 500, r: 7, vx: 0, vy: 0, speed: 360 },
    bricks: [],
    cols: 10,
    rows: 6,
    brick: { w: 44, h: 18, gap: 6, top: 70 },
    input: { left: false, right: false, mouseX: null }
  };

  function updateUI() {
    scoreEl.textContent = String(S.score);
    bestEl.textContent = String(S.best);
    livesEl.textContent = String(S.lives);
    levelEl.textContent = String(S.level);
  }

  function setOverlay(msg) {
    if (!msg) overlay.classList.add('hidden');
    else { overlay.textContent = msg; overlay.classList.remove('hidden'); }
  }

  function newLevel(resetBall = true) {
    // fit columns into canvas CSS pixels
    const W = canvas.clientWidth;
    const padding = 16;
    const totalGap = (S.cols - 1) * S.brick.gap;
    const avail = W - padding * 2 - totalGap;
    const bw = Math.max(24, Math.min(80, Math.floor(avail / S.cols)));
    S.brick.w = bw;
    S.brick.top = 70;
    S.brick.h = 18;

    S.bricks = [];
    for (let r = 0; r < S.rows; r++) {
      for (let c = 0; c < S.cols; c++) {
        const x = padding + c * (S.brick.w + S.brick.gap);
        const y = S.brick.top + r * (S.brick.h + S.brick.gap);
        const hp = 1 + Math.floor((S.level - 1) / 2) + (r >= S.rows - 2 ? 1 : 0); // late rows tougher later
        S.bricks.push({ x, y, hp });
      }
    }
    if (resetBall) placeBallOnPaddle();
  }

  function placeBallOnPaddle() {
    S.ball.vx = 0; S.ball.vy = 0;
    S.ball.x = S.paddle.x + S.paddle.w / 2;
    S.ball.y = canvas.clientHeight - 40 - S.paddle.h - S.ball.r - 2;
  }

  function resetGame() {
    S.level = 1;
    S.score = 0;
    S.lives = 3;
    S.paddle.w = 100;
    S.paddle.x = (canvas.clientWidth - S.paddle.w) / 2;
    S.running = true; S.paused = false;
    newLevel(true);
    setOverlay('Click or press Space to launch');
    updateUI();
  }

  function launchBall() {
    if (S.ball.vy !== 0 || !S.running) return;
    const angle = (-Math.PI / 3) + Math.random() * (Math.PI / 6); // between -60° and -30°
    const v = S.ball.speed;
    S.ball.vx = Math.cos(angle) * v;
    S.ball.vy = Math.sin(angle) * v;
    setOverlay('');
  }

  // Input
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { S.input.left = true; e.preventDefault(); }
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { S.input.right = true; e.preventDefault(); }
    if (e.code === 'Space') {
      if (!S.running) { resetGame(); return; }
      if (S.ball.vy === 0) launchBall(); else togglePause();
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') S.input.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') S.input.right = false;
  });
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    S.input.mouseX = e.clientX - rect.left;
  });
  canvas.addEventListener('mouseleave', () => { S.input.mouseX = null; });
  canvas.addEventListener('pointerleave', () => { S.input.mouseX = null; });
  canvas.addEventListener('touchend', () => { S.input.mouseX = null; }, { passive: true });
  canvas.addEventListener('click', () => {
    if (!S.running) { resetGame(); return; }
    if (S.ball.vy === 0) launchBall();
  });

  newGameBtn.addEventListener('click', resetGame);
  pauseBtn.addEventListener('click', togglePause);

  function togglePause() {
    if (!S.running) return;
    S.paused = !S.paused;
    setOverlay(S.paused ? 'Paused (Space to resume)' : '');
  }

  // Physics helpers
  function step(dt) {
    const playActive = S.running && !S.paused;
    const W = canvas.clientWidth, H = canvas.clientHeight;

    // Paddle movement
    const paddleSpeed = S.paddle.speed;
    if (S.input.mouseX != null) {
      S.paddle.x = S.input.mouseX - S.paddle.w / 2;
    } else {
      if (S.input.left) S.paddle.x -= paddleSpeed * dt;
      if (S.input.right) S.paddle.x += paddleSpeed * dt;
    }
    S.paddle.x = Math.max(6, Math.min(W - S.paddle.w - 6, S.paddle.x));
    S.paddle.y = H - 40 - S.paddle.h;

    // If ball is on paddle, follow it (even when not running)
    if (S.ball.vy === 0) {
      placeBallOnPaddle();
      if (!playActive) return; // allow paddle movement pre-start/paused
    } else if (!playActive) {
      return; // paused while ball is in flight: freeze state
    }

    // Ball movement
    let nx = S.ball.x + S.ball.vx * dt;
    let ny = S.ball.y + S.ball.vy * dt;
    const r = S.ball.r;

    // Paddle collision first (so we don't tunnel into bricks beneath it)
    if (ny + r >= S.paddle.y && ny + r <= S.paddle.y + S.paddle.h + 6) {
      if (nx >= S.paddle.x && nx <= S.paddle.x + S.paddle.w) {
        ny = S.paddle.y - r; // place above paddle
        // Reflect with angle based on hit position
        const hit = (nx - (S.paddle.x + S.paddle.w / 2)) / (S.paddle.w / 2);
        const angle = hit * (Math.PI / 3); // max ~60°
        const speed = Math.hypot(S.ball.vx, S.ball.vy) * 1.02; // tiny accel
        S.ball.vx = Math.sin(angle) * speed;
        S.ball.vy = -Math.cos(angle) * speed;
      }
    }

    // Brick collisions before wall-top to ensure top-row hits register
    let hitIndex = -1;
    for (let i = 0; i < S.bricks.length; i++) {
      const b = S.bricks[i];
      if (b.hp <= 0) continue;
      if (nx + r < b.x || nx - r > b.x + S.brick.w || ny + r < b.y || ny - r > b.y + S.brick.h) continue;
      hitIndex = i; break;
    }
    if (hitIndex >= 0) {
      const b = S.bricks[hitIndex];
      // Determine whether we hit horizontally or vertically
      const prevx = S.ball.x, prevy = S.ball.y;
      const overlapX = (prevx < b.x ? (prevx + r) - b.x : (b.x + S.brick.w) - (prevx - r));
      const overlapY = (prevy < b.y ? (prevy + r) - b.y : (b.y + S.brick.h) - (prevy - r));
      if (overlapX < overlapY) { S.ball.vx *= -1; } else { S.ball.vy *= -1; }
      b.hp -= 1;
      S.score += 10;
      if (S.score > S.best) { S.best = S.score; localStorage.setItem('breakout-best', String(S.best)); }
      nx = S.ball.x + S.ball.vx * dt;
      ny = S.ball.y + S.ball.vy * dt;
    }

    // Wall collisions after bricks so top row is hittable
    if (nx - r < 0) { nx = r; S.ball.vx *= -1; }
    if (nx + r > W) { nx = W - r; S.ball.vx *= -1; }
    if (ny - r < 0) { ny = r; S.ball.vy *= -1; }

    // Bottom (lose life)
    if (ny - r > H) {
      S.lives -= 1;
      if (S.lives <= 0) {
        gameOver();
        return;
      } else {
        placeBallOnPaddle();
        setOverlay('Life lost — click or Space to relaunch');
      }
    } else {
      S.ball.x = nx; S.ball.y = ny;
    }

    // Level cleared?
    if (S.bricks.every(b => b.hp <= 0)) {
      S.level += 1;
      S.rows = Math.min(10, S.rows + (S.level % 2 === 0 ? 1 : 0));
      if (S.paddle.w > 64) S.paddle.w -= 6;
      newLevel(true);
      setOverlay(`Level ${S.level} — click or Space to launch`);
    }

    updateUI();
  }

  function gameOver() {
    S.running = false;
    setOverlay('Game over — press Space or New Game');
    updateUI();
  }

  // Rendering
  function draw() {
    const W = canvas.clientWidth, H = canvas.clientHeight;
    ctx.clearRect(0, 0, W, H);

    // Paddle
    ctx.fillStyle = '#94a3b8';
    roundRect(ctx, S.paddle.x, S.paddle.y, S.paddle.w, S.paddle.h, 6);
    ctx.fill();

    // Ball
    ctx.beginPath();
    ctx.fillStyle = '#e5e7eb';
    ctx.arc(S.ball.x, S.ball.y, S.ball.r, 0, Math.PI * 2);
    ctx.fill();

    // Bricks
    for (const b of S.bricks) {
      if (b.hp <= 0) continue;
      const hue = 210 - Math.min(160, (S.level - 1) * 10 + b.y * 0.05);
      ctx.fillStyle = `hsl(${hue} 70% 55% / 0.95)`;
      roundRect(ctx, b.x, b.y, S.brick.w, S.brick.h, 4);
      ctx.fill();
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

  // Game loop
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    step(dt);
    draw();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // Start in attract mode
  updateUI();
  setOverlay('Press Space or New Game to start');

})();
