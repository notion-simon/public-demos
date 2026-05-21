// ============================================================
//  FINAL FORM — Audio Engine (Web Audio API synthesis only)
// ============================================================

const Audio = (() => {
  let ctx = null;
  let masterGain = null;
  let _volume = 0.5;
  let _muted = false;

  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = _volume;
    masterGain.connect(ctx.destination);
  }

  function setVolume(v) {
    _volume = Math.max(0, Math.min(1, v));
    if (masterGain) masterGain.gain.value = _muted ? 0 : _volume;
  }

  function setMute(m) {
    _muted = m;
    if (masterGain) masterGain.gain.value = _muted ? 0 : _volume;
  }

  function getVolume() { return _volume; }
  function getMuted() { return _muted; }

  // --- helpers ---
  function makeGain(vol) {
    const g = ctx.createGain();
    g.gain.value = vol;
    g.connect(masterGain);
    return g;
  }

  function playTone(freq, type, duration, vol, attack = 0.01, release = 0.05) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = makeGain(0);
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(g);
    const now = ctx.currentTime;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(vol, now + attack);
    g.gain.setValueAtTime(vol, now + duration - release);
    g.gain.linearRampToValueAtTime(0, now + duration);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  function playNoise(duration, vol, lpFreq = 4000, hpFreq = 0) {
    if (!ctx) return;
    const bufSize = ctx.sampleRate * duration;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    let node = src;
    if (lpFreq < 20000) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = lpFreq;
      node.connect(lp);
      node = lp;
    }
    if (hpFreq > 0) {
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = hpFreq;
      node.connect(hp);
      node = hp;
    }
    const g = makeGain(0);
    node.connect(g);
    const now = ctx.currentTime;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(vol, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);
    src.start(now);
    src.stop(now + duration + 0.1);
  }

  function sweepTone(f0, f1, type, duration, vol) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = makeGain(0);
    osc.type = type;
    osc.frequency.value = f0;
    osc.connect(g);
    const now = ctx.currentTime;
    osc.frequency.linearRampToValueAtTime(f1, now + duration);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(vol, now + 0.01);
    g.gain.linearRampToValueAtTime(0, now + duration);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  // --- named sounds ---
  const sounds = {
    uiClick() {
      playTone(800, 'square', 0.06, 0.12);
    },
    uiHover() {
      playTone(600, 'sine', 0.04, 0.05);
    },
    playButton() {
      playTone(300, 'sine', 0.1, 0.3);
      setTimeout(() => playTone(450, 'sine', 0.12, 0.25), 80);
      setTimeout(() => playTone(600, 'sine', 0.14, 0.3), 160);
    },
    monologueType() {
      const freqs = [400, 440, 480, 500, 420, 460];
      playTone(freqs[Math.floor(Math.random() * freqs.length)], 'triangle', 0.05, 0.06);
    },
    battleStart() {
      // Deep bass hit + rising sweep
      playNoise(0.4, 0.4, 200);
      sweepTone(80, 40, 'sawtooth', 0.5, 0.3);
      setTimeout(() => playTone(200, 'sawtooth', 0.3, 0.2), 300);
      setTimeout(() => playTone(300, 'sawtooth', 0.2, 0.15), 500);
    },
    fireballLaunch() {
      sweepTone(200, 600, 'sawtooth', 0.3, 0.2);
      playNoise(0.2, 0.1, 600);
    },
    fireballHit() {
      playNoise(0.35, 0.45, 300);
      playTone(100, 'sawtooth', 0.25, 0.3, 0.005, 0.2);
    },
    lightning() {
      playNoise(0.08, 0.6, 18000, 3000);
      playTone(80, 'sawtooth', 0.1, 0.15);
    },
    groundSlam() {
      playNoise(0.5, 0.3, 400);
      playTone(60, 'sawtooth', 0.4, 0.5, 0.005, 0.3);
      playTone(80, 'square', 0.2, 0.4, 0.01, 0.3);
    },
    minionSpawn() {
      playTone(300, 'sine', 0.4, 0.15);
      setTimeout(() => playTone(350, 'sine', 0.4, 0.15), 100);
      setTimeout(() => playTone(280, 'sine', 0.4, 0.2), 200);
      playTone(301, 'triangle', 0.35, 0.4); // slight detuning
    },
    heroAttack() {
      sweepTone(400, 200, 'sawtooth', 0.1, 0.15);
      playNoise(0.08, 0.15, 3000, 500);
    },
    heroHurt() {
      playNoise(0.15, 0.25, 2000);
      playTone(250, 'sawtooth', 0.15, 0.12);
    },
    bossHurt() {
      playNoise(0.1, 0.2, 1500);
      sweepTone(180, 100, 'square', 0.15, 0.2);
    },
    weakPointHit() {
      playTone(1000, 'triangle', 0.25, 0.35, 0.005, 0.2);
      setTimeout(() => playTone(1250, 'triangle', 0.25, 0.25), 100);
      setTimeout(() => playTone(1500, 'triangle', 0.2, 0.3), 200);
      playNoise(0.1, 0.15, 5000);
    },
    phaseTransition() {
      // Dramatic orchestral hit — stacked intervals
      const notes = [80, 100, 120, 160, 200, 240, 300];
      notes.forEach((f, i) => {
        setTimeout(() => {
          playTone(f, 'sawtooth', 0.6, 0.15 - i * 0.01);
          playTone(f * 1.5, 'square', 0.5, 0.08);
        }, i * 30);
      });
      setTimeout(() => playNoise(0.5, 0.35, 800), 100);
      setTimeout(() => sweepTone(100, 300, 'sawtooth', 0.8, 0.3), 200);
    },
    closeCall() {
      // Tense stinger
      playTone(150, 'sawtooth', 0.2, 0.25);
      setTimeout(() => playTone(160, 'sawtooth', 0.2, 0.2), 100);
      setTimeout(() => playTone(145, 'sawtooth', 0.2, 0.3), 200);
      playNoise(0.15, 0.2, 3000);
    },
    audienceCheer() {
      // Noise swell
      playNoise(1.0, 0.3, 6000, 200);
      setTimeout(() => playNoise(0.6, 0.2, 8000, 300), 300);
    },
    scoreCount() {
      // Ascending tick
      const freq = 400 + Math.random() * 200;
      playTone(freq, 'triangle', 0.08, 0.15);
    },
    victoryFanfare() {
      const melody = [261, 329, 392, 523, 659, 784, 1046];
      melody.forEach((f, i) => {
        setTimeout(() => {
          playTone(f, 'triangle', 0.4, 0.25);
          playTone(f * 0.75, 'sine', 0.4, 0.2);
        }, i * 120);
      });
      setTimeout(() => {
        playTone(1046, 'triangle', 0.8, 0.4);
        playTone(784, 'sine', 0.8, 0.35);
        playTone(523, 'sine', 0.8, 0.3);
        playNoise(0.5, 0.2, 8000);
      }, 900);
    },
    gameOver() {
      sweepTone(400, 100, 'sawtooth', 1.5, 0.3);
      setTimeout(() => sweepTone(200, 60, 'sine', 1.0, 0.2), 300);
    }
  };

  return { init, setVolume, setMute, getVolume, getMuted, play: sounds };
})();
