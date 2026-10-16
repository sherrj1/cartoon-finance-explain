// Flag Plinko game logic: phases, rounds, the "duration governor", finale scoring, logging, resume snapshots.
// Pure JS (no DOM). Driven by tick() at 60 Hz of *stream time*; works identically in the browser and in Node.
import { RNG } from './rng.js';
import { World } from './physics.js';
import { BOARD, BIN_POINTS } from './board.js';

export const TICK = 1 / 60;
const SUBSTEPS = 2;

export const DEFAULTS = {
  gameSeconds: 10800,        // target 180 min
  endMargin: 8,              // aim to finish this many seconds before the target
  introSeconds: 240,
  bannerSeconds: 20,
  resultsSeconds: 20,
  winnerSeconds: 30,
  cooldownSeconds: 300,
  settleReserve: 16,         // time kept for the last balls to fall
  minRoundSeconds: 80,
  maxAttempts: 4,
  waveInterval: 4.0,         // ideal seconds between waves in the big rounds
  maxDropInterval: 40,       // never wait longer than this between drops in small rounds
  finaleDropInterval: 3.5,
  phases: [
    { id: 1, name: 'PHASE 1', rounds: 8, minutes: 6, end: 60 },
    { id: 2, name: 'PHASE 2', rounds: 8, minutes: 7, end: 16 },
    { id: 3, name: 'PHASE 3', rounds: 6, minutes: 8, end: 4 },
  ],
  finaleMinutes: 8,
  overtimeAfter: 240,        // seconds past the target after which everything is squeezed
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Game {
  /**
   * @param {object} o  { seed, countries:[{code,name}], config?, probs?:number[12], resume?:snapshot }
   */
  constructor(o) {
    const given = o.config || {};
    this.cfg = { ...DEFAULTS, ...given };
    // Short games (< ~2.6 h): use fewer rounds and shorter intro / winner / pause so the schedule still fits.
    // Anything you set explicitly in `config` wins over these automatic values.
    if (this.cfg.gameSeconds < 9500) {
      const g = this.cfg.gameSeconds, cl = (v, a, b) => Math.max(a, Math.min(b, v));
      const rounds = g <= 1200 ? [3, 3, 2] : g <= 2700 ? [4, 4, 3] : g <= 4800 ? [6, 6, 4] : [8, 8, 6];
      if (!given.phases) this.cfg.phases = DEFAULTS.phases.map((p, i) => ({ ...p, rounds: rounds[i] }));
      if (given.introSeconds == null) this.cfg.introSeconds = cl(Math.round(g * 0.025), 20, 240);
      if (given.cooldownSeconds == null) this.cfg.cooldownSeconds = cl(Math.round(g * 0.03), 30, 300);
      if (given.winnerSeconds == null) this.cfg.winnerSeconds = cl(Math.round(g * 0.01), 15, 30);
      if (given.minRoundSeconds == null) this.cfg.minRoundSeconds = g <= 1200 ? 40 : g <= 2700 ? 55 : 80;
      // Hectic mode (< ~33 min): short banners / result screens, balls are released in quick succession so the board is never empty
      if (g < 2000) {
        const set = (k, v) => { if (given[k] == null) this.cfg[k] = v; };
        set('bannerSeconds', g <= 1200 ? 7 : 8); set('resultsSeconds', g <= 1200 ? 9 : 12);
        set('waveInterval', 3); set('maxDropInterval', 6); set('finaleDropInterval', 2.5); set('settleReserve', 12);
        // nominal round lengths proportional to the time that is really available, so the governor does not have to squeeze (pace ~ 1)
        if (!given.phases && given.finaleMinutes == null) {
          const wt = [1.0, 0.85, 0.8], fw = 0.7;
          const total = this.cfg.phases.reduce((a, ph, i) => a + ph.rounds * wt[i], 0) + 3 * fw;
          const k = (g - this.cfg.introSeconds - 10) / 60 / total;
          this.cfg.phases = this.cfg.phases.map((ph, i) => ({ ...ph, minutes: wt[i] * k }));
          this.cfg.finaleMinutes = fw * k;
        }
        // a phase is also finished when its planned rounds are used up and the flag count is only a little above the target
        if (given.phaseTolerance == null) this.cfg.phaseTolerance = 1.25;
      }
    }
    this.countries = o.countries;
    this.byCode = new Map(this.countries.map((c) => [c.code, c]));
    this.seed = o.seed >>> 0;
    this.probs = o.probs || new Array(BOARD.bins).fill(1 / BOARD.bins);
    this.logicRng = new RNG(this.seed ^ 0x9e3779b9);
    this.physRng = new RNG(this.seed);
    this.world = new World(this.physRng, { phys: o.config?.phys });
    this.world.onLand = (b, bin) => this._onLand(b, bin);
    this.world.onPeg = (b, peg, speed) => this.emit('peg', b, peg, speed);
    this.world.onNudge = (b, progress) => this.emit('nudge', b, progress);
    this.listeners = {};
    this.T = 0;
    this.timeScale = 1;
    this.alive = this.countries.map((c) => c.code);
    this.eliminated = [];             // [{code, round, T}]
    this.phaseIdx = 0;
    this.roundInPhase = 0;
    this.roundNo = 0;
    this.attempt = 0;
    this.scores = {};                 // finale totals
    this.round = null;
    this.mode = 'intro';
    this.modeEnd = this.cfg.introSeconds;
    this.nextDemo = 2;
    this.log = { seed: this.seed, version: 1, startedAt: null, rounds: [], replays: 0, winner: null, durationSeconds: null, stats: null };
    this.finished = false;
    this.winner = null;
    this.binStacks = Array.from({ length: BOARD.bins }, () => []);
    this.binCounts = new Array(BOARD.bins).fill(0);
    this.recent = [];                 // recently eliminated for the ticker
    if (o.resume) this._restore(o.resume);
  }

  // ------------------------------------------------------------------ events
  on(name, fn) { (this.listeners[name] ||= []).push(fn); return this; }
  emit(name, ...a) { const l = this.listeners[name]; if (l) for (const f of l) f(...a); }

  get endT() { return this.cfg.gameSeconds - this.cfg.endMargin; }
  get remaining() { return Math.max(0, this.cfg.gameSeconds - this.T); }
  get phase() { return this.cfg.phases[this.phaseIdx] || null; }
  get inFinale() { return this.phaseIdx >= this.cfg.phases.length; }

  // ------------------------------------------------------------------ main loop
  tick() {
    this.T += TICK;
    const dt = (TICK / SUBSTEPS) * this.timeScale;
    if (this.world.balls.length) for (let i = 0; i < SUBSTEPS; i++) this.world.step(dt);
    switch (this.mode) {
      case 'intro': this._tickIntro(); break;
      case 'banner': if (this.T >= this.modeEnd) this._startDrop(); break;
      case 'drop': this._tickDrop(); break;
      case 'settle': if (this.world.balls.length === 0) this._endAttempt(); break;
      case 'results': if (this.T >= this.modeEnd) this._afterResults(); break;
      case 'winner': if (this.T >= this.modeEnd) { this.mode = 'cooldown'; this.modeEnd = this.T + this.cfg.cooldownSeconds; this.emit('mode', 'cooldown'); } break;
      case 'cooldown': if (this.T >= this.modeEnd) { this.mode = 'done'; this.emit('restart'); } break;
      default: break;
    }
  }

  _tickIntro() {
    // cosmetic demo balls (not part of the game)
    if (this.T >= this.nextDemo) {
      this.nextDemo = this.T + 2.2;
      const c = this.countries[this.logicRng.int(this.countries.length)];
      this.world.spawn({ code: c.code, demo: true });
    }
    if (this.T >= this.modeEnd) {
      this.log.startedAt = this.log.startedAt || Date.now();
      this._beginRound();
    }
  }

  // ------------------------------------------------------------------ governor
  /** Sum of nominal minutes of all rounds still to be played (including the current one). */
  _futureWeight() {
    const c = this.cfg;
    let n = this.alive.length;
    let w = 0;
    for (let p = this.phaseIdx; p < c.phases.length; p++) {
      const ph = c.phases[p];
      if (n <= ph.end) continue;
      const left = p === this.phaseIdx ? Math.max(1, ph.rounds - this.roundInPhase) : ph.rounds;
      w += left * ph.minutes;
      n = ph.end;
    }
    const finalists = this.inFinale ? this.alive.length : Math.min(n, 4);
    w += Math.max(0, finalists - 1) * c.finaleMinutes;
    return w;
  }

  _planRound() {
    const c = this.cfg;
    const finale = this.inFinale;
    const nominal = finale ? c.finaleMinutes : this.phase.minutes;
    const fw = Math.max(nominal, this._futureWeight());
    const overtime = this.T > this.endT + c.overtimeAfter;
    let budget = ((this.endT - this.T) * nominal) / fw;
    if (this.attempt > 1) budget *= 0.6;     // replays are shorter than a fresh round
    budget = Math.max(overtime ? 50 : c.minRoundSeconds, budget);
    const pace = budget / (nominal * 60);
    // (c) physics time scale: slightly faster when behind schedule, slightly slower/floatier when ahead
    this.timeScale = clamp(pace < 0.85 ? 1 + (0.85 - pace) * 0.5 : pace > 1.25 ? 1 - Math.min(0.1, (pace - 1.25) * 0.1) : 1, 0.9, 1.12);
    return { budget, pace, nominal };
  }

  _chooseBins(p) {
    const B = BOARD.bins;
    const rng = this.logicRng;
    const idx = Array.from({ length: B }, (_, i) => i);
    const cands = [];
    for (let t = 0; t < 400; t++) {
      rng.shuffle(idx);
      let sum = 0, mask = 0, k = 0;
      for (const i of idx) {
        if (sum + this.probs[i] / 2 > p && k > 0) break;
        sum += this.probs[i]; mask |= 1 << i; k++;
        if (k >= B - 1) break;
      }
      cands.push({ err: Math.abs(sum - p), mask });
    }
    cands.sort((a, b) => a.err - b.err);
    const best = cands[0].err;
    const pool = cands.filter((c) => c.err <= best + 0.006);
    const mask = pool[rng.int(pool.length)].mask;
    return Array.from({ length: B }, (_, i) => ({ green: !!(mask & (1 << i)), count: 0, points: BIN_POINTS[i] }));
  }

  // ------------------------------------------------------------------ round lifecycle
  _advancePhase() {
    // skip phases that are already satisfied; move on when the planned rounds are used up and the target is reached
    const tol = this.cfg.phaseTolerance || 1;
    while (!this.inFinale && (this.alive.length <= this.phase.end ||
      (this.phase.end >= 16 && this.roundInPhase >= this.phase.rounds && this.alive.length <= Math.ceil(this.phase.end * tol)))) { this.phaseIdx++; this.roundInPhase = 0; }
  }

  _beginRound(isReplay = false, tied = null) {
    const c = this.cfg;
    if (!isReplay && !tied) {
      // snapshot of the state *before* planning, so a resumed game re-plans this round identically
      this._pre = { v: 1, seed: this.seed, T: this.T, logic: this.logicRng.state, phys: this.physRng.state, alive: this.alive.slice(),
                    eliminated: this.eliminated.map((e) => ({ ...e })), phaseIdx: this.phaseIdx, roundInPhase: this.roundInPhase,
                    roundNo: this.roundNo, recent: this.recent.map((r) => ({ ...r })), log: JSON.parse(JSON.stringify(this.log)) };
    }
    this._advancePhase();
    if (!isReplay && !tied) { this.roundNo++; this.attempt = 0; }
    this.attempt++;
    const finale = this.inFinale;
    const plan = this._planRound();
    const participants = tied ? tied.slice() : this.alive.slice();
    const R = { no: this.roundNo, attempt: this.attempt, finale, phase: finale ? 4 : this.phase.id, phaseName: finale ? 'FINALE' : this.phase.name,
                n: participants.length, participants, startT: this.T, budget: plan.budget, pace: plan.pace, tie: !!tied };
    const banner = plan.budget < 150 ? Math.min(10, c.bannerSeconds) : c.bannerSeconds;
    const results = plan.budget < 150 ? Math.min(10, c.resultsSeconds) : c.resultsSeconds;
    const window = Math.max(8, plan.budget - banner - results - c.settleReserve);
    R.bannerEnd = this.T + banner;
    R.resultsLen = results;
    R.outcome = {};   // code -> 'safe' | 'out'
    R.landed = 0;
    this.binCounts.fill(0);
    this.binStacks.forEach((s) => (s.length = 0));

    if (!finale) {
      const N = participants.length;
      const rl = Math.max(1, this.phase.rounds - this.roundInPhase);
      const rlEff = clamp(Math.round(rl * clamp(plan.pace, 0.55, 1.6)), 1, rl);
      const overtime = this.T > this.endT + c.overtimeAfter;
      let target = rlEff <= 1 || overtime ? (overtime ? Math.max(this.phase.end, Math.floor(N / 2)) : this.phase.end)
        : Math.round(N * Math.pow(this.phase.end / N, 1 / rlEff));
      target = clamp(target, Math.max(1, this.phase.end), N - 1);
      // small rounds: avoid a high chance that nobody goes out (that would force a replay)
      if (N <= 10) target = Math.min(target, Math.max(Math.floor(N * Math.pow(0.15, 1 / N)), 1));
      target = clamp(target, 1, N - 1);
      if (isReplay && this.attempt > 2) target = clamp(Math.round((target + N) / 2), 1, N - 1); // soften after repeated odd outcomes
      R.target = target;
      R.mustGo = N - target;
      R.bins = this._chooseBins(target / N);
      // release schedule: waves over the window
      const order = this.logicRng.shuffle(participants.slice());
      const waves = clamp(Math.floor(window / c.waveInterval), 1, N);
      const size = Math.ceil(N / waves);
      const nWaves = Math.ceil(N / size);
      const interval = Math.min(c.maxDropInterval, window / nWaves);
      R.queue = order.map((code, i) => ({ code, t: R.bannerEnd + Math.floor(i / size) * interval + (i % size) * 0.33 }));
      R.waveSize = size; R.interval = interval;
    } else {
      const F = participants.length;
      R.bins = BIN_POINTS.map((pts) => ({ green: false, count: 0, points: pts }));
      const dropI = Math.max(2.5, c.finaleDropInterval);
      const total = Math.max(F * (tied ? 4 : 5), Math.floor(window / dropI));
      const K = clamp(Math.floor(total / F), tied ? 4 : 5, 60);
      const interval = Math.max(1.4, window / (K * F));
      R.K = K; R.interval = interval;
      if (!tied) for (const code of participants) this.scores[code] = 0; else for (const code of participants) this.scores[code] = 0;
      R.target = F - 1; R.mustGo = 1;
      const queue = [];
      for (let k = 0; k < K; k++) {
        const ord = this.logicRng.shuffle(participants.slice());
        ord.forEach((code, j) => queue.push({ code, t: R.bannerEnd + (k * F + j) * interval }));
      }
      R.queue = queue;
      R.balls = Object.fromEntries(participants.map((c2) => [c2, 0]));
    }
    R.released = 0;
    this.round = R;
    this.mode = 'banner';
    this.modeEnd = R.bannerEnd;
    if (!isReplay) this.emit('snapshot', this.snapshot());
    this.emit(isReplay ? 'replay' : 'roundStart', this.roundInfo());
    this.emit('mode', 'banner');
  }

  roundInfo() {
    const R = this.round;
    return { no: R.no, attempt: R.attempt, phase: R.phase, phaseName: R.phaseName, n: R.n, target: R.target, mustGo: R.mustGo, finale: R.finale, tie: R.tie,
             budget: R.budget, T: this.T, alive: this.alive.length };
  }

  _startDrop() {
    this.mode = 'drop';
    this.emit('mode', 'drop');
  }

  _tickDrop() {
    const R = this.round;
    while (R.released < R.queue.length && R.queue[R.released].t <= this.T) {
      const q = R.queue[R.released++];
      const ball = this.world.spawn({ code: q.code, round: R.no });
      this.emit('release', ball);
    }
    if (R.released >= R.queue.length) { this.mode = 'settle'; this.emit('mode', 'settle'); }
  }

  _onLand(ball, bin) {
    const pl = ball.payload;
    if (!pl) return;
    if (pl.demo || !this.round || pl.round !== this.round.no) { this.emit('land', ball, bin, null); return; }
    const R = this.round;
    R.landed++;
    const b = R.bins[bin];
    b.count++;
    this.binCounts[bin]++;
    this.binStacks[bin].push(pl.code);
    let outcome;
    if (R.finale) {
      this.scores[pl.code] = (this.scores[pl.code] || 0) + b.points;
      R.balls[pl.code]++;
      outcome = b.points;
    } else {
      outcome = b.green ? 'safe' : 'out';
      R.outcome[pl.code] = outcome;
    }
    this.emit('land', ball, bin, outcome);
  }

  _endAttempt() {
    const R = this.round;
    const finale = R.finale;
    let eliminated = [], survivors = [];
    if (!finale) {
      for (const code of R.participants) (R.outcome[code] === 'out' ? eliminated : survivors).push(code);
      const minSurv = Math.max(2, Math.round(0.5 * R.target));
      const bad = eliminated.length === 0 || survivors.length === 0 || (R.phase <= 3 && survivors.length < minSurv && R.n > 3);
      if (bad && this.attempt < this.cfg.maxAttempts) {
        this.log.replays++;
        this.log.rounds.push(this._roundLog(R, survivors, eliminated, true));
        for (const code of R.participants) delete R.outcome[code];
        this._beginRound(true);
        return;
      }
      if (survivors.length === 0) { survivors = [R.participants[0]]; eliminated = R.participants.slice(1); } // pathological guard
    } else {
      // lowest total score goes; ties among the lowest are re-dropped (only those countries)
      let min = Infinity;
      for (const code of R.participants) min = Math.min(min, this.scores[code]);
      const lows = R.participants.filter((code) => this.scores[code] === min);
      if (lows.length > 1 && this.attempt < this.cfg.maxAttempts + 4) {
        this.log.replays++;
        this.log.rounds.push(this._roundLog(R, R.participants.filter((c2) => !lows.includes(c2)), [], true));
        this._beginRound(true, lows);
        return;
      }
      eliminated = [lows[0]];
      survivors = R.participants.filter((c2) => c2 !== lows[0]);
      if (R.tie) survivors = this.alive.filter((c2) => c2 !== lows[0]);
    }
    // apply
    const elimSet = new Set(eliminated);
    this.alive = this.alive.filter((c2) => !elimSet.has(c2));
    for (const code of eliminated) {
      this.eliminated.push({ code, round: R.no, T: this.T });
      this.recent.unshift({ code, round: R.no });
    }
    this.recent.length = Math.min(this.recent.length, 12);
    R.eliminated = eliminated; R.survivors = survivors;
    R.endT = this.T;
    this.log.rounds.push(this._roundLog(R, this.alive, eliminated, false));
    if (!finale) this.roundInPhase++;
    this.mode = 'results';
    this.modeEnd = this.T + R.resultsLen;
    this.emit('results', { round: R.no, eliminated, survivors: this.alive.length, finale });
    this.emit('mode', 'results');
  }

  _roundLog(R, survivors, eliminated, replay) {
    return { round: R.no, attempt: R.attempt, phase: R.phase, startT: Math.round(R.startT), endT: Math.round(this.T), budget: Math.round(R.budget),
             nStart: R.n, target: R.target, survivors: Array.isArray(survivors) ? survivors.length : survivors, eliminated: eliminated.length,
             greenBins: R.bins.map((b, i) => (b.green ? i : -1)).filter((i) => i >= 0), replay, tie: R.tie };
  }

  _afterResults() {
    if (this.alive.length <= 1) return this._finish();
    this._beginRound();
  }

  _finish() {
    this.winner = this.alive[0];
    this.finished = true;
    this.log.winner = this.winner;
    this.log.durationSeconds = Math.round(this.T);
    this.log.stats = { ...this.world.stats };
    this.mode = 'winner';
    this.modeEnd = this.T + this.cfg.winnerSeconds;
    this.emit('winner', this.winner, this.log);
    this.emit('mode', 'winner');
  }

  // ------------------------------------------------------------------ resume
  /** State at the start of the current round (JSON-serialisable). Saved after every round for crash-resume. */
  snapshot() { return this._pre; }

  _restore(s) {
    this.T = s.T; this.logicRng.state = s.logic; this.physRng.state = s.phys;
    this.alive = s.alive; this.eliminated = s.eliminated; this.phaseIdx = s.phaseIdx; this.roundInPhase = s.roundInPhase;
    this.roundNo = s.roundNo; this.attempt = 0; this.recent = s.recent || []; this.log = s.log;
    this.world.balls.length = 0;
    this._beginRound();   // re-enter the round that was about to start
  }
}
