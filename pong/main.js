(() => {
  const canvas = document.getElementById('board');
  const ctx = canvas.getContext('2d');
  const leftScoreEl = document.getElementById('leftScore');
  const rightScoreEl = document.getElementById('rightScore');
  const playToEl = document.getElementById('playTo');
  const twoPlayerToggle = document.getElementById('twoPlayer');
  const newGameBtn = document.getElementById('newGameBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const overlay = document.getElementById('overlay');

  // HiDPI scaling
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
    twoPlayer: false,
    playTo: 7,
    left: { y: 0, w: 12, h: 70, speed: 360, score: 0 },
    right: { y: 0, w: 12, h: 70, speed: 360, score: 0 },
    ball: { x: 0, y: 0, r: 6, vx: 0, vy: 0, speed: 340 },
    input: { w: false, s: false, up: false, down: false },
    servePending: true, // parked on center until launch
    serveDir: 1 // 1 -> right, -1 -> left
  };

  function setOverlay(msg) {
    if (!msg) overlay.classList.add('hidden');
    else { overlay.textContent = msg; overlay.classList.remove('hidden'); }
  }

  function resetRound(centerDir = 1) {
    const W = canvas.clientWidth, H = canvas.clientHeight;
    S.left.y = (H - S.left.h) / 2;
    S.right.y = (H - S.right.h) / 2;
    S.ball.x = W / 2;
    S.ball.y = H / 2;
    S.ball.vx = 0; S.ball.vy = 0;
    S.serveDir = centerDir;
    S.servePending = true;
    setOverlay('Click or press Space to serve');
  }

  function resetGame() {
    S.left.score = 0; S.right.score = 0;
    S.running = true; S.paused = false;
    resetRound(Math.random() < 0.5 ? -1 : 1);
    updateUI();
  }

  function updateUI() {
    leftScoreEl.textContent = String(S.left.score);
    rightScoreEl.textContent = String(S.right.score);
    playToEl.textContent = String(S.playTo);
  }

  function launchBall() {
    if (!S.running || S.paused || !S.servePending) return;
    const angle = (Math.random() * 0.6 - 0.3); // -0.3..0.3 rad off center
    const v = S.ball.speed;
    S.ball.vx = Math.cos(angle) * v * S.serveDir;
    S.ball.vy = Math.sin(angle) * v * (Math.random() < 0.5 ? 1 : -1);
    S.servePending = false;
    setOverlay('');
  }

  // Input
  window.addEventListener('keydown', (e) => {
    if (e.key === 'w' || e.key === 'W') S.input.w = true;
    if (e.key === 's' || e.key === 'S') S.input.s = true;
    if (e.key === 'ArrowUp') { S.input.up = true; e.preventDefault(); }
    if (e.key === 'ArrowDown') { S.input.down = true; e.preventDefault(); }
    if (e.code === 'Space') {
      if (!S.running) { resetGame(); return; }
      if (S.servePending) launchBall(); else togglePause();
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === 'w' || e.key === 'W') S.input.w = false;
    if (e.key === 's' || e.key === 'S') S.input.s = false;
    if (e.key === 'ArrowUp') S.input.up = false;
    if (e.key === 'ArrowDown') S.input.down = false;
  });
  canvas.addEventListener('click', () => {
    if (!S.running) { resetGame(); return; }
    if (S.servePending) launchBall();
  });

  twoPlayerToggle.addEventListener('change', (e) => {
    S.twoPlayer = !!e.target.checked;
  });
  newGameBtn.addEventListener('click', resetGame);
  pauseBtn.addEventListener('click', togglePause);

  function togglePause() {
    if (!S.running) return;
    S.paused = !S.paused;
    setOverlay(S.paused ? 'Paused (Space to resume)' : '');
  }

  function step(dt) {
    if (!S.running || S.paused) return;
    const W = canvas.clientWidth, H = canvas.clientHeight;

    // Paddles
    const ls = S.left.speed, rs = S.right.speed;
    if (S.input.w) S.left.y -= ls * dt;
    if (S.input.s) S.left.y += ls * dt;
    if (S.twoPlayer) {
      if (S.input.up) S.right.y -= rs * dt;
      if (S.input.down) S.right.y += rs * dt;
    } else {
      // Simple CPU AI: track ball with easing and error
      const target = S.ball.y - S.right.h / 2 + (Math.sin(performance.now() / 400) * 10);
      const diff = target - S.right.y;
      S.right.y += Math.max(-rs * dt, Math.min(rs * dt, diff * 0.6));
    }
    S.left.y = Math.max(6, Math.min(H - S.left.h - 6, S.left.y));
    S.right.y = Math.max(6, Math.min(H - S.right.h - 6, S.right.y));

    // Serve parked: just keep paddles moving
    if (S.servePending) return;

    // Ball movement
    let nx = S.ball.x + S.ball.vx * dt;
    let ny = S.ball.y + S.ball.vy * dt;
    const r = S.ball.r;

    // Top/bottom walls
    if (ny - r < 0) { ny = r; S.ball.vy *= -1; }
    if (ny + r > H) { ny = H - r; S.ball.vy *= -1; }

    // Left paddle collision
    if (nx - r <= 20 && nx - r >= 8) {
      if (ny >= S.left.y && ny <= S.left.y + S.left.h) {
        nx = 20 + r;
        const hit = (ny - (S.left.y + S.left.h / 2)) / (S.left.h / 2);
        const speed = Math.min(640, Math.hypot(S.ball.vx, S.ball.vy) * 1.04 + 8);
        const angle = hit * (Math.PI / 3);
        S.ball.vx = Math.cos(angle) * speed;
        S.ball.vy = Math.sin(angle) * speed;
      }
    }
    // Right paddle collision
    if (nx + r >= W - 20 && nx + r <= W - 8) {
      if (ny >= S.right.y && ny <= S.right.y + S.right.h) {
        nx = W - 20 - r;
        const hit = (ny - (S.right.y + S.right.h / 2)) / (S.right.h / 2);
        const speed = Math.min(640, Math.hypot(S.ball.vx, S.ball.vy) * 1.04 + 8);
        const angle = hit * (Math.PI / 3);
        S.ball.vx = -Math.cos(angle) * speed;
        S.ball.vy = Math.sin(angle) * speed;
      }
    }

    S.ball.x = nx; S.ball.y = ny;

    // Score check
    if (S.ball.x + r < 0) { // right scores
      S.right.score += 1;
      if (S.right.score >= S.playTo) return gameOver('Right wins!');
      updateUI();
      resetRound(-1); // serve toward left
      return;
    }
    if (S.ball.x - r > W) { // left scores
      S.left.score += 1;
      if (S.left.score >= S.playTo) return gameOver('Left wins!');
      updateUI();
      resetRound(1); // serve toward right
      return;
    }
  }

  function gameOver(msg) {
    S.running = false;
    S.paused = false;
    S.servePending = true;
    setOverlay(`${msg} — Space or New Game`);
    updateUI();
  }

  function draw() {
    const W = canvas.clientWidth, H = canvas.clientHeight;
    ctx.clearRect(0, 0, W, H);

    // Center line
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.setLineDash([6, 10]);
    ctx.beginPath();
    ctx.moveTo(W/2, 10); ctx.lineTo(W/2, H-10);
    ctx.stroke();
    ctx.setLineDash([]);

    // Paddles
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(14, S.left.y, S.left.w, S.left.h);
    ctx.fillRect(W - 14 - S.right.w, S.right.y, S.right.w, S.right.h);

    // Ball
    ctx.beginPath(); ctx.arc(S.ball.x, S.ball.y, S.ball.r, 0, Math.PI*2); ctx.fill();

    // If serving, park ball at center facing serveDir
    if (S.servePending) {
      ctx.save();
      ctx.translate(W/2, H/2);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(S.serveDir*16,-6); ctx.lineTo(S.serveDir*16,6); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  // Loop
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    step(dt);
    draw();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // Start idle state
  updateUI();
  setOverlay('Press Space or New Game to start');
  resetRound(1);
})();

