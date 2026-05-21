(() => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const introScreen = document.getElementById('introScreen');
  const endScreen = document.getElementById('endScreen');
  const pauseOverlay = document.getElementById('pauseOverlay');
  const hud = document.getElementById('hud');
  const playButton = document.getElementById('playButton');
  const restartButton = document.getElementById('restartButton');
  const restartButtonPause = document.getElementById('restartButtonPause');
  const resumeButton = document.getElementById('resumeButton');
  const muteButton = document.getElementById('muteButton');
  const muteButtonHud = document.getElementById('muteButtonHud');
  const volumeSlider = document.getElementById('volumeSlider');
  const volumeSliderHud = document.getElementById('volumeSliderHud');
  const clueList = document.getElementById('clueList');
  const contextHint = document.getElementById('contextHint');
  const suspicionFill = document.getElementById('suspicionFill');
  const suspicionText = document.getElementById('suspicionText');
  const beatIndicator = document.getElementById('beatIndicator');
  const endTitle = document.getElementById('endTitle');
  const endText = document.getElementById('endText');
  const endStats = document.getElementById('endStats');

  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const WORLD = { width: 1600, height: 940 };
  const COLORS = {
    gold: '#e5c06e',
    silver: '#b7d3ff',
    rose: '#e07897',
    violet: '#8c69db',
    moon: '#f5f2ff',
    shadow: '#100b1a'
  };

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  const rand = (min, max) => Math.random() * (max - min) + min;
  const normAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

  const obstacles = [
    { x: 515, y: 290, w: 84, h: 84, r: 20 },
    { x: 1001, y: 290, w: 84, h: 84, r: 20 },
    { x: 515, y: 556, w: 84, h: 84, r: 20 },
    { x: 1001, y: 556, w: 84, h: 84, r: 20 },
    { x: 220, y: 278, w: 96, h: 62, r: 18 },
    { x: 222, y: 468, w: 96, h: 62, r: 18 },
    { x: 1286, y: 278, w: 96, h: 62, r: 18 },
    { x: 1284, y: 468, w: 96, h: 62, r: 18 },
    { x: 742, y: 110, w: 116, h: 42, r: 14 },
    { x: 876, y: 110, w: 116, h: 42, r: 14 }
  ];

  const secretsTemplate = [
    { x: 270, y: 505, label: 'Silver Secret' },
    { x: 800, y: 148, label: 'Moon Secret' },
    { x: 1330, y: 505, label: 'Rose Secret' }
  ];

  const gate = { x: 800, y: 866, r: 62 };
  const ballroomCenter = { x: 800, y: 460 };

  class AudioEngine {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.musicGain = null;
      this.sfxGain = null;
      this.initialized = false;
      this.volume = 0.75;
      this.muted = false;
      this.running = false;
      this.scheduler = null;
      this.beatDuration = 60 / 90;
      this.nextBeatTime = 0;
      this.step = 0;
      this.state = { suspicion: 0, gateOpen: false };
    }
    loadSettings() {
      try {
        const v = parseFloat(localStorage.getItem('masquerade-volume'));
        if (!Number.isNaN(v)) this.volume = clamp(v, 0, 1);
        this.muted = localStorage.getItem('masquerade-muted') === '1';
      } catch (e) {}
    }
    init() {
      if (this.initialized) {
        this.ctx.resume();
        return;
      }
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.musicGain.gain.value = 0.72;
      this.sfxGain.gain.value = 0.92;
      this.musicGain.connect(this.master);
      this.sfxGain.connect(this.master);
      this.master.connect(this.ctx.destination);
      this.initialized = true;
    }
    setState(next) { Object.assign(this.state, next); }
    setVolume(v) {
      this.volume = clamp(v, 0, 1);
      if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
      try { localStorage.setItem('masquerade-volume', String(this.volume)); } catch (e) {}
    }
    setMuted(v) {
      this.muted = !!v;
      if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
      try { localStorage.setItem('masquerade-muted', this.muted ? '1' : '0'); } catch (e) {}
    }
    start() {
      this.init();
      if (!this.ctx) return;
      this.ctx.resume();
      this.running = true;
      this.nextBeatTime = this.ctx.currentTime + 0.08;
      this.step = 0;
      clearInterval(this.scheduler);
      this.scheduler = setInterval(() => this.schedule(), 80);
    }
    stop() { this.running = false; }
    schedule() {
      if (!this.running || !this.ctx) return;
      while (this.nextBeatTime < this.ctx.currentTime + 0.22) {
        this.scheduleBeat(this.step, this.nextBeatTime);
        this.nextBeatTime += this.beatDuration;
        this.step++;
      }
    }
    scheduleBeat(step, time) {
      const beat = step % 3;
      const tension = this.state.suspicion / 100;
      const gateOpen = this.state.gateOpen;
      this.tone({ freq: beat === 0 ? 73.42 : 98, type: 'sine', start: time, duration: 0.18, gain: beat === 0 ? 0.16 : 0.08 + tension * 0.02, target: this.musicGain, attack: 0.004, release: 0.12 });
      this.noise({ start: time, duration: 0.04, gain: 0.02, highpass: 1200, target: this.musicGain });
      const phrase = [523.25, 659.25, 783.99][beat];
      this.tone({ freq: phrase, type: 'triangle', start: time + 0.035, duration: 0.13, gain: 0.05, target: this.musicGain, attack: 0.008, release: 0.08 });
      this.tone({ freq: phrase * 2, type: 'sine', start: time + 0.04, duration: 0.1, gain: 0.015, target: this.musicGain, attack: 0.008, release: 0.06 });
      if (beat === 0) {
        this.tone({ freq: gateOpen ? 329.63 : 261.63, type: 'sawtooth', start: time, duration: 1.5, gain: 0.024 + tension * 0.02, target: this.musicGain, attack: 0.12, release: 0.7 });
        this.tone({ freq: gateOpen ? 493.88 : 392.0, type: 'triangle', start: time + 0.02, duration: 1.45, gain: 0.014, target: this.musicGain, attack: 0.12, release: 0.7 });
      }
      if (tension > 0.55 && beat === 2) {
        this.tone({ freq: 155.56, type: 'square', start: time, duration: 0.18, gain: 0.018 + tension * 0.03, target: this.musicGain, attack: 0.01, release: 0.08, detune: -10 });
      }
    }
    tone({ freq, type='sine', start=0, duration=0.2, gain=0.1, target=this.sfxGain, attack=0.01, release=0.1, detune=0 }) {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      if (detune) osc.detune.setValueAtTime(detune, start);
      g.gain.setValueAtTime(0.0001, start);
      g.gain.linearRampToValueAtTime(gain, start + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, start + duration + release);
      osc.connect(g);
      g.connect(target);
      osc.start(start);
      osc.stop(start + duration + release + 0.03);
    }
    noise({ start=0, duration=0.08, gain=0.03, highpass=800, target=this.sfxGain }) {
      if (!this.ctx) return;
      const buffer = this.ctx.createBuffer(1, Math.max(1, Math.floor(this.ctx.sampleRate * duration)), this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = highpass;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(gain, start);
      g.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      src.connect(filter); filter.connect(g); g.connect(target);
      src.start(start); src.stop(start + duration + 0.02);
    }
    click() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      this.tone({ freq: 880, type: 'triangle', start: t, duration: 0.05, gain: 0.05 });
      this.tone({ freq: 1174.66, type: 'sine', start: t + 0.03, duration: 0.05, gain: 0.03 });
    }
    pulseGood() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      [392, 523.25, 659.25].forEach((f, i) => this.tone({ freq: f, type: 'triangle', start: t + i * 0.03, duration: 0.1, gain: 0.06 - i * 0.01 }));
      this.noise({ start: t, duration: 0.06, gain: 0.012, highpass: 1600 });
    }
    pulseBad() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      this.tone({ freq: 210, type: 'square', start: t, duration: 0.06, gain: 0.055, detune: -18 });
      this.tone({ freq: 178, type: 'square', start: t + 0.02, duration: 0.08, gain: 0.045, detune: 15 });
      this.noise({ start: t, duration: 0.07, gain: 0.014, highpass: 1500 });
    }
    collect() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone({ freq: f, type: 'sine', start: t + i * 0.03, duration: 0.12, gain: 0.04 }));
    }
    gateOpen() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      [261.63, 329.63, 392, 523.25].forEach((f, i) => this.tone({ freq: f, type: 'triangle', start: t + i * 0.08, duration: 0.18, gain: 0.05 }));
    }
    win() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      [392, 523.25, 659.25, 783.99].forEach((f, i) => this.tone({ freq: f, type: 'triangle', start: t + i * 0.08, duration: 0.18, gain: 0.06 }));
    }
    lose() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      [220, 196, 174.61].forEach((f, i) => this.tone({ freq: f, type: 'sawtooth', start: t + i * 0.1, duration: 0.26, gain: 0.06, attack: 0.01, release: 0.22 }));
    }
  }

  const audio = new AudioEngine();
  audio.loadSettings();

  class Game {
    constructor() {
      this.keys = new Set();
      this.state = 'intro';
      this.lastFrame = 0;
      this.worldTime = 0;
      this.beatStart = 0;
      this.beatDuration = audio.beatDuration;
      this.beatFlash = 0;
      this.camera = { x: WORLD.width / 2, y: WORLD.height / 2 };
      this.message = { text: 'Press Space on the beat to charm nearby guests.', timer: 4 };
      this.endReason = '';
      this.createWorld();
      this.resize();
      requestAnimationFrame((t) => this.loop(t));
    }
    createWorld() {
      this.player = { x: 800, y: 788, r: 15, speed: 255, suspicion: 0, pulseCooldown: 0 };
      this.secrets = secretsTemplate.map((s) => ({ ...s, collected: false, pulse: rand(0, Math.PI * 2) }));
      this.collectedClues = 0;
      this.gateOpen = false;
      this.endReason = '';
      this.startTime = performance.now();
      this.particles = [];
      this.guests = [];
      this.makeGuests();
      this.message = { text: 'Press Space on the beat to charm nearby guests.', timer: 4 };
      this.worldTime = 0;
    }
    makeGuests() {
      const add = (x, y, facing, patrol = null, color = COLORS.gold) => {
        this.guests.push({ x, y, baseX: x, baseY: y, facing, patrol, patrolIndex: 0, r: 16, charmed: 0, alert: 0, spin: rand(0, Math.PI * 2), color });
      };
      // left wing
      add(360, 300, Math.PI * 0.15, [{ x: 330, y: 300 }, { x: 390, y: 300 }], COLORS.silver);
      add(392, 488, -0.15, [{ x: 380, y: 470 }, { x: 392, y: 510 }], COLORS.silver);
      add(470, 402, 0.05, [{ x: 470, y: 365 }, { x: 470, y: 438 }], COLORS.silver);
      // center lanes
      add(650, 242, Math.PI / 2, [{ x: 650, y: 220 }, { x: 650, y: 300 }], COLORS.gold);
      add(800, 250, Math.PI / 2, [{ x: 800, y: 222 }, { x: 800, y: 308 }], COLORS.gold);
      add(950, 242, Math.PI / 2, [{ x: 950, y: 220 }, { x: 950, y: 300 }], COLORS.gold);
      add(620, 460, 0, [{ x: 590, y: 460 }, { x: 680, y: 460 }], COLORS.gold);
      add(980, 460, Math.PI, [{ x: 920, y: 460 }, { x: 1010, y: 460 }], COLORS.gold);
      // right wing
      add(1240, 304, Math.PI - 0.15, [{ x: 1210, y: 300 }, { x: 1270, y: 300 }], COLORS.rose);
      add(1202, 492, Math.PI + 0.1, [{ x: 1200, y: 470 }, { x: 1200, y: 520 }], COLORS.rose);
      add(1130, 408, Math.PI, [{ x: 1130, y: 370 }, { x: 1130, y: 445 }], COLORS.rose);
      // dance ring
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI * 2 * i) / 8;
        const r = 150;
        add(ballroomCenter.x + Math.cos(a) * r, ballroomCenter.y + Math.sin(a) * r * 0.74, a + Math.PI / 2, null, [COLORS.gold, COLORS.silver, COLORS.rose][i % 3]);
      }
    }
    resize() {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.floor(rect.width * DPR);
      canvas.height = Math.floor(rect.height * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      this.viewWidth = rect.width;
      this.viewHeight = rect.height;
    }
    start() {
      this.createWorld();
      this.state = 'playing';
      audio.start();
      this.beatDuration = audio.beatDuration;
      this.beatStart = performance.now() / 1000 + 0.08;
      audio.setState({ suspicion: 0, gateOpen: false });
      introScreen.classList.add('hidden');
      introScreen.classList.remove('active');
      pauseOverlay.classList.add('hidden');
      endScreen.classList.add('hidden');
      hud.classList.remove('hidden');
    }
    restart() { audio.click(); this.start(); }
    togglePause() {
      if (this.state === 'playing') {
        this.state = 'paused';
        pauseOverlay.classList.remove('hidden');
      } else if (this.state === 'paused') {
        this.state = 'playing';
        pauseOverlay.classList.add('hidden');
      }
    }
    loop(ts) {
      if (!this.lastFrame) this.lastFrame = ts;
      const dt = Math.min(0.033, (ts - this.lastFrame) / 1000);
      this.lastFrame = ts;
      if (this.state === 'playing') this.update(dt);
      this.render();
      requestAnimationFrame((t) => this.loop(t));
    }
    update(dt) {
      this.worldTime += dt;
      this.beatFlash = Math.max(0, this.beatFlash - dt * 3.5);
      this.player.pulseCooldown = Math.max(0, this.player.pulseCooldown - dt);
      if (this.message.timer > 0) this.message.timer -= dt;
      this.updateBeatIndicator();
      this.updatePlayer(dt);
      this.updateGuests(dt);
      this.updateDetection(dt);
      this.collectSecrets();
      this.updateParticles(dt);
      this.updateCamera(dt);
      this.updateHUD();
      audio.setState({ suspicion: this.player.suspicion, gateOpen: this.gateOpen });

      if (this.gateOpen && dist(this.player.x, this.player.y, gate.x, gate.y) < gate.r) {
        this.finish(true);
      }
      if (this.player.suspicion >= 100) {
        this.endReason = 'Too many eyes found their mark.';
        this.finish(false);
      }
    }
    updateBeatIndicator() {
      const now = performance.now() / 1000;
      const beats = (now - this.beatStart) / this.beatDuration;
      const nearest = Math.round(beats);
      const nearestTime = this.beatStart + nearest * this.beatDuration;
      if (Math.abs(now - nearestTime) < 0.08) this.beatFlash = 1;
      beatIndicator.classList.toggle('active', this.beatFlash > 0.2);
    }
    isOnBeat() {
      const now = performance.now() / 1000;
      const beats = (now - this.beatStart) / this.beatDuration;
      const nearest = Math.round(beats);
      const nearestTime = this.beatStart + nearest * this.beatDuration;
      return Math.abs(now - nearestTime) <= 0.15;
    }
    updatePlayer(dt) {
      let dx = 0, dy = 0;
      if (this.keys.has('w') || this.keys.has('arrowup')) dy -= 1;
      if (this.keys.has('s') || this.keys.has('arrowdown')) dy += 1;
      if (this.keys.has('a') || this.keys.has('arrowleft')) dx -= 1;
      if (this.keys.has('d') || this.keys.has('arrowright')) dx += 1;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len; dy /= len;
      this.player.x += dx * this.player.speed * dt;
      this.player.y += dy * this.player.speed * dt;
      this.resolveCircleVsWorld(this.player);
    }
    pulse() {
      if (this.state !== 'playing' || this.player.pulseCooldown > 0) return;
      this.player.pulseCooldown = 0.18;
      const success = this.isOnBeat();
      const pulseRadius = success ? 185 : 150;
      this.spawnRing(this.player.x, this.player.y, success ? COLORS.gold : COLORS.rose, success ? 190 : 150, success ? 0.8 : 0.6);
      let affected = 0;
      for (const guest of this.guests) {
        const d = dist(this.player.x, this.player.y, guest.x, guest.y);
        if (d <= pulseRadius) {
          affected++;
          if (success) {
            guest.charmed = Math.max(guest.charmed, 2.5);
            guest.alert = 0;
          } else {
            guest.alert = Math.max(guest.alert, 1.5);
          }
        }
      }
      if (success) {
        this.player.suspicion = clamp(this.player.suspicion - 9, 0, 100);
        this.message = { text: affected ? `Perfect step. ${affected} guest${affected === 1 ? '' : 's'} charmed.` : 'Perfect step. No one close enough to sway.', timer: 1.5 };
        audio.pulseGood();
        for (let i = 0; i < 16; i++) this.spawnSpark(this.player.x, this.player.y, COLORS.gold, rand(35, 180), rand(0, Math.PI * 2), rand(0.5, 1.2));
      } else {
        this.player.suspicion = clamp(this.player.suspicion + 8, 0, 100);
        this.message = { text: 'Missed the beat. The room stiffens.', timer: 1.3 };
        audio.pulseBad();
        for (let i = 0; i < 12; i++) this.spawnSpark(this.player.x, this.player.y, COLORS.rose, rand(25, 120), rand(0, Math.PI * 2), rand(0.35, 0.8));
      }
    }
    updateGuests(dt) {
      const danceStart = 11;
      const ringGuests = this.guests.slice(danceStart);
      for (const guest of ringGuests) {
        if (guest.charmed > 0) {
          guest.charmed -= dt;
          guest.spin += dt * 6;
        } else {
          const idx = ringGuests.indexOf(guest);
          const a = this.worldTime * 0.3 + idx * (Math.PI * 2 / ringGuests.length);
          guest.x = ballroomCenter.x + Math.cos(a) * 150;
          guest.y = ballroomCenter.y + Math.sin(a) * 110;
          guest.facing = a + Math.PI / 2;
        }
      }
      for (let i = 0; i < danceStart; i++) {
        const guest = this.guests[i];
        guest.charmed = Math.max(0, guest.charmed - dt);
        guest.alert = Math.max(0, guest.alert - dt * 0.6);
        if (guest.charmed > 0) {
          guest.spin += dt * 6.5;
          continue;
        }
        if (guest.patrol && guest.patrol.length) {
          const target = guest.patrol[guest.patrolIndex];
          const dx = target.x - guest.x;
          const dy = target.y - guest.y;
          const d = Math.hypot(dx, dy);
          if (d < 6) guest.patrolIndex = (guest.patrolIndex + 1) % guest.patrol.length;
          else {
            const speed = 40;
            guest.x += (dx / d) * speed * dt;
            guest.y += (dy / d) * speed * dt;
            guest.facing = Math.atan2(dy, dx);
          }
        }
      }
    }
    updateDetection(dt) {
      let visible = false;
      let delta = 0;
      for (const guest of this.guests) {
        if (guest.charmed > 0) continue;
        const dx = this.player.x - guest.x;
        const dy = this.player.y - guest.y;
        const d = Math.hypot(dx, dy);
        const radius = guest.alert > 0 ? 230 : 185;
        if (d > radius) continue;
        const angleToPlayer = Math.atan2(dy, dx);
        const cone = guest.alert > 0 ? Math.PI * 0.95 : Math.PI * 0.62;
        const diff = Math.abs(normAngle(angleToPlayer - guest.facing));
        if (diff > cone / 2) continue;
        visible = true;
        const power = 1 - d / radius;
        delta += dt * (16 + guest.alert * 8) * power;
      }
      if (!visible) delta -= dt * 5;
      this.player.suspicion = clamp(this.player.suspicion + delta, 0, 100);
      contextHint.textContent = this.gateOpen
        ? 'The Moon Gate is open. Reach it.'
        : 'Press Space on the beat to charm nearby guests.';
    }
    collectSecrets() {
      for (const secret of this.secrets) {
        if (secret.collected) continue;
        secret.pulse += 0.05;
        if (dist(this.player.x, this.player.y, secret.x, secret.y) < 26) {
          secret.collected = true;
          this.collectedClues++;
          this.message = { text: `${secret.label} claimed.`, timer: 1.5 };
          audio.collect();
          for (let i = 0; i < 18; i++) this.spawnSpark(secret.x, secret.y, COLORS.moon, rand(35, 170), rand(0, Math.PI * 2), rand(0.4, 1.3));
          if (this.collectedClues === 3) {
            this.gateOpen = true;
            this.message = { text: 'The Moon Gate opens. Run.', timer: 2.4 };
            audio.gateOpen();
            this.spawnRing(gate.x, gate.y, COLORS.moon, 170, 1.1);
          }
        }
      }
    }
    updateParticles(dt) {
      for (const p of this.particles) {
        p.life -= dt;
        if (p.ring) p.radius = lerp(p.radius, p.maxRadius, 1 - Math.pow(0.0008, dt));
        else {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vx *= 0.985;
          p.vy *= 0.985;
        }
      }
      this.particles = this.particles.filter((p) => p.life > 0);
    }
    updateCamera(dt) {
      const tx = clamp(this.player.x, this.viewWidth / 2, WORLD.width - this.viewWidth / 2);
      const ty = clamp(this.player.y, this.viewHeight / 2, WORLD.height - this.viewHeight / 2);
      this.camera.x = lerp(this.camera.x, tx, 1 - Math.pow(0.001, dt));
      this.camera.y = lerp(this.camera.y, ty, 1 - Math.pow(0.001, dt));
    }
    updateHUD() {
      clueList.textContent = `${this.collectedClues} / 3`;
      suspicionFill.style.width = `${this.player.suspicion}%`;
      suspicionText.textContent = `${Math.round(this.player.suspicion)}%`;
      muteButton.textContent = audio.muted ? 'Unmute' : 'Mute';
      muteButtonHud.textContent = audio.muted ? 'Unmute' : 'Mute';
      muteButton.setAttribute('aria-pressed', audio.muted ? 'true' : 'false');
      muteButtonHud.setAttribute('aria-pressed', audio.muted ? 'true' : 'false');
    }
    finish(win) {
      this.state = 'ended';
      endScreen.classList.remove('hidden');
      const elapsed = Math.max(1, Math.floor((performance.now() - this.startTime) / 1000));
      if (win) {
        endTitle.textContent = 'Escaped Beneath the Thirteenth Moon';
        endText.textContent = 'Your final step carried you through the gate before the court could close around you.';
        audio.win();
      } else {
        endTitle.textContent = 'Unmasked Before the Court';
        endText.textContent = this.endReason || 'The masquerade saw through you.';
        audio.lose();
      }
      endStats.innerHTML = `
        <div><strong>Time:</strong> ${elapsed}s</div>
        <div><strong>Secrets:</strong> ${this.collectedClues}/3</div>
        <div><strong>Suspicion:</strong> ${Math.round(this.player.suspicion)}%</div>
      `;
    }
    spawnSpark(x, y, color, speed, angle, life) {
      this.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life, maxLife: life, color, size: rand(2, 5) });
    }
    spawnRing(x, y, color, maxRadius, life) {
      this.particles.push({ x, y, ring: true, radius: 12, maxRadius, life, maxLife: life, color });
    }
    resolveCircleVsWorld(ent) {
      ent.x = clamp(ent.x, ent.r + 30, WORLD.width - ent.r - 30);
      ent.y = clamp(ent.y, ent.r + 30, WORLD.height - ent.r - 30);
      for (const obs of obstacles) {
        const nx = clamp(ent.x, obs.x, obs.x + obs.w);
        const ny = clamp(ent.y, obs.y, obs.y + obs.h);
        const dx = ent.x - nx;
        const dy = ent.y - ny;
        const d = Math.hypot(dx, dy);
        if (d < ent.r + 3) {
          const push = (ent.r + 3 - d) || 1;
          ent.x += (dx / (d || 1)) * push;
          ent.y += (dy / (d || 1)) * push;
        }
      }
    }
    render() {
      ctx.clearRect(0, 0, this.viewWidth, this.viewHeight);
      ctx.save();
      ctx.translate(this.viewWidth / 2 - this.camera.x, this.viewHeight / 2 - this.camera.y);
      this.drawWorld();
      this.drawSecrets();
      this.drawGuests();
      this.drawPlayer();
      this.drawGate();
      this.drawParticles();
      this.drawMessage();
      ctx.restore();
      this.drawScreenFx();
    }
    drawWorld() {
      const bg = ctx.createLinearGradient(0, 0, 0, WORLD.height);
      bg.addColorStop(0, '#140d22'); bg.addColorStop(0.7, '#0b0915'); bg.addColorStop(1, '#08050d');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, WORLD.width, WORLD.height);
      ctx.save();
      ctx.globalAlpha = 0.07;
      for (let x = 0; x < WORLD.width; x += 64) {
        ctx.beginPath();
        ctx.moveTo(x, 0); ctx.lineTo(x + 35, WORLD.height);
        ctx.strokeStyle = x % 128 === 0 ? '#e4c98b' : '#8c6bb5';
        ctx.stroke();
      }
      ctx.restore();

      const salon = (x, y, w, h, color, label) => {
        ctx.fillStyle = color;
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        this.roundRect(x, y, w, h, 26, true, true);
        ctx.fillStyle = 'rgba(255,255,255,0.72)';
        ctx.font = '18px Georgia';
        ctx.fillText(label, x + 18, y + 28);
      };
      salon(110, 220, 360, 340, 'rgba(143,184,255,0.13)', 'Silver Salon');
      salon(1130, 220, 360, 340, 'rgba(217,87,125,0.13)', 'Rose Salon');
      salon(610, 70, 380, 140, 'rgba(217,184,105,0.12)', 'Moon Gallery');
      salon(240, 200, 1120, 560, 'rgba(255,255,255,0.03)', '');

      const floor = ctx.createRadialGradient(ballroomCenter.x, ballroomCenter.y, 40, ballroomCenter.x, ballroomCenter.y, 270);
      floor.addColorStop(0, 'rgba(255, 236, 191, 0.14)');
      floor.addColorStop(0.5, 'rgba(110, 82, 163, 0.11)');
      floor.addColorStop(1, 'rgba(16, 12, 28, 0.01)');
      ctx.fillStyle = floor;
      ctx.beginPath();
      ctx.ellipse(ballroomCenter.x, ballroomCenter.y, 270, 205, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(235, 211, 141, 0.08)';
      for (let i = 0; i < 7; i++) {
        ctx.beginPath();
        ctx.ellipse(ballroomCenter.x, ballroomCenter.y, 250 - i * 25, 188 - i * 20, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      for (const obs of obstacles) {
        ctx.fillStyle = '#22172f';
        ctx.strokeStyle = 'rgba(233, 224, 255, 0.08)';
        this.roundRect(obs.x, obs.y, obs.w, obs.h, obs.r, true, true);
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        this.roundRect(obs.x + 10, obs.y + 10, obs.w - 20, obs.h - 20, Math.max(8, obs.r - 6), true, false);
      }

      const chandeliers = [[800, 296], [640, 400], [960, 400]];
      chandeliers.forEach(([x, y], i) => {
        const glow = ctx.createRadialGradient(x, y, 8, x, y, 88);
        glow.addColorStop(0, 'rgba(255, 241, 204, 0.3)'); glow.addColorStop(1, 'rgba(255, 241, 204, 0)');
        ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, 88, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, y - 18); ctx.stroke();
        ctx.fillStyle = i === 1 ? COLORS.silver : i === 2 ? COLORS.rose : COLORS.gold;
        ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fill();
      });
    }
    drawSecrets() {
      for (const s of this.secrets) {
        if (s.collected) continue;
        const pulse = 0.75 + Math.sin(this.worldTime * 3 + s.pulse) * 0.12;
        const glow = ctx.createRadialGradient(s.x, s.y, 2, s.x, s.y, 40);
        glow.addColorStop(0, `rgba(255,255,255,${0.85 * pulse})`);
        glow.addColorStop(0.4, 'rgba(210,225,255,0.8)');
        glow.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(s.x, s.y, 40, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath(); ctx.arc(s.x, s.y, 12 + Math.sin(this.worldTime * 4 + s.pulse) * 2, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = COLORS.moon;
        ctx.beginPath(); ctx.arc(s.x, s.y, 4, 0, Math.PI * 2); ctx.fill();
      }
    }
    drawGuests() {
      for (const g of this.guests) {
        if (g.charmed <= 0) this.drawCone(g);
      }
      const sorted = [...this.guests].sort((a, b) => a.y - b.y);
      for (const g of sorted) {
        ctx.save();
        ctx.translate(g.x, g.y);
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.beginPath(); ctx.ellipse(0, 18, 15, 7, 0, 0, Math.PI * 2); ctx.fill();
        const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, g.charmed > 0 ? 48 : 30);
        glow.addColorStop(0, g.charmed > 0 ? 'rgba(245,242,255,0.28)' : 'rgba(255,255,255,0.08)');
        glow.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, g.charmed > 0 ? 48 : 30, 0, Math.PI * 2); ctx.fill();
        if (g.charmed > 0) ctx.rotate(g.spin);
        ctx.fillStyle = COLORS.shadow;
        ctx.beginPath();
        ctx.moveTo(0, -22);
        ctx.quadraticCurveTo(20, -4, 15, 20);
        ctx.quadraticCurveTo(0, 14, -15, 20);
        ctx.quadraticCurveTo(-20, -4, 0, -22);
        ctx.fill();
        ctx.fillStyle = g.charmed > 0 ? COLORS.moon : g.color;
        ctx.beginPath(); ctx.ellipse(0, 0, 13, 17, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff7eb';
        ctx.beginPath(); ctx.ellipse(0, -5, 9, 7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#111'; ctx.fillRect(-7, -8, 14, 4);
        if (g.alert > 0) {
          ctx.strokeStyle = `rgba(240,120,150,${0.2 + g.alert * 0.25})`;
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(0, 0, 25 + g.alert * 5, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.restore();
      }
    }
    drawCone(g) {
      const radius = g.alert > 0 ? 230 : 185;
      const cone = g.alert > 0 ? Math.PI * 0.95 : Math.PI * 0.62;
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.rotate(g.facing);
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
      grad.addColorStop(0, g.alert > 0 ? 'rgba(230,100,136,0.15)' : 'rgba(255,238,190,0.08)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, -cone / 2, cone / 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    drawPlayer() {
      ctx.save();
      ctx.translate(this.player.x, this.player.y);
      ctx.fillStyle = 'rgba(0,0,0,0.24)';
      ctx.beginPath(); ctx.ellipse(0, 18, 18, 8, 0, 0, Math.PI * 2); ctx.fill();
      const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 44);
      glow.addColorStop(0, 'rgba(229,192,110,0.32)'); glow.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, 44, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = COLORS.shadow;
      ctx.beginPath();
      ctx.moveTo(0, -24);
      ctx.quadraticCurveTo(22, -5, 17, 22);
      ctx.quadraticCurveTo(0, 14, -17, 22);
      ctx.quadraticCurveTo(-22, -5, 0, -24);
      ctx.fill();
      ctx.fillStyle = COLORS.gold;
      ctx.beginPath(); ctx.ellipse(0, 0, 14, 18, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff8ef';
      ctx.beginPath(); ctx.ellipse(0, -5, 10, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#111'; ctx.fillRect(-8, -8, 16, 5);
      if (this.player.pulseCooldown > 0) {
        ctx.strokeStyle = `rgba(255,255,255,${0.2 + this.player.pulseCooldown * 2})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, 22 + this.player.pulseCooldown * 30, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    }
    drawGate() {
      const glow = ctx.createRadialGradient(gate.x, gate.y, 12, gate.x, gate.y, 120);
      glow.addColorStop(0, this.gateOpen ? 'rgba(240,245,255,0.42)' : 'rgba(95,82,125,0.2)');
      glow.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(gate.x, gate.y, 120, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = this.gateOpen ? COLORS.moon : 'rgba(170,148,213,0.45)';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(gate.x, gate.y, 54, Math.PI, 0); ctx.stroke();
      if (this.gateOpen) {
        ctx.strokeStyle = 'rgba(240,245,255,0.35)';
        ctx.beginPath(); ctx.arc(gate.x, gate.y, 38 + Math.sin(this.worldTime * 3) * 2, Math.PI, 0); ctx.stroke();
      }
    }
    drawParticles() {
      for (const p of this.particles) {
        const a = clamp(p.life / p.maxLife, 0, 1);
        if (p.ring) {
          ctx.strokeStyle = this.rgbaFromHex(p.color, a * 0.55);
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.stroke();
        } else {
          ctx.fillStyle = this.rgbaFromHex(p.color, a * 0.9);
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    drawMessage() {
      if (this.message.timer <= 0) return;
      ctx.save();
      ctx.translate(this.player.x, this.player.y - 44);
      ctx.font = '16px Georgia';
      const w = Math.min(420, ctx.measureText(this.message.text).width + 24);
      ctx.fillStyle = 'rgba(10,8,20,0.75)';
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      this.roundRect(-w / 2, -22, w, 34, 16, true, true);
      ctx.fillStyle = COLORS.moon;
      ctx.textAlign = 'center';
      ctx.fillText(this.message.text, 0, 0);
      ctx.restore();
    }
    drawScreenFx() {
      const suspicion = this.player ? this.player.suspicion / 100 : 0;
      const vignette = ctx.createRadialGradient(this.viewWidth / 2, this.viewHeight / 2, Math.min(this.viewWidth, this.viewHeight) * 0.2, this.viewWidth / 2, this.viewHeight / 2, Math.max(this.viewWidth, this.viewHeight) * 0.75);
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, `rgba(8,2,10,${0.34 + suspicion * 0.44})`);
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);
      if (suspicion > 0.7) {
        ctx.fillStyle = `rgba(140, 26, 54, ${(suspicion - 0.7) * 0.22})`;
        ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);
      }
    }
    roundRect(x, y, w, h, r, fill, stroke) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      if (fill) ctx.fill();
      if (stroke) ctx.stroke();
    }
    rgbaFromHex(hex, alpha) {
      const v = parseInt(hex.replace('#', ''), 16);
      const r = (v >> 16) & 255, g = (v >> 8) & 255, b = v & 255;
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }

  const game = new Game();

  const syncVolume = (value) => {
    volumeSlider.value = String(value);
    volumeSliderHud.value = String(value);
  };
  const applyVolume = (raw) => {
    const value = clamp(Number(raw) / 100, 0, 1);
    audio.setVolume(value);
    syncVolume(Math.round(value * 100));
  };
  const toggleMute = () => {
    audio.setMuted(!audio.muted);
    game.updateHUD();
  };
  syncVolume(Math.round(audio.volume * 100));

  playButton.addEventListener('click', () => {
    audio.init();
    audio.click();
    game.start();
  });
  restartButton.addEventListener('click', () => game.restart());
  restartButtonPause.addEventListener('click', () => game.restart());
  resumeButton.addEventListener('click', () => game.togglePause());
  muteButton.addEventListener('click', toggleMute);
  muteButtonHud.addEventListener('click', toggleMute);
  volumeSlider.addEventListener('input', (e) => applyVolume(e.target.value));
  volumeSliderHud.addEventListener('input', (e) => applyVolume(e.target.value));
  window.addEventListener('resize', () => game.resize());

  window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'escape', 'w', 'a', 's', 'd', 'p'].includes(key)) e.preventDefault();
    if (game.state === 'intro') return;
    if ((key === 'escape' || key === 'p') && (game.state === 'playing' || game.state === 'paused')) {
      game.togglePause();
      return;
    }
    if (game.state !== 'playing') return;
    if (!e.repeat) game.keys.add(key);
    if ((e.key === ' ' || e.code === 'Space') && !e.repeat) game.pulse();
  }, { passive: false });
  window.addEventListener('keyup', (e) => game.keys.delete(e.key.toLowerCase()));

  contextHint.textContent = 'Press Play to enter the masquerade.';
  window.__masqueradeGame = game;
  window.__masqueradeAudio = audio;
})();
