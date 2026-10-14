// Small deterministic 2D physics for the Plinko board: circle balls vs static pegs / capsule segments,
// ball-vs-ball collisions, slow "floaty" fall, and an anti-stuck system.
// Pure JS, no DOM: the same module runs in the browser and in Node (fast simulation).
import { BOARD, buildBoard, binIndex } from './board.js';

export const PHYS = {
  gravity: 1500,       // px/s^2
  drag: 1.2,           // 1/s  (tuned: a ball takes ~5.7-7.4 s to fall)
  pegRestitution: 0.45,
  wallRestitution: 0.35,
  ballRestitution: 0.45,
  topKick: 90,         // px/s random sideways kick when a ball lands on the very top of a peg
  jitter: 0.05,        // random angle noise (rad) on peg hits -> no perfectly symmetric paths
  maxSpeed: 700,
  stuckSpeed: 14,      // px/s
  stuckTime: 1.0,      // s below stuckSpeed -> nudge
  progressWindow: 3.0, // s: if a ball moved down less than progressMin px in this window -> nudge
  progressMin: 14,
  forceLandAge: 75,    // s: last resort, never expected to trigger
};

const CELL = 64;

export class World {
  constructor(rng, opts = {}) {
    this.rng = rng;
    this.p = { ...PHYS, ...(opts.phys || {}) };
    const b = buildBoard();
    this.pegs = b.pegs;
    this.segs = b.segs;
    this.binW = b.binW;
    this.balls = [];
    this.nextId = 1;
    this.t = 0;
    this.stats = { nudges: 0, progressNudges: 0, forced: 0, landed: 0, maxFall: 0, pegHits: 0 };
    this.onPeg = null;      // (ball, peg, speed)
    this.onLand = null;     // (ball, binIdx)
    this.onNudge = null;
    this._buildGrid();
  }

  _buildGrid() {
    const { W, H } = BOARD;
    this.gw = Math.ceil(W / CELL) + 2;
    this.gh = Math.ceil((H + 450) / CELL) + 2;
    this.grid = Array.from({ length: this.gw * this.gh }, () => ({ pegs: [], segs: [] }));
    const R = BOARD.ballR + 6;
    const cellsFor = (minx, miny, maxx, maxy, fn) => {
      const x0 = Math.floor((minx - R) / CELL) + 1, x1 = Math.floor((maxx + R) / CELL) + 1;
      const y0 = Math.floor((miny - R + 450) / CELL), y1 = Math.floor((maxy + R + 450) / CELL);
      for (let cy = Math.max(0, y0); cy <= Math.min(this.gh - 1, y1); cy++)
        for (let cx = Math.max(0, x0); cx <= Math.min(this.gw - 1, x1); cx++) fn(this.grid[cy * this.gw + cx]);
    };
    for (const p of this.pegs) cellsFor(p.x - p.r, p.y - p.r, p.x + p.r, p.y + p.r, (c) => c.pegs.push(p));
    for (const s of this.segs)
      cellsFor(Math.min(s.x1, s.x2) - s.r, Math.min(s.y1, s.y2) - s.r, Math.max(s.x1, s.x2) + s.r, Math.max(s.y1, s.y2) + s.r, (c) => c.segs.push(s));
  }

  _cell(x, y) {
    const cx = Math.floor(x / CELL) + 1, cy = Math.floor((y + 450) / CELL);
    if (cx < 0 || cy < 0 || cx >= this.gw || cy >= this.gh) return null;
    return this.grid[cy * this.gw + cx];
  }

  spawn(payload, x, opts = {}) {
    const R = BOARD.ballR;
    const ball = {
      id: this.nextId++,
      x: x ?? this.rng.float(R + 12, BOARD.W - R - 12),
      y: opts.y ?? BOARD.spawnY,
      vx: opts.vx ?? this.rng.float(-25, 25),
      vy: opts.vy ?? this.rng.float(10, 40),
      r: R,
      age: 0,
      slow: 0,
      lastY: BOARD.spawnY,
      lastYAge: 0,
      payload,
    };
    this.balls.push(ball);
    return ball;
  }

  step(dt) {
    const p = this.p;
    const balls = this.balls;
    this.t += dt;
    const damp = Math.exp(-p.drag * dt);
    for (let i = 0; i < balls.length; i++) {
      const b = balls[i];
      b.vy += p.gravity * dt;
      b.vx *= damp;
      b.vy *= damp;
      const sp2 = b.vx * b.vx + b.vy * b.vy;
      if (sp2 > p.maxSpeed * p.maxSpeed) {
        const k = p.maxSpeed / Math.sqrt(sp2);
        b.vx *= k; b.vy *= k;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.age += dt;
    }
    // ball <-> static
    for (let i = 0; i < balls.length; i++) this._collideStatic(balls[i]);
    // ball <-> ball (n is small; O(n^2) with a cheap reject is plenty even for 200+ balls)
    const n = balls.length;
    for (let i = 0; i < n; i++) {
      const a = balls[i];
      for (let j = i + 1; j < n; j++) {
        const c = balls[j];
        const dx = c.x - a.x;
        if (dx > 42 || dx < -42) continue;
        const dy = c.y - a.y;
        if (dy > 42 || dy < -42) continue;
        const rr = a.r + c.r;
        const d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr) continue;
        let d = Math.sqrt(d2);
        let nx, ny;
        if (d < 1e-6) { nx = 0; ny = 1; d = 0; } else { nx = dx / d; ny = dy / d; }
        const pen = (rr - d) * 0.5;
        a.x -= nx * pen; a.y -= ny * pen;
        c.x += nx * pen; c.y += ny * pen;
        const rvx = c.vx - a.vx, rvy = c.vy - a.vy;
        const vn = rvx * nx + rvy * ny;
        if (vn < 0) {
          const imp = -(1 + p.ballRestitution) * vn * 0.5;
          a.vx -= imp * nx; a.vy -= imp * ny;
          c.vx += imp * nx; c.vy += imp * ny;
        }
      }
    }
    // one more static pass so ball-ball pushes can't leave balls inside pegs/walls
    for (let i = 0; i < n; i++) this._collideStatic(balls[i]);

    // landing / stuck handling
    for (let i = balls.length - 1; i >= 0; i--) {
      const b = balls[i];
      if (b.y > BOARD.catchY || b.age > p.forceLandAge) {
        if (b.age > p.forceLandAge && b.y <= BOARD.catchY) {
          this.stats.forced++;
          b.y = BOARD.catchY + 1;
        }
        balls.splice(i, 1);
        const bin = binIndex(b.x);
        this.stats.landed++;
        if (b.age > this.stats.maxFall) this.stats.maxFall = b.age;
        if (this.onLand) this.onLand(b, bin);
        continue;
      }
      this._antiStuck(b, dt);
    }
  }

  _collideStatic(b) {
    const cell = this._cell(b.x, b.y);
    if (!cell) return;
    const p = this.p;
    for (let k = 0; k < cell.pegs.length; k++) {
      const pg = cell.pegs[k];
      const dx = b.x - pg.x, dy = b.y - pg.y;
      const rr = b.r + pg.r;
      const d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr) continue;
      let d = Math.sqrt(d2);
      let nx, ny;
      if (d < 1e-6) { nx = 0; ny = -1; d = 0; } else { nx = dx / d; ny = dy / d; }
      b.x += nx * (rr - d); b.y += ny * (rr - d);
      const vn = b.vx * nx + b.vy * ny;
      if (vn < 0) {
        // rotate the normal by a tiny random angle (physics + RNG): breaks perfect symmetry
        const j = (this.rng.next() - 0.5) * 2 * p.jitter;
        const cs = Math.cos(j), sn = Math.sin(j);
        const jx = nx * cs - ny * sn, jy = nx * sn + ny * cs;
        const vnj = b.vx * jx + b.vy * jy;
        const e = 1 + p.pegRestitution;
        b.vx -= e * vnj * jx; b.vy -= e * vnj * jy;
        // ball sitting exactly on top of a peg = unstable balance: knock it off to one side (seeded RNG)
        if (ny < -0.9 && nx > -0.45 && nx < 0.45) b.vx += (this.rng.next() - 0.5) * p.topKick;
        this.stats.pegHits++;
        if (this.onPeg) this.onPeg(b, pg, -vn);
      }
    }
    for (let k = 0; k < cell.segs.length; k++) {
      const s = cell.segs[k];
      const sx = s.x2 - s.x1, sy = s.y2 - s.y1;
      const len2 = sx * sx + sy * sy;
      let t = ((b.x - s.x1) * sx + (b.y - s.y1) * sy) / len2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const cx = s.x1 + sx * t, cy = s.y1 + sy * t;
      const dx = b.x - cx, dy = b.y - cy;
      const rr = b.r + s.r;
      const d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr) continue;
      let d = Math.sqrt(d2);
      let nx, ny;
      if (d < 1e-6) { nx = -sy; ny = sx; const l = Math.hypot(nx, ny); nx /= l; ny /= l; d = 0; } else { nx = dx / d; ny = dy / d; }
      b.x += nx * (rr - d); b.y += ny * (rr - d);
      const vn = b.vx * nx + b.vy * ny;
      if (vn < 0) {
        const e = 1 + (s.divider ? p.pegRestitution : p.wallRestitution);
        b.vx -= e * vn * nx; b.vy -= e * vn * ny;
        if (s.divider && this.onPeg) this.onPeg(b, null, -vn);
      }
    }
  }

  _antiStuck(b, dt) {
    const p = this.p;
    const speed = Math.hypot(b.vx, b.vy);
    // (1) nearly motionless for too long
    if (speed < p.stuckSpeed && b.age > 0.6) b.slow += dt; else b.slow = Math.max(0, b.slow - dt * 2);
    // (2) jittering in place: not making downward progress
    b.lastYAge += dt;
    if (b.lastYAge >= p.progressWindow) {
      if (b.y - b.lastY < p.progressMin && b.y > 0) { this._nudge(b, true); }
      b.lastY = b.y; b.lastYAge = 0;
    }
    if (b.slow >= p.stuckTime) this._nudge(b, false);
  }

  _nudge(b, progress) {
    const dirIn = b.x < BOARD.W / 2 ? 1 : -1;
    const dir = this.rng.chance(0.7) ? dirIn : -dirIn;
    b.vx += dir * this.rng.float(70, 120);
    b.vy -= this.rng.float(30, 70);
    b.slow = 0;
    if (progress) this.stats.progressNudges++; else this.stats.nudges++;
    if (this.onNudge) this.onNudge(b, progress);
  }
}
