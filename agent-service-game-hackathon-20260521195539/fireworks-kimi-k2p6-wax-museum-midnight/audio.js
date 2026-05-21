/* Wax Museum Midnight — Procedural Audio */

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.volume = 0.7;
    this.muted = false;
    this.initd = false;
    this.crackleSrc = null;
    this.crackleGain = null;
    this.footTimer = null;
    this.droneTimer = null;
    this.danger = null;
    this.dangerNodes = [];
  }

  init() {
    if (this.initd) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
    this.initd = true;
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : v, this.ctx.currentTime, 0.05);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.05);
    return this.muted;
  }

  _now() { return this.ctx ? this.ctx.currentTime : 0; }
  _gain(v, t) {
    const g = this.ctx.createGain();
    g.gain.value = v;
    if (t !== undefined) g.gain.setValueAtTime(v, t);
    return g;
  }
  _osc(type, freq, t) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    return o;
  }
  _noise(len) {
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * (len || 1), this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  startCrackle() {
    if (!this.initd) return;
    this.stopCrackle();
    const buf = this._noise(2);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const g = this._gain(0.05);
    src.connect(g);
    g.connect(this.master);
    src.start();
    this.crackleSrc = src;
    this.crackleGain = g;
  }

  stopCrackle() {
    if (this.crackleSrc) { try { this.crackleSrc.stop(); this.crackleSrc.disconnect(); } catch(e){} this.crackleSrc = null; }
    if (this.crackleGain) { try { this.crackleGain.disconnect(); } catch(e){} this.crackleGain = null; }
  }

  drip(yRatio) {
    if (!this.initd) return;
    const t = this._now();
    const base = 300 + (1 - yRatio) * 500;
    const o = this._osc('sine', base);
    const g = this._gain(0, t);
    g.gain.linearRampToValueAtTime(0.25, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.frequency.exponentialRampToValueAtTime(base * 0.5, t + 0.18);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + 0.2);
  }

  harden() {
    if (!this.initd) return;
    const t = this._now();
    const o = this._osc('sine', 150);
    const g = this._gain(0, t);
    g.gain.linearRampToValueAtTime(0.2, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    o.frequency.exponentialRampToValueAtTime(50, t + 0.2);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + 0.25);
  }

  creak() {
    if (!this.initd) return;
    const t = this._now();
    const buf = this._noise(0.3);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 800 + Math.random() * 400;
    f.Q.value = 3;
    const g = this._gain(0.04, t);
    g.gain.linearRampToValueAtTime(0.04, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + 0.3);
  }

  footstep(nearness) {
    if (!this.initd) return;
    const t = this._now();
    const o = this._osc('triangle', 100);
    const g = this._gain(0, t);
    const vol = Math.min(0.25, 0.03 + (nearness || 0) * 0.22);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 500 + (nearness || 0) * 2000;
    o.connect(f);
    f.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + 0.15);
  }

  lanternSwing() {
    if (!this.initd) return;
    const t = this._now();
    const o1 = this._osc('sine', 420);
    const o2 = this._osc('sine', 630);
    const g = this._gain(0, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    o1.connect(g);
    o2.connect(g);
    g.connect(this.master);
    o1.start(t); o2.start(t);
    o1.stop(t + 0.25);
    o2.stop(t + 0.25);
  }

  dangerStart() {
    if (!this.initd) return;
    if (this.danger) return;
    const t = this._now();
    const o1 = this._osc('sawtooth', 220);
    const o2 = this._osc('sawtooth', 277);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 400;
    f.frequency.linearRampToValueAtTime(2000, t + 1.5);
    const g = this._gain(0.1, t);
    g.gain.linearRampToValueAtTime(0.12, t + 0.3);
    o1.connect(f);
    o2.connect(f);
    f.connect(g);
    g.connect(this.master);
    o1.start(t);
    o2.start(t);
    this.dangerNodes = [o1, o2, f, g];
    this.danger = { stop: () => {
      const t2 = this._now();
      g.gain.setTargetAtTime(0, t2, 0.15);
      o1.stop(t2 + 0.2);
      o2.stop(t2 + 0.2);
      this.danger = null;
    }};
  }

  dangerStop() {
    if (this.danger) { this.danger.stop(); this.danger = null; }
    this.dangerNodes = [];
  }

  startDrone() {
    if (!this.initd) return;
    this.stopDrone();
    const t = this._now();
    const g = this._gain(0.06, t);
    g.gain.linearRampToValueAtTime(0.06, t + 2);
    g.connect(this.master);
    const notes = [110, 146.83, 164.81, 196];
    const playNote = (when, freq) => {
      const o = this._osc('sine', freq);
      const o2 = this._osc('triangle', freq * 2);
      const pg = this._gain(0, when);
      pg.gain.linearRampToValueAtTime(0.04, when + 0.02);
      pg.gain.exponentialRampToValueAtTime(0.001, when + 2.5);
      o.connect(pg);
      o2.connect(pg);
      pg.connect(g);
      o.start(when);
      o2.start(when);
      o.stop(when + 3);
      o2.stop(when + 3);
    };
    notes.forEach((freq, i) => playNote(t + i * 0.5, freq));
    this.droneTimer = setInterval(() => {
      const t2 = this._now();
      notes.forEach((freq, i) => playNote(t2 + i * 0.5, freq));
    }, 3500);
  }

  stopDrone() {
    if (this.droneTimer) { clearInterval(this.droneTimer); this.droneTimer = null; }
  }

  startFootsteps(w, playerDistFn) {
    if (!this.initd) return;
    if (this.footTimer) clearInterval(this.footTimer);
    this.footTimer = setInterval(() => {
      if (w.moving && w.speed > 0) {
        const dist = playerDistFn ? playerDistFn() : 999;
        const near = w.spotted ? 1 : Math.max(0, 1 - (dist || 999) / 8);
        this.footstep(near);
      }
    }, 500);
  }

  stopFootsteps() {
    if (this.footTimer) { clearInterval(this.footTimer); this.footTimer = null; }
  }

  stopAll() {
    this.stopCrackle();
    this.stopFootsteps();
    this.stopDrone();
    this.dangerStop();
  }
}

const AUDIO = new AudioEngine();
