/* Wax Museum Midnight — Procedural Tile-Step Stealth */

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const TILE = { FLOOR: 1, WALL: 2, EXIT: 5, START: 9, GAP: 0 };
const TILE_S = 56;
const WAX_DRIP_COST = 5;
const WAX_MAX = 100;
const MOVE_DUR = 120;
const FLAME_R = 200;
const FOV_A = Math.PI / 2.2;
const FOV_D = 150;

let state = 'INTRO';
let levelIdx = 0;
let tiles = [];
let waxPools = [];
let waxCaches = [];
let particles = [];
let time = 0;
let camX = 0, camY = 0;
let runSeed = 0;
let rngState = 0;
let currentRunLevels = [];

const player = { gx: 1, gy: 1, x: 1, y: 1, wax: WAX_MAX, lastDrip: 0, moving: false, moveT: 0, moveFrom: {x:0,y:0}, moveTo: {x:0,y:0}, alive: true };
const watchman = { x: 0, y: 0, gx: 0, gy: 0, wp: 0, waiting: false, waitT: 0, moving: false, angle: 0, speed: 1, spotted: false, spotT: 0, forward: true };

/* ---------- Seeded RNG ---------- */
function srand(seed) { rngState = seed >>> 0; }
function rand() { rngState = (rngState * 1103515245 + 12345) & 0x7fffffff; return rngState / 0x7fffffff; }
function randInt(min, max) { return min + Math.floor(rand() * (max - min + 1)); }
function randItem(arr) { return arr[Math.floor(rand() * arr.length)]; }

/* ---------- Procedural Generation ---------- */
const ROOM_NAMES = [
  "The Lesson","The Vestibule","The Cloister","The Atrium","The Scriptorium",
  "The Antechamber","The Belfry","The Refectory","The Oratory","The Consistory",
  "The Tribune","The Mausoleum","The Panopticon","The Hypogeum","The Orrery",
  "The Nave","The Crypt","The Annex","The Rotunda","The Purgatory"
];

function generateRun() {
  runSeed = Date.now() % 1000000;
  srand(runSeed);
  currentRunLevels = [];
  for (let i = 0; i < 5; i++) currentRunLevels.push(generateLevel(i));
  const el = document.getElementById('run-id');
  if (el) el.textContent = 'Exhibit #' + runSeed;
  const hudEl = document.getElementById('run-hud-id');
  if (hudEl) hudEl.textContent = '#' + runSeed;
}

function generateLevel(idx) {
  // Dimensions vary by difficulty and randomness
  const isWide = rand() < 0.6;
  const width = isWide ? Math.min(24, 11 + idx * 3 + randInt(0, 2)) : Math.min(18, 9 + idx * 2 + randInt(0, 1));
  const height = isWide ? Math.min(9, 5 + idx + randInt(0, 1)) : Math.min(11, 5 + idx + randInt(0, 2));

  const grid = [];
  for (let y = 0; y < height; y++) {
    grid[y] = [];
    for (let x = 0; x < width; x++) grid[y][x] = TILE.WALL;
  }

  const corridorY = Math.floor(height / 2);

  // --- Guaranteed horizontal corridor (the spine) ---
  for (let x = 1; x < width - 1; x++) {
    grid[corridorY][x] = TILE.FLOOR;
  }

  // --- Meander: shift the corridor up or down for random segments ---
  const meanders = randInt(0, Math.min(3, idx + 1));
  for (let m = 0; m < meanders; m++) {
    const segStart = randInt(2, width - 5);
    const segLen = randInt(2, Math.min(5, width - segStart - 2));
    const offset = rand() < 0.5 ? -1 : 1;
    const altY = corridorY + offset;
    if (altY > 0 && altY < height - 1) {
      for (let x = segStart; x < segStart + segLen; x++) {
        grid[altY][x] = TILE.FLOOR;
      }
      // Ensure vertical connectivity at segment ends
      grid[altY][segStart] = TILE.FLOOR;
      grid[corridorY][segStart] = TILE.FLOOR;
      if (segStart + segLen < width - 1) {
        grid[altY][segStart + segLen - 1] = TILE.FLOOR;
        grid[corridorY][segStart + segLen - 1] = TILE.FLOOR;
      }
    }
  }

  // --- Random vertical connectors / alcoves near the corridor ---
  for (let x = 2; x < width - 2; x++) {
    if (rand() < 0.10 && corridorY > 1) grid[corridorY - 1][x] = TILE.FLOOR;
    if (rand() < 0.10 && corridorY < height - 2) grid[corridorY + 1][x] = TILE.FLOOR;
  }

  // --- Start and Exit on the main corridor ---
  grid[corridorY][1] = TILE.START;
  grid[corridorY][width - 2] = TILE.EXIT;

  // --- Gaps on the corridor (never on start or exit) ---
  const gapCandidates = [];
  for (let x = 2; x < width - 2; x++) {
    if (grid[corridorY][x] === TILE.FLOOR) gapCandidates.push({x, y: corridorY});
  }
  // Fisher-Yates shuffle
  for (let i = gapCandidates.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [gapCandidates[i], gapCandidates[j]] = [gapCandidates[j], gapCandidates[i]];
  }
  const maxGaps = Math.min(gapCandidates.length, 1 + idx + randInt(0, Math.max(1, Math.floor(idx / 2))));
  for (let i = 0; i < maxGaps; i++) {
    const g = gapCandidates[i];
    grid[g.y][g.x] = TILE.GAP;
  }

  // --- Branching rooms / alcoves off the corridor ---
  const roomCount = randInt(0, Math.min(3, idx + 1));
  for (let r = 0; r < roomCount; r++) {
    const rx = randInt(2, width - 3);
    const ry = randInt(1, height - 2);
    if (grid[ry][rx] === TILE.WALL) {
      grid[ry][rx] = TILE.FLOOR;
      if (rand() < 0.35 && rx + 1 < width - 1) grid[ry][rx + 1] = TILE.FLOOR;
      if (rand() < 0.35 && ry + 1 < height - 1) grid[ry + 1][rx] = TILE.FLOOR;
    }
  }

  // --- Watchman patrols (levels 1+) on open horizontal lanes ---
  let watchmanDef = null;
  if (idx >= 1) {
    const lanes = [];
    for (let y = 1; y < height - 1; y++) {
      const openX = [];
      for (let x = 1; x < width - 1; x++) {
        if (grid[y][x] !== TILE.WALL) openX.push(x);
      }
      if (openX.length >= 4) lanes.push({y, openX});
    }
    if (lanes.length > 0) {
      const lane = randItem(lanes);
      const y = lane.y;
      const xs = lane.openX;
      const wps = [];
      const step = Math.max(1, Math.floor(xs.length / 3));
      for (let i = 0; i < Math.min(4, xs.length); i += step) {
        const pick = i + randInt(0, Math.max(0, Math.min(step - 1, xs.length - i - 1)));
        wps.push({x: xs[Math.min(pick, xs.length - 1)], y});
      }
      // Keep waypoints reasonably far from start and exit
      const filtered = wps.filter(p => p.x > 3 && p.x < width - 3);
      if (filtered.length >= 2) {
        const speed = 1.2 + idx * 0.2 + rand() * 0.35;
        const wait = Math.max(200, 600 - idx * 80 - rand() * 100);
        const pingpong = rand() < 0.5;
        watchmanDef = { waypoints: filtered, speed, wait, pingpong };
      }
    }
  }

  // --- Wax caches off the main corridor ---
  const caches = [];
  const cacheCount = randInt(0, Math.min(3, idx + 1));
  for (let i = 0; i < cacheCount; i++) {
    let attempts = 0;
    while (attempts < 100) {
      const cx = randInt(2, width - 3);
      const cy = randInt(1, height - 2);
      if (grid[cy][cx] === TILE.FLOOR && cy !== corridorY) {
        caches.push({x: cx, y: cy});
        break;
      }
      attempts++;
    }
  }

  const name = ROOM_NAMES[randInt(0, ROOM_NAMES.length - 1)];

  // Convert grid to string map
  const mapLines = [];
  for (let y = 0; y < height; y++) {
    let line = "";
    for (let x = 0; x < width; x++) {
      const t = grid[y][x];
      if (t === TILE.WALL) line += '#';
      else if (t === TILE.START) line += 'S';
      else if (t === TILE.EXIT) line += 'E';
      else if (t === TILE.GAP) line += 'X';
      else line += '-';
    }
    mapLines.push(line);
  }

  return { name, map: mapLines, watchman: watchmanDef, caches };
}

/* ---------- Map Parsing ---------- */
function parseMap(lines) {
  const h = lines.length;
  const w = lines[0].length;
  const t = [];
  let sx = 1, sy = 1;
  for (let y = 0; y < h; y++) {
    const row = [];
    for (let x = 0; x < w; x++) {
      const c = lines[y][x];
      if (c === '#') row.push(TILE.WALL);
      else if (c === 'S') { row.push(TILE.START); sx = x; sy = y; }
      else if (c === 'E') row.push(TILE.EXIT);
      else if (c === 'X') row.push(TILE.GAP);
      else row.push(TILE.FLOOR);
    }
    t.push(row);
  }
  return { tiles: t, width: w, height: h, start: {x: sx, y: sy} };
}

function tileAt(gx, gy) {
  if (gy < 0 || gy >= tiles.length || gx < 0 || gx >= tiles[0].length) return TILE.WALL;
  return tiles[gy][gx];
}

function isWalkable(gx, gy) {
  const t = tileAt(gx, gy);
  return t !== TILE.WALL && (t !== TILE.GAP || hasWax(gx, gy));
}

function hasWax(gx, gy) {
  return waxPools.some(p => p.gx === gx && p.gy === gy);
}

/* ---------- Core Systems ---------- */
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function loadLevel(idx) {
  levelIdx = idx;
  const def = currentRunLevels[idx];
  const parsed = parseMap(def.map);
  tiles = parsed.tiles;
  waxPools = [];
  waxCaches = (def.caches || []).slice();
  particles = [];

  player.gx = parsed.start.x;
  player.gy = parsed.start.y;
  player.x = parsed.start.x;
  player.y = parsed.start.y;
  player.wax = WAX_MAX;
  player.alive = true;
  player.moving = false;
  player.lastDrip = 0;

  watchman.forward = true;
  const w = def.watchman;
  if (w && w.waypoints) {
    const w0 = w.waypoints[0];
    watchman.x = w0.x + 0.5;
    watchman.y = w0.y + 0.5;
    watchman.gx = w0.x;
    watchman.gy = w0.y;
    watchman.wp = 0;
    watchman.waiting = false;
    watchman.waitT = 0;
    watchman.speed = w.speed;
    watchman.moving = false;
    watchman.angle = 0;
    watchman.spotted = false;
    watchman.spotT = 0;
  } else {
    watchman.x = -100;
    watchman.y = -100;
  }

  camX = canvas.width * 0.5 - (parsed.start.x + 0.5) * TILE_S;
  camY = canvas.height * 0.5 - (parsed.start.y + 0.5) * TILE_S;

  document.getElementById('room-label').textContent = def.name;

  AUDIO.stopAll();
  AUDIO.startCrackle();
  AUDIO.startDrone();
  if (def.watchman) {
    AUDIO.startFootsteps(watchman, () => Math.hypot(watchman.x - player.x, watchman.y - player.y));
  }

  state = 'PLAYING';
  document.getElementById('hud').classList.add('active');
  hideAll();
}

function hideAll() {
  ['intro-screen','pause-screen','room-end-screen','gameover-screen','victory-screen'].forEach(id => {
    document.getElementById(id).classList.remove('active');
  });
}
function show(id) {
  hideAll();
  document.getElementById(id).classList.add('active');
}

function die(reason) {
  if (!player.alive) return;
  player.alive = false;
  state = 'GAMEOVER';
  AUDIO.stopAll();
  document.getElementById('death-reason').textContent = reason;
  show('gameover-screen');
  document.getElementById('hud').classList.remove('active');
}

function winLevel() {
  state = 'ROOM_END';
  AUDIO.stopAll();
  show('room-end-screen');
  setTimeout(() => {
    if (levelIdx + 1 < currentRunLevels.length) loadLevel(levelIdx + 1);
    else {
      state = 'VICTORY';
      show('victory-screen');
      document.getElementById('hud').classList.remove('active');
    }
  }, 1500);
}

function tryMove(dx, dy) {
  if (player.moving || state !== 'PLAYING') return;
  const tx = player.gx + dx;
  const ty = player.gy + dy;
  if (!isWalkable(tx, ty)) {
    AUDIO.creak();
    return;
  }
  player.moving = true;
  player.moveT = 0;
  player.moveFrom = { x: player.gx, y: player.gy };
  player.moveTo = { x: tx, y: ty };
}

function drip() {
  const now = Date.now();
  if (now - player.lastDrip < 200) return;
  if (player.wax <= 3) return;
  player.wax -= WAX_DRIP_COST;
  player.lastDrip = now;
  const gx = player.gx, gy = player.gy;
  const targets = [[gx, gy], [gx+1, gy], [gx-1, gy], [gx, gy+1], [gx, gy-1]];
  targets.forEach(([tx, ty]) => {
    if (tileAt(tx, ty) === TILE.GAP) {
      waxPools = waxPools.filter(p => !(p.gx === tx && p.gy === ty));
      waxPools.push({ gx: tx, gy: ty, created: now, size: 0 });
    }
  });
  AUDIO.drip(0.5);
  const spx = (player.x + 0.5) * TILE_S + camX;
  const spy = (player.y + 0.5) * TILE_S + camY;
  for (let i = 0; i < 5; i++) {
    particles.push({ x: spx, y: spy - 20, vx: (Math.random()-0.5)*3, vy: Math.random()*2, life: 0.8, color: 'rgba(212,168,64,' });
  }
}

function update(dt) {
  time += dt;
  if (state !== 'PLAYING') return;
  const dtSec = dt * 0.001;

  if (player.moving) {
    player.moveT += dt;
    const t = Math.min(1, player.moveT / MOVE_DUR);
    const ease = 1 - (1 - t) * (1 - t);
    player.x = player.moveFrom.x + (player.moveTo.x - player.moveFrom.x) * ease;
    player.y = player.moveFrom.y + (player.moveTo.y - player.moveFrom.y) * ease;
    if (t >= 1) {
      player.moving = false;
      player.gx = player.moveTo.x;
      player.gy = player.moveTo.y;
      player.x = player.gx;
      player.y = player.gy;
      AUDIO.harden();

      // Wax cache pickup
      const cIdx = waxCaches.findIndex(c => c.x === player.gx && c.y === player.gy);
      if (cIdx !== -1) {
        player.wax = Math.min(WAX_MAX, player.wax + 20);
        waxCaches.splice(cIdx, 1);
        AUDIO.drip(0.9);
        for (let i = 0; i < 6; i++) {
          const spx = (player.x + 0.5) * TILE_S + camX;
          const spy = (player.y + 0.5) * TILE_S + camY;
          particles.push({ x: spx, y: spy - 10, vx: (Math.random()-0.5)*4, vy: -Math.random()*3, life: 1.0, color: 'rgba(255,220,120,' });
        }
      }

      if (tileAt(player.gx, player.gy) === TILE.EXIT) {
        winLevel();
        return;
      }
    }
  }

  const now = Date.now();
  waxPools = waxPools.filter(p => {
    const age = now - p.created;
    if (age < 300) p.size = Math.min(1, age / 300);
    return age < 15000;
  });

  if (player.wax <= 0) { die("Your flame guttered and died."); return; }

  if (currentRunLevels[levelIdx].watchman) updateWatchman(dtSec);

  particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += 0.03; p.life -= dtSec; });
  particles = particles.filter(p => p.life > 0);

  const tx = canvas.width * 0.5 - (player.x + 0.5) * TILE_S;
  const ty = canvas.height * 0.5 - (player.y + 0.5) * TILE_S;
  camX += (tx - camX) * 0.1;
  camY += (ty - camY) * 0.1;

  const pct = Math.max(0, Math.min(100, player.wax));
  const wf = document.getElementById('wax-fill');
  wf.style.width = pct + '%';
  wf.classList.toggle('low', pct < 20);
}

function updateWatchman(dtSec) {
  const def = currentRunLevels[levelIdx];
  const w = def.watchman;
  if (!w) return;

  if (watchman.waiting) {
    watchman.waitT -= dtSec * 1000;
    if (watchman.waitT <= 0) {
      watchman.waiting = false;
      if (w.pingpong) {
        if (watchman.forward) {
          watchman.wp++;
          if (watchman.wp >= w.waypoints.length - 1) watchman.forward = false;
        } else {
          watchman.wp--;
          if (watchman.wp <= 0) watchman.forward = true;
        }
      } else {
        watchman.wp = (watchman.wp + 1) % w.waypoints.length;
      }
    }
    watchman.moving = false;
  } else {
    const t = w.waypoints[watchman.wp];
    const tx = t.x + 0.5, ty = t.y + 0.5;
    const d = Math.hypot(tx - watchman.x, ty - watchman.y);
    if (d < 0.15) {
      watchman.waiting = true;
      watchman.waitT = w.wait;
      watchman.moving = false;
      AUDIO.lanternSwing();
    } else {
      watchman.moving = true;
      const a = Math.atan2(ty - watchman.y, tx - watchman.x);
      watchman.angle = a;
      watchman.x += Math.cos(a) * watchman.speed * dtSec;
      watchman.y += Math.sin(a) * watchman.speed * dtSec;
    }
  }

  // Detection
  const pd = Math.hypot(watchman.x - player.x - 0.5, watchman.y - player.y - 0.5) * TILE_S;
  if (pd > FOV_D + 50) {
    watchman.spotted = false;
    watchman.spotT = 0;
    AUDIO.dangerStop();
    return;
  }

  const pa = Math.atan2(player.y + 0.5 - watchman.y, player.x + 0.5 - watchman.x);
  let diff = pa - watchman.angle;
  while (diff <= -Math.PI) diff += Math.PI * 2;
  while (diff > Math.PI) diff -= Math.PI * 2;
  const spotted = pd <= FOV_D && Math.abs(diff) <= FOV_A * 0.5;

  let blocked = false;
  if (spotted) {
    const steps = Math.ceil(Math.hypot(player.x + 0.5 - watchman.x, player.y + 0.5 - watchman.y) * 5);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      if (tileAt(Math.floor(watchman.x + (player.x + 0.5 - watchman.x) * t), Math.floor(watchman.y + (player.y + 0.5 - watchman.y) * t)) === TILE.WALL) {
        blocked = true; break;
      }
    }
  }

  if (spotted && !blocked) {
    if (!watchman.spotted) { watchman.spotted = true; AUDIO.dangerStart(); }
    watchman.spotT += dtSec * 1000;
    if (watchman.spotT > 500) { die("The lantern found you."); }
  } else {
    watchman.spotted = false;
    watchman.spotT = 0;
    AUDIO.dangerStop();
  }
}

/* ---------- Drawing ---------- */
function draw() {
  ctx.fillStyle = '#050505';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (state === 'INTRO') return;

  const px = (player.x + 0.5) * TILE_S + camX;
  const py = (player.y + 0.5) * TILE_S + camY;

  // Tiles
  for (let y = 0; y < tiles.length; y++) {
    for (let x = 0; x < tiles[y].length; x++) {
      const t = tiles[y][x];
      const sx = x * TILE_S + camX;
      const sy = y * TILE_S + camY;
      const cx = sx + TILE_S * 0.5;
      const cy = sy + TILE_S * 0.5;

      if (t === TILE.FLOOR || t === TILE.START || t === TILE.EXIT) {
        ctx.fillStyle = t === TILE.EXIT ? '#1e1810' : '#0e0c08';
        ctx.fillRect(sx + 1, sy + 1, TILE_S - 2, TILE_S - 2);
        ctx.strokeStyle = t === TILE.EXIT ? '#c8a050' : '#1a1610';
        ctx.lineWidth = 1;
        ctx.strokeRect(sx + 1, sy + 1, TILE_S - 2, TILE_S - 2);
        if (t === TILE.EXIT) {
          ctx.fillStyle = '#c8a050';
          ctx.font = 'bold 12px Georgia';
          ctx.textAlign = 'center';
          ctx.fillText('EXIT', cx, cy + 4);
        }
      } else if (t === TILE.WALL) {
        ctx.fillStyle = '#141210';
        ctx.fillRect(sx, sy, TILE_S, TILE_S);
        ctx.fillStyle = '#1c1814';
        ctx.fillRect(sx + 2, sy + 2, TILE_S - 4, TILE_S - 4);
      } else if (t === TILE.GAP) {
        ctx.fillStyle = '#030303';
        ctx.fillRect(sx + 2, sy + 2, TILE_S - 4, TILE_S - 4);
        ctx.strokeStyle = 'rgba(40,30,20,0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(sx + 4, sy + 4, TILE_S - 8, TILE_S - 8);
        ctx.strokeStyle = 'rgba(60,45,30,0.15)';
        ctx.beginPath();
        ctx.moveTo(sx + 8, sy + 8);
        ctx.lineTo(sx + TILE_S - 8, sy + TILE_S - 8);
        ctx.moveTo(sx + TILE_S - 8, sy + 8);
        ctx.lineTo(sx + 8, sy + TILE_S - 8);
        ctx.stroke();
      }
    }
  }

  // Wax caches
  waxCaches.forEach(c => {
    const sx = c.x * TILE_S + camX;
    const sy = c.y * TILE_S + camY;
    const cx = sx + TILE_S * 0.5;
    const cy = sy + TILE_S * 0.5;
    const pulse = 0.6 + Math.sin(time * 0.005 + c.x * 3 + c.y * 7) * 0.4;
    ctx.fillStyle = `rgba(212,192,144,${0.25 * pulse})`;
    ctx.beginPath();
    ctx.arc(cx, cy, 6 + pulse * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255,235,180,${0.5 * pulse})`;
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  // Wax pools
  const now = Date.now();
  waxPools.forEach(p => {
    const age = now - p.created;
    const fade = Math.max(0, 1 - age / 15000);
    const size = p.size * 20;
    const sx = p.gx * TILE_S + camX + TILE_S * 0.5;
    const sy = p.gy * TILE_S + camY + TILE_S * 0.5;
    ctx.fillStyle = `rgba(212,192,144,${0.55 * fade})`;
    ctx.beginPath();
    ctx.ellipse(sx, sy, size, size * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(230,210,160,${0.3 * fade})`;
    ctx.beginPath();
    ctx.ellipse(sx, sy, size * 0.5, size * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  // Watchman
  if (currentRunLevels[levelIdx] && currentRunLevels[levelIdx].watchman) {
    const wx = watchman.x * TILE_S + camX;
    const wy = watchman.y * TILE_S + camY;
    ctx.fillStyle = '#0a0806';
    ctx.beginPath();
    ctx.arc(wx, wy - 8, 9, 0, Math.PI * 2);
    ctx.fill();
    const hx = wx + Math.cos(watchman.angle + Math.PI * 0.3) * 13;
    const hy = wy - 8 + Math.sin(watchman.angle + Math.PI * 0.3) * 7;
    ctx.strokeStyle = '#0a0806';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(wx + 3, wy - 5);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    ctx.fillStyle = '#1a1408';
    ctx.beginPath();
    ctx.arc(hx, hy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(240,180,60,0.9)';
    ctx.beginPath();
    ctx.arc(hx, hy, 3, 0, Math.PI * 2);
    ctx.fill();

    const a = watchman.angle + Math.PI * 0.3;
    const sp = FOV_A * 0.5;
    ctx.fillStyle = watchman.spotted ? 'rgba(220,80,40,0.15)' : 'rgba(240,180,60,0.08)';
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.arc(hx, hy, FOV_D, a - sp, a + sp);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = watchman.spotted ? 'rgba(220,80,40,0.25)' : 'rgba(240,180,60,0.15)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(hx + Math.cos(a - sp) * FOV_D, hy + Math.sin(a - sp) * FOV_D);
    ctx.moveTo(hx, hy);
    ctx.lineTo(hx + Math.cos(a + sp) * FOV_D, hy + Math.sin(a + sp) * FOV_D);
    ctx.stroke();
  }

  // Player
  const waxR = 5 + (player.wax / WAX_MAX) * 8;
  ctx.fillStyle = `rgba(212,168,64,${0.35 + (player.wax / WAX_MAX) * 0.35})`;
  ctx.beginPath();
  ctx.ellipse(px, py + 4, waxR, waxR * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c8b898';
  ctx.fillRect(px - 3, py - 6, 6, 8);

  // Light
  ctx.save();
  const grad = ctx.createRadialGradient(px, py - 20, 10, px, py - 20, FLAME_R);
  grad.addColorStop(0, 'rgba(255,200,80,0.24)');
  grad.addColorStop(0.4, 'rgba(255,180,60,0.08)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = grad;
  ctx.fillRect(px - FLAME_R, py - FLAME_R - 20, FLAME_R * 2, FLAME_R * 2);

  const dg = ctx.createRadialGradient(px, py - 20, FLAME_R * 0.5, px, py - 20, FLAME_R * 2.2);
  dg.addColorStop(0, 'rgba(0,0,0,0)');
  dg.addColorStop(1, 'rgba(0,0,0,0.92)');
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = dg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();

  // Particles
  particles.forEach(p => {
    ctx.fillStyle = p.color + Math.max(0, p.life) + ')';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2 + p.life * 2, 0, Math.PI * 2);
    ctx.fill();
  });

  // Flame
  const fx = Math.sin(time * 0.012) * 2 + Math.sin(time * 0.023) * 1.5;
  const fy = Math.sin(time * 0.018) * 2;
  ctx.fillStyle = 'rgba(240,180,60,0.28)';
  ctx.beginPath();
  ctx.ellipse(px + fx, py + fy - 20, 10, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,220,120,0.9)';
  ctx.beginPath();
  ctx.moveTo(px + fx, py + fy - 32);
  ctx.quadraticCurveTo(px + fx + 5, py + fy - 16, px + fx, py + fy - 14);
  ctx.quadraticCurveTo(px + fx - 5, py + fy - 16, px + fx, py + fy - 32);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff8e0';
  ctx.beginPath();
  ctx.ellipse(px + fx, py + fy - 22, 2.5, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
}

/* ---------- Loop & Input ---------- */
let lastT = 0;
function frame(now) {
  const dt = Math.min(now - lastT, 50);
  lastT = now;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}

window.addEventListener('keydown', e => {
  if (state !== 'PLAYING') {
    if (e.key === 'Escape') {
      if (state === 'PAUSED') resumeGame();
    }
    return;
  }
  if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') tryMove(0, -1);
  if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') tryMove(0, 1);
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') tryMove(-1, 0);
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') tryMove(1, 0);
  if (e.key === ' ') drip();
  if (e.key === 'Escape') {
    state = 'PAUSED';
    AUDIO.stopFootsteps();
    show('pause-screen');
  }
});
window.addEventListener('resize', resize);

function resumeGame() {
  if (state === 'PAUSED') {
    state = 'PLAYING';
    if (currentRunLevels[levelIdx] && currentRunLevels[levelIdx].watchman) {
      AUDIO.startFootsteps(watchman, () => Math.hypot(watchman.x - player.x, watchman.y - player.y));
    }
    hideAll();
    document.getElementById('hud').classList.add('active');
  }
}

/* ---------- UI Bindings ---------- */
document.getElementById('play-btn').addEventListener('click', () => {
  AUDIO.init();
  AUDIO.setVolume(parseFloat(document.getElementById('volume-slider').value));
  resize();
  generateRun();
  loadLevel(0);
});

document.getElementById('mute-btn').addEventListener('click', () => {
  const muted = AUDIO.toggleMute();
  document.getElementById('mute-btn').textContent = muted ? '🔇' : '🔊';
});

document.getElementById('pause-btn').addEventListener('click', () => {
  if (state === 'PLAYING') { state = 'PAUSED'; AUDIO.stopFootsteps(); show('pause-screen'); }
});

document.getElementById('resume-btn').addEventListener('click', resumeGame);
document.getElementById('restart-room-btn').addEventListener('click', () => loadLevel(levelIdx));
document.getElementById('quit-btn').addEventListener('click', () => {
  state = 'INTRO';
  AUDIO.stopAll();
  show('intro-screen');
  document.getElementById('hud').classList.remove('active');
});
document.getElementById('retry-btn').addEventListener('click', () => loadLevel(levelIdx));
document.getElementById('gameover-quit-btn').addEventListener('click', () => {
  state = 'INTRO';
  show('intro-screen');
});
document.getElementById('victory-replay-btn').addEventListener('click', () => {
  AUDIO.init();
  generateRun();
  loadLevel(0);
});
document.getElementById('volume-slider').addEventListener('input', e => {
  AUDIO.setVolume(parseFloat(e.target.value));
});

// Boot
resize();
lastT = performance.now();
requestAnimationFrame(frame);
