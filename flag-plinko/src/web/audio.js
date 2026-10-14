// All sounds are synthesised with WebAudio (no files, no licences). Volumes come from config.json.
export class Sfx {
  constructor(cfg = {}) {
    this.cfg = { enabled: true, master: 0.8, sfx: 0.7, music: 0.25, ...cfg };
    this.ctx = null;
    this.voices = 0;
    this.last = { tick: 0, out: 0, safe: 0 };
    this.musicTimer = null;
    this.step = 0;
    this.nextT = 0;
  }

  init() {
    if (!this.cfg.enabled || this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = this.cfg.master; this.master.connect(c.destination);
    const comp = c.createDynamicsCompressor(); comp.connect(this.master);
    this.sfxBus = c.createGain(); this.sfxBus.gain.value = this.cfg.sfx; this.sfxBus.connect(comp);
    this.musicBus = c.createGain(); this.musicBus.gain.value = this.cfg.music; this.musicBus.connect(comp);
    // 1 s of white noise reused for whooshes / thuds
    const n = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = n.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noise = n;
    const resume = () => { if (c.state !== 'running') c.resume(); };
    resume();
    for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, resume, { once: true });
    this.startMusic();
  }

  setVolumes({ master, sfx, music } = {}) {
    if (!this.ctx) return;
    if (master != null) this.master.gain.value = master;
    if (sfx != null) this.sfxBus.gain.value = sfx;
    if (music != null) this.musicBus.gain.value = music;
  }

  _tone(freq, dur, { type = 'sine', gain = 0.2, attack = 0.004, bus = this.sfxBus, when = 0, endFreq = null, detune = 0 } = {}) {
    const c = this.ctx;
    if (!c || this.voices > 24) return;
    const t = c.currentTime + when;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); o.detune.value = detune;
    if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + 0.02);
    this.voices++;
    o.onended = () => { this.voices--; };
  }

  _noise(dur, { gain = 0.2, f0 = 400, f1 = 2000, q = 1, type = 'bandpass', when = 0 } = {}) {
    const c = this.ctx;
    if (!c || this.voices > 24) return;
    const t = c.currentTime + when;
    const s = c.createBufferSource(); s.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfxBus);
    s.start(t); s.stop(t + dur + 0.02);
    this.voices++; s.onended = () => { this.voices--; };
  }

  // ---- game sounds
  tick(speed = 200, row = 0, col = 0) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.last.tick < 0.028) return;   // at most ~35 ticks per second
    this.last.tick = now;
    const scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5];
    const f = scale[(row * 3 + col) % scale.length] * (1 + (Math.random() - 0.5) * 0.015);
    this._tone(f, 0.07, { type: 'triangle', gain: Math.min(0.22, 0.04 + speed / 2500) });
  }
  out() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.last.out < 0.12) return;
    this.last.out = now;
    this._tone(210, 0.3, { type: 'sawtooth', gain: 0.17, endFreq: 60 });
    this._noise(0.18, { gain: 0.14, f0: 900, f1: 120, type: 'lowpass' });
  }
  safe() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.last.safe < 0.1) return;
    this.last.safe = now;
    this._tone(880, 0.18, { gain: 0.12 });
    this._tone(1318.5, 0.28, { gain: 0.1, when: 0.07 });
  }
  roundStart() {
    this._noise(1.0, { gain: 0.3, f0: 180, f1: 3200, q: 0.9 });
    this._tone(220, 0.9, { type: 'sine', gain: 0.18, endFreq: 880 });
  }
  replay() {
    this._tone(330, 0.35, { type: 'square', gain: 0.1, endFreq: 165 });
    this._tone(247, 0.45, { type: 'square', gain: 0.1, endFreq: 110, when: 0.25 });
  }
  results() { this._tone(523.25, 0.2, { gain: 0.12 }); this._tone(392, 0.3, { gain: 0.12, when: 0.12 }); }
  winner() {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98];
    notes.forEach((n, i) => this._tone(n, 0.5, { type: 'triangle', gain: 0.2, when: i * 0.14 }));
    [261.63, 329.63, 392, 523.25].forEach((n) => this._tone(n, 2.4, { type: 'sawtooth', gain: 0.07, attack: 0.1, when: 0.85, detune: 6 }));
    this._noise(1.6, { gain: 0.16, f0: 2000, f1: 8000, type: 'highpass', when: 0.8 });
  }

  // ---- background music: slow generative lo-fi (pads + pluck + bass)
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const bpm = 84, beat = 60 / bpm;
    const chords = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];     // Am F C G
    const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
    this.nextT = this.ctx.currentTime + 0.2;
    const sched = () => {
      const c = this.ctx;
      while (this.nextT < c.currentTime + 1.2) {
        const bar = Math.floor(this.step / 4) % chords.length, b = this.step % 4;
        const t = this.nextT - c.currentTime;
        if (b === 0) {
          for (const m of chords[bar]) {
            this._tone(mtof(m), beat * 4.1, { type: 'triangle', gain: 0.05, attack: 0.5, bus: this.musicBus, when: t, detune: -5 });
            this._tone(mtof(m), beat * 4.1, { type: 'sine', gain: 0.05, attack: 0.5, bus: this.musicBus, when: t, detune: 5 });
          }
          this._tone(mtof(chords[bar][0] - 12), beat * 3.6, { type: 'sine', gain: 0.1, attack: 0.05, bus: this.musicBus, when: t });
        }
        if (Math.random() < 0.55) {
          const note = chords[bar][Math.floor(Math.random() * 3)] + 12 * (Math.random() < 0.5 ? 1 : 2);
          this._tone(mtof(note), beat * 1.2, { type: 'triangle', gain: 0.04, attack: 0.01, bus: this.musicBus, when: t + (Math.random() < 0.3 ? beat / 2 : 0) });
        }
        this.step++;
        this.nextT += beat;
      }
    };
    this.musicTimer = setInterval(sched, 250);
    sched();
  }
}
