// Push-optimal Sokoban solver for make.fun's hallway-and-rooms levels: every room is solved on its own by a
// breadth-first search over pushes (rooms never share boxes), then the rooms' pushes are joined by player walks.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

type Push = [number, number]; // box square, direction index

function solve(text: string): string {
  const rows = text.split('\n').filter((r) => r.trim().length > 0);
  const h = rows.length, w = Math.max(...rows.map((r) => r.length));
  const N = w * h, D = [-w, w, -1, 1], L = 'udlr';
  const wall = new Uint8Array(N), goal = new Uint8Array(N);
  const boxes: number[] = [];
  let player = 0;
  rows.forEach((row, y) => {
    for (let x = 0; x < w; x++) {
      const c = row[x] ?? '#', i = y * w + x;
      if (c === '#') wall[i] = 1;
      if ('.*+'.includes(c)) goal[i] = 1;
      if ('$*'.includes(c)) boxes.push(i);
      if ('@+'.includes(c)) player = i;
    }
  });
  // Squares outside the grid's floor (beyond the outer wall) are walls too.
  const outside = new Uint8Array(N);
  {
    const st: number[] = [];
    for (let i = 0; i < N; i++) {
      const x = i % w, y = (i / w) | 0;
      if ((x === 0 || y === 0 || x === w - 1 || y === h - 1) && !wall[i]) { outside[i] = 1; st.push(i); }
    }
    while (st.length) {
      const i = st.pop()!;
      for (const d of D) {
        const j = i + d;
        if (j >= 0 && j < N && Math.abs((j % w) - (i % w)) <= 1 && !wall[j] && !outside[j]) { outside[j] = 1; st.push(j); }
      }
    }
    for (let i = 0; i < N; i++) if (outside[i]) wall[i] = 1;
  }
  const hallRow = (player / w) | 0;
  // Rooms: connected floor off the hallway row.
  const room = new Int32Array(N).fill(-1);
  let nRooms = 0;
  for (let i = 0; i < N; i++) {
    if (wall[i] || room[i] >= 0 || ((i / w) | 0) === hallRow) continue;
    const st = [i];
    room[i] = nRooms;
    while (st.length) {
      const a = st.pop()!;
      for (const d of D) {
        const b = a + d;
        if (!wall[b] && room[b] < 0 && ((b / w) | 0) !== hallRow) { room[b] = nRooms; st.push(b); }
      }
    }
    nRooms++;
  }
  let hallTarget = -1;
  for (let i = hallRow * w; i < hallRow * w + w; i++) if (!wall[i]) { hallTarget = i; break; }
  const occ = new Uint8Array(N);
  for (const b of boxes) occ[b] = 1;

  // Squares reachable by the player from p, with boxes (occ) blocking.
  const mark = new Int32Array(N);
  let stamp = 0;
  const reach = (p: number): number => {
    stamp++;
    const st = [p];
    mark[p] = stamp;
    let mn = p;
    while (st.length) {
      const a = st.pop()!;
      if (a < mn) mn = a;
      for (const d of D) {
        const b = a + d;
        if (!wall[b] && !occ[b] && mark[b] !== stamp) { mark[b] = stamp; st.push(b); }
      }
    }
    return mn;
  };

  const solveRoom = (r: number, start: number, mustExit: boolean): Push[] | null => {
    const rb = boxes.filter((b) => room[b] === r);
    if (rb.length === 0) return [];
    // Live squares: from where a box can be pushed onto some goal (reverse pulls from goals inside the room).
    const live = new Uint8Array(N);
    const st: number[] = [];
    for (let i = 0; i < N; i++) if (goal[i] && room[i] === r) { live[i] = 1; st.push(i); }
    while (st.length) {
      const a = st.pop()!;
      for (const d of D) {
        const b = a + d, p = a + 2 * d;
        if (room[b] === r && !live[b] && !wall[b] && !wall[p]) { live[b] = 1; st.push(b); }
      }
    }
    for (const b of rb) occ[b] = 0;
    const setBoxes = (bs: number[], v: number) => { for (const b of bs) occ[b] = v; };
    const keyOf = (bs: number[], pn: number) => bs.join(',') + ':' + pn;
    const sB: number[][] = [], sP: number[] = [], par: number[] = [], mv: Push[] = [];
    const seen = new Set<string>();
    const sorted = [...rb].sort((a, b) => a - b);
    setBoxes(sorted, 1);
    seen.add(keyOf(sorted, reach(start)));
    setBoxes(sorted, 0);
    sB.push(sorted); sP.push(start); par.push(-1); mv.push([0, 0]);
    let found = -1;
    for (let q = 0; q < sB.length && found < 0; q++) {
      const bs = sB[q];
      setBoxes(bs, 1);
      if (bs.every((b) => goal[b])) {
        reach(sP[q]);
        if (!mustExit || mark[hallTarget] === stamp) { found = q; setBoxes(bs, 0); break; }
      }
      reach(sP[q]);
      const m = stamp;
      const cand: [number, number][] = [];
      for (let k = 0; k < bs.length; k++) {
        const b = bs[k];
        for (let d = 0; d < 4; d++) {
          const t = b + D[d];
          if (mark[b - D[d]] !== m || wall[t] || occ[t] || !live[t] || room[t] !== r) continue;
          cand.push([k, d]);
        }
      }
      for (const [k, d] of cand) {
        const b = bs[k], t = b + D[d];
        const nb = bs.slice();
        nb[k] = t;
        nb.sort((a, c) => a - c);
        occ[b] = 0; occ[t] = 1;
        // Simple freeze check: 2x2 blocks of walls/boxes with a box off goal.
        let dead = false;
        for (const [dx, dy] of [[-1, -w], [-1, w], [1, -w], [1, w]]) {
          const sq = [t, t + dx, t + dy, t + dx + dy];
          if (sq.every((s) => wall[s] || occ[s]) && sq.some((s) => occ[s] && !goal[s])) { dead = true; break; }
        }
        if (!dead) {
          const key = keyOf(nb, reach(b));
          if (!seen.has(key)) {
            seen.add(key);
            sB.push(nb); sP.push(b); par.push(q); mv.push([b, d]);
          }
        }
        occ[t] = 0; occ[b] = 1;
      }
      setBoxes(bs, 0);
    }
    setBoxes(rb, 1);
    if (found < 0) return null;
    const out: Push[] = [];
    for (let q = found; par[q] >= 0; q = par[q]) out.push(mv[q]);
    return out.reverse();
  };

  // Solve each room both ways; at most one room (the last) may leave the player shut inside it.
  const plans: { r: number; free: Push[] | null; exit: Push[] | null }[] = [];
  for (let r = 0; r < nRooms; r++) {
    const free = solveRoom(r, player, false);
    const exit = solveRoom(r, player, true);
    plans.push({ r, free, exit });
  }
  let lastIdx = -1, gain = 0;
  plans.forEach((p, i) => {
    const g = p.exit === null ? 1e9 : p.free ? p.exit.length - p.free.length : 0;
    if (p.free && g > gain) { gain = g; lastIdx = i; }
  });
  const order = plans.filter((_, i) => i !== lastIdx);
  if (lastIdx >= 0) order.push(plans[lastIdx]);

  // Turn pushes into moves.
  let pos = player, moves = '';
  const walk = (from: number, to: number): string | null => {
    if (from === to) return '';
    const prev = new Int32Array(N).fill(-1);
    prev[from] = from;
    const qu = [from];
    for (let qi = 0; qi < qu.length; qi++) {
      const a = qu[qi];
      for (let d = 0; d < 4; d++) {
        const b = a + D[d];
        if (wall[b] || occ[b] || prev[b] >= 0) continue;
        prev[b] = a;
        if (b === to) {
          let s = '';
          for (let c = to; c !== from; c = prev[c]) s = L[D.indexOf(c - prev[c])] + s;
          return s;
        }
        qu.push(b);
      }
    }
    return null;
  };
  order.forEach((p, i) => {
    const pushes = (i === order.length - 1 ? p.free : p.exit) ?? p.free;
    if (!pushes) return;
    for (const [b, d] of pushes) {
      const wk = walk(pos, b - D[d]);
      if (wk === null) return;
      moves += wk + L[d].toUpperCase();
      occ[b] = 0;
      occ[b + D[d]] = 1;
      pos = b;
    }
  });
  return moves;
}

for (const id of readdirSync(I).sort()) {
  let moves = '';
  try { moves = solve(readFileSync(join(I, id, 'level.txt'), 'utf8')); } catch {}
  mkdirSync(join(O, id), { recursive: true });
  writeFileSync(join(O, id, 'solution.txt'), `${moves}\n`);
}
