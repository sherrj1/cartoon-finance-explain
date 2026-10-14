// Board geometry. Local coordinates: x 0..W (left wall .. right wall), y 0..H (top .. floor).
// The renderer translates this by BOARD_X/BOARD_Y on the 1080x1920 canvas.
export const BOARD = {
  W: 1000,
  H: 1020,
  ballR: 20,
  pegR: 7,
  pegRows: 15,
  pegTop: 130,
  rowGap: 50,
  cols: 15,            // peg intervals per row (B rows have cols+1 pegs incl. half-pegs on the walls)
  bins: 12,
  binTop: 890,         // top of the dividers
  catchY: 935,         // ball centre below this line = landed in its bin
  dividerR: 4,
  wallR: 3,
  spawnY: -24,
};
export const BOARD_X = 40;
export const BOARD_Y = 290;

export function binIndex(x) {
  const bw = BOARD.W / BOARD.bins;
  return Math.max(0, Math.min(BOARD.bins - 1, Math.floor(x / bw)));
}

// Points used in the finale (edges are rare -> worth more).
export const BIN_POINTS = [10, 8, 6, 4, 2, 1, 1, 2, 4, 6, 8, 10];

export function buildBoard() {
  const { W, H, pegRows, pegTop, rowGap, cols, bins, binTop, pegR, dividerR, wallR } = BOARD;
  const sx = W / cols;
  const pegs = [];
  const segs = [];
  for (let r = 0; r < pegRows; r++) {
    const y = pegTop + r * rowGap;
    if (r % 2 === 0) {
      // B row: pegs on a grid including half-pegs sitting on both walls (they deflect balls inwards)
      for (let k = 0; k <= cols; k++) pegs.push({ x: k * sx, y, r: pegR, row: r });
    } else {
      // A row: offset by half a step; the first/last peg is left out so no pocket < ball diameter forms at the wall
      for (let k = 1; k < cols - 1; k++) pegs.push({ x: (k + 0.5) * sx, y, r: pegR, row: r });
      // angled wedges at the walls: balls landing on them slide away from the wall
      segs.push({ x1: 0, y1: y - 14, x2: 40, y2: y + 8, r: 2 });
      segs.push({ x1: 40, y1: y + 8, x2: 0, y2: y + 26, r: 2 });
      segs.push({ x1: W, y1: y - 14, x2: W - 40, y2: y + 8, r: 2 });
      segs.push({ x1: W - 40, y1: y + 8, x2: W, y2: y + 26, r: 2 });
    }
  }
  // walls and floor
  segs.push({ x1: 0, y1: -400, x2: 0, y2: H, r: wallR });
  segs.push({ x1: W, y1: -400, x2: W, y2: H, r: wallR });
  segs.push({ x1: 0, y1: H, x2: W, y2: H, r: wallR });
  // bin dividers
  const bw = W / bins;
  for (let k = 1; k < bins; k++) segs.push({ x1: k * bw, y1: binTop, x2: k * bw, y2: H, r: dividerR, divider: true });
  return { pegs, segs, binW: bw };
}
