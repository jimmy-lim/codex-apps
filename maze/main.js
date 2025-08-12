(() => {
  const canvas = document.getElementById('board');
  const ctx = canvas.getContext('2d');
  const sizeStat = document.getElementById('sizeStat');
  const cellsStat = document.getElementById('cellsStat');
  const deadEndsStat = document.getElementById('deadEndsStat');
  const pathLenStat = document.getElementById('pathLenStat');
  const widthInp = document.getElementById('widthInp');
  const heightInp = document.getElementById('heightInp');
  const algoSel = document.getElementById('algoSel');
  const animateChk = document.getElementById('animateChk');
  const speedRange = document.getElementById('speedRange');
  const genBtn = document.getElementById('genBtn');
  const startRunBtn = document.getElementById('startRunBtn');
  const solveBtn = document.getElementById('solveBtn');
  const clearBtn = document.getElementById('clearBtn');
  // const downloadBtn = document.getElementById('downloadBtn');
  const runTimeEl = document.getElementById('runTime');

  // Layout + DPR scaling
  function fitCanvas() {
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function layout() {
    const header = document.querySelector('.topbar');
    const footer = document.querySelector('.help');
    const wrap = canvas.parentElement;
    const headerH = header ? header.getBoundingClientRect().height : 0;
    const footerH = footer ? footer.getBoundingClientRect().height : 0;
    const vh = window.innerHeight;
    const availH = Math.max(200, vh - headerH - footerH - 48); // padding allowance
    const availW = Math.max(200, wrap.clientWidth - 32); // account for borders/padding
    const size = Math.floor(Math.min(availW, availH));
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    fitCanvas();
  }
  layout();
  window.addEventListener('resize', () => { layout(); draw(); });

  const DIR = { N:1, E:2, S:4, W:8 };
  const DX = { [DIR.E]:1, [DIR.W]:-1, [DIR.N]:0, [DIR.S]:0 };
  const DY = { [DIR.E]:0, [DIR.W]:0, [DIR.N]:-1, [DIR.S]:1 };
  const OPP = { [DIR.N]:DIR.S, [DIR.S]:DIR.N, [DIR.E]:DIR.W, [DIR.W]:DIR.E };

  const S = {
    cols: 20, rows: 20,
    grid: [], // each cell bitmask of open walls
    visited: [],
    path: null, // array of [c,r]
    anim: { running:false, stack:[], frontier:[], algo:'backtracker' },
    run: { active:false, startedAt:0, time:0, pos:[0,0], finished:false }
  };

  function resetGrid(c, r) {
    S.cols = c; S.rows = r;
    S.grid = Array.from({length:r}, ()=>Array(c).fill(0));
    S.visited = Array.from({length:r}, ()=>Array(c).fill(false));
    S.path = null;
    resetRun();
    sizeStat.textContent = `${c}×${r}`;
    cellsStat.textContent = String(c*r);
    deadEndsStat.textContent = '0';
    pathLenStat.textContent = '0';
  }

  function inBounds(x,y){ return x>=0 && x<S.cols && y>=0 && y<S.rows; }

  function neighbors(x,y){
    const ns=[];
    for (const d of [DIR.N,DIR.E,DIR.S,DIR.W]){
      const nx=x+DX[d], ny=y+DY[d];
      if (inBounds(nx,ny)) ns.push([nx,ny,d]);
    }
    return ns;
  }

  // Algorithms
  function initBacktracker(){
    S.anim.algo='backtracker';
    S.anim.stack=[[0,0]]; S.visited[0][0]=true;
  }
  function stepBacktracker(){
    const st=S.anim.stack; if (st.length===0) return true;
    const [x,y]=st[st.length-1];
    const opts=neighbors(x,y).filter(([nx,ny])=>!S.visited[ny][nx]);
    if (opts.length===0){ st.pop(); return false; }
    const [nx,ny,dir]=opts[Math.floor(Math.random()*opts.length)];
    S.grid[y][x]|=dir; S.grid[ny][nx]|=OPP[dir];
    S.visited[ny][nx]=true; st.push([nx,ny]);
    return false;
  }

  function initPrim(){
    S.anim.algo='prim';
    const sx=Math.floor(Math.random()*S.cols), sy=Math.floor(Math.random()*S.rows);
    S.visited[sy][sx]=true; S.anim.frontier=[]; pushFrontier(sx,sy);
  }
  function pushFrontier(x,y){
    for (const [nx,ny,dir] of neighbors(x,y)){
      if (!S.visited[ny][nx]) S.anim.frontier.push([x,y,nx,ny,dir]);
    }
  }
  function stepPrim(){
    const F=S.anim.frontier; if (F.length===0) return true;
    const i=Math.floor(Math.random()*F.length);
    const [x,y,nx,ny,dir]=F.splice(i,1)[0];
    if (S.visited[ny][nx]) return false;
    S.grid[y][x]|=dir; S.grid[ny][nx]|=OPP[dir];
    S.visited[ny][nx]=true; pushFrontier(nx,ny);
    return false;
  }

  function generateInstant(algo){
    resetVisited();
    if (algo==='prim') initPrim(); else initBacktracker();
    let done=false, guard=0;
    while(!done && guard<1e7){
      done = (algo==='prim') ? stepPrim() : stepBacktracker();
      guard++;
    }
    finalizeStats();
    resetRun();
  }

  function resetVisited(){ for(let y=0;y<S.rows;y++) for(let x=0;x<S.cols;x++) S.visited[y][x]=false; }

  function deadEnds(){
    let c=0; for(let y=0;y<S.rows;y++) for(let x=0;x<S.cols;x++){
      const m=S.grid[y][x];
      const deg=((m&DIR.N)?1:0)+((m&DIR.E)?1:0)+((m&DIR.S)?1:0)+((m&DIR.W)?1:0);
      if (deg===1) c++;
    }
    return c;
  }

  function solvePath(){
    // BFS from (0,0) to (cols-1,rows-1)
    const q=[[0,0]]; const prev=new Map(); const key=(x,y)=>x+","+y;
    const seen=Array.from({length:S.rows},()=>Array(S.cols).fill(false));
    seen[0][0]=true;
    while(q.length){
      const [x,y]=q.shift(); if (x===S.cols-1 && y===S.rows-1){
        const path=[]; let cx=x, cy=y; path.push([cx,cy]);
        while(prev.has(key(cx,cy))){ const p=prev.get(key(cx,cy)); cx=p[0]; cy=p[1]; path.push([cx,cy]); }
        path.reverse(); return path;
      }
      const m=S.grid[y][x];
      for (const d of [DIR.N,DIR.E,DIR.S,DIR.W]){
        if (!(m&d)) continue; const nx=x+DX[d], ny=y+DY[d];
        if (!inBounds(nx,ny) || seen[ny][nx]) continue;
        seen[ny][nx]=true; prev.set(key(nx,ny),[x,y]); q.push([nx,ny]);
      }
    }
    return null;
  }

  function finalizeStats(){
    deadEndsStat.textContent = String(deadEnds());
    S.path = null; pathLenStat.textContent = '0';
  }

  // Drawing
  function draw(){
    const W = canvas.clientWidth, H = canvas.clientHeight;
    ctx.clearRect(0,0,W,H);
    if (!S.grid.length) return;
    const cell = Math.min(W/S.cols, H/S.rows);
    const ox = Math.floor((W - cell*S.cols)/2);
    const oy = Math.floor((H - cell*S.rows)/2);

    // Background
    ctx.fillStyle='#0b1027'; ctx.fillRect(ox,oy,cell*S.cols,cell*S.rows);
    // Grid walls
    ctx.strokeStyle='#e5e7eb'; ctx.lineWidth=2; ctx.lineCap='square';
    for(let y=0;y<S.rows;y++){
      for(let x=0;x<S.cols;x++){
        const m=S.grid[y][x]; const x0=ox+x*cell, y0=oy+y*cell, x1=x0+cell, y1=y0+cell;
        ctx.beginPath();
        if (!(m&DIR.N)) { ctx.moveTo(x0,y0); ctx.lineTo(x1,y0); }
        if (!(m&DIR.E)) { ctx.moveTo(x1,y0); ctx.lineTo(x1,y1); }
        if (!(m&DIR.S)) { ctx.moveTo(x0,y1); ctx.lineTo(x1,y1); }
        if (!(m&DIR.W)) { ctx.moveTo(x0,y0); ctx.lineTo(x0,y1); }
        ctx.stroke();
      }
    }

    // Start/Goal
    ctx.fillStyle='rgba(110,168,254,0.25)';
    ctx.fillRect(ox+1, oy+1, cell-2, cell-2);
    ctx.fillStyle='rgba(166,227,161,0.25)';
    ctx.fillRect(ox+(S.cols-1)*cell+1, oy+(S.rows-1)*cell+1, cell-2, cell-2);

    // Path overlay
    if (S.path && S.path.length){
      ctx.strokeStyle='#a6e3a1'; ctx.lineWidth=Math.max(2, Math.floor(cell*0.25));
      ctx.beginPath();
      for (let i=0;i<S.path.length;i++){
        const [cx,cy]=S.path[i];
        const px=ox+cx*cell+cell/2, py=oy+cy*cell+cell/2;
        if (i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
      }
      ctx.stroke();
    }

    // Player
    if (S.run.active || S.run.finished) {
      const [pxc, pyc] = S.run.pos;
      const px = ox + pxc*cell + cell/2;
      const py = oy + pyc*cell + cell/2;
      ctx.fillStyle = S.run.finished ? '#a6e3a1' : '#6ea8fe';
      ctx.beginPath(); ctx.arc(px, py, Math.max(3, cell*0.28), 0, Math.PI*2); ctx.fill();
    }
  }

  // Animation loop for generation
  let last=performance.now();
  function loop(now){
    const dt = Math.min(0.05, (now-last)/1000); last=now;
    if (S.anim.running){
      const steps = Math.max(1, Math.floor(Number(speedRange.value)));
      for (let i=0;i<steps;i++){
        const done = (S.anim.algo==='prim') ? stepPrim() : stepBacktracker();
        if (done){ S.anim.running=false; finalizeStats(); break; }
      }
      draw();
    }
    // Update run timer display
    if (S.run.active && !S.run.finished) {
      S.run.time = (performance.now() - S.run.startedAt) / 1000;
      runTimeEl.textContent = S.run.time.toFixed(2);
    }
    if (S.run.active || S.run.finished) draw();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // Actions
  function doGenerate(){
    const c = Math.max(5, Math.min(200, Number(widthInp.value|0)));
    const r = Math.max(5, Math.min(200, Number(heightInp.value|0)));
    resetGrid(c, r);
    if (animateChk.checked){
      if (algoSel.value==='prim') initPrim(); else initBacktracker();
      S.anim.running=true; draw();
    } else {
      generateInstant(algoSel.value);
      draw();
    }
  }

  function doSolve(){
    const path = solvePath();
    S.path = path; pathLenStat.textContent = path ? String(path.length) : '0';
    draw();
  }

  function doClear(){ S.path=null; pathLenStat.textContent='0'; draw(); }

  function doDownload(){
    // Render at device CSS size (already scaled) — export PNG
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a'); a.href=url; a.download=`maze_${S.cols}x${S.rows}.png`; a.click();
  }

  genBtn.addEventListener('click', doGenerate);
  startRunBtn.addEventListener('click', () => { resetRun(true); });
  solveBtn.addEventListener('click', doSolve);
  clearBtn.addEventListener('click', doClear);
  // downloadBtn.addEventListener('click', doDownload);
  widthInp.addEventListener('change', ()=>{ sizeStat.textContent=`${widthInp.value}×${heightInp.value}`; cellsStat.textContent=String(Number(widthInp.value)*Number(heightInp.value)); });
  heightInp.addEventListener('change', ()=>{ sizeStat.textContent=`${widthInp.value}×${heightInp.value}`; cellsStat.textContent=String(Number(widthInp.value)*Number(heightInp.value)); });

  // Init
  resetGrid(20,20);
  // Generate an initial maze quickly
  generateInstant('backtracker');
  draw();

  // Running logic
  function resetRun(start=false){
    S.run.active = false; S.run.finished = false; S.run.time = 0;
    S.run.pos = [0,0];
    runTimeEl.textContent = '0.00';
    if (start) startRun(); else draw();
  }
  function startRun(){
    if (S.anim.running) return; // wait for generation to finish
    S.run.active = true; S.run.finished = false; S.run.time = 0;
    S.run.pos = [0,0];
    S.run.startedAt = performance.now();
  }
  function finishRun(){
    S.run.finished = true; S.run.active = false;
    // keep final time displayed
  }

  // Movement
  function tryMove(dir){
    if (!S.run.active || S.run.finished || S.anim.running) return;
    let [x,y] = S.run.pos;
    const m = S.grid[y][x];
    if (!(m & dir)) return;
    const nx = x + DX[dir], ny = y + DY[dir];
    if (nx<0||ny<0||nx>=S.cols||ny>=S.rows) return;
    S.run.pos = [nx,ny];
    if (nx===S.cols-1 && ny===S.rows-1) finishRun();
  }

  window.addEventListener('keydown', (e) => {
    if (S.anim.running) return;
    if (!S.run.active && !S.run.finished && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','a','A','d','D','w','W','s','S'].includes(e.key)) {
      startRun();
    }
    if (e.key==='ArrowLeft' || e.key==='a' || e.key==='A') { tryMove(DIR.W); e.preventDefault(); }
    else if (e.key==='ArrowRight' || e.key==='d' || e.key==='D') { tryMove(DIR.E); e.preventDefault(); }
    else if (e.key==='ArrowUp' || e.key==='w' || e.key==='W') { tryMove(DIR.N); e.preventDefault(); }
    else if (e.key==='ArrowDown' || e.key==='s' || e.key==='S') { tryMove(DIR.S); e.preventDefault(); }
  });
})();
