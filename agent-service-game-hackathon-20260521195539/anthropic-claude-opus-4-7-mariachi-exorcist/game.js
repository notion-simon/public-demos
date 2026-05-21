// Mariachi Exorcist - rhythm duel with three distinct ghosts
// ============================================================
(() => {
  'use strict';

  // ============================================================
  // Audio engine — fully synthesized mariachi
  // ============================================================
  function midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  const Audio = {
    ctx: null, master: null, music: null, sfx: null, bed: null,
    muted: false, volume: 0.75, started: false,
    bedActive: false, bedTimer: null, lastBedT: 0,

    init() {
      if (this.started) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      // Master compressor for glue
      this.comp = this.ctx.createDynamicsCompressor();
      this.comp.threshold.value = -14;
      this.comp.knee.value = 30;
      this.comp.ratio.value = 6;
      this.comp.attack.value = 0.005;
      this.comp.release.value = 0.18;
      this.master = this.ctx.createGain(); this.master.gain.value = this.volume;
      this.comp.connect(this.master);
      this.master.connect(this.ctx.destination);
      this.music = this.ctx.createGain(); this.music.gain.value = 0.95; this.music.connect(this.comp);
      this.sfx = this.ctx.createGain(); this.sfx.gain.value = 0.9; this.sfx.connect(this.comp);
      this.bed = this.ctx.createGain(); this.bed.gain.value = 0.78; this.bed.connect(this.comp);
      this.started = true;
    },
    setVolume(v) {
      this.volume = v;
      if (this.master) this.master.gain.value = this.muted ? 0 : v;
      try { localStorage.setItem('me_vol', String(v)); } catch (e) {}
    },
    setMuted(m) {
      this.muted = m;
      if (this.master) this.master.gain.value = m ? 0 : this.volume;
      try { localStorage.setItem('me_mute', m ? '1' : '0'); } catch (e) {}
    },

    // ---- Mariachi instruments --------------------------------
    // Guitar / vihuela pluck (Karplus-style approximation).
    pluck(freq, when, dur, gain, dest) {
      if (!this.ctx) return;
      dur = dur || 0.5; gain = gain || 0.3;
      dest = dest || this.music;
      const ctx = this.ctx, t = (when != null) ? when : ctx.currentTime;
      const o1 = ctx.createOscillator(); o1.type = 'triangle'; o1.frequency.value = freq;
      const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 2;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 2600;
      o1.connect(g); o2.connect(g); g.connect(filt); filt.connect(dest);
      o1.start(t); o2.start(t); o1.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
      // Noise pluck attack
      const len = Math.max(1, Math.floor(ctx.sampleRate * 0.025));
      const nb = ctx.createBuffer(1, len, ctx.sampleRate);
      const nd = nb.getChannelData(0);
      for (let i = 0; i < len; i++) nd[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const n = ctx.createBufferSource(); n.buffer = nb;
      const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = freq * 2;
      const ng = ctx.createGain(); ng.gain.value = gain * 0.35;
      n.connect(nf); nf.connect(ng); ng.connect(dest);
      n.start(t);
    },

    // Vihuela strum across chord notes (with up/down direction)
    strum(chord, when, direction, gain, dest) {
      if (!this.ctx) return;
      gain = gain || 0.12; dest = dest || this.bed;
      const t = (when != null) ? when : this.ctx.currentTime;
      const seq = direction === 'up' ? [...chord].reverse() : chord;
      // Higher octave for vihuela's brighter tone
      seq.forEach((n, i) => this.pluck(midiToFreq(n + 12), t + i * 0.012, 0.22, gain * 0.9, dest));
    },

    // Bajo bass — fat low pluck with body
    bass(midi, when, dur, gain) {
      if (!this.ctx) return;
      dur = dur || 0.5; gain = gain || 0.34;
      const ctx = this.ctx, t = (when != null) ? when : ctx.currentTime;
      const f = midiToFreq(midi);
      const o1 = ctx.createOscillator(); o1.type = 'triangle'; o1.frequency.value = f;
      const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 0.5;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
      o1.connect(g); o2.connect(g); g.connect(lp); lp.connect(this.bed);
      o1.start(t); o2.start(t); o1.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
    },

    // Trumpet — bright sawtooth with vibrato and quick attack
    trumpet(freq, when, dur, gain, dest) {
      if (!this.ctx) return;
      dur = dur || 0.5; gain = gain || 0.18;
      dest = dest || this.music;
      const ctx = this.ctx, t = (when != null) ? when : ctx.currentTime;
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq;
      // Pitch bend up at attack — gives that brassy lift
      o.frequency.setValueAtTime(freq * 0.985, t);
      o.frequency.linearRampToValueAtTime(freq, t + 0.04);
      // Vibrato (only after attack)
      const lfo = ctx.createOscillator(); lfo.frequency.value = 5.6;
      const lfoG = ctx.createGain(); lfoG.gain.setValueAtTime(0, t);
      lfoG.gain.linearRampToValueAtTime(5.5, t + 0.12);
      lfo.connect(lfoG); lfoG.connect(o.frequency);
      // Formant-ish filter sweep
      const filt = ctx.createBiquadFilter(); filt.type = 'lowpass';
      filt.frequency.setValueAtTime(900, t);
      filt.frequency.linearRampToValueAtTime(2800, t + 0.08);
      filt.Q.value = 6;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(gain, t + 0.05);
      g.gain.setValueAtTime(gain * 0.82, t + dur * 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(filt); filt.connect(g); g.connect(dest);
      o.start(t); lfo.start(t);
      o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
    },

    // Cajón / kick — punchy low body thump
    kick(when, gain) {
      if (!this.ctx) return;
      gain = gain || 0.32;
      const ctx = this.ctx, t = (when != null) ? when : ctx.currentTime;
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(48, t + 0.13);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(gain, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(g); g.connect(this.bed);
      o.start(t); o.stop(t + 0.2);
      // Click layer
      const len = Math.floor(ctx.sampleRate * 0.012);
      const nb = ctx.createBuffer(1, len, ctx.sampleRate);
      const nd = nb.getChannelData(0);
      for (let i = 0; i < len; i++) nd[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const n = ctx.createBufferSource(); n.buffer = nb;
      const ng = ctx.createGain(); ng.gain.value = gain * 0.3;
      n.connect(ng); ng.connect(this.bed);
      n.start(t);
    },

    // Maraca / shaker — short noise burst
    shaker(when, gain) {
      if (!this.ctx) return;
      gain = gain || 0.06;
      const ctx = this.ctx, t = (when != null) ? when : ctx.currentTime;
      const len = Math.floor(ctx.sampleRate * 0.05);
      const nb = ctx.createBuffer(1, len, ctx.sampleRate);
      const nd = nb.getChannelData(0);
      for (let i = 0; i < len; i++) nd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.5);
      const n = ctx.createBufferSource(); n.buffer = nb;
      const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6500;
      const g = ctx.createGain(); g.gain.value = gain;
      n.connect(f); f.connect(g); g.connect(this.bed);
      n.start(t);
    },

    // Hand clap — body + tail
    clap(when, gain) {
      if (!this.ctx) return;
      gain = gain || 0.16;
      const ctx = this.ctx, t = (when != null) ? when : ctx.currentTime;
      for (let i = 0; i < 3; i++) {
        const start = t + i * 0.013;
        const len = Math.floor(ctx.sampleRate * 0.04);
        const nb = ctx.createBuffer(1, len, ctx.sampleRate);
        const nd = nb.getChannelData(0);
        for (let j = 0; j < len; j++) nd[j] = (Math.random() * 2 - 1);
        const n = ctx.createBufferSource(); n.buffer = nb;
        const f = ctx.createBiquadFilter(); f.type = 'bandpass';
        f.frequency.value = 1700; f.Q.value = 1.8;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, start);
        g.gain.linearRampToValueAtTime(gain * (1 - i * 0.35), start + 0.003);
        g.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);
        n.connect(f); f.connect(g); g.connect(this.bed);
        n.start(start);
      }
    },

    // Grito-ish wail for misses / failure
    wail(when, gain) {
      if (!this.ctx) return;
      gain = gain || 0.22;
      const ctx = this.ctx, t = (when != null) ? when : ctx.currentTime;
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(420, t);
      o.frequency.exponentialRampToValueAtTime(190, t + 0.7);
      const filt = ctx.createBiquadFilter(); filt.type = 'bandpass';
      filt.frequency.value = 900; filt.Q.value = 6;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(gain, t + 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
      o.connect(filt); filt.connect(g); g.connect(this.sfx);
      o.start(t); o.stop(t + 0.8);
    },

    // Soft dud for misses (used sparingly)
    miss(when) {
      if (!this.ctx) return;
      const t = (when != null) ? when : this.ctx.currentTime;
      this.pluck(170, t, 0.18, 0.18, this.sfx);
      this.pluck(178, t, 0.18, 0.14, this.sfx);
    },

    chime(freq, when, gain) {
      if (!this.ctx) return;
      gain = gain || 0.18;
      const t = (when != null) ? when : this.ctx.currentTime;
      [1, 2.76, 5.4].forEach((p, i) => {
        const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq * p;
        const g = this.ctx.createGain();
        const amp = gain / (i + 1);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(amp, t + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 2 / (i + 1));
        o.connect(g); g.connect(this.sfx);
        o.start(t); o.stop(t + 2.2);
      });
    },

    click() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator(); o.type = 'square'; o.frequency.value = 660;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.06, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      o.connect(g); g.connect(this.sfx);
      o.start(t); o.stop(t + 0.06);
    },

    // Count-in rim-tap
    rimTick(when, accent) {
      if (!this.ctx) return;
      const t = (when != null) ? when : this.ctx.currentTime;
      const f = accent ? 1800 : 1200;
      const o = this.ctx.createOscillator(); o.type = 'square'; o.frequency.value = f;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(accent ? 0.22 : 0.14, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
      const hp = this.ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 800;
      o.connect(hp); hp.connect(g); g.connect(this.sfx);
      o.start(t); o.stop(t + 0.08);
    },

    // ---- Bed loop (the actual mariachi groove) ---------------
    startBed(level) {
      this.stopBed();
      if (!this.ctx) return;
      this.bedActive = true;
      const beat = 60 / level.bpm;
      const barLen = 4 * beat;
      const cycleLen = level.prog.length * barLen;

      const self = this;
      function scheduleCycle(startT) {
        if (!self.bedActive) return;
        for (let m = 0; m < level.prog.length; m++) {
          self.scheduleBar(startT + m * barLen, m, level);
        }
      }

      const t = this.ctx.currentTime + 0.12;
      scheduleCycle(t);
      this.lastBedT = t;
      const queueNext = () => {
        if (!self.bedActive) return;
        const next = self.lastBedT + cycleLen;
        scheduleCycle(next);
        self.lastBedT = next;
        self.bedTimer = setTimeout(queueNext, cycleLen * 1000 - 250);
      };
      this.bedTimer = setTimeout(queueNext, cycleLen * 1000 - 250);
    },
    stopBed() {
      this.bedActive = false;
      if (this.bedTimer) { clearTimeout(this.bedTimer); this.bedTimer = null; }
    },

    scheduleBar(t, barIdx, level) {
      const beat = 60 / level.bpm;
      const chordInfo = level.prog[barIdx];
      const chordRoot = level.root + chordInfo.r;
      const chord = chordOf(chordRoot, chordInfo.q);
      const style = level.style;

      // ---- Bass / bajo ----
      const bassNote = chordRoot - 24;
      if (style === 'ballad') {
        // Slow ballad: root on 1, root on 3 (half-note feel)
        this.bass(bassNote, t, beat * 1.6, 0.32);
        this.bass(bassNote, t + 2 * beat, beat * 1.6, 0.32);
      } else if (style === 'corrido') {
        // Classic corrido bajo: root on 1, fifth on 3
        this.bass(bassNote, t, beat * 0.9, 0.33);
        this.bass(bassNote + 7, t + 2 * beat, beat * 0.9, 0.30);
      } else if (style === 'dramatic') {
        // Dramatic: root on 1 and 3, drop to fifth on the and-of-4
        this.bass(bassNote, t, beat * 0.85, 0.36);
        this.bass(bassNote, t + 2 * beat, beat * 0.85, 0.34);
        this.bass(bassNote + 7, t + 3.5 * beat, beat * 0.5, 0.28);
      }

      // ---- Vihuela / guitar strums ----
      // The defining mariachi sound: tight downstrokes on 2 & 4.
      if (style === 'ballad') {
        // Gentle arpeggio across the bar
        const arp = [chord[0], chord[2], chord[1], chord[3], chord[2], chord[1]];
        for (let i = 0; i < 6; i++) {
          this.pluck(midiToFreq(arp[i]), t + i * (beat * 0.65), 0.55, 0.085, this.bed);
        }
      } else if (style === 'corrido') {
        // Strong down-up pattern: 2 (down), &-of-2 (up), 3 (down small), 4 (down), &-of-4 (up)
        this.strum(chord, t + beat, 'down', 0.13);
        this.strum(chord, t + beat + beat / 2, 'up', 0.08);
        this.strum(chord, t + 3 * beat, 'down', 0.13);
        this.strum(chord, t + 3 * beat + beat / 2, 'up', 0.08);
      } else {
        // dramatic: chops on 2, &, 3, 4, & — driving and tense
        this.strum(chord, t + beat, 'down', 0.14);
        this.strum(chord, t + beat + beat / 2, 'up', 0.10);
        this.strum(chord, t + 2 * beat + beat / 2, 'down', 0.10);
        this.strum(chord, t + 3 * beat, 'down', 0.14);
        this.strum(chord, t + 3 * beat + beat / 2, 'up', 0.10);
      }

      // ---- Percussion ----
      if (style === 'ballad') {
        // Subtle shaker on every quarter, no kick
        for (let i = 0; i < 4; i++) this.shaker(t + i * beat, 0.04);
      } else if (style === 'corrido') {
        // Kick on 1, 3 ; shaker on every 8th
        this.kick(t, 0.32);
        this.kick(t + 2 * beat, 0.30);
        for (let i = 0; i < 8; i++) this.shaker(t + i * (beat / 2), 0.055 + (i % 2 ? 0.025 : 0));
      } else {
        // Kick on 1 and 3 ; clap on 2 and 4 ; shaker on every 8th
        this.kick(t, 0.34);
        this.kick(t + 2 * beat, 0.32);
        this.clap(t + beat, 0.13);
        this.clap(t + 3 * beat, 0.13);
        for (let i = 0; i < 8; i++) this.shaker(t + i * (beat / 2), 0.06 + (i % 2 ? 0.03 : 0));
      }

      // ---- Trumpet hook ----
      if (level.melody && level.melody[barIdx]) {
        for (const n of level.melody[barIdx]) {
          const f = midiToFreq(level.root + n.p);
          this.trumpet(f, t + n.b * beat, (n.d || 0.6) * beat, n.g || 0.14, this.bed);
        }
      }
    },
  };

  // Build a chord array (3-4 notes) from a root MIDI note and quality flag.
  function chordOf(root, q) {
    if (q === 'm') return [root, root + 3, root + 7, root + 12];
    if (q === 'd') return [root, root + 3, root + 6, root + 12];
    if (q === '7') return [root, root + 4, root + 7, root + 10];
    if (q === 'M7') return [root, root + 4, root + 7, root + 11];
    return [root, root + 4, root + 7, root + 12]; // major
  }

  // ============================================================
  // Levels (the three ghosts)
  // ============================================================
  // Melody notes: { p: midi-offset-from-root, b: beat-within-bar (0..4), d: duration in beats, g: gain }
  const LEVELS = [
    {
      // ---- LA NOVIA -------------------------------------------------
      id: 'novia',
      name: 'La Novia', subtitle: 'The Bride · the haunted chapel',
      bpm: 86,
      root: 57,                         // A3
      style: 'ballad',
      // Am - F - C - G   (i - VI - III - VII in A minor)
      prog: [{ r: 0, q: 'm' }, { r: -4, q: '' }, { r: 3, q: '' }, { r: -2, q: '' }],
      melody: [
        // Bar 1 — Am: A4 ... C5 ... E5
        [{ p: 12, b: 1.0, d: 1.0 }, { p: 15, b: 2.0, d: 1.0 }, { p: 19, b: 3.0, d: 0.9 }],
        // Bar 2 — F: F4 ... A4 ... C5
        [{ p: 8, b: 1.0, d: 1.0 }, { p: 12, b: 2.0, d: 1.0 }, { p: 17, b: 3.0, d: 0.9 }],
        // Bar 3 — C: G4 ... C5 ... E5
        [{ p: 10, b: 0.5, d: 0.5 }, { p: 15, b: 1.5, d: 0.5 }, { p: 19, b: 2.5, d: 1.4 }],
        // Bar 4 — G: D5 down to B4
        [{ p: 17, b: 0.5, d: 0.5 }, { p: 14, b: 1.5, d: 0.5 }, { p: 10, b: 2.5, d: 1.0 }],
      ],
      noteCount: 22,
      density: 0.40, chordChance: 0.04, streamChance: 0.02,
      hauntPerMiss: 6.5, spiritPerHit: 3.0, wrongPress: 4.5,
      scene: 'chapel',
      flowerCol: '#ffd9e6',
    },
    {
      // ---- EL BANDIDO -----------------------------------------------
      id: 'bandido',
      name: 'El Bandido', subtitle: 'The Bandit · the red canyon',
      bpm: 122,
      root: 62,                         // D4 root
      style: 'corrido',
      // D - D - G - A  (I - I - IV - V)
      prog: [{ r: 0, q: '' }, { r: 0, q: '' }, { r: 5, q: '' }, { r: 7, q: '' }],
      melody: [
        // Bar 1 — D: heroic ascent
        [{ p: 14, b: 0.0, d: 0.5 }, { p: 16, b: 0.5, d: 0.5 }, { p: 19, b: 1.0, d: 1.0 }, { p: 21, b: 2.5, d: 1.4 }],
        // Bar 2 — D: variation answer
        [{ p: 21, b: 0.0, d: 0.5 }, { p: 19, b: 0.5, d: 0.5 }, { p: 16, b: 1.0, d: 0.5 }, { p: 19, b: 2.0, d: 1.9 }],
        // Bar 3 — G: lift up to high G/B
        [{ p: 19, b: 0.0, d: 0.5 }, { p: 22, b: 0.5, d: 0.5 }, { p: 24, b: 1.0, d: 1.5 }, { p: 21, b: 3.0, d: 0.9 }],
        // Bar 4 — A: resolve with V→I implied
        [{ p: 21, b: 0.0, d: 0.5 }, { p: 17, b: 0.5, d: 0.5 }, { p: 14, b: 1.0, d: 0.5 }, { p: 17, b: 2.0, d: 1.9 }],
      ],
      noteCount: 36,
      density: 0.58, chordChance: 0.16, streamChance: 0.14,
      hauntPerMiss: 7.0, spiritPerHit: 2.7, wrongPress: 5.0,
      scene: 'canyon',
      flowerCol: '#ffd166',
    },
    {
      // ---- LA CATRINA -----------------------------------------------
      id: 'catrina',
      name: 'La Catrina', subtitle: 'Lady of the Dead · the cemetery',
      bpm: 142,
      root: 64,                         // E4 root (E harmonic minor / phrygian dominant)
      style: 'dramatic',
      // Em - B - Em - F  (i - V - i - bII, Spanish/phrygian flavor)
      prog: [{ r: 0, q: 'm' }, { r: -5, q: '' }, { r: 0, q: 'm' }, { r: -11, q: '' }],
      melody: [
        // Bar 1 — Em: dark ascent E G B E
        [{ p: 12, b: 0.0, d: 0.5 }, { p: 15, b: 0.5, d: 0.5 }, { p: 19, b: 1.0, d: 0.5 }, { p: 24, b: 1.5, d: 0.5 }, { p: 19, b: 2.0, d: 1.9 }],
        // Bar 2 — B (V): D# F# A B — leading tone tension
        [{ p: 23, b: 0.0, d: 0.5 }, { p: 18, b: 0.5, d: 0.5 }, { p: 23, b: 1.0, d: 0.5 }, { p: 26, b: 1.5, d: 1.5 }, { p: 23, b: 3.0, d: 0.9 }],
        // Bar 3 — Em
        [{ p: 19, b: 0.0, d: 0.5 }, { p: 15, b: 0.5, d: 0.5 }, { p: 12, b: 1.0, d: 0.5 }, { p: 15, b: 1.5, d: 0.5 }, { p: 19, b: 2.0, d: 1.9 }],
        // Bar 4 — F (bII): phrygian punch, descend
        [{ p: 17, b: 0.0, d: 0.5 }, { p: 20, b: 0.5, d: 0.5 }, { p: 25, b: 1.0, d: 1.0 }, { p: 23, b: 2.5, d: 0.5 }, { p: 19, b: 3.0, d: 0.9 }],
      ],
      noteCount: 44,
      density: 0.66, chordChance: 0.22, streamChance: 0.22,
      hauntPerMiss: 7.5, spiritPerHit: 2.4, wrongPress: 5.5,
      scene: 'cemetery',
      flowerCol: '#ff5ea0',
    },
  ];

  // ============================================================
  // Game state
  // ============================================================
  const G = {
    state: 'INTRO',
    levelIdx: 0,
    level: null,
    chart: [],
    t0: 0,
    spirit: 0,
    haunt: 0,
    combo: 0,
    maxCombo: 0,
    hits: 0, misses: 0, perfects: 0,
    feedbacks: [],
    bursts: [],
    petals: [],
    sceneParticles: [],
    ghostShake: 0,
    ghostFlinch: 0,
    ghostBob: 0,
    bgFlash: 0,
    laneRing: [0, 0, 0],
    time: 0,
    countInUntil: 0,
    prevState: 'PLAY',
    pausedAt: 0,
  };

  // ============================================================
  // DOM + canvas
  // ============================================================
  const $ = sel => document.querySelector(sel);
  const cv = $('#stage');
  const ctx = cv.getContext('2d');
  cv.width = 1280; cv.height = 800;
  const Input = { keys: {}, laneFlash: [0, 0, 0] };

  function canvasPos(ev) {
    const r = cv.getBoundingClientRect();
    return {
      x: (ev.clientX - r.left) / r.width * cv.width,
      y: (ev.clientY - r.top) / r.height * cv.height,
    };
  }
  cv.addEventListener('mousedown', ev => {
    if (G.state !== 'PLAY') return;
    const p = canvasPos(ev);
    const lane = Math.floor((p.x / cv.width) * 3);
    if (lane >= 0 && lane < 3) tryHit(lane);
  });
  window.addEventListener('keydown', ev => {
    const k = ev.key.toLowerCase();
    if (Input.keys[k]) return; // ignore key auto-repeat
    Input.keys[k] = true;
    handleKey(k, ev);
  });
  window.addEventListener('keyup', ev => { Input.keys[ev.key.toLowerCase()] = false; });

  function handleKey(k, ev) {
    if (k === 'm') {
      Audio.setMuted(!Audio.muted);
      $('#muteBtn').textContent = Audio.muted ? '🔇' : '🔊';
      return;
    }
    if (k === 'escape') {
      if (G.state === 'PLAY' || G.state === 'COUNTIN') pauseGame();
      else if (G.state === 'PAUSED') resumeGame();
      return;
    }
    if (G.state === 'INTRO' && (k === 'enter' || k === ' ')) {
      ev && ev.preventDefault();
      $('#playBtn').click();
      return;
    }
    if (G.state === 'PLAY') {
      if (k === 'a') { ev && ev.preventDefault(); tryHit(0); }
      else if (k === 's') { ev && ev.preventDefault(); tryHit(1); }
      else if (k === 'd') { ev && ev.preventDefault(); tryHit(2); }
    }
  }

  // ============================================================
  // Chart generation
  // ============================================================
  function buildChart(level) {
    const beat = 60 / level.bpm;
    const sub = beat / 2;
    const sub16 = beat / 4;
    const leadIn = 4 * beat;
    const chart = [];
    let i = 0;
    let lastLane = -1, sameLaneCount = 0;
    let safety = 0;
    while (chart.length < level.noteCount && safety < 240) {
      safety++;
      const tBase = leadIn + i * sub;
      i++;
      if (Math.random() > level.density) continue;

      // Burst (16th-note triplet)
      if (Math.random() < level.streamChance && chart.length + 3 <= level.noteCount) {
        const lane = pickLane(lastLane);
        for (let b = 0; b < 3; b++) {
          chart.push({ t: tBase + b * sub16, lane, judged: false, hit: false, chordPart: false });
        }
        lastLane = lane; sameLaneCount = 1;
        continue;
      }
      // Chord (two simultaneous lanes)
      if (Math.random() < level.chordChance && chart.length + 2 <= level.noteCount) {
        const l1 = pickLane(lastLane);
        let l2 = (l1 + 1 + Math.floor(Math.random() * 2)) % 3;
        if (l2 === l1) l2 = (l1 + 1) % 3;
        chart.push({ t: tBase, lane: l1, judged: false, hit: false, chordPart: true });
        chart.push({ t: tBase, lane: l2, judged: false, hit: false, chordPart: true });
        lastLane = l1; sameLaneCount = 1;
        continue;
      }
      const lane = pickLane(lastLane);
      chart.push({ t: tBase, lane, judged: false, hit: false, chordPart: false });
      if (lane === lastLane) sameLaneCount++; else sameLaneCount = 1;
      lastLane = lane;
    }
    chart.sort((a, b) => a.t - b.t || a.lane - b.lane);
    return chart;

    function pickLane(prev) {
      let l;
      do { l = Math.floor(Math.random() * 3); } while (l === prev && Math.random() < 0.55);
      return l;
    }
  }

  // ============================================================
  // Game flow
  // ============================================================
  function startGame() {
    Audio.init();
    if (Audio.ctx.state === 'suspended') Audio.ctx.resume();
    try {
      const v = parseFloat(localStorage.getItem('me_vol'));
      if (!isNaN(v)) { Audio.setVolume(v); $('#volSlider').value = String(Math.round(v * 100)); }
      const m = localStorage.getItem('me_mute');
      if (m === '1') { Audio.setMuted(true); $('#muteBtn').textContent = '🔇'; }
    } catch (e) {}
    $('#intro').classList.add('hidden');
    $('#audioHud').classList.remove('hidden');
    G.levelIdx = 0;
    startLevel();
  }

  function startLevel() {
    const lvl = LEVELS[G.levelIdx];
    G.level = lvl;
    G.chart = buildChart(lvl);
    G.spirit = 0; G.haunt = 0; G.combo = 0; G.maxCombo = 0;
    G.hits = 0; G.misses = 0; G.perfects = 0;
    G.feedbacks.length = 0;
    G.bursts.length = 0;
    G.petals.length = 0;
    G.sceneParticles.length = 0;
    G.ghostShake = 0; G.ghostFlinch = 0; G.bgFlash = 0;
    G.laneRing = [0, 0, 0];
    G.state = 'COUNTIN';
    G.t0 = performance.now() / 1000;
    Audio.startBed(lvl);
    const beat = 60 / lvl.bpm;
    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        if (G.state === 'COUNTIN') Audio.rimTick(undefined, i === 3);
      }, i * beat * 1000);
    }
    G.countInUntil = 4 * beat;
    setTimeout(() => { if (G.state === 'COUNTIN') G.state = 'PLAY'; }, 4 * beat * 1000);
  }

  function pauseGame() {
    if (G.state !== 'PLAY' && G.state !== 'COUNTIN') return;
    G.pausedAt = performance.now() / 1000;
    G.prevState = G.state;
    G.state = 'PAUSED';
    $('#pause').classList.remove('hidden');
    Audio.stopBed();
  }
  function resumeGame() {
    if (G.state !== 'PAUSED') return;
    $('#pause').classList.add('hidden');
    const dt = performance.now() / 1000 - G.pausedAt;
    G.t0 += dt;
    G.state = G.prevState || 'PLAY';
    Audio.startBed(G.level);
  }
  function restartDuel() {
    $('#pause').classList.add('hidden');
    Audio.stopBed();
    startLevel();
  }

  function endDuel(won) {
    Audio.stopBed();
    G.state = won ? 'WON_DUEL' : 'LOST_DUEL';
    if (won) {
      Audio.chime(880); setTimeout(() => Audio.chime(1318), 110); setTimeout(() => Audio.chime(1760), 220);
      Audio.trumpet(midiToFreq(G.level.root + 12), undefined, 0.7, 0.22);
      spawnPetalBurst(120);
      if (G.levelIdx >= LEVELS.length - 1) setTimeout(() => winGame(), 1500);
      else setTimeout(() => showResult(true), 1000);
    } else {
      Audio.wail(undefined, 0.32);
      setTimeout(() => showResult(false), 900);
    }
  }

  function showResult(won) {
    const lvl = G.level;
    if (won) {
      $('#resultTitle').innerHTML = `${lvl.name} <span class="accent">is at rest</span>`;
      $('#resultSub').textContent = `Combo ${G.maxCombo} · Notes ${G.hits}/${G.chart.length}`;
      const next = LEVELS[G.levelIdx + 1];
      $('#resultBody').textContent = `The dusk lifts a little. Next: ${next.name} (${next.subtitle}).`;
      $('#resultBtn').textContent = `▶ Face ${next.name}`;
      $('#resultBtn').onclick = () => {
        Audio.click();
        $('#result').classList.add('hidden');
        G.levelIdx++;
        startLevel();
      };
    } else {
      $('#resultTitle').innerHTML = `Overwhelmed by <span class="accent">${lvl.name}</span>`;
      $('#resultSub').textContent = `Combo ${G.maxCombo} · Notes ${G.hits}/${G.chart.length}`;
      $('#resultBody').textContent = `The ghost grows stronger from your stumbles. Hit notes on the beat — wrong-key strikes feed the haunt. Try again.`;
      $('#resultBtn').textContent = '↻ Try Again';
      $('#resultBtn').onclick = () => {
        Audio.click();
        $('#result').classList.add('hidden');
        startLevel();
      };
    }
    $('#result').classList.remove('hidden');
  }

  function winGame() {
    G.state = 'WIN_GAME';
    Audio.stopBed();
    $('#audioHud').classList.add('hidden');
    $('#winScreen').classList.remove('hidden');
    const t = Audio.ctx.currentTime;
    [0, 0.4, 0.8, 1.2].forEach((dt, i) => {
      const chord = [[60, 64, 67, 72], [65, 69, 72, 77], [67, 71, 74, 79], [60, 64, 67, 72]][i];
      chord.forEach(n => Audio.pluck(midiToFreq(n), t + dt, 0.6, 0.22));
      Audio.trumpet(midiToFreq(chord[chord.length - 1] + 12), t + dt + 0.18, 0.6, 0.22);
    });
    Audio.chime(1760, t + 1.6);
    spawnPetalBurst(300);
  }

  function spawnPetalBurst(n) {
    for (let i = 0; i < n; i++) {
      G.petals.push({
        x: Math.random() * cv.width, y: -20 - Math.random() * 400,
        vx: (Math.random() - 0.5) * 60, vy: 80 + Math.random() * 90,
        life: 8, color: randomMarigold(),
        rot: Math.random() * Math.PI * 2, spin: (Math.random() - 0.5) * 5,
        size: 4 + Math.random() * 4,
      });
    }
  }

  // ============================================================
  // Hit / Miss
  // ============================================================
  function tryHit(lane) {
    if (G.state !== 'PLAY') return;
    Input.laneFlash[lane] = 1;
    const now = performance.now() / 1000 - G.t0;
    let best = null, bestDt = Infinity;
    for (const n of G.chart) {
      if (n.judged || n.lane !== lane) continue;
      const dt = Math.abs(n.t - now);
      if (dt < bestDt) { bestDt = dt; best = n; }
    }
    if (best && bestDt < 0.16) {
      best.judged = true; best.hit = true;
      const perfect = bestDt < 0.055;
      if (perfect) G.perfects++;
      G.hits++;
      G.combo++;
      if (G.combo > G.maxCombo) G.maxCombo = G.combo;
      const mult = G.combo >= 16 ? 2 : G.combo >= 8 ? 1.5 : 1;
      const gain = G.level.spiritPerHit * mult * (perfect ? 1.18 : 1);
      G.spirit = Math.min(100, G.spirit + gain);
      playHitSound(lane);
      addFeedback(perfect ? 'PERFECT!' : 'HIT', perfect ? '#ffd166' : '#a3ff9e', lane);
      spawnHitBurst(lane, perfect);
      G.ghostFlinch = 1;
      G.bgFlash = 0.6;
      G.laneRing[lane] = 1;
      if (G.spirit >= 100) endDuel(true);
    } else {
      G.combo = 0;
      G.haunt = Math.min(100, G.haunt + G.level.wrongPress);
      Audio.miss();
      addFeedback('MISS', '#ff7f9e', lane);
      G.ghostShake = 1;
      if (G.haunt >= 100) endDuel(false);
    }
  }

  function playHitSound(lane) {
    const root = G.level.root;
    if (lane === 0) {
      [root - 12, root - 7, root - 5].forEach(n => Audio.pluck(midiToFreq(n), undefined, 0.6, 0.24));
    } else if (lane === 1) {
      [root, root + 4, root + 7].forEach(n => Audio.pluck(midiToFreq(n + 12), undefined, 0.32, 0.22));
    } else {
      const choices = [root + 12, root + 16, root + 19];
      const pick = choices[Math.floor(Math.random() * choices.length)];
      Audio.trumpet(midiToFreq(pick), undefined, 0.35, 0.22);
    }
  }

  function addFeedback(text, color, lane) {
    G.feedbacks.push({
      text, color,
      x: laneX(lane), y: hitY() - 70,
      vy: -50, life: 0.7,
    });
  }

  function spawnHitBurst(lane, perfect) {
    const x = laneX(lane), y = hitY();
    const count = perfect ? 14 : 8;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.3;
      const sp = 150 + Math.random() * 200;
      G.bursts.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7 - 40,
        life: 0.45 + Math.random() * 0.2,
        color: perfect ? randomMarigold() : LANE_COLORS[lane],
        size: 4 + Math.random() * 3,
      });
    }
  }

  // ============================================================
  // Update tick (called from frame loop during PLAY)
  // ============================================================
  function tickPlay() {
    const now = performance.now() / 1000 - G.t0;
    let pendingAfter = 0;
    for (const n of G.chart) {
      if (!n.judged) {
        if (n.t < now - 0.20) {
          n.judged = true; n.hit = false;
          G.misses++;
          G.combo = 0;
          G.haunt = Math.min(100, G.haunt + G.level.hauntPerMiss);
          if (Math.random() < 0.25) Audio.miss();
          addFeedback('MISS', '#ff7f9e', n.lane);
          if (G.haunt >= 100) { endDuel(false); return; }
        } else if (n.t > now - 0.20) {
          pendingAfter++;
        }
      }
    }
    if (pendingAfter === 0 && G.chart.length > 0) {
      const lastT = G.chart[G.chart.length - 1].t;
      if (now > lastT + 1.0) {
        if (G.spirit >= G.haunt) endDuel(true); else endDuel(false);
      }
    }
  }

  // ============================================================
  // Rendering
  // ============================================================
  // Lane geometry: notes track is centered, 3 lanes equally spaced
  const LANE_COLORS = ['#ff9b30', '#ff5ea0', '#3aa9ff'];
  const LANE_COLORS_SOFT = ['#7a3a0c', '#5a1a36', '#143a5a'];

  function lanesLeft() { return cv.width * 0.5 - cv.width * 0.33; }
  function lanesRight() { return cv.width * 0.5 + cv.width * 0.33; }
  function laneX(lane) {
    const w = (lanesRight() - lanesLeft()) / 3;
    return lanesLeft() + (lane + 0.5) * w;
  }
  function hitY() { return cv.height - 140; }

  function frame(ts) {
    G.time = ts / 1000;
    const dt = 1 / 60;
    // Decay visual states
    if (G.ghostFlinch > 0) G.ghostFlinch = Math.max(0, G.ghostFlinch - dt * 4);
    if (G.ghostShake > 0) G.ghostShake = Math.max(0, G.ghostShake - dt * 5);
    if (G.bgFlash > 0) G.bgFlash = Math.max(0, G.bgFlash - dt * 3);
    for (let i = 0; i < 3; i++) {
      if (Input.laneFlash[i] > 0) Input.laneFlash[i] = Math.max(0, Input.laneFlash[i] - dt * 6);
      if (G.laneRing[i] > 0) G.laneRing[i] = Math.max(0, G.laneRing[i] - dt * 2.5);
    }
    // Feedbacks
    for (const fb of G.feedbacks) { fb.y += fb.vy * dt; fb.life -= dt; }
    G.feedbacks = G.feedbacks.filter(fb => fb.life > 0);
    // Hit bursts
    for (const b of G.bursts) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      b.vy += 600 * dt; // gravity
      b.vx *= 0.96;
    }
    G.bursts = G.bursts.filter(b => b.life > 0);
    // Petals
    for (const p of G.petals) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      p.vx *= 0.99; p.rot = (p.rot || 0) + (p.spin || 0) * dt;
    }
    G.petals = G.petals.filter(p => p.life > 0 && p.y < cv.height + 30);
    // Scene particles (managed by scene)
    if (G.level && G.state !== 'INTRO') updateSceneParticles(dt);

    if (G.state === 'PLAY') tickPlay();

    // Render
    if (G.state === 'INTRO') {
      renderIntroBackdrop();
    } else if (G.state === 'WIN_GAME') {
      renderWin();
    } else {
      renderScene();
    }
    requestAnimationFrame(frame);
  }

  function renderIntroBackdrop() {
    // Use La Catrina scene with dimmed mood
    const lvl = LEVELS[0];
    paintSky(lvl);
    drawStars(80);
    paintFloor(lvl);
    drawTownSilhouette();
  }

  function renderScene() {
    const lvl = G.level || LEVELS[0];
    paintSky(lvl);
    if (G.bgFlash > 0) {
      ctx.fillStyle = `rgba(255, 200, 120, ${0.18 * G.bgFlash})`;
      ctx.fillRect(0, 0, cv.width, cv.height);
    }
    drawStars(110);
    paintSceneArt(lvl);   // scene-specific backdrop art
    paintFloor(lvl);
    drawTownSilhouette();
    drawPapelPicado();
    drawSceneParticles();
    drawGhost(lvl);
    drawLanes();
    drawNotes();
    drawHUD();
    drawHitBursts();
    drawFeedbacks();
    drawPetals();
    if (G.state === 'COUNTIN') drawCountIn();
  }

  function paintSky(lvl) {
    const W = cv.width, H = cv.height;
    let stops;
    const sc = lvl.scene;
    if (sc === 'chapel') {
      stops = [[10, 8, 26], [55, 28, 70], [180, 90, 130]];
    } else if (sc === 'canyon') {
      stops = [[25, 10, 18], [110, 30, 30], [240, 105, 65]];
    } else if (sc === 'cemetery') {
      stops = [[12, 6, 30], [60, 25, 88], [165, 90, 200]];
    } else {
      stops = [[20, 10, 30], [60, 30, 80], [180, 90, 130]];
    }
    const g = ctx.createLinearGradient(0, 0, 0, H * 0.72);
    g.addColorStop(0, rgb(stops[0]));
    g.addColorStop(0.55, rgb(stops[1]));
    g.addColorStop(1, rgb(stops[2]));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  function paintFloor(lvl) {
    const W = cv.width, H = cv.height;
    let stops;
    if (lvl.scene === 'chapel') stops = [[42, 22, 50], [10, 6, 16]];
    else if (lvl.scene === 'canyon') stops = [[90, 38, 22], [16, 8, 12]];
    else if (lvl.scene === 'cemetery') stops = [[70, 36, 80], [14, 8, 26]];
    else stops = [[40, 20, 50], [10, 5, 15]];
    const g = ctx.createLinearGradient(0, H * 0.62, 0, H);
    g.addColorStop(0, rgb(stops[0]));
    g.addColorStop(1, rgb(stops[1]));
    ctx.fillStyle = g; ctx.fillRect(0, H * 0.62, W, H * 0.38);
  }

  // Per-scene midground art (rose window / cliffs / tombstones etc.)
  function paintSceneArt(lvl) {
    if (lvl.scene === 'chapel') paintChapel();
    else if (lvl.scene === 'canyon') paintCanyon();
    else if (lvl.scene === 'cemetery') paintCemetery();
  }

  function paintChapel() {
    const W = cv.width, H = cv.height;
    // Big halo glow that sits behind ghost
    const haloX = W * 0.5, haloY = H * 0.36;
    ctx.save();
    const halo = ctx.createRadialGradient(haloX, haloY, 30, haloX, haloY, 380);
    halo.addColorStop(0, 'rgba(255, 220, 240, 0.55)');
    halo.addColorStop(0.4, 'rgba(220, 80, 140, 0.35)');
    halo.addColorStop(1, 'rgba(40, 10, 50, 0)');
    ctx.fillStyle = halo; ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // Rose window: colored RING (donut), so the ghost stays readable on top
    const cx = W * 0.5, cy = H * 0.40;
    const rOuter = 180, rInner = 96;
    ctx.save();
    ctx.translate(cx, cy);
    const slowSpin = Math.sin(G.time * 0.2) * 0.04;
    ctx.rotate(slowSpin);
    const colors = ['#d6266b', '#e9c46a', '#1f3a8a', '#ff8a1f', '#ff5ea0', '#7a4dc7', '#1f9aa8', '#e0a3ff'];
    for (let i = 0; i < 8; i++) {
      const a0 = (i / 8) * Math.PI * 2;
      const a1 = ((i + 1) / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(0, 0, rOuter, a0, a1);
      ctx.arc(0, 0, rInner, a1, a0, true);
      ctx.closePath();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = colors[i];
      ctx.fill();
    }
    // outer + inner ring strokes
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = '#f4ecd6'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, rOuter, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, rInner, 0, Math.PI * 2); ctx.stroke();
    // 8 spokes only across the ring (not center)
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * rInner, Math.sin(a) * rInner);
      ctx.lineTo(Math.cos(a) * rOuter, Math.sin(a) * rOuter);
      ctx.stroke();
    }
    ctx.restore();

    // Candles flanking the chapel
    drawCandle(W * 0.18, H * 0.6);
    drawCandle(W * 0.82, H * 0.6);
    drawCandle(W * 0.12, H * 0.66, 0.85);
    drawCandle(W * 0.88, H * 0.66, 0.85);
  }

  function drawCandle(x, y, scale) {
    scale = scale || 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    // wax body
    ctx.fillStyle = '#f4ecd6';
    ctx.fillRect(-6, 0, 12, 70);
    ctx.fillStyle = '#cbb990';
    ctx.fillRect(-6, 0, 12, 4);
    // flame
    const flicker = 1 + Math.sin(G.time * 7 + x) * 0.12;
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.moveTo(0, -2);
    ctx.quadraticCurveTo(-6, -10, 0, -22 * flicker);
    ctx.quadraticCurveTo(6, -10, 0, -2);
    ctx.fill();
    ctx.fillStyle = '#ff8a1f';
    ctx.beginPath();
    ctx.moveTo(0, -2);
    ctx.quadraticCurveTo(-3, -6, 0, -13 * flicker);
    ctx.quadraticCurveTo(3, -6, 0, -2);
    ctx.fill();
    // glow
    const gg = ctx.createRadialGradient(0, -10, 4, 0, -10, 80);
    gg.addColorStop(0, 'rgba(255, 209, 102, 0.55)');
    gg.addColorStop(1, 'rgba(255, 209, 102, 0)');
    ctx.fillStyle = gg; ctx.fillRect(-90, -90, 180, 180);
    ctx.restore();
  }

  function paintCanyon() {
    const W = cv.width, H = cv.height;
    // Blood moon
    const mx = W * 0.5, my = H * 0.28;
    ctx.save();
    const moonGlow = ctx.createRadialGradient(mx, my, 30, mx, my, 350);
    moonGlow.addColorStop(0, 'rgba(255, 120, 90, 0.6)');
    moonGlow.addColorStop(1, 'rgba(80, 20, 20, 0)');
    ctx.fillStyle = moonGlow; ctx.fillRect(0, 0, W, H);
    // moon disk with craters
    const moonGrad = ctx.createRadialGradient(mx - 20, my - 20, 5, mx, my, 90);
    moonGrad.addColorStop(0, '#ffd0a5');
    moonGrad.addColorStop(1, '#c44a3a');
    ctx.fillStyle = moonGrad;
    ctx.beginPath(); ctx.arc(mx, my, 90, 0, Math.PI * 2); ctx.fill();
    // craters
    ctx.fillStyle = 'rgba(140, 50, 40, 0.5)';
    [[mx - 30, my - 20, 12], [mx + 20, my + 8, 9], [mx + 10, my - 40, 6], [mx - 14, my + 30, 7]].forEach(c => {
      ctx.beginPath(); ctx.arc(c[0], c[1], c[2], 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();

    // Layered jagged cliffs left + right
    ctx.save();
    const layers = [
      { col: 'rgba(50,18,15,0.95)', shift: 0, scale: 1 },
      { col: 'rgba(85,30,22,0.95)', shift: 80, scale: 0.85 },
      { col: 'rgba(125,45,32,0.95)', shift: 160, scale: 0.7 },
    ];
    for (const L of layers) {
      ctx.fillStyle = L.col;
      // left cliff
      ctx.beginPath();
      ctx.moveTo(0, H * 0.66);
      ctx.lineTo(0, H * 0.4 + L.shift);
      const pointsL = [80, 160, 220, 280, 320, 380, 440, 500];
      const heightsL = [60, -30, 20, -50, 40, -30, 25, 35];
      for (let i = 0; i < pointsL.length; i++) {
        ctx.lineTo(pointsL[i] * L.scale, (H * 0.4 + L.shift + heightsL[i]));
      }
      ctx.lineTo(540 * L.scale, H * 0.66);
      ctx.closePath(); ctx.fill();
      // right cliff (mirrored)
      ctx.beginPath();
      ctx.moveTo(W, H * 0.66);
      ctx.lineTo(W, H * 0.4 + L.shift);
      for (let i = 0; i < pointsL.length; i++) {
        ctx.lineTo(W - pointsL[i] * L.scale, (H * 0.4 + L.shift + heightsL[i]));
      }
      ctx.lineTo(W - 540 * L.scale, H * 0.66);
      ctx.closePath(); ctx.fill();
    }
    // cactus silhouettes
    drawCactus(W * 0.12, H * 0.67, 0.9);
    drawCactus(W * 0.88, H * 0.67, 0.9);
    drawCactus(W * 0.22, H * 0.70, 0.6);
    drawCactus(W * 0.78, H * 0.70, 0.6);
    ctx.restore();
  }
  function drawCactus(x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = '#0d0612';
    // main trunk
    ctx.beginPath();
    ctx.rect(-7, -90, 14, 90);
    ctx.fill();
    // arms
    ctx.beginPath();
    ctx.rect(-7, -60, -24, 14);
    ctx.fill();
    ctx.beginPath(); ctx.rect(-31, -60, 14, -22); ctx.fill();
    ctx.beginPath(); ctx.rect(7, -45, 24, 14); ctx.fill();
    ctx.beginPath(); ctx.rect(17, -45, 14, -22); ctx.fill();
    // spines (small dots)
    ctx.fillStyle = '#4a2a0d';
    for (let i = 0; i < 8; i++) ctx.fillRect(-5 + (i % 2) * 8, -90 + i * 10, 2, 2);
    ctx.restore();
  }

  function paintCemetery() {
    const W = cv.width, H = cv.height;
    // Big moon
    const mx = W * 0.5, my = H * 0.30;
    ctx.save();
    const halo = ctx.createRadialGradient(mx, my, 10, mx, my, 320);
    halo.addColorStop(0, 'rgba(220, 170, 255, 0.55)');
    halo.addColorStop(1, 'rgba(80, 20, 100, 0)');
    ctx.fillStyle = halo; ctx.fillRect(0, 0, W, H);
    const moon = ctx.createRadialGradient(mx - 16, my - 16, 5, mx, my, 70);
    moon.addColorStop(0, '#f3e7ff');
    moon.addColorStop(1, '#a685d6');
    ctx.fillStyle = moon;
    ctx.beginPath(); ctx.arc(mx, my, 70, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // Wrought-iron gate silhouette behind ghost
    ctx.save();
    ctx.strokeStyle = '#0a0612'; ctx.lineWidth = 4;
    for (let i = -3; i <= 3; i++) {
      const x = W * 0.5 + i * 40;
      ctx.beginPath();
      ctx.moveTo(x, H * 0.36);
      ctx.lineTo(x, H * 0.62);
      ctx.stroke();
      // spear tip
      ctx.beginPath();
      ctx.moveTo(x - 6, H * 0.36);
      ctx.lineTo(x, H * 0.34);
      ctx.lineTo(x + 6, H * 0.36);
      ctx.fillStyle = '#0a0612'; ctx.fill();
    }
    // top rail
    ctx.beginPath();
    ctx.moveTo(W * 0.5 - 130, H * 0.39);
    ctx.lineTo(W * 0.5 + 130, H * 0.39);
    ctx.stroke();
    ctx.restore();

    // Tombstones
    drawTombstone(W * 0.16, H * 0.68, 1.0);
    drawTombstone(W * 0.30, H * 0.71, 0.7);
    drawTombstone(W * 0.84, H * 0.68, 1.0);
    drawTombstone(W * 0.70, H * 0.71, 0.7);
    // Marigold path
    ctx.save();
    for (let i = 0; i < 22; i++) {
      const tt = i / 22;
      const px = W * 0.5 + Math.sin(i * 0.6) * 40;
      const py = H * 0.7 + tt * H * 0.22;
      ctx.fillStyle = i % 2 ? '#ff8a1f' : '#ffb347';
      ctx.beginPath(); ctx.arc(px, py, 6 - tt * 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e9c46a';
      ctx.beginPath(); ctx.arc(px, py, 3 - tt * 1.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    // Fog at bottom
    ctx.save();
    const fog = ctx.createLinearGradient(0, H * 0.72, 0, H);
    fog.addColorStop(0, 'rgba(220, 180, 240, 0)');
    fog.addColorStop(0.5, 'rgba(220, 180, 240, 0.25)');
    fog.addColorStop(1, 'rgba(220, 180, 240, 0.45)');
    ctx.fillStyle = fog; ctx.fillRect(0, H * 0.72, W, H * 0.28);
    ctx.restore();
  }
  function drawTombstone(x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = '#1a0f24';
    ctx.beginPath();
    ctx.moveTo(-26, 0);
    ctx.lineTo(-26, -50);
    ctx.quadraticCurveTo(-26, -78, 0, -78);
    ctx.quadraticCurveTo(26, -78, 26, -50);
    ctx.lineTo(26, 0);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#3a2a48';
    ctx.fillRect(-18, -52, 36, 4);
    // RIP
    ctx.fillStyle = '#5a4a68';
    ctx.font = 'bold 11px Georgia';
    ctx.textAlign = 'center';
    ctx.fillText('R.I.P.', 0, -38);
    // small marigold
    ctx.fillStyle = '#ff8a1f';
    ctx.beginPath(); ctx.arc(0, -8, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawStars(count) {
    ctx.save();
    for (let i = 0; i < count; i++) {
      const x = (i * 97) % cv.width;
      const y = (i * 53) % (cv.height * 0.52);
      const a = 0.32 + 0.68 * Math.abs(Math.sin(G.time * 0.7 + i));
      ctx.globalAlpha = a * 0.75;
      ctx.fillStyle = (i % 7 === 0) ? '#ffd29c' : '#fff7e6';
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.restore();
  }

  function drawPapelPicado() {
    const W = cv.width;
    const rows = [
      { y: 78, colors: ['#d6266b', '#e9c46a', '#1f3a8a', '#ff8a1f', '#ff5ea0'] },
      { y: 128, colors: ['#ff8a1f', '#1f3a8a', '#d6266b', '#ffb347', '#e9c46a'] },
    ];
    rows.forEach(row => {
      ctx.save();
      ctx.strokeStyle = 'rgba(20,8,28,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 20) {
        const sag = 10 * Math.sin(x * 0.01);
        if (x === 0) ctx.moveTo(0, row.y + sag);
        else ctx.lineTo(x, row.y + sag);
      }
      ctx.stroke();
      const flagW = 56;
      for (let i = 0, x = 10; x < W; i++, x += flagW + 8) {
        const sag = 10 * Math.sin(x * 0.01);
        const color = row.colors[i % row.colors.length];
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.92;
        ctx.beginPath();
        ctx.moveTo(x, row.y + sag);
        ctx.lineTo(x + flagW, row.y + sag);
        ctx.lineTo(x + flagW - 6, row.y + sag + 36);
        ctx.lineTo(x + 6, row.y + sag + 36);
        ctx.closePath(); ctx.fill();
        ctx.globalCompositeOperation = 'destination-out';
        for (let h = 0; h < 3; h++) for (let v = 0; v < 2; v++) {
          ctx.beginPath();
          ctx.arc(x + 12 + h * 16, row.y + sag + 10 + v * 12, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.beginPath();
        ctx.moveTo(x + flagW / 2, row.y + sag + 6);
        ctx.lineTo(x + flagW / 2 + 6, row.y + sag + 18);
        ctx.lineTo(x + flagW / 2, row.y + sag + 30);
        ctx.lineTo(x + flagW / 2 - 6, row.y + sag + 18);
        ctx.closePath(); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.restore();
    });
  }

  function drawTownSilhouette() {
    const W = cv.width, H = cv.height;
    const baseY = H * 0.76;
    ctx.save();
    ctx.fillStyle = 'rgba(8, 4, 16, 0.96)';
    ctx.beginPath();
    ctx.moveTo(0, H); ctx.lineTo(0, baseY);
    let x = 0, i = 0;
    while (x < W) {
      const seed = Math.sin(x * 0.013) * 0.5 + 0.5;
      const h = 40 + seed * 90;
      const w = 50 + ((i * 37) % 30);
      ctx.lineTo(x, baseY - h);
      ctx.lineTo(x + w * 0.4, baseY - h);
      ctx.lineTo(x + w * 0.4, baseY - h * 0.6);
      ctx.lineTo(x + w, baseY - h * 0.8);
      ctx.lineTo(x + w, baseY);
      x += w; i++;
    }
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
    // lit windows
    ctx.fillStyle = 'rgba(255,180,71,0.5)';
    for (let k = 0; k < 50; k++) {
      const wx = 30 + k * 26;
      const wy = baseY - 30 - (k % 4) * 22;
      if (Math.sin(k * 1.7) > 0.2) ctx.fillRect(wx, wy, 6, 8);
    }
    ctx.restore();
  }

  // ============================================================
  // Scene particles (rose petals / dust / marigold petals)
  // ============================================================
  function updateSceneParticles(dt) {
    // Maintain pool size
    const target = G.level.scene === 'chapel' ? 18 : G.level.scene === 'canyon' ? 22 : 26;
    while (G.sceneParticles.length < target) spawnSceneParticle();
    for (const p of G.sceneParticles) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.life -= dt;
      p.rot += p.spin * dt;
      // wrap
      if (p.y > cv.height + 30 || p.life <= 0) {
        Object.assign(p, makeSceneParticle());
      }
    }
  }
  function spawnSceneParticle() {
    G.sceneParticles.push(makeSceneParticle());
  }
  function makeSceneParticle() {
    const sc = G.level.scene;
    if (sc === 'chapel') {
      // White / pink rose petals falling slow
      return {
        x: Math.random() * cv.width, y: -20 - Math.random() * cv.height,
        vx: -10 + Math.random() * 20, vy: 25 + Math.random() * 25,
        life: 10 + Math.random() * 10, rot: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 1.4,
        size: 4 + Math.random() * 3,
        color: Math.random() < 0.5 ? '#ffd9e6' : '#fff7e6',
        kind: 'petal',
      };
    } else if (sc === 'canyon') {
      // Dust motes drifting horizontally
      return {
        x: Math.random() * cv.width, y: cv.height * 0.3 + Math.random() * cv.height * 0.5,
        vx: 20 + Math.random() * 25, vy: -8 + Math.random() * 16,
        life: 5 + Math.random() * 6, rot: 0, spin: 0,
        size: 1.4 + Math.random() * 1.6,
        color: 'rgba(255, 160, 100, 0.55)',
        kind: 'dust',
      };
    } else {
      // Marigold petals + soul wisps
      return {
        x: Math.random() * cv.width, y: -20 - Math.random() * cv.height,
        vx: -20 + Math.random() * 40, vy: 30 + Math.random() * 40,
        life: 10 + Math.random() * 10, rot: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 2.2,
        size: 4 + Math.random() * 4,
        color: ['#ff8a1f', '#ffb347', '#e9c46a', '#ff5ea0'][Math.floor(Math.random() * 4)],
        kind: 'marigold',
      };
    }
  }
  function drawSceneParticles() {
    ctx.save();
    for (const p of G.sceneParticles) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.kind === 'dust') {
        ctx.globalAlpha = 0.7;
        ctx.beginPath(); ctx.arc(0, 0, p.size, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  // ============================================================
  // Ghost drawing — three distinct silhouettes
  // ============================================================
  function drawGhost(lvl) {
    const W = cv.width;
    const id = lvl.id;
    G.ghostBob = (G.ghostBob || 0) + 0.025;
    let cx = W / 2;
    let cy = 410 + Math.sin(G.ghostBob) * 10;
    if (G.ghostShake > 0) {
      cx += (Math.random() - 0.5) * 18 * G.ghostShake;
      cy += (Math.random() - 0.5) * 12 * G.ghostShake;
    }
    const flinch = G.ghostFlinch;
    const scale = 1 - flinch * 0.07;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    // Aura ring (pulses with combo)
    const auraR = 240 + (G.combo > 0 ? 24 * Math.sin(G.time * 6) : 0);
    const aura = ctx.createRadialGradient(0, -10, 30, 0, -10, auraR);
    const hue = G.combo >= 16 ? 'rgba(255, 220, 130, 0.55)' :
                G.combo >= 8 ? 'rgba(255, 200, 130, 0.45)' :
                'rgba(255, 255, 255, 0.28)';
    aura.addColorStop(0, hue);
    aura.addColorStop(0.4, 'rgba(180, 200, 255, 0.14)');
    aura.addColorStop(1, 'rgba(80, 100, 200, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath(); ctx.arc(0, -10, auraR, 0, Math.PI * 2); ctx.fill();

    if (id === 'novia') drawNovia(flinch);
    else if (id === 'bandido') drawBandido(flinch);
    else drawCatrina(flinch);

    ctx.restore();

    // Ghost name banner (top of screen)
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, W, 60);
    ctx.fillStyle = '#fff7e6';
    ctx.font = 'bold 26px "Georgia", serif';
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillText(lvl.name, 24, 32);
    const nameW = ctx.measureText(lvl.name).width;
    ctx.fillStyle = '#e9c46a';
    ctx.font = 'italic 16px "Georgia", serif';
    ctx.fillText(' · ' + lvl.subtitle, 24 + nameW, 33);
    ctx.fillStyle = '#fff7e6';
    ctx.font = 'bold 14px "Georgia", serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Duel ${G.levelIdx + 1} / ${LEVELS.length}`, W / 2, 30);
    ctx.restore();
  }

  // ---- La Novia: tall bridal silhouette w/ veil ---------------
  function drawNovia(flinch) {
    const t = G.time;
    // Trailing veil (large translucent triangle behind)
    ctx.save();
    ctx.globalAlpha = 0.6;
    const veil = ctx.createLinearGradient(0, -120, 0, 220);
    veil.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
    veil.addColorStop(1, 'rgba(255, 240, 250, 0)');
    ctx.fillStyle = veil;
    ctx.beginPath();
    ctx.moveTo(-110, 250);
    ctx.quadraticCurveTo(-130, 0, -50, -110);
    ctx.quadraticCurveTo(0, -150, 50, -110);
    ctx.quadraticCurveTo(130, 0, 110, 250);
    // Lace bottom edge
    for (let i = 0; i < 10; i++) {
      const x = 110 - (i * 22);
      const y = 250 + (i % 2 ? 8 : -2);
      ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fill();
    ctx.restore();

    // Dress body — slimmer than default ghost
    ctx.globalAlpha = 0.94;
    const body = ctx.createRadialGradient(0, -30, 10, 0, -30, 150);
    body.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
    body.addColorStop(0.6, 'rgba(255, 240, 250, 0.78)');
    body.addColorStop(1, 'rgba(220, 200, 230, 0)');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(-58, 80);
    ctx.quadraticCurveTo(-78, -10, -50, -70);
    ctx.quadraticCurveTo(0, -110, 50, -70);
    ctx.quadraticCurveTo(78, -10, 58, 80);
    // Cinched waist effect with curved hem
    for (let i = 0; i < 6; i++) {
      const xpos = 58 - (i + 1) * (116 / 6);
      const py = 80 + (i % 2 ? 18 : 4) * Math.sin(t * 1.6 + i);
      ctx.lineTo(xpos, py);
    }
    ctx.closePath(); ctx.fill();

    // Skull face — narrower
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff7e6';
    ctx.beginPath(); ctx.ellipse(0, -38, 42, 56, 0, 0, Math.PI * 2); ctx.fill();
    // Eye flowers (pink petals around dark socket)
    ctx.fillStyle = '#ffd9e6';
    for (let s = -1; s <= 1; s += 2) {
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3;
        ctx.beginPath();
        ctx.arc(s * 20 + Math.cos(a) * 8, -44 + Math.sin(a) * 8, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Eye sockets — small heart-shapes (the rose-petal motif)
    ctx.fillStyle = '#5a1a3a';
    drawHeart(-20, -44, 5);
    drawHeart(20, -44, 5);
    // Nose (small triangle/diamond)
    ctx.beginPath();
    ctx.moveTo(-4, -16); ctx.lineTo(4, -16); ctx.lineTo(0, -8); ctx.closePath(); ctx.fill();
    // Grin (delicate)
    ctx.strokeStyle = '#5a1a3a'; ctx.lineWidth = 2.4;
    const gy = flinch > 0.2 ? 4 : 0;
    ctx.beginPath();
    ctx.moveTo(-22, gy);
    for (let i = 0; i < 12; i++) ctx.lineTo(-20 + i * 4.2, gy + (i % 2 ? 3 : -3));
    ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { ctx.moveTo(-12 + i * 5, gy); ctx.lineTo(-12 + i * 5, gy + 5); }
    ctx.stroke();

    // Bridal crown of small white flowers + lace veil top
    for (let i = 0; i < 11; i++) {
      const a = -Math.PI + i * (Math.PI / 10);
      const rx = Math.cos(a) * 48;
      const ry = Math.sin(a) * 30 - 84;
      ctx.fillStyle = '#fff7e6';
      ctx.beginPath(); ctx.arc(rx, ry, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd9e6';
      ctx.beginPath(); ctx.arc(rx, ry, 3, 0, Math.PI * 2); ctx.fill();
    }
    // long veil flowing back
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#fff7e6';
    ctx.beginPath();
    ctx.moveTo(-44, -86);
    ctx.quadraticCurveTo(-100, -40, -78, 60);
    ctx.lineTo(-58, 60);
    ctx.quadraticCurveTo(-70, -10, -34, -78);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(44, -86);
    ctx.quadraticCurveTo(100, -40, 78, 60);
    ctx.lineTo(58, 60);
    ctx.quadraticCurveTo(70, -10, 34, -78);
    ctx.closePath(); ctx.fill();
    ctx.restore();

    // Bouquet of dead roses in her hands
    ctx.save();
    ctx.translate(0, 70);
    ctx.fillStyle = '#5a1a3a';
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc((i - 2) * 8, -i % 2 * 4, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#3a0d22';
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc((i - 2) * 8, -i % 2 * 4, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // wrap
    ctx.fillStyle = '#cbb990';
    ctx.fillRect(-14, 0, 28, 10);
    ctx.restore();
  }
  function drawHeart(cx, cy, size) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + size * 0.6);
    ctx.bezierCurveTo(cx + size, cy, cx + size, cy - size * 0.8, cx, cy - size * 0.2);
    ctx.bezierCurveTo(cx - size, cy - size * 0.8, cx - size, cy, cx, cy + size * 0.6);
    ctx.closePath();
    ctx.fill();
  }

  // ---- El Bandido: sombrero + mustache + bandoliers ----------
  function drawBandido(flinch) {
    const t = G.time;
    // Body — more solid, browner
    ctx.globalAlpha = 0.95;
    const body = ctx.createRadialGradient(0, -10, 10, 0, -10, 150);
    body.addColorStop(0, 'rgba(220, 200, 175, 0.95)');
    body.addColorStop(0.6, 'rgba(150, 110, 80, 0.75)');
    body.addColorStop(1, 'rgba(80, 50, 30, 0)');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(-86, 70);
    ctx.quadraticCurveTo(-120, -20, -72, -88);
    ctx.quadraticCurveTo(0, -130, 72, -88);
    ctx.quadraticCurveTo(120, -20, 86, 70);
    // wavy hem
    for (let i = 0; i < 8; i++) {
      const xpos = 86 - (i + 1) * (172 / 8);
      const py = 70 + (i % 2 ? 22 : 6) * Math.sin(t * 2 + i);
      ctx.lineTo(xpos, py);
    }
    ctx.closePath(); ctx.fill();

    // Poncho stripes across the body
    ctx.globalAlpha = 0.8;
    const stripes = ['#d6266b', '#ff8a1f', '#1f3a8a', '#e9c46a'];
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-80, 70);
    ctx.lineTo(80, 70);
    ctx.lineTo(70, -10);
    ctx.lineTo(-70, -10);
    ctx.closePath();
    ctx.clip();
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = stripes[i];
      ctx.fillRect(-90, -10 + i * 20, 180, 14);
    }
    ctx.restore();
    ctx.globalAlpha = 1;

    // Bandoliers — X across chest
    ctx.save();
    ctx.strokeStyle = '#3a2a14';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(-58, -34); ctx.lineTo(58, 22);
    ctx.moveTo(58, -34); ctx.lineTo(-58, 22);
    ctx.stroke();
    // bullet rectangles
    ctx.fillStyle = '#e9c46a';
    for (let i = 0; i < 10; i++) {
      const tt = i / 10;
      const x1 = -58 + tt * 116, y1 = -34 + tt * 56;
      const x2 = 58 - tt * 116, y2 = -34 + tt * 56;
      const ang1 = Math.atan2(22 - (-34), 58 - (-58));
      const ang2 = Math.atan2(22 - (-34), -58 - 58);
      ctx.save(); ctx.translate(x1, y1); ctx.rotate(ang1); ctx.fillRect(-3, -5, 6, 10); ctx.restore();
      ctx.save(); ctx.translate(x2, y2); ctx.rotate(ang2); ctx.fillRect(-3, -5, 6, 10); ctx.restore();
    }
    ctx.restore();

    // Skull face — slightly wider
    ctx.fillStyle = '#fff7e6';
    ctx.beginPath(); ctx.ellipse(0, -40, 50, 56, 0, 0, Math.PI * 2); ctx.fill();
    // Eyes — round, plain skull
    ctx.fillStyle = '#2a0530';
    ctx.beginPath(); ctx.arc(-18, -46, 10, 0, Math.PI * 2); ctx.arc(18, -46, 10, 0, Math.PI * 2); ctx.fill();
    // tiny gold tooth glint in left eye
    ctx.fillStyle = '#e9c46a';
    ctx.beginPath(); ctx.arc(-21, -49, 2.5, 0, Math.PI * 2); ctx.fill();

    // Nose
    ctx.fillStyle = '#2a0530';
    ctx.beginPath(); ctx.moveTo(-5, -18); ctx.lineTo(5, -18); ctx.lineTo(0, -8); ctx.closePath(); ctx.fill();

    // MUSTACHE — the defining feature, big drooping curves under nose
    ctx.fillStyle = '#1a0a06';
    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.bezierCurveTo(-10, -2, -28, 8, -40, 22);
    ctx.bezierCurveTo(-44, 28, -36, 32, -32, 26);
    ctx.bezierCurveTo(-26, 18, -16, 10, -6, 6);
    ctx.bezierCurveTo(-2, 6, 0, 4, 0, -4);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.bezierCurveTo(10, -2, 28, 8, 40, 22);
    ctx.bezierCurveTo(44, 28, 36, 32, 32, 26);
    ctx.bezierCurveTo(26, 18, 16, 10, 6, 6);
    ctx.bezierCurveTo(2, 6, 0, 4, 0, -4);
    ctx.fill();

    // Grin teeth (small, partially hidden by mustache)
    ctx.strokeStyle = '#2a0530'; ctx.lineWidth = 2.4;
    const gy = flinch > 0.2 ? 8 : 4;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) { ctx.moveTo(-10 + i * 7, gy); ctx.lineTo(-10 + i * 7, gy + 6); }
    ctx.stroke();

    // SOMBRERO — wide-brimmed black hat with silver/gold trim
    ctx.save();
    ctx.fillStyle = '#1a0a06';
    // brim ellipse
    ctx.beginPath(); ctx.ellipse(0, -88, 130, 22, 0, 0, Math.PI * 2); ctx.fill();
    // crown
    ctx.beginPath();
    ctx.moveTo(-46, -90);
    ctx.lineTo(-40, -130);
    ctx.quadraticCurveTo(0, -148, 40, -130);
    ctx.lineTo(46, -90);
    ctx.closePath();
    ctx.fill();
    // gold trim
    ctx.strokeStyle = '#e9c46a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, -88, 130, 22, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-46, -90); ctx.lineTo(46, -90); ctx.stroke();
    // hat band
    ctx.fillStyle = '#3a2a14';
    ctx.fillRect(-44, -94, 88, 6);
    // medallion
    ctx.fillStyle = '#e9c46a';
    ctx.beginPath(); ctx.arc(0, -91, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // Cigarillo glow at mouth edge (small orange dot that pulses)
    const ember = 0.7 + 0.3 * Math.sin(G.time * 4);
    ctx.fillStyle = `rgba(255, 138, 31, ${ember})`;
    ctx.beginPath(); ctx.arc(36, 14, 3, 0, Math.PI * 2); ctx.fill();
    // smoke wisp
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#f4ecd6'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(36, 12);
    ctx.quadraticCurveTo(40, 0, 36, -20);
    ctx.quadraticCurveTo(32, -34, 40, -52);
    ctx.stroke();
    ctx.restore();
  }

  // ---- La Catrina: tall feathered hat, elaborate skull --------
  function drawCatrina(flinch) {
    const t = G.time;

    // Elegant elongated body — gown
    ctx.globalAlpha = 0.95;
    const body = ctx.createRadialGradient(0, -10, 10, 0, -10, 180);
    body.addColorStop(0, 'rgba(255, 240, 250, 0.95)');
    body.addColorStop(0.5, 'rgba(220, 180, 240, 0.75)');
    body.addColorStop(1, 'rgba(150, 80, 180, 0)');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(-50, 90);
    ctx.quadraticCurveTo(-100, 30, -56, -50);     // hip flare
    ctx.quadraticCurveTo(-30, -90, -42, -120);    // narrow at shoulders
    ctx.quadraticCurveTo(0, -150, 42, -120);
    ctx.quadraticCurveTo(30, -90, 56, -50);
    ctx.quadraticCurveTo(100, 30, 50, 90);
    // wavy hem
    for (let i = 0; i < 7; i++) {
      const xpos = 50 - (i + 1) * (100 / 7);
      const py = 90 + (i % 2 ? 20 : 4) * Math.sin(t * 1.8 + i);
      ctx.lineTo(xpos, py);
    }
    ctx.closePath(); ctx.fill();

    // Lace high collar (fan-shaped at neck)
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#f4ecd6';
    ctx.beginPath();
    ctx.moveTo(-44, -90);
    ctx.quadraticCurveTo(-55, -118, -36, -130);
    ctx.lineTo(36, -130);
    ctx.quadraticCurveTo(55, -118, 44, -90);
    ctx.lineTo(20, -84);
    ctx.lineTo(0, -90);
    ctx.lineTo(-20, -84);
    ctx.closePath();
    ctx.fill();
    // collar lace pattern
    ctx.strokeStyle = '#d6a0c5'; ctx.lineWidth = 1.4;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 9, -130);
      ctx.lineTo(i * 7, -90);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;

    // Skull face — slightly larger oval
    ctx.fillStyle = '#fff7e6';
    ctx.beginPath(); ctx.ellipse(0, -48, 48, 60, 0, 0, Math.PI * 2); ctx.fill();
    // Elaborate floral eye sockets — large flowers
    drawFlowerEye(-20, -54, '#ff5ea0', '#7a4dc7', '#ffd166');
    drawFlowerEye(20, -54, '#ff5ea0', '#7a4dc7', '#ffd166');
    // Cheek swirls
    ctx.strokeStyle = '#7a4dc7'; ctx.lineWidth = 2;
    for (let s = -1; s <= 1; s += 2) {
      ctx.beginPath();
      ctx.moveTo(s * 30, -30);
      ctx.quadraticCurveTo(s * 38, -20, s * 30, -10);
      ctx.quadraticCurveTo(s * 24, -2, s * 30, 6);
      ctx.stroke();
    }
    // forehead ornament — small rose at top center
    ctx.fillStyle = '#d6266b';
    ctx.beginPath(); ctx.arc(0, -82, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff8a1f';
    ctx.beginPath(); ctx.arc(0, -82, 3, 0, Math.PI * 2); ctx.fill();
    // Nose — heart/diamond
    ctx.fillStyle = '#2a0530';
    ctx.beginPath();
    ctx.moveTo(-5, -22); ctx.lineTo(0, -12); ctx.lineTo(5, -22); ctx.lineTo(0, -28);
    ctx.closePath(); ctx.fill();
    // Grin
    ctx.strokeStyle = '#2a0530'; ctx.lineWidth = 2.6;
    const gy = flinch > 0.2 ? 6 : 0;
    ctx.beginPath();
    ctx.moveTo(-26, gy);
    for (let i = 0; i < 12; i++) ctx.lineTo(-24 + i * 4.6, gy + (i % 2 ? 4 : -4));
    ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < 7; i++) { ctx.moveTo(-14 + i * 5, gy); ctx.lineTo(-14 + i * 5, gy + 6); }
    ctx.stroke();

    // HAT — tall ornate with feathers and roses
    ctx.save();
    // Hat band base
    ctx.fillStyle = '#2a0530';
    ctx.beginPath();
    ctx.ellipse(0, -110, 70, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    // Tall hat dome
    ctx.fillStyle = '#1a0628';
    ctx.beginPath();
    ctx.moveTo(-44, -110);
    ctx.quadraticCurveTo(-58, -148, -34, -180);
    ctx.quadraticCurveTo(0, -198, 34, -180);
    ctx.quadraticCurveTo(58, -148, 44, -110);
    ctx.closePath(); ctx.fill();
    // Hat band
    ctx.fillStyle = '#7a4dc7';
    ctx.fillRect(-44, -120, 88, 10);
    // Roses on hat
    const roses = [{ x: -34, y: -180, r: 12, c: '#d6266b' }, { x: 0, y: -198, r: 14, c: '#ff5ea0' }, { x: 34, y: -180, r: 12, c: '#7a4dc7' }];
    for (const ro of roses) {
      ctx.fillStyle = ro.c;
      ctx.beginPath(); ctx.arc(ro.x, ro.y, ro.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd166';
      ctx.beginPath(); ctx.arc(ro.x, ro.y, ro.r * 0.4, 0, Math.PI * 2); ctx.fill();
    }
    // Feathers — long curved strokes
    ctx.strokeStyle = '#e9c46a'; ctx.lineWidth = 3;
    const feathers = [
      { ax: -10, ay: -198, bx: -70, by: -226 },
      { ax: 10, ay: -198, bx: 70, by: -236 },
      { ax: 0, ay: -200, bx: -6, by: -252 },
      { ax: -16, ay: -194, bx: -96, by: -206 },
      { ax: 16, ay: -194, bx: 96, by: -212 },
    ];
    for (const f of feathers) {
      // feather shaft
      ctx.beginPath();
      ctx.moveTo(f.ax, f.ay);
      ctx.quadraticCurveTo((f.ax + f.bx) / 2 + 10, (f.ay + f.by) / 2, f.bx, f.by);
      ctx.stroke();
      // small barbs (perpendicular tufts)
      ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 1.4;
      for (let s = 0.2; s < 1; s += 0.18) {
        const px = f.ax + (f.bx - f.ax) * s + 10 * (0.5 - s);
        const py = f.ay + (f.by - f.ay) * s;
        const dx = (f.bx - f.ax) / 5, dy = (f.by - f.ay) / 5;
        // tangent perpendicular for barb
        ctx.beginPath();
        ctx.moveTo(px - dy * 0.1, py + dx * 0.1);
        ctx.lineTo(px + dy * 0.1 + 6, py - dx * 0.1 + 4);
        ctx.stroke();
      }
      ctx.strokeStyle = '#e9c46a'; ctx.lineWidth = 3;
    }
    ctx.restore();

    // Skeletal hand holding marigold beside body
    ctx.save();
    ctx.translate(-66, 30);
    ctx.fillStyle = '#fff7e6';
    // tiny phalanges (3 dots)
    ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(-6, -6, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(6, -6, 3.5, 0, Math.PI * 2); ctx.fill();
    // marigold
    ctx.fillStyle = '#ff8a1f';
    ctx.beginPath(); ctx.arc(0, -16, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffb347';
    ctx.beginPath(); ctx.arc(0, -16, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function drawFlowerEye(cx, cy, petal, ring, center) {
    // petals around socket
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = petal;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.save();
      ctx.rotate(a);
      ctx.beginPath();
      ctx.ellipse(0, -14, 4.5, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // outer ring stroke
    ctx.strokeStyle = ring; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.stroke();
    // socket
    ctx.fillStyle = '#2a0530';
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
    // tiny center light
    ctx.fillStyle = center;
    ctx.beginPath(); ctx.arc(2, -2, 2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // ============================================================
  // Lanes / notes / HUD
  // ============================================================
  function drawLanes() {
    const W = cv.width, H = cv.height;
    const hY = hitY();
    const laneW = (lanesRight() - lanesLeft()) / 3;
    const left = lanesLeft();
    const top = 240;
    const bottom = H - 40;

    ctx.save();
    // Lane wells
    for (let i = 0; i < 3; i++) {
      const x = left + i * laneW;
      const baseAlpha = 0.32 + Input.laneFlash[i] * 0.4;
      ctx.fillStyle = `rgba(15, 8, 26, ${baseAlpha})`;
      ctx.fillRect(x, top, laneW - 4, bottom - top);
      // colored side glow
      const sg = ctx.createLinearGradient(x, top, x + laneW, top);
      sg.addColorStop(0, `rgba(${hexToRgb(LANE_COLORS[i])}, ${0.08 + Input.laneFlash[i] * 0.3})`);
      sg.addColorStop(0.5, 'rgba(0,0,0,0)');
      sg.addColorStop(1, `rgba(${hexToRgb(LANE_COLORS[i])}, ${0.08 + Input.laneFlash[i] * 0.3})`);
      ctx.fillStyle = sg;
      ctx.fillRect(x, top, laneW - 4, bottom - top);
    }
    // Borders
    ctx.strokeStyle = 'rgba(233, 196, 106, 0.45)';
    ctx.lineWidth = 2;
    ctx.strokeRect(left, top, laneW * 3 - 4, bottom - top);
    // Lane separators
    ctx.strokeStyle = 'rgba(233, 196, 106, 0.2)';
    ctx.lineWidth = 1.5;
    for (let i = 1; i < 3; i++) {
      const x = left + i * laneW;
      ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
    }

    // Hit line — rich glowing strip
    ctx.save();
    const gradLine = ctx.createLinearGradient(left, hY, left + laneW * 3, hY);
    gradLine.addColorStop(0, LANE_COLORS[0]);
    gradLine.addColorStop(0.5, '#e9c46a');
    gradLine.addColorStop(1, LANE_COLORS[2]);
    ctx.strokeStyle = gradLine; ctx.lineWidth = 5;
    ctx.shadowColor = '#ffd166'; ctx.shadowBlur = 20;
    ctx.beginPath(); ctx.moveTo(left, hY); ctx.lineTo(left + laneW * 3, hY); ctx.stroke();
    ctx.restore();

    // Key buttons (with ring animation on hit)
    const keys = ['A', 'S', 'D'];
    for (let i = 0; i < 3; i++) {
      const cx = left + (i + 0.5) * laneW - 2;
      const lit = Input.laneFlash[i] > 0.05 || Input.keys[keys[i].toLowerCase()];
      // Outer hit ring (expanding on success)
      if (G.laneRing[i] > 0) {
        const ringR = 42 + (1 - G.laneRing[i]) * 50;
        ctx.save();
        ctx.globalAlpha = G.laneRing[i];
        ctx.strokeStyle = LANE_COLORS[i];
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(cx, hY, ringR, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
      // Glow halo when lit
      if (lit) {
        const hg = ctx.createRadialGradient(cx, hY, 10, cx, hY, 90);
        hg.addColorStop(0, `rgba(${hexToRgb(LANE_COLORS[i])}, 0.5)`);
        hg.addColorStop(1, `rgba(${hexToRgb(LANE_COLORS[i])}, 0)`);
        ctx.fillStyle = hg;
        ctx.beginPath(); ctx.arc(cx, hY, 90, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = lit ? LANE_COLORS[i] : 'rgba(255,255,255,0.08)';
      ctx.strokeStyle = LANE_COLORS[i];
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cx, hY, 44, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff7e6';
      ctx.font = 'bold 32px "Georgia", serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(keys[i], cx, hY + 1);
      // Hint labels during count-in
      if (G.state === 'COUNTIN') {
        ctx.fillStyle = '#e9c46a';
        ctx.font = '13px "Georgia", serif';
        const label = ['low strum', 'chord', 'trumpet'][i];
        ctx.fillText(label, cx, hY + 70);
      }
    }
    ctx.restore();
  }

  function drawNotes() {
    if (!G.level || G.state === 'INTRO') return;
    const left = lanesLeft();
    const laneW = (lanesRight() - lanesLeft()) / 3;
    const hY = hitY();
    const startY = 246;
    const travel = hY - startY;
    const lead = 1.25;
    const now = performance.now() / 1000 - G.t0;

    for (const n of G.chart) {
      if (n.judged && !n.hit) {
        if (n.t > now - 0.30) {
          const a = Math.max(0, 1 - (now - n.t) / 0.30);
          const cxn = left + (n.lane + 0.5) * laneW;
          ctx.save();
          ctx.globalAlpha = a * 0.85;
          ctx.strokeStyle = '#ff7f9e'; ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(cxn - 20, hY - 20); ctx.lineTo(cxn + 20, hY + 20);
          ctx.moveTo(cxn + 20, hY - 20); ctx.lineTo(cxn - 20, hY + 20);
          ctx.stroke();
          ctx.restore();
        }
        continue;
      }
      if (n.judged && n.hit) continue;
      const remaining = n.t - now;
      if (remaining > lead) continue;
      const y = hY - (remaining / lead) * travel;
      if (y < startY - 10) continue;
      const cxn = left + (n.lane + 0.5) * laneW;

      // Trailing tail when close to hit line
      if (remaining < 0.5) {
        const trail = ctx.createLinearGradient(cxn, y - 30, cxn, y + 30);
        trail.addColorStop(0, `rgba(${hexToRgb(LANE_COLORS[n.lane])}, 0)`);
        trail.addColorStop(0.5, `rgba(${hexToRgb(LANE_COLORS[n.lane])}, 0.35)`);
        trail.addColorStop(1, `rgba(${hexToRgb(LANE_COLORS[n.lane])}, 0)`);
        ctx.fillStyle = trail;
        ctx.fillRect(cxn - 12, y - 30, 24, 60);
      }

      ctx.save();
      ctx.shadowColor = LANE_COLORS[n.lane]; ctx.shadowBlur = 16;
      // Outer diamond
      ctx.fillStyle = LANE_COLORS[n.lane];
      ctx.strokeStyle = '#fff7e6';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cxn, y - 24); ctx.lineTo(cxn + 32, y);
      ctx.lineTo(cxn, y + 24); ctx.lineTo(cxn - 32, y); ctx.closePath();
      ctx.fill(); ctx.stroke();
      // Inner highlight
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255, 247, 230, 0.7)';
      ctx.beginPath();
      ctx.moveTo(cxn, y - 14); ctx.lineTo(cxn + 18, y);
      ctx.lineTo(cxn, y + 14); ctx.lineTo(cxn - 18, y); ctx.closePath();
      ctx.fill();
      ctx.restore();
      if (n.chordPart) {
        ctx.save();
        ctx.fillStyle = 'rgba(255, 247, 230, 0.95)';
        ctx.font = 'bold 16px "Georgia", serif';
        ctx.textAlign = 'center';
        ctx.fillText('♬', cxn, y - 32);
        ctx.restore();
      }
    }
  }

  function drawHUD() {
    if (G.state === 'INTRO' || G.state === 'WIN_GAME') return;
    const W = cv.width;
    const barY = 184;
    drawBar(60, barY, 420, 30, G.spirit / 100, '#e9c46a', '#3a2a08', 'SPIRIT', '#ffd166');
    drawBar(W - 60 - 420, barY, 420, 30, G.haunt / 100, '#ff5ea0', '#3a0a1f', 'HAUNT', '#ff8aba', true);
    if (G.combo > 1) {
      ctx.save();
      const big = G.combo >= 16;
      ctx.font = `bold ${big ? 42 : 32}px "Georgia", serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = big ? '#ffd166' : '#e9c46a';
      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur = 10;
      const mult = G.combo >= 16 ? '×2.0' : G.combo >= 8 ? '×1.5' : '×1.0';
      // Place combo just below bars, between bar bottom and lane top
      ctx.fillText(`${G.combo} combo ${mult}`, W / 2, 232);
      ctx.restore();
    }
  }
  function drawBar(x, y, w, h, frac, fillCol, bgCol, label, labelCol, rtl) {
    ctx.save();
    // bg
    ctx.fillStyle = bgCol;
    ctx.fillRect(x, y, w, h);
    // fill with subtle gradient
    const fw = w * Math.max(0, Math.min(1, frac));
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, fillCol);
    grad.addColorStop(1, shade(fillCol, -0.25));
    ctx.fillStyle = grad;
    if (rtl) ctx.fillRect(x + w - fw, y, fw, h);
    else ctx.fillRect(x, y, fw, h);
    // tick marks every 25%
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const xx = x + (w * i / 4);
      ctx.beginPath(); ctx.moveTo(xx, y + 2); ctx.lineTo(xx, y + h - 2); ctx.stroke();
    }
    // border
    ctx.strokeStyle = '#f4ecd6'; ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    // label above
    ctx.fillStyle = labelCol;
    ctx.font = 'bold 13px "Georgia", serif';
    ctx.textBaseline = 'middle';
    ctx.letterSpacing = '2px';
    if (rtl) { ctx.textAlign = 'right'; ctx.fillText(label, x + w, y - 12); }
    else { ctx.textAlign = 'left'; ctx.fillText(label, x, y - 12); }
    // percent
    ctx.fillStyle = '#f4ecd6';
    ctx.font = 'bold 14px "Georgia", serif';
    if (rtl) { ctx.textAlign = 'left'; ctx.fillText(`${Math.round(frac * 100)}%`, x, y - 12); }
    else { ctx.textAlign = 'right'; ctx.fillText(`${Math.round(frac * 100)}%`, x + w, y - 12); }
    ctx.restore();
  }
  function shade(hex, amt) {
    // Lighten/darken hex by amt (-1..1)
    const rgb = hexToRgbArr(hex);
    return `rgb(${rgb.map(c => Math.max(0, Math.min(255, c + 255 * amt))).join(',')})`;
  }
  function hexToRgb(hex) { return hexToRgbArr(hex).join(','); }
  function hexToRgbArr(hex) {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  function drawFeedbacks() {
    for (const fb of G.feedbacks) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, fb.life / 0.7));
      ctx.fillStyle = fb.color;
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.lineWidth = 4;
      ctx.font = 'bold 32px "Georgia", serif';
      ctx.textAlign = 'center';
      ctx.strokeText(fb.text, fb.x, fb.y);
      ctx.fillText(fb.text, fb.x, fb.y);
      ctx.restore();
    }
  }

  function drawHitBursts() {
    ctx.save();
    for (const b of G.bursts) {
      ctx.globalAlpha = Math.max(0, Math.min(1, b.life / 0.6));
      ctx.fillStyle = b.color;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawPetals() {
    ctx.save();
    for (const p of G.petals) {
      ctx.save();
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.min(1, p.life / 3);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot || 0);
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size || 5, (p.size || 5) * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawCountIn() {
    const W = cv.width;
    const now = performance.now() / 1000 - G.t0;
    const beat = 60 / (G.level?.bpm || 100);
    const remaining = Math.max(0, G.countInUntil - now);
    const n = Math.ceil(remaining / beat);
    const pulse = 1 - ((remaining % beat) / beat);
    ctx.save();
    ctx.globalAlpha = 0.92 - 0.4 * pulse;
    ctx.fillStyle = '#fff7e6';
    ctx.strokeStyle = '#2a0530'; ctx.lineWidth = 6;
    const sz = 130 + 28 * pulse;
    ctx.font = `bold ${sz}px "Georgia", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const text = n > 0 ? String(n) : '¡Vámonos!';
    const cy = hitY() - 220;
    ctx.strokeText(text, W / 2, cy);
    ctx.fillText(text, W / 2, cy);
    ctx.restore();
  }

  function renderWin() {
    const W = cv.width, H = cv.height;
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#3a1a4a');
    grad.addColorStop(0.4, '#e9c46a');
    grad.addColorStop(1, '#ff8a1f');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
    drawStars(40);
    drawTownSilhouette();
    drawPetals();
  }

  function rgb(c) { return `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`; }
  function randomMarigold() {
    const c = ['#ff8a1f', '#ffb347', '#e9c46a', '#d6266b', '#ff5ea0'];
    return c[Math.floor(Math.random() * c.length)];
  }

  // ============================================================
  // DOM wiring
  // ============================================================
  $('#playBtn').addEventListener('click', () => {
    try { Audio.init(); Audio.click(); } catch (e) {}
    startGame();
  });
  $('#playAgainBtn').addEventListener('click', () => {
    G.levelIdx = 0;
    $('#winScreen').classList.add('hidden');
    $('#audioHud').classList.remove('hidden');
    startLevel();
  });
  $('#muteBtn').addEventListener('click', () => {
    Audio.setMuted(!Audio.muted);
    $('#muteBtn').textContent = Audio.muted ? '🔇' : '🔊';
  });
  $('#volSlider').addEventListener('input', (e) => {
    Audio.setVolume(parseInt(e.target.value, 10) / 100);
  });
  $('#resumeBtn').addEventListener('click', () => { Audio.click(); resumeGame(); });
  $('#restartBtn').addEventListener('click', () => { Audio.click(); restartDuel(); });

  requestAnimationFrame(frame);

  // Debug accessor for automated testing
  window.__me_debug = {
    nextNoteInLane(lane) {
      if (G.state !== 'PLAY' || !G.chart) return null;
      const now = performance.now() / 1000 - G.t0;
      for (const n of G.chart) {
        if (!n.judged && n.lane === lane && n.t >= now - 0.05) return { dt: n.t - now };
      }
      return null;
    },
    state() { return G.state; },
    bars() { return { spirit: G.spirit, haunt: G.haunt, combo: G.combo, level: G.levelIdx }; },
    chartSummary() {
      if (!G.chart) return null;
      return { total: G.chart.length, judged: G.chart.filter(n => n.judged).length, hits: G.hits, misses: G.misses };
    },
  };
})();
