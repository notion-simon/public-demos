/* Weather Witch: Forecast a Lie (Simplified)
   One core mechanic: click the sigil exactly as the scanline passes through it.
   Client-only static game for GitHub Pages.
*/

(() => {
  'use strict';

  // ---------- utils ----------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];

  function nowSec(){ return performance.now() / 1000; }

  // ---------- data ----------
  const WEATHER = {
    RAIN: { id:'RAIN', name:'Rain', accent:'#27d6ff', desc:'Downpour. Barrels. Gutters. Umbrellas.' },
    SUN: { id:'SUN', name:'Sun', accent:'#ffcc33', desc:'Clear heat. Mirrors. Awnings. Wide eyes.' },
    WIND: { id:'WIND', name:'Wind', accent:'#79ff7a', desc:'Gales. Rope. Open doors. Flying trash.' },
    LIGHTNING: { id:'LIGHTNING', name:'Lightning', accent:'#ff3bd4', desc:'Storm. Rods. Prayers. Power.' },
  };

  const DAYS = [
    { day:1, title:'The Orchard Fire', desc:'A spark leapt the creek. If the orchard burns, winter will be hungry.', required:'RAIN', mundane:'SUN' },
    { day:2, title:'The River Is Too High', desc:'Floodwater is licking the steps. Lower it before night market.', required:'SUN', mundane:'RAIN' },
    { day:3, title:'The Miasma Fair', desc:'A sour fog is choking the square. Clear it or the fair dies.', required:'WIND', mundane:'SUN' },
    { day:4, title:'The Battery Church', desc:'The ward is empty. Charge the spires before the hungry spirits arrive.', required:'LIGHTNING', mundane:'WIND' },
    { day:5, title:'Frost on the Wheat', desc:'Cold glitter is eating the stalks. Warm the field, seal the harvest.', required:'SUN', mundane:'LIGHTNING' },
  ];

  // ---------- DOM ----------
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const overlay = document.getElementById('overlay');
  const overlayCard = document.getElementById('overlayCard');

  const hud = document.getElementById('hud');
  const hudDay = document.getElementById('hudDay');
  const hudNeed = document.getElementById('hudNeed');
  const hudBelief = document.getElementById('hudBelief');
  const hudRequired = document.getElementById('hudRequired');
  const hudChosen = document.getElementById('hudChosen');
  const btnMute = document.getElementById('btnMute');
  const vol = document.getElementById('vol');

  // ---------- Audio ----------
  class AudioEngine {
    constructor(){
      this.ctx = null;
      this.master = null;
      this.musicGain = null;
      this.fxGain = null;
      this.noiseGain = null;
      this.muted = false;
      this.volume = 0.8;
      this._music = null;
      this._noise = null;
      this._belief = 0;
      this._weatherAccent = 'RAIN';
    }

    ensure(){
      if (this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC({ latencyHint: 'interactive' });

      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.55;
      this.fxGain = this.ctx.createGain();
      this.fxGain.gain.value = 0.9;
      this.noiseGain = this.ctx.createGain();
      this.noiseGain.gain.value = 0.16;

      this.musicGain.connect(this.master);
      this.noiseGain.connect(this.master);
      this.fxGain.connect(this.master);
      this.master.connect(this.ctx.destination);

      this._startMusic();
      this._startNoise();
      this.setBelief(0);
    }

    setVolume(v){
      this.volume = v;
      if (this.master){
        this.master.gain.setTargetAtTime(this.muted ? 0 : v, this.ctx.currentTime, 0.015);
      }
    }

    toggleMute(){
      this.muted = !this.muted;
      this.setVolume(this.volume);
    }

    setBelief(v){
      this._belief = clamp(v, 0, 100);
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      // belief removes static and brightens music
      this.noiseGain.gain.setTargetAtTime(lerp(0.22, 0.03, this._belief/100), t, 0.06);
      this.musicGain.gain.setTargetAtTime(lerp(0.38, 0.64, this._belief/100), t, 0.08);
      if (this._music?.filter){
        this._music.filter.frequency.setTargetAtTime(lerp(650, 1400, this._belief/100), t, 0.10);
      }
    }

    setWeatherAccent(id){
      this._weatherAccent = id;
      if (!this.ctx || !this._music) return;
      const t = this.ctx.currentTime;
      const map = {
        RAIN: 0,
        SUN: 4,
        WIND: 7,
        LIGHTNING: 11
      };
      const semi = map[id] ?? 0;
      const base = 110 * Math.pow(2, semi/12);
      this._music.osc1.frequency.setTargetAtTime(base, t, 0.25);
      this._music.osc2.frequency.setTargetAtTime(base*2, t, 0.25);
    }

    _startMusic(){
      const ctx = this.ctx;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 900;
      filter.Q.value = 0.8;

      const g = ctx.createGain();
      g.gain.value = 0.85;

      const osc1 = ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc1.frequency.value = 110;
      const osc2 = ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.value = 220;

      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.09;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 18;
      lfo.connect(lfoGain);
      lfoGain.connect(osc2.detune);

      osc1.connect(g);
      osc2.connect(g);
      g.connect(filter);
      filter.connect(this.musicGain);

      osc1.start();
      osc2.start();
      lfo.start();

      this._music = { filter, g, osc1, osc2, lfo };
    }

    _startNoise(){
      const ctx = this.ctx;
      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i=0;i<bufferSize;i++) data[i] = (Math.random()*2-1) * 0.35;

      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1300;
      filter.Q.value = 0.9;

      src.connect(filter);
      filter.connect(this.noiseGain);
      src.start();
      this._noise = {src, filter};
    }

    _blip(freq=740, dur=0.06, type='square', gain=0.12){
      if (!this.ctx) return;
      const ctx = this.ctx;
      const t0 = ctx.currentTime;
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = 0;
      o.connect(g);
      g.connect(this.fxGain);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(gain, t0 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.start(t0);
      o.stop(t0 + dur + 0.02);
    }

    hit(){
      const w = this._weatherAccent;
      const f = w === 'RAIN' ? 880 : w === 'SUN' ? 990 : w === 'WIND' ? 1040 : 1180;
      this._blip(f, 0.07, 'triangle', 0.14);
    }
    miss(){ this._blip(140, 0.10, 'square', 0.10); }
    ui(){ this._blip(520, 0.05, 'sine', 0.08); }
    win(){ this._blip(990,0.09,'sine',0.15); setTimeout(()=>this._blip(1320,0.10,'sine',0.11), 90); }
    lose(){ this._blip(220,0.13,'sawtooth',0.14); }
  }

  const audio = new AudioEngine();

  // ---------- state ----------
  const State = {
    INTRO: 'INTRO',
    BRIEFING: 'BRIEFING',
    LIVE: 'LIVE',
    RESULT: 'RESULT',
    WIN: 'WIN'
  };

  const game = {
    state: State.INTRO,
    dayIndex: 0,

    required: 'RAIN',
    chosen: 'RAIN',

    belief: 0,
    beliefNeed: 55,

    // live
    time: 0,
    duration: 20,
    scanX: 0,
    scanSpeed: 0.33,
    combo: 0,
    staticAmt: 0,
    targets: [],
    spawnT: 0,

    // input
    pointer: {x:0, y:0, down:false, justPressed:false},
    spaceJustPressed: false,
    spaceCount: 0,

    // ui feedback
    caption: '',
    captionT: 0,
  };

  // ---------- sizing ----------
  let W=0, H=0, DPR=1;
  function resize(){
    DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    W = Math.floor(canvas.clientWidth * DPR);
    H = Math.floor(canvas.clientHeight * DPR);
    canvas.width = W;
    canvas.height = H;
  }
  window.addEventListener('resize', resize);

  // ---------- overlay helpers ----------
  function showOverlay(html){
    overlayCard.innerHTML = html;
    overlay.classList.remove('hidden');
  }
  function hideOverlay(){ overlay.classList.add('hidden'); }

  function caption(text, dur=1.3){
    game.caption = text;
    game.captionT = dur;
  }

  // ---------- intro ----------
  function showIntro(){
    hud.style.display = 'none';
    showOverlay(`
      <h1>Weather Witch: <span style="color:var(--hot)">Forecast a Lie</span></h1>
      <h2>Click glowing sigils to build Belief. Make your forecast real.</h2>
      <div class="divider"></div>
      <div class="grid2">
        <div class="notice">
          <p><b>Core mechanic:</b> <b>click sigils before they fade</b>.</p>
          <p class="small">You’ll see a scanline sweeping the map—hit on the line for a little bonus (optional).</p>
          <p class="small">Controls: mouse/touch to click • <span class="kbd">Space</span> = click nearest • <span class="kbd">M</span> = mute</p>
        </div>
        <div class="notice">
          <p><b>5 days.</b> Each day has a needed weather. Choose the right forecast to keep the Need low.</p>
          <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:10px;">
            <button id="playBtn" class="btn primary">Play</button>
            <button id="tipBtn" class="btn">One Tip</button>
          </div>
          <p class="small" style="margin-top:10px;">Audio starts after Play (browser rule). Use volume anytime.</p>
        </div>
      </div>
    `);

    document.getElementById('playBtn').onclick = () => {
      audio.ensure();
      audio.ui();
      startCampaign();
    };
    document.getElementById('tipBtn').onclick = () => {
      audio.ensure();
      audio.ui();
      showOverlay(`
        <h1>One Tip</h1>
        <p>Don’t spam clicks. Wait for the scanline to overlap the sigil—then strike.</p>
        <div class="divider"></div>
        <button id="backBtn" class="btn primary">Back</button>
      `);
      document.getElementById('backBtn').onclick = showIntro;
    };
  }

  // ---------- campaign flow ----------
  function startCampaign(){
    game.dayIndex = 0;
    game.state = State.BRIEFING;
    hud.style.display = 'flex';
    showBriefing();
  }

  function showBriefing(){
    const d = DAYS[game.dayIndex];
    game.required = d.required;
    game.chosen = d.required;
    game.belief = 0;
    game.targets.length = 0;
    audio.setBelief(0);

    updateHud();

    const req = WEATHER[d.required];
    const mun = WEATHER[d.mundane];

    const options = Object.values(WEATHER).map(w => {
      const recommended = (w.id === d.required);
      return `
        <button class="bigBtn" data-weather="${w.id}" style="border-color:${recommended ? 'rgba(121,255,122,0.35)' : 'rgba(255,255,255,0.12)'}">
          <div class="title" style="color:${w.accent}">${w.name}</div>
          <div class="desc">${w.desc}</div>
          ${recommended ? `<div class="desc" style="margin-top:6px; color:rgba(121,255,122,0.92)"><b>Needed today</b></div>` : ``}
        </button>
      `;
    }).join('');

    showOverlay(`
      <h1>Day ${d.day}: ${d.title}</h1>
      <p>${d.desc}</p>
      <div class="divider"></div>
      <div class="row">
        <div class="notice" style="flex:1; min-width:260px;">
          <p><b>Mundane forecast:</b> <span style="color:${mun.accent}">${mun.name}</span></p>
          <p class="small">The ordinary sky is useless. Your broadcast isn’t.</p>
        </div>
        <div class="notice" style="flex:1; min-width:260px;">
          <p><b>Needed:</b> <span style="color:${req.accent}">${req.name}</span></p>
          <p class="small">Choose your forecast. Then go live.</p>
        </div>
      </div>

      <p style="margin-top:12px;"><b>Pick a forecast:</b></p>
      <div class="row">${options}</div>
      <div class="divider"></div>
      <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap;">
        <div class="small">Core mechanic: click sigils before they fade. (Scanline hits give a bonus.)</div>
        <button id="goLive" class="btn primary" disabled>Go Live</button>
      </div>
    `);

    let selected = null;
    const goLive = document.getElementById('goLive');

    overlayCard.querySelectorAll('button.bigBtn').forEach(btn => {
      btn.onclick = () => {
        audio.ensure();
        audio.ui();
        overlayCard.querySelectorAll('button.bigBtn').forEach(b => b.style.outline='none');
        const w = btn.dataset.weather;
        btn.style.outline = `2px solid ${WEATHER[w].accent}`;
        selected = w;
        goLive.disabled = false;
      };
    });

    goLive.onclick = () => {
      if (!selected) return;
      game.chosen = selected;
      beginLive();
    };
  }

  function computeNeed(){
    const dayRamp = game.dayIndex * 2; // gentle
    const correct = game.chosen === game.required;
    return clamp((correct ? 44 : 70) + dayRamp, 30, 92);
  }

  function beginLive(){
    game.state = State.LIVE;
    hideOverlay();

    game.belief = 0;
    game.combo = 0;
    game.staticAmt = 0;
    game.time = 0;
    game.duration = 25;
    game.scanX = 0.05;
    game.scanSpeed = 0.28;
    game.spawnT = 0;
    game.targets.length = 0;

    game.beliefNeed = computeNeed();
    audio.setWeatherAccent(game.chosen);
    audio.setBelief(0);

    caption(`ON AIR — Click sigils on the scanline. Need ${Math.round(game.beliefNeed)}.`);
    updateHud();
  }

  function endLive(){
    const success = game.belief >= game.beliefNeed;
    game.state = State.RESULT;

    const d = DAYS[game.dayIndex];
    const chosen = WEATHER[game.chosen];
    const req = WEATHER[game.required];

    if (success) audio.win(); else audio.lose();

    showOverlay(`
      <h1>${success ? 'Crisis averted.' : 'Forecast fizzles.'}</h1>
      <p>${success
        ? `The town believes. The <b style="color:${chosen.accent}">${chosen.name}</b> arrives.`
        : `Not enough belief. The sky stays stubborn.`
      }</p>
      <div class="divider"></div>
      <div class="row">
        <div class="notice" style="flex:1; min-width:260px;">
          <p><b>Needed today:</b> <span style="color:${req.accent}">${req.name}</span></p>
          <p><b>You forecast:</b> <span style="color:${chosen.accent}">${chosen.name}</span></p>
        </div>
        <div class="notice" style="flex:1; min-width:260px;">
          <p><b>Belief:</b> ${Math.round(game.belief)}% / <b>Need:</b> ${Math.round(game.beliefNeed)}%</p>
          <p class="small">${success
            ? 'Tip: clicking on the scanline gives a small bonus, but any sigil click counts.'
            : 'Try again: click sigils before they fade. (Scanline hits give a bonus.)'
          }</p>
        </div>
      </div>
      <div class="divider"></div>
      <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap;">
        <div class="small">Same mechanic every day. Different pressure.</div>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <button id="retry" class="btn">Retry</button>
          <button id="next" class="btn primary">${success ? (game.dayIndex === DAYS.length-1 ? 'Finish' : 'Continue') : 'Continue Anyway'}</button>
        </div>
      </div>
    `);

    document.getElementById('retry').onclick = () => {
      audio.ensure(); audio.ui();
      showBriefing();
      game.state = State.BRIEFING;
    };

    document.getElementById('next').onclick = () => {
      audio.ensure(); audio.ui();
      if (success){
        game.dayIndex += 1;
      }
      if (game.dayIndex >= DAYS.length){
        showWin();
        return;
      }
      showBriefing();
      game.state = State.BRIEFING;
    };
  }

  function showWin(){
    game.state = State.WIN;
    showOverlay(`
      <h1>You taught the sky to listen.</h1>
      <p>Five crises solved. Five forecasts made real by pure belief.</p>
      <div class="divider"></div>
      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        <button id="again" class="btn primary">Play Again</button>
        <button id="intro" class="btn">Back to Intro</button>
      </div>
    `);

    document.getElementById('again').onclick = () => { audio.ensure(); audio.ui(); startCampaign(); };
    document.getElementById('intro').onclick = () => { audio.ensure(); audio.ui(); game.state = State.INTRO; showIntro(); };
  }

  // ---------- HUD ----------
  function updateHud(){
    const d = DAYS[game.dayIndex] ?? DAYS[0];
    hudDay.textContent = String(d.day);
    hudBelief.textContent = String(Math.round(game.belief));
    hudNeed.textContent = String(Math.round(game.beliefNeed));
    hudRequired.textContent = WEATHER[game.required].name;
    hudChosen.textContent = WEATHER[game.chosen].name;
  }

  // ---------- input ----------
  function canvasPos(evt){
    const rect = canvas.getBoundingClientRect();
    const x = (evt.clientX - rect.left) / rect.width;
    const y = (evt.clientY - rect.top) / rect.height;
    return {x: clamp(x,0,1), y: clamp(y,0,1)};
  }

  function onDown(e){
    const p = canvasPos(e);
    game.pointer.x = p.x; game.pointer.y = p.y;
    game.pointer.down = true;
    game.pointer.justPressed = true;
  }
  function onMove(e){
    const p = canvasPos(e);
    game.pointer.x = p.x; game.pointer.y = p.y;
  }
  function onUp(e){
    const p = canvasPos(e);
    game.pointer.x = p.x; game.pointer.y = p.y;
    game.pointer.down = false;
  }

  canvas.addEventListener('pointerdown', (e)=>{ onDown(e); try{canvas.setPointerCapture(e.pointerId);}catch{} });
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('mousedown', onDown);
  canvas.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  canvas.addEventListener('touchstart', (e)=>{ if (e.touches.length) onDown(e.touches[0]); }, {passive:true});
  canvas.addEventListener('touchmove', (e)=>{ if (e.touches.length) onMove(e.touches[0]); }, {passive:true});
  window.addEventListener('touchend', ()=>{ game.pointer.down = false; }, {passive:true});

  window.addEventListener('keydown', (e)=>{
    if (e.code === 'Space'){
      game.spaceJustPressed = true;
      game.spaceCount++;
      e.preventDefault();
    }
    if (e.key === 'm' || e.key === 'M'){
      audio.ensure();
      audio.toggleMute();
      btnMute.textContent = audio.muted ? 'Unmute' : 'Mute';
    }
  });

  btnMute.addEventListener('click', ()=>{
    audio.ensure();
    audio.toggleMute();
    btnMute.textContent = audio.muted ? 'Unmute' : 'Mute';
  });
  vol.addEventListener('input', ()=>{
    audio.ensure();
    audio.setVolume(parseFloat(vol.value));
  });

  // ---------- live mechanics ----------
  function calcLayout(){
    // Must match drawLive() layout so hit detection is correct.
    const pad = 40 * DPR;
    const rx = pad, ry = pad*0.9;
    const rw = W - pad*2;
    const rh = H - pad*2.1;
    const mx = rx + 18*DPR;
    const my = ry + 54*DPR;
    const mw = rw - 36*DPR;
    const mh = rh - 92*DPR;
    return {rx,ry,rw,rh,mx,my,mw,mh};
  }

  function spawnTarget(){
    // keep targets inside "map" region
    const x = rand(0.10, 0.90);
    const y = rand(0.10, 0.90);
    const r = rand(0.040, 0.055);
    const ttl = rand(2.4, 3.4);
    game.targets.push({x,y,r,ttl,pulse:rand(0,10)});
  }

  function decayTargets(dt){
    for (let i=game.targets.length-1;i>=0;i--){
      const tg = game.targets[i];
      tg.ttl -= dt;
      if (tg.ttl <= 0){
        game.targets.splice(i,1);
        // expiry is a gentle warning: you let it pass.
        game.combo = Math.max(0, game.combo - 1);
        game.staticAmt = clamp(game.staticAmt + 0.08, 0, 1);
      }
    }
  }

  function attemptHit(auto=false){
    if (!game.targets.length) return;

    // scanline x in normalized map region
    const scanX = game.scanX;
    const L = calcLayout();

    // choose candidate target
    let idx = -1;
    let best = 1e9;

    if (auto){
      // keyboard: pick target closest to scanline
      for (let i=0;i<game.targets.length;i++){
        const tg = game.targets[i];
        const dx = Math.abs(tg.x - scanX);
        if (dx < best){ best = dx; idx = i; }
      }
    } else {
      // mouse: pick nearest target to pointer
      const px = (game.pointer.x * W - L.mx) / (L.mw || 1);
      const py = (game.pointer.y * H - L.my) / (L.mh || 1);
      for (let i=0;i<game.targets.length;i++){
        const tg = game.targets[i];
        const dx = (tg.x - px);
        const dy = (tg.y - py);
        const d2 = dx*dx + dy*dy;
        if (d2 < best){ best = d2; idx = i; }
      }
    }

    if (idx < 0) return;
    const tg = game.targets[idx];

    const withinAim = auto ? true : (best <= (tg.r*tg.r) * 1.1);
    const timingBonus = Math.abs(tg.x - scanX) <= (0.030 + tg.r*0.25);

    // If you're not actually clicking a sigil, ignore the click (no punishment).
    if (!auto && !withinAim){
      return;
    }

    // Hit: always succeeds on sigil click. Timing just adds extra belief.
    game.targets.splice(idx,1);
    game.combo += 1;
    const base = 6.4 + Math.min(5, game.combo*0.28);
    const gain = base + (timingBonus ? 3.0 : 0.0);
    game.belief = clamp(game.belief + gain, 0, 100);
    game.staticAmt = Math.max(0, game.staticAmt - 0.10);
    audio.hit();
    caption(timingBonus ? 'Perfect. (+bonus)' : pick(['Locked in.','They believe.','Forecast lands.']), 0.75);

    audio.setBelief(game.belief);
    updateHud();
  }

  // ---------- render ----------
  function clear(){
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,W,H);
  }

  function roundRect(x,y,w,h,r){
    const rr = Math.min(r, w/2, h/2);
    ctx.beginPath();
    ctx.moveTo(x+rr,y);
    ctx.arcTo(x+w,y,x+w,y+h,rr);
    ctx.arcTo(x+w,y+h,x,y+h,rr);
    ctx.arcTo(x,y+h,x,y,rr);
    ctx.arcTo(x,y,x+w,y,rr);
    ctx.closePath();
  }

  function drawBackground(t){
    const g = ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0, 'rgba(7,8,20,1)');
    g.addColorStop(1, 'rgba(4,6,14,1)');
    ctx.fillStyle = g;
    ctx.fillRect(0,0,W,H);

    // stars
    for (let i=0;i<80;i++){
      const x = (Math.sin(t*0.18 + i*19.1) * 0.46 + 0.5) * W;
      const y = (Math.cos(t*0.14 + i*7.2) * 0.46 + 0.5) * H;
      const r = 0.5 + (i%4)*0.3;
      ctx.fillStyle = `rgba(217,226,255,${0.05 + 0.05*Math.sin(t*0.8+i)})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI*2);
      ctx.fill();
    }
  }

  function drawCaption(){
    if (game.captionT <= 0) return;
    const a = clamp(game.captionT / 0.25, 0, 1);
    ctx.save();
    ctx.globalAlpha = 0.92 * a;
    const w = Math.min(W*0.92, 920*DPR);
    const x = (W - w)/2;
    const y = H - (76*DPR);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    roundRect(x, y, w, 48*DPR, 14*DPR);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(217,226,255,0.92)';
    ctx.font = `${14*DPR}px ui-sans-serif, system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(game.caption, W/2, y + 24*DPR);
    ctx.restore();
  }

  function drawLive(t){
    const {rx,ry,rw,rh,mx,my,mw,mh} = calcLayout();

    // tv frame
    ctx.fillStyle = 'rgba(0,0,0,0.24)';
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    roundRect(rx, ry, rw, rh, 22*DPR);
    ctx.fill();
    ctx.stroke();

    // map
    const g = ctx.createLinearGradient(mx, my, mx+mw, my+mh);
    g.addColorStop(0, 'rgba(26,30,70,0.92)');
    g.addColorStop(1, 'rgba(12,14,36,0.92)');
    ctx.fillStyle = g;
    roundRect(mx, my, mw, mh, 16*DPR);
    ctx.fill();

    // isobars
    ctx.save();
    ctx.strokeStyle = 'rgba(39,214,255,0.10)';
    ctx.lineWidth = 2*DPR;
    for (let i=0;i<8;i++){
      const yy = my + (i+1)/9 * mh;
      const wob = Math.sin(t*0.8 + i*0.7) * 18*DPR;
      ctx.beginPath();
      ctx.moveTo(mx + 10*DPR + wob, yy);
      ctx.bezierCurveTo(mx + mw*0.35, yy-30*DPR, mx + mw*0.65, yy+30*DPR, mx+mw-10*DPR - wob, yy);
      ctx.stroke();
    }
    ctx.restore();

    // occult circles
    ctx.save();
    ctx.globalAlpha = 0.24;
    ctx.strokeStyle = 'rgba(255,59,212,0.24)';
    ctx.lineWidth = 2*DPR;
    const ccx = mx + mw*0.58;
    const ccy = my + mh*0.50;
    for (let i=0;i<3;i++){
      ctx.beginPath();
      ctx.arc(ccx, ccy, (0.16+i*0.08)*Math.min(mw,mh), 0, Math.PI*2);
      ctx.stroke();
    }
    ctx.restore();

    // scanline
    const scanPX = mx + game.scanX * mw;
    const sg = ctx.createLinearGradient(scanPX-22*DPR, 0, scanPX+22*DPR, 0);
    sg.addColorStop(0, 'rgba(0,0,0,0)');
    sg.addColorStop(0.5, 'rgba(255,255,255,0.26)');
    sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(scanPX-28*DPR, my, 56*DPR, mh);

    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 2*DPR;
    ctx.beginPath();
    ctx.moveTo(scanPX, my);
    ctx.lineTo(scanPX, my+mh);
    ctx.stroke();

    // targets
    const accent = WEATHER[game.chosen].accent;
    for (const tg of game.targets){
      tg.pulse += 0.08;
      const pulse = 0.5 + 0.5*Math.sin(tg.pulse);
      const tx = mx + tg.x*mw;
      const ty = my + tg.y*mh;
      const r = tg.r * Math.min(mw,mh);

      // halo
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2.5*DPR;
      ctx.beginPath();
      ctx.arc(tx, ty, r*(1.05+0.15*pulse), 0, Math.PI*2);
      ctx.stroke();
      ctx.globalAlpha = 0.38;
      ctx.beginPath();
      ctx.arc(tx, ty, r*0.55, 0, Math.PI*2);
      ctx.stroke();
      // cross
      ctx.globalAlpha = 0.88;
      ctx.beginPath();
      ctx.moveTo(tx-r, ty);
      ctx.lineTo(tx+r, ty);
      ctx.moveTo(tx, ty-r);
      ctx.lineTo(tx, ty+r);
      ctx.stroke();
      ctx.restore();
    }

    // belief bar + threshold marker
    const bx = mx;
    const by = ry + 16*DPR;
    const bw = mw;
    const bh = 22*DPR;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    roundRect(bx, by, bw, bh, 999);
    ctx.fill();

    const fill = clamp(game.belief/100, 0, 1);
    const grad = ctx.createLinearGradient(bx,0,bx+bw,0);
    grad.addColorStop(0, 'rgba(255,59,212,0.85)');
    grad.addColorStop(0.5, 'rgba(39,214,255,0.85)');
    grad.addColorStop(1, 'rgba(121,255,122,0.85)');
    ctx.fillStyle = grad;
    roundRect(bx, by, bw*fill, bh, 999);
    ctx.fill();

    const needX = bx + (game.beliefNeed/100) * bw;
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 2*DPR;
    ctx.beginPath();
    ctx.moveTo(needX, by-4*DPR);
    ctx.lineTo(needX, by+bh+4*DPR);
    ctx.stroke();

    ctx.fillStyle = 'rgba(217,226,255,0.92)';
    ctx.font = `${13*DPR}px ui-sans-serif, system-ui`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`BELIEF ${Math.round(game.belief)}%  •  Need ${Math.round(game.beliefNeed)}%  •  Combo ${game.combo}`, bx + 10*DPR, by + bh/2);

    // subtle CRT scanlines
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = 'rgba(0,0,0,1)';
    for (let y=0;y<H;y+=4*DPR){
      ctx.fillRect(0, y, W, 1*DPR);
    }
    ctx.restore();

    // static sprinkle
    if (game.staticAmt > 0.001){
      ctx.save();
      ctx.globalAlpha = 0.18*game.staticAmt;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      const dots = Math.floor(260 * game.staticAmt);
      for (let i=0;i<dots;i++){
        const x = (Math.random()*W)|0;
        const y = (Math.random()*H)|0;
        const w = (1 + (Math.random()*2)|0) * DPR;
        ctx.fillRect(x, y, w, 1*DPR);
      }
      ctx.restore();
    }

    // timer
    ctx.fillStyle = 'rgba(217,226,255,0.72)';
    ctx.textAlign = 'right';
    ctx.fillText(`LIVE ${Math.round(Math.max(0, game.duration - game.time))}s`, mx+mw-6*DPR, ry+28*DPR);

    // crosshair for aiming
    const px = game.pointer.x * W;
    const py = game.pointer.y * H;
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = 'rgba(217,226,255,0.6)';
    ctx.lineWidth = 1.5*DPR;
    ctx.beginPath();
    ctx.arc(px, py, 10*DPR, 0, Math.PI*2);
    ctx.stroke();
    ctx.restore();
  }

  // ---------- loop ----------
  let lastT = nowSec();
  function frame(){
    const t = nowSec();
    const dt = clamp(t - lastT, 0, 0.033);
    lastT = t;

    resize();

    if (game.captionT > 0) game.captionT -= dt;

    if (game.state === State.LIVE){
      game.time += dt;

      // scanline moves left-to-right and wraps
      game.scanX += game.scanSpeed * dt;
      if (game.scanX > 1) game.scanX -= 1;

      // spawn targets steadily; keep ~3-5 alive
      game.spawnT -= dt;
      if (game.spawnT <= 0){
        if (game.targets.length < 5) spawnTarget();
        game.spawnT = rand(0.65, 1.05);
      }

      decayTargets(dt);
      game.staticAmt = Math.max(0, game.staticAmt - 0.12*dt);

      if (game.pointer.justPressed){
        attemptHit(false);
      }
      if (game.spaceJustPressed){
        attemptHit(true);
      }
      game.spaceJustPressed = false;

      // auto-end
      if (game.time >= game.duration){
        endLive();
      }
    }

    clear();
    drawBackground(t);

    if (game.state === State.LIVE){
      drawLive(t);
    } else {
      // ambient sigils behind overlays
      drawAmbient(t);
    }

    drawCaption();

    game.pointer.justPressed = false;

    requestAnimationFrame(frame);
  }

  function drawAmbient(t){
    const cx = W*0.5, cy = H*0.54;
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = 2*DPR;
    const R = Math.min(W,H)*0.26;
    for (let i=0;i<4;i++){
      const r = R*(0.55 + i*0.15);
      ctx.strokeStyle = i%2 ? 'rgba(39,214,255,0.12)' : 'rgba(255,59,212,0.16)';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI*2);
      ctx.stroke();
    }
    ctx.translate(cx, cy);
    ctx.rotate(t*0.12);
    for (let i=0;i<9;i++){
      const a = (i/9)*Math.PI*2;
      ctx.strokeStyle = i%2 ? 'rgba(255,204,51,0.10)' : 'rgba(217,226,255,0.08)';
      ctx.beginPath();
      ctx.moveTo(Math.cos(a)*R*0.22, Math.sin(a)*R*0.22);
      ctx.lineTo(Math.cos(a)*R*0.98, Math.sin(a)*R*0.98);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---------- boot ----------
  function boot(){
    resize();
    showIntro();
    updateHud();

    // small debug hook for automated checks
    window.__WW = {
      get: () => ({
        state: game.state,
        dayIndex: game.dayIndex,
        required: game.required,
        chosen: game.chosen,
        belief: game.belief,
        beliefNeed: game.beliefNeed,
        time: game.time,
        targets: game.targets.map(t => ({x:t.x, y:t.y, r:t.r, ttl:t.ttl})),
        scanX: game.scanX,
        pointer: {x: game.pointer.x, y: game.pointer.y, down: game.pointer.down},
        spaceCount: game.spaceCount
      })
    };

    requestAnimationFrame(frame);
  }

  boot();

})();
