(() => {
  const canvas = document.getElementById('board');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const speedEl = document.getElementById('speed');
  const newGameBtn = document.getElementById('newGameBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const overlay = document.getElementById('overlay');

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

  const GROUND_Y = () => canvas.clientHeight - 36; // baseline

  const S = {
    running: false,
    paused: false,
    score: 0,
    best: Number(localStorage.getItem('dino-best') || '0') || 0,
    speed: 260, // px/s, increases over time
    groundX: 0,
    dino: { x: 40, y: 0, w: 36, h: 44, vy: 0, onGround: true, duck: false, jumpHeld: false },
    obs: [],
    spawn: { t: 0, next: 0 },
    clouds: [],
  };

  function setOverlay(msg) {
    if (!msg) overlay.classList.add('hidden');
    else { overlay.textContent = msg; overlay.classList.remove('hidden'); }
  }
  function updateUI() {
    scoreEl.textContent = String(Math.floor(S.score));
    bestEl.textContent = String(S.best);
    speedEl.textContent = String(Math.round(S.speed));
  }

  function resetGame() {
    S.running = true; S.paused = false;
    S.score = 0; S.speed = 260; S.obs = []; S.clouds = [];
    S.spawn.t = 0; S.spawn.next = 0;
    S.dino.y = GROUND_Y() - S.dino.h; S.dino.vy = 0; S.dino.onGround = true; S.dino.duck = false;
    // add some clouds
    for (let i = 0; i < 3; i++) S.clouds.push({ x: Math.random()*canvas.clientWidth, y: 20 + Math.random()*60, v: 15 + Math.random()*10 });
    setOverlay('Click/Space to jump, Down to duck');
    updateUI();
  }

  function spawnObstacle() {
    // Random cactus sizes or a low-flying bird when speed is high
    const W = canvas.clientWidth;
    if (Math.random() < 0.8) {
      // Cactus cluster 1-3
      const count = 1 + Math.floor(Math.random() * 3);
      const baseH = 34 + Math.floor(Math.random()*16);
      let offset = 0;
      for (let i = 0; i < count; i++) {
        const w = 16 + Math.floor(Math.random()*8);
        const h = baseH + (i%2 ? -6 : 0);
        S.obs.push({ type: 'cactus', x: W + offset, y: GROUND_Y() - h, w, h });
        offset += w + 8;
      }
    } else {
      // Bird (ptera) at mid height, only when speed high
      const h = 18, w = 28;
      const level = Math.random() < 0.5 ? GROUND_Y() - 60 : GROUND_Y() - 90;
      S.obs.push({ type: 'bird', x: W + 10, y: level - h, w, h, flap: 0 });
    }
  }

  function scheduleNextSpawn() {
    const minGap = Math.max(220, 520 - S.speed); // higher speed -> shorter min gap
    const maxGap = minGap + 200;
    S.spawn.next = minGap + Math.random() * (maxGap - minGap);
    S.spawn.t = 0;
  }

  function jump() {
    if (!S.running || S.paused) return;
    if (S.dino.onGround) {
      S.dino.vy = -880; // jump impulse
      S.dino.onGround = false;
      S.dino.duck = false;
      setOverlay('');
    }
  }

  function duck(d) {
    if (!S.running || S.paused) return;
    S.dino.duck = d && S.dino.onGround;
  }

  // Input
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
      if (!S.running) { resetGame(); return; }
      jump(); e.preventDefault();
    } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
      duck(true); e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') duck(false);
    if (e.code === 'Space') S.dino.jumpHeld = false;
  });
  canvas.addEventListener('pointerdown', () => { if (!S.running) { resetGame(); } else jump(); });

  newGameBtn.addEventListener('click', resetGame);
  pauseBtn.addEventListener('click', () => { if (!S.running) return; S.paused = !S.paused; setOverlay(S.paused ? 'Paused' : ''); });

  function collide(a, b) {
    return !(a.x + a.w < b.x || a.x > b.x + b.w || a.y + a.h < b.y || a.y > b.y + b.h);
  }

  function step(dt) {
    if (!S.running || S.paused) return;
    const W = canvas.clientWidth, H = canvas.clientHeight;

    // Increase speed slowly
    S.speed += dt * 8; // +8 px/s each second
    S.groundX = (S.groundX - S.speed * dt) % 40;

    // Clouds
    for (const c of S.clouds) { c.x -= c.v * dt; if (c.x < -60) { c.x = W + Math.random()*120; c.y = 20 + Math.random()*80; } }

    // Dino physics
    if (!S.dino.onGround) {
      S.dino.vy += 2400 * dt; // gravity
      S.dino.y += S.dino.vy * dt;
      if (S.dino.y >= GROUND_Y() - S.dino.h) {
        S.dino.y = GROUND_Y() - S.dino.h; S.dino.vy = 0; S.dino.onGround = true;
      }
    }

    // Obstacles
    for (const o of S.obs) {
      o.x -= S.speed * dt;
      if (o.type === 'bird') { o.flap = (o.flap + dt*6) % (Math.PI*2); o.y += Math.sin(o.flap) * 0.3; }
    }
    S.obs = S.obs.filter(o => o.x + o.w > -10);

    // Spawn timing
    S.spawn.t += S.speed * dt; // measure in screen-space units
    if (S.spawn.t >= S.spawn.next) { spawnObstacle(); scheduleNextSpawn(); }

    // Score
    S.score += S.speed * dt * 0.02; // scale down to reasonable numbers
    if (S.score > S.best) { S.best = Math.floor(S.score); localStorage.setItem('dino-best', String(S.best)); }

    // Collision check: build Dino hitbox (smaller when ducking)
    const dBox = {
      x: S.dino.x + 6,
      y: S.dino.y + (S.dino.duck ? 14 : 6),
      w: S.dino.w - 12,
      h: (S.dino.duck ? S.dino.h - 10 : S.dino.h - 12),
    };
    for (const o of S.obs) {
      const oBox = { x: o.x+2, y: o.y+2, w: o.w-4, h: o.h-4 };
      if (collide(dBox, oBox)) { return gameOver(); }
    }

    updateUI();
  }

  function gameOver() {
    S.running = false;
    setOverlay('Game Over — Space or New Game');
    updateUI();
  }

  function draw() {
    const W = canvas.clientWidth, H = canvas.clientHeight;
    ctx.clearRect(0, 0, W, H);

    // Sky tint
    // Ground
    ctx.fillStyle = '#94a3b8';
    const gy = GROUND_Y();
    ctx.fillRect(0, gy + 18, W, 4);
    // Dotted ground pattern
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    for (let x = S.groundX; x < W; x += 40) {
      ctx.fillRect(x, gy + 12, 20, 2);
    }

    // Clouds
    for (const c of S.clouds) drawCloud(c.x, c.y);

    // Dino
    drawDino();

    // Obstacles
    for (const o of S.obs) drawObstacle(o);
  }

  function drawCloud(x, y) {
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI*2);
    ctx.arc(x+14, y+2, 12, 0, Math.PI*2);
    ctx.arc(x+28, y, 9, 0, Math.PI*2);
    ctx.fill();
  }

  function drawDino() {
    const d = S.dino;
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.fillStyle = '#e5e7eb';
    const duck = d.duck && d.onGround;
    if (duck) {
      // Lower, longer body
      roundRect(ctx, 0, d.h-26, 46, 22, 6); ctx.fill();
      // Head
      roundRect(ctx, 30, d.h-44, 18, 16, 4); ctx.fill();
    } else {
      // Body
      roundRect(ctx, 0, d.h-44, 30, 44, 6); ctx.fill();
      // Head
      roundRect(ctx, 18, d.h-64, 20, 20, 4); ctx.fill();
    }
    // Eye
    ctx.fillStyle = '#0f1220';
    ctx.fillRect(duck ? 40 : 32, duck ? d.h-38 : d.h-56, 2, 2);
    // Legs animation
    if (d.onGround) {
      const t = performance.now() / 120;
      ctx.fillStyle = '#e5e7eb';
      const off = Math.sin(t) * 3;
      ctx.fillRect(4, d.h-2, 8, 2);
      ctx.fillRect(16, d.h-2, 8, 2);
      ctx.fillRect(4, d.h-6, 2, 6 + off);
      ctx.fillRect(22, d.h-6, 2, 6 - off);
    }
    ctx.restore();
  }

  function drawObstacle(o) {
    ctx.fillStyle = o.type === 'bird' ? '#cbd5e1' : '#a7f3d0';
    if (o.type === 'cactus') {
      roundRect(ctx, o.x, o.y, o.w, o.h, 4); ctx.fill();
      // arms
      ctx.fillRect(o.x + 2, o.y + 6, 4, Math.min(16, o.h-12));
      ctx.fillRect(o.x + o.w - 6, o.y + 10, 4, Math.min(16, o.h-18));
    } else {
      // bird
      ctx.fillRect(o.x, o.y + o.h/2 - 2, o.w, 4);
      ctx.fillRect(o.x + o.w - 6, o.y, 6, o.h); // body+wing
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

  // Initialize idle state
  updateUI();
  setOverlay('Press Space or New Game to start');
  S.dino.y = GROUND_Y() - S.dino.h;
  scheduleNextSpawn();
})();

