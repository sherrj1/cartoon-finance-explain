// Seedable RNG (mulberry32). State can be saved/restored so a game can resume after a crash.
export class RNG {
  constructor(seed = 1) {
    this.s = (seed >>> 0) || 1;
  }
  next() {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  float(a = 0, b = 1) { return a + (b - a) * this.next(); }
  int(n) { return Math.floor(this.next() * n); }
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[this.int(arr.length)]; }
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  get state() { return this.s; }
  set state(v) { this.s = v >>> 0; }
}

export function randomSeed() {
  return (Math.random() * 2 ** 32) >>> 0;
}
