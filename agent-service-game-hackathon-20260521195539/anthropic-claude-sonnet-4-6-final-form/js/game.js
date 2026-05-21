// ============================================================
//  FINAL FORM — Main Game Controller
// ============================================================

(function () {
  'use strict';

  // ---- Canvas & Context ----
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  // ---- Preview canvas (design screen) ----
  const previewCanvas = document.getElementById('previewCanvas');
  const previewCtx = previewCanvas ? previewCanvas.getContext('2d') : null;

  // ---- Screens ----
  const screens = {
    intro: document.getElementById('screen-intro'),
    design: document.getElementById('screen-design'),
    monologue: document.getElementById('screen-monologue'),
    result: document.getElementById('screen-result'),
    victory: document.getElementById('screen-victory'),
  };

  // ---- State ----
  const STATE = { INTRO: 'intro', DESIGN: 'design', MONOLOGUE: 'monologue', BATTLE: 'battle', RESULT: 'result', VICTORY: 'victory' };
  let currentState = STATE.INTRO;
  let t = 0; // global timer

  // ---- Persistent game data ----
  let runNumber = 0;
  let heroMemory = null; // persists across runs
  let lastScore = null;
  let lastStats = null;

  // ---- Default boss config ----
  let bossConfig = {
    attacks: ['fireball', 'groundslam', 'lightning', 'empty', 'empty', 'empty'],
    weakPoint: 'chest',
    phaseThreshold: 50,
    phase2Color: 'crimson',
    monologue: '',
  };

  // ---- Battle-scoped state ----
  let boss = null;
  let hero = null;
  let particles = [];
  let floatTexts = [];
  let activeAttacks = [];
  let screenShake = { x: 0, y: 0, intensity: 0 };
  let battleEnding = false; // guard against double endBattle

  // Audience score tracking
  let audienceScore = 0;
  let battleStats = {
    duration: 0,
    closeCallCount: 0,
    phaseShifted: false,
    uniqueAttacks: new Set(),
    comboDrama: false,
    attacksUsed: [],
  };
  let bossCloseCalled = false;
  let heroCloseCalled = false;
  let bossWasCritical = false; // boss ever went below 25%
  let heroWasCritical = false; // hero ever went below 25%

  // Announcement
  let announcement = { text: '', timer: 0 };

  // Phase shift overlay
  let phaseShiftProgress = -1;

  // ---- Event Bus ----
  const eventBus = {
    _handlers: {},
    on(evt, fn) { (this._handlers[evt] = this._handlers[evt] || []).push(fn); },
    emit(evt, data) { (this._handlers[evt] || []).forEach(fn => fn(data)); },
    clear() { this._handlers = {}; }
  };

  // ---- Transitions ----
  let fadeAlpha = 0;
  let fadingIn = false;
  let fadeCallback = null;

  function fadeToBlack(cb) {
    fadingIn = true;
    fadeAlpha = 0;
    fadeCallback = cb;
  }

  // ============================================================
  //  SCREEN MANAGEMENT
  // ============================================================
  function showScreen(name) {
    Object.values(screens).forEach(s => { if (s) s.classList.remove('active'); });
    if (screens[name]) screens[name].classList.add('active');
    canvas.style.display = name === STATE.BATTLE || name === STATE.INTRO ? 'block' : 'none';
    // Keep canvas visible during monologue for background
    if (name === STATE.MONOLOGUE) canvas.style.display = 'block';
  }

  // ============================================================
  //  INTRO
  // ============================================================
  function initIntro() {
    currentState = STATE.INTRO;
    showScreen('intro');
  }

  document.getElementById('btn-play').addEventListener('click', () => {
    Audio.init();
    Audio.play.playButton();
    fadeToBlack(() => {
      runNumber = 0;
      heroMemory = null;
      initDesign();
    });
  });

  // ============================================================
  //  DESIGN SCREEN
  // ============================================================
  function initDesign() {
    currentState = STATE.DESIGN;
    runNumber++;
    showScreen('design');
    canvas.style.display = 'none';

    document.getElementById('run-number').textContent = `Attempt #${runNumber}`;

    // Show previous score if exists
    const prevScoreEl = document.getElementById('prev-score-area');
    if (lastScore && lastStats) {
      const tipsArr = Scoring.tips(lastStats, lastScore);
      prevScoreEl.innerHTML = `
        <div class="prev-score">Last run: <span class="score-num">${lastScore.total}</span> pts — ${starString(lastScore.stars)}</div>
        ${tipsArr.map(tip => `<div class="tip">${tip}</div>`).join('')}
      `;
      prevScoreEl.style.display = 'block';
    } else {
      prevScoreEl.style.display = 'none';
    }

    renderAttackSlots();
    renderWeakPoint();
    renderPhaseThreshold();
    renderPhase2Color();
    updatePreview();
  }

  // ---- Attack Sequencer ----
  const ATTACK_CYCLE = ['empty', 'fireball', 'lightning', 'groundslam', 'minion'];
  const ATTACK_LABELS = { empty: '—', fireball: '🔥 Fireball', lightning: '⚡ Lightning', groundslam: '💥 Ground Slam', minion: '👾 Minion' };
  const ATTACK_COLORS = { empty: '#333', fireball: '#992200', lightning: '#334488', groundslam: '#665500', minion: '#440066' };

  function renderAttackSlots() {
    const container = document.getElementById('attack-slots');
    container.innerHTML = '';
    for (let i = 0; i < 6; i++) {
      const slot = document.createElement('div');
      slot.className = 'attack-slot';
      const val = bossConfig.attacks[i] || 'empty';
      slot.style.background = ATTACK_COLORS[val] || '#333';
      slot.textContent = ATTACK_LABELS[val] || '—';
      slot.dataset.index = i;
      slot.addEventListener('click', () => {
        Audio.play.uiClick();
        const cur = ATTACK_CYCLE.indexOf(bossConfig.attacks[i]);
        bossConfig.attacks[i] = ATTACK_CYCLE[(cur + 1) % ATTACK_CYCLE.length];
        renderAttackSlots();
        updatePreview();
      });
      container.appendChild(slot);
    }
  }

  // ---- Weak Point ----
  function renderWeakPoint() {
    ['head', 'chest', 'feet'].forEach(loc => {
      const btn = document.getElementById(`wp-${loc}`);
      if (!btn) return;
      btn.classList.toggle('selected', bossConfig.weakPoint === loc);
      btn.onclick = () => {
        Audio.play.uiClick();
        bossConfig.weakPoint = loc;
        renderWeakPoint();
        updatePreview();
      };
    });
  }

  // ---- Phase Threshold ----
  function renderPhaseThreshold() {
    const slider = document.getElementById('phase-slider');
    const label = document.getElementById('phase-label');
    if (!slider) return;
    slider.value = bossConfig.phaseThreshold;
    label.textContent = `${bossConfig.phaseThreshold}%`;
    slider.oninput = () => {
      bossConfig.phaseThreshold = parseInt(slider.value);
      label.textContent = `${bossConfig.phaseThreshold}%`;
      updatePreview();
    };
  }

  // ---- Phase 2 Color ----
  const PHASE2_COLORS = {
    crimson: { label: 'Crimson', hex: '#ff1a1a' },
    purple: { label: 'Void Purple', hex: '#9900ff' },
    green: { label: 'Toxic Green', hex: '#00ff44' },
    ice: { label: 'Ice Blue', hex: '#00ccff' },
  };

  function renderPhase2Color() {
    Object.keys(PHASE2_COLORS).forEach(key => {
      const btn = document.getElementById(`color-${key}`);
      if (!btn) return;
      btn.classList.toggle('selected', bossConfig.phase2Color === key);
      btn.style.background = PHASE2_COLORS[key].hex;
      btn.onclick = () => {
        Audio.play.uiClick();
        bossConfig.phase2Color = key;
        renderPhase2Color();
        updatePreview();
      };
    });
  }

  // ---- Monologue ----
  const monologueInput = document.getElementById('monologue-input');
  const monologueCount = document.getElementById('monologue-count');
  if (monologueInput) {
    monologueInput.addEventListener('input', () => {
      bossConfig.monologue = monologueInput.value.slice(0, 140);
      monologueInput.value = bossConfig.monologue;
      if (monologueCount) monologueCount.textContent = `${bossConfig.monologue.length}/140`;
    });
  }

  // ---- Preview ----
  let previewT = 0;
  function updatePreview() {
    // Preview is updated in the main loop; this just schedules a redraw
    previewT += 30;
    if (previewCtx) Renderer.drawBossPreview(previewCtx, bossConfig, previewT);
  }

  // ---- Take the Stage ----
  document.getElementById('btn-take-stage').addEventListener('click', () => {
    Audio.play.uiClick();
    // Read monologue
    if (monologueInput) bossConfig.monologue = monologueInput.value;
    fadeToBlack(() => {
      initMonologue();
    });
  });

  // ============================================================
  //  MONOLOGUE SCREEN
  // ============================================================
  let monologueChars = 0;
  let monologueInterval = null;
  const DEFAULT_MONOLOGUE = 'So, you dare challenge me again? Your persistence is... amusing.';

  function initMonologue() {
    currentState = STATE.MONOLOGUE;
    showScreen('monologue');
    canvas.style.display = 'block';

    // Create a boss for the background visual (no hero, no battle)
    boss = new Boss(bossConfig);
    boss.state = 'idle';
    boss.idleTimer = 99999; // never attack during monologue
    boss.x = W / 2;
    boss.y = H / 2 - 20;

    const text = bossConfig.monologue.trim() || DEFAULT_MONOLOGUE;
    const el = document.getElementById('monologue-text');
    el.textContent = '';
    monologueChars = 0;

    clearInterval(monologueInterval);
    monologueInterval = setInterval(() => {
      if (monologueChars < text.length) {
        el.textContent += text[monologueChars];
        Audio.play.monologueType();
        monologueChars++;
      } else {
        clearInterval(monologueInterval);
        setTimeout(() => {
          fadeToBlack(() => initBattle());
        }, 1800);
      }
    }, 65);
  }

  // ============================================================
  //  BATTLE
  // ============================================================
  function initBattle() {
    currentState = STATE.BATTLE;
    showScreen('battle');
    canvas.style.display = 'block';

    // Reset
    particles = [];
    floatTexts = [];
    activeAttacks = [];
    audienceScore = 0;
    screenShake = { x: 0, y: 0, intensity: 0 };
    battleEnding = false;
    bossWasCritical = false;
    heroWasCritical = false;
    announcement = { text: '', timer: 0 };
    phaseShiftProgress = -1;
    bossCloseCalled = false;
    heroCloseCalled = false;

    battleStats = {
      duration: 0,
      closeCallCount: 0,
      phaseShifted: false,
      uniqueAttacks: new Set(),
      comboDrama: false,
      attacksUsed: [],
    };

    // Create entities
    boss = new Boss(bossConfig);
    hero = new Hero(heroMemory);

    eventBus.clear();
    setupBattleEvents();

    Audio.play.battleStart();

    // Fade in
    fadingIn = false;
    fadeAlpha = 1;
  }

  function setupBattleEvents() {
    eventBus.on('attack', (atkId) => {
      const atk = ATTACKS[atkId];
      if (!atk) return;
      announcement.text = atk.label;
      announcement.timer = 1200;
      battleStats.uniqueAttacks.add(atkId);
      battleStats.attacksUsed.push(atkId);

      // Play sound
      const sounds = {
        fireball: () => Audio.play.fireballLaunch(),
        lightning: () => Audio.play.lightning(),
        groundslam: () => Audio.play.groundSlam(),
        minion: () => Audio.play.minionSpawn(),
      };
      if (sounds[atkId]) sounds[atkId]();
    });

    eventBus.on('telegraphing', (atkId) => {});

    eventBus.on('phaseShift', () => {
      battleStats.phaseShifted = true;
      phaseShiftProgress = 0;
      announcement.text = '⚠ SECOND FORM ⚠';
      announcement.timer = 2000;
      screenShake.intensity = 20;
      Renderer.setAudienceReaction(1.0);
      audienceScore = Math.min(audienceScore + 50, Scoring.TOTAL_MAX);
      Audio.play.phaseTransition();
    });

    eventBus.on('heroAttack', ({ damage, weakPoint }) => {
      Audio.play.heroAttack();
      if (weakPoint) {
        Audio.play.weakPointHit();
        announcement.text = '★ WEAK POINT ★';
        announcement.timer = 900;
        screenShake.intensity = 8;
      } else {
        screenShake.intensity = Math.max(screenShake.intensity, 4);
        Audio.play.bossHurt();
      }
    });
  }

  // ---- Battle tick ----
  function updateBattle(dt) {
    if (currentState !== STATE.BATTLE) return;

    battleStats.duration += dt / 1000;

    // Update entities
    boss.update(dt, hero, particles, floatTexts, activeAttacks, eventBus);
    hero.update(dt, boss, activeAttacks, particles, floatTexts, eventBus);

    // Update projectiles & check collisions
    activeAttacks = activeAttacks.filter(atk => atk.active);
    for (const atk of activeAttacks) {
      if (!atk.active) continue;
      atk.update(dt);

      // Collision with hero
      if (!atk.hit) {
        if (atk.id === 'fireball') {
          const dx = atk.x - hero.x, dy = atk.y - hero.y;
          if (Math.sqrt(dx * dx + dy * dy) < 28) {
            atk.hit = true; atk.active = false;
            hero.takeDamage(atk.type.damage, particles, floatTexts);
            Audio.play.heroHurt();
            Audio.play.fireballHit();
            screenShake.intensity = 10;
          }
        } else if (atk.id === 'lightning' && !atk.hit) {
          // Instant hit on hero if hero in range
          const dx = Math.abs(hero.x - boss.x);
          if (dx < 250 && atk.age < 50) {
            atk.hit = true;
            hero.takeDamage(atk.type.damage, particles, floatTexts);
            Audio.play.heroHurt();
            screenShake.intensity = 6;
          }
        } else if (atk.id === 'groundslam') {
          const dx = Math.abs(hero.x - atk.x);
          if (dx < atk.type.radius * 0.65 && atk.age > 100 && atk.age < 300) {
            if (!atk.hit) {
              atk.hit = true;
              hero.takeDamage(atk.type.damage, particles, floatTexts);
              Audio.play.heroHurt();
              screenShake.intensity = 14;
            }
          }
        } else if (atk.id === 'minion') {
          // Minion targets hero
          atk.targetX = hero.x;
          const dx = Math.abs(atk.x - hero.x), dy = Math.abs(atk.y - hero.y);
          if (dx < 24 && dy < 40 && !atk.hit) {
            atk.hit = true; atk.active = false;
            hero.takeDamage(atk.type.damage, particles, floatTexts);
            Audio.play.heroHurt();
          }
        }
      }
    }

    // Update particles & float texts
    particles = particles.filter(p => { p.update(dt); return p.active; });
    floatTexts = floatTexts.filter(f => { f.update(dt); return f.active; });

    // Screen shake decay
    if (screenShake.intensity > 0) {
      screenShake.x = (Math.random() - 0.5) * screenShake.intensity;
      screenShake.y = (Math.random() - 0.5) * screenShake.intensity;
      screenShake.intensity = Math.max(0, screenShake.intensity - dt * 0.05);
    } else {
      screenShake.x = 0; screenShake.y = 0;
    }

    // Announcement timer
    if (announcement.timer > 0) announcement.timer -= dt;

    // Phase shift overlay
    if (phaseShiftProgress >= 0) {
      phaseShiftProgress = Math.min(1, phaseShiftProgress + dt / 1800);
      if (phaseShiftProgress >= 1) phaseShiftProgress = -1;
    }

    // Audience score — accumulate over time
    audienceScore = Math.min(
      Scoring.TOTAL_MAX,
      audienceScore + (dt / 1000) * 2 // 2pts/sec just for fighting
    );

    // Close call detection: either fighter drops below 15% → dramatic near-death
    const bossCloseLow = boss.hp / boss.maxHp < 0.15;
    const heroCloseLow = hero.hp / hero.maxHp < 0.15;

    if (bossCloseLow && !bossCloseCalled) {
      bossCloseCalled = true;
      bossWasCritical = true;
      battleStats.closeCallCount++;
      audienceScore = Math.min(Scoring.TOTAL_MAX, audienceScore + 80);
      Renderer.setAudienceReaction(0.9);
      Audio.play.closeCall();
      Audio.play.audienceCheer();
    }
    if (heroCloseLow && !heroCloseCalled) {
      heroCloseCalled = true;
      heroWasCritical = true;
      battleStats.closeCallCount++;
      audienceScore = Math.min(Scoring.TOTAL_MAX, audienceScore + 80);
      Renderer.setAudienceReaction(0.9);
      Audio.play.closeCall();
      Audio.play.audienceCheer();
    }

    // Also track "danger zone" (wider threshold) for combo tracking
    if (boss.hp / boss.maxHp < 0.32 && !bossWasCritical) {
      bossWasCritical = true;
    }
    if (hero.hp / hero.maxHp < 0.28 && !heroWasCritical) {
      heroWasCritical = true;
    }

    // Combo Drama: both fighters entered danger zone at any point
    if (bossWasCritical && heroWasCritical && !battleStats.comboDrama) {
      battleStats.comboDrama = true;
      audienceScore = Math.min(Scoring.TOTAL_MAX, audienceScore + 80);
      Renderer.setAudienceReaction(1.0);
    }

    // Check end conditions (guard against double-fire)
    if (!battleEnding) {
      if (boss.state === 'dead' && boss.hp <= 0) {
        battleEnding = true;
        currentState = 'battleOver';
        Audio.play.audienceCheer();
        setTimeout(() => endBattle(false), 1800);
      } else if (hero.dead && hero.hp <= 0) {
        battleEnding = true;
        currentState = 'battleOver';
        setTimeout(() => endBattle(true), 1800);
      }
    }
  }

  function endBattle(bossWon) {
    // Update hero memory for next run
    if (!heroMemory) heroMemory = { dodgeChances: {}, weakPointKnown: false, aggression: 0 };
    hero.learnFromRun(battleStats.attacksUsed, bossConfig);
    heroMemory = hero.memory;

    // Calculate score
    const stats = {
      duration: battleStats.duration,
      closeCallCount: battleStats.closeCallCount,
      phaseShifted: battleStats.phaseShifted,
      uniqueAttacks: battleStats.uniqueAttacks,
      comboDrama: battleStats.comboDrama,
      monologueLength: bossConfig.monologue.trim().length,
    };
    lastScore = Scoring.calculate(stats);
    lastStats = stats;

    fadeToBlack(() => {
      if (lastScore.total >= 650) {
        initVictory();
      } else {
        initResult(bossWon);
      }
    });
  }

  // ============================================================
  //  RESULT SCREEN
  // ============================================================
  function initResult(bossWon) {
    currentState = STATE.RESULT;
    showScreen('result');
    canvas.style.display = 'none';

    // Outcome header
    document.getElementById('result-outcome').textContent = bossWon
      ? '⚔ THE HERO FELL' : '💀 YOU WERE DEFEATED';

    // Stars
    const starsEl = document.getElementById('result-stars');
    starsEl.textContent = starString(lastScore.stars);

    // Flavor quote
    document.getElementById('result-quote').textContent =
      Scoring.flavorQuote(lastScore.stars, !bossWon);

    // Score breakdown — animate counting
    const breakdownEl = document.getElementById('score-breakdown');
    breakdownEl.innerHTML = '';
    const cats = [
      { key: 'spectacle', label: 'Spectacle (Duration)', max: Scoring.MAX.spectacle },
      { key: 'drama', label: 'Drama (Close Calls)', max: Scoring.MAX.drama },
      { key: 'transformation', label: 'Transformation (Phase)', max: Scoring.MAX.transformation },
      { key: 'voice', label: 'Voice (Monologue)', max: Scoring.MAX.voice },
      { key: 'variety', label: 'Variety (Attacks)', max: Scoring.MAX.variety },
      { key: 'combo', label: 'Mutual Peril', max: Scoring.MAX.combo },
    ];

    let delay = 100;
    cats.forEach(cat => {
      const row = document.createElement('div');
      row.className = 'score-row';
      const val = lastScore.breakdown[cat.key];
      row.innerHTML = `
        <span class="score-label">${cat.label}</span>
        <span class="score-bar-wrap"><span class="score-bar" style="width:0%" data-target="${(val / cat.max * 100).toFixed(1)}"></span></span>
        <span class="score-val" data-target="${val}">0</span>
      `;
      breakdownEl.appendChild(row);

      setTimeout(() => {
        Audio.play.scoreCount();
        row.querySelector('.score-bar').style.width = `${(val / cat.max * 100).toFixed(1)}%`;
        row.querySelector('.score-val').textContent = val;
      }, delay);
      delay += 220;
    });

    // Total
    setTimeout(() => {
      document.getElementById('result-total').textContent = `TOTAL: ${lastScore.total} / ${Scoring.TOTAL_MAX}`;
      Audio.play.scoreCount();
      if (lastScore.stars >= 4) Audio.play.audienceCheer();
    }, delay + 100);

    // Tips
    const tipsEl = document.getElementById('result-tips');
    const tipsArr = Scoring.tips(lastStats, lastScore);
    tipsEl.innerHTML = tipsArr.map(tip => `<div class="tip">${tip}</div>`).join('');

    // Victory check note
    const progressEl = document.getElementById('result-progress');
    const needed = 650 - lastScore.total;
    if (needed > 0) {
      progressEl.textContent = `Need ${needed} more points in a single run to achieve LEGEND status (650+).`;
    } else {
      progressEl.textContent = '🏆 You could have won! Try again for the perfect run!';
    }
  }

  document.getElementById('btn-redesign').addEventListener('click', () => {
    Audio.play.uiClick();
    fadeToBlack(() => initDesign());
  });

  // ============================================================
  //  VICTORY SCREEN
  // ============================================================
  function initVictory() {
    currentState = STATE.VICTORY;
    showScreen('victory');
    canvas.style.display = 'block';

    document.getElementById('victory-score').textContent =
      `Final Score: ${lastScore.total} / ${Scoring.TOTAL_MAX}`;
    document.getElementById('victory-stars').textContent = starString(lastScore.stars);
    document.getElementById('victory-runs').textContent =
      `Achieved in ${runNumber} attempt${runNumber !== 1 ? 's' : ''}.`;

    Audio.play.victoryFanfare();

    // Spawn celebration particles
    for (let i = 0; i < 80; i++) {
      particles.push(new Particle(
        Math.random() * W, Math.random() * H * 0.5,
        (Math.random() - 0.5) * 6,
        2 + Math.random() * 4,
        ['#ffd700', '#ff6b35', '#cc2200', '#9900ff', '#00ccff'][Math.floor(Math.random() * 5)],
        2000 + Math.random() * 2000, 5
      ));
    }
    currentState = STATE.VICTORY;
  }

  document.getElementById('btn-play-again').addEventListener('click', () => {
    Audio.play.uiClick();
    runNumber = 0;
    heroMemory = null;
    lastScore = null;
    lastStats = null;
    particles = [];
    fadeToBlack(() => initDesign());
  });

  // ============================================================
  //  VOLUME CONTROL
  // ============================================================
  const volSlider = document.getElementById('vol-slider');
  const muteBtn = document.getElementById('btn-mute');

  if (volSlider) {
    volSlider.value = 50;
    volSlider.addEventListener('input', () => {
      Audio.setVolume(parseInt(volSlider.value) / 100);
      if (Audio.getMuted() && volSlider.value > 0) {
        Audio.setMute(false);
        if (muteBtn) muteBtn.textContent = '🔊';
      }
    });
  }

  if (muteBtn) {
    muteBtn.addEventListener('click', () => {
      const muted = !Audio.getMuted();
      Audio.setMute(muted);
      muteBtn.textContent = muted ? '🔇' : '🔊';
      Audio.play.uiClick();
    });
  }

  // ============================================================
  //  MAIN LOOP
  // ============================================================
  let lastTime = 0;

  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(now - lastTime, 50); // cap at 50ms
    lastTime = now;
    t += dt;

    ctx.clearRect(0, 0, W, H);

    // Global shake
    ctx.save();
    ctx.translate(screenShake.x, screenShake.y);

    if (currentState === STATE.INTRO) {
      Renderer.drawIntroBG(ctx, W, H, t);
    } else if (currentState === STATE.MONOLOGUE) {
      // Draw atmospheric monologue scene
      Renderer.drawArena(ctx, W, H, t);
      if (boss) {
        // Animate boss pulsing during monologue
        boss.animFrame = Math.floor(t / 200);
        boss.scale = 1.0 + 0.04 * Math.sin(t * 0.002);
        Renderer.drawBoss(ctx, boss, t);
      }
      // Dark overlay to focus on text box
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, W, H);
    } else if (currentState === STATE.BATTLE || currentState === 'battleOver') {
      // In battleOver state, still animate particles
      if (currentState === 'battleOver') {
        particles = particles.filter(p => { p.update(dt); return p.active; });
        floatTexts = floatTexts.filter(f => { f.update(dt); return f.active; });
        if (announcement.timer > 0) announcement.timer -= dt;
      }
      Renderer.drawArena(ctx, W, H, t);
      Renderer.drawParticles(ctx, particles);
      Renderer.drawAttacks(ctx, activeAttacks, t);
      if (boss) Renderer.drawBoss(ctx, boss, t);
      if (hero) Renderer.drawHero(ctx, hero, t);
      Renderer.drawFloatTexts(ctx, floatTexts);
      if (boss && hero) Renderer.drawHPBars(ctx, boss, hero, W);
      Renderer.drawAudienceMeter(ctx, W, audienceScore, Scoring.TOTAL_MAX);
      const annAlpha = Math.min(1, announcement.timer / 400);
      Renderer.drawAnnouncement(ctx, announcement.text, annAlpha, W, H);
      if (phaseShiftProgress >= 0) {
        Renderer.drawPhaseShiftOverlay(ctx, phaseShiftProgress, boss, W, H);
      }
    } else if (currentState === STATE.VICTORY) {
      Renderer.drawArena(ctx, W, H, t);
      Renderer.drawParticles(ctx, particles);
      particles = particles.filter(p => { p.update(dt); return p.active; });
    }

    ctx.restore();

    // Fade overlay
    if (fadingIn) {
      fadeAlpha = Math.min(1, fadeAlpha + dt * 0.004);
      if (fadeAlpha >= 1 && fadeCallback) {
        const cb = fadeCallback;
        fadeCallback = null;
        cb();
        fadingIn = false;
        // Now fade back out
        fadeAlpha = 1;
        fadingOut = true;
      }
    }
    if (fadingOut) {
      fadeAlpha = Math.max(0, fadeAlpha - dt * 0.004);
      if (fadeAlpha <= 0) fadingOut = false;
    }

    if (fadeAlpha > 0) {
      ctx.fillStyle = `rgba(0,0,0,${fadeAlpha})`;
      ctx.fillRect(0, 0, W, H);
    }

    // Update preview canvas if on design screen
    if (currentState === STATE.DESIGN && previewCtx) {
      previewT = (previewT || 0) + dt;
      Renderer.drawBossPreview(previewCtx, bossConfig, previewT);
    }

    // Battle update
    if (currentState === STATE.BATTLE) {
      updateBattle(dt);
    }
  }

  let fadingOut = false;

  // ---- Start ----
  requestAnimationFrame(loop);
  initIntro();

  // ---- Helpers ----
  function starString(n) {
    const labels = ['','MEDIOCRE','DECENT','NOTABLE','SPECTACULAR','LEGENDARY'];
    return labels[Math.min(5, Math.max(0, n))] || 'NOTABLE';
  }
})();
