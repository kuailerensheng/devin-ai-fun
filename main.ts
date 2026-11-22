// A tiny stack VM for make.fun's ISA v1: runs every /input/<id>/program.bin and writes stdout.bin and exit.txt.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
// opcode -> [immediate bytes, pops, pushes]
const OPS: Record<number, number[]> = {
  0: [0, 0, 0], 1: [1, 0, 1], 2: [4, 0, 1], 3: [0, 1, 0], 4: [0, 1, 2], 5: [0, 2, 2], 6: [0, 2, 3], 7: [0, 3, 3],
  0x17: [0, 1, 1], 0x1b: [0, 1, 1], 0x30: [2, 0, 0], 0x31: [2, 1, 0], 0x32: [2, 1, 0], 0x33: [2, 0, 0], 0x34: [0, 0, 0],
  0x40: [0, 1, 1], 0x41: [0, 2, 0], 0x50: [0, 1, 0], 0x51: [0, 1, 0], 0x52: [0, 0, 1], 0x53: [0, 1, 0],
};
for (const b of [0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x18, 0x19, 0x1a, 0x1c, 0x1d, 0x1e, 0x20, 0x21, 0x22]) OPS[b] = [0, 2, 1];

function run(p: Uint8Array, inp: Uint8Array): [Uint8Array, number] {
  const n = p.length, D = new Int32Array(257), C: number[] = [], M = new Int32Array(256), out = new Uint8Array(65536);
  let sp = 0, ol = 0, ip = 0, pc = 0, steps = 0;
  const end = (code: number): [Uint8Array, number] => [out.slice(0, ol), code];
  const emit = (bytes: number[]) => {
    if (ol + bytes.length > 65536) return false;
    for (const x of bytes) out[ol++] = x;
    return true;
  };
  for (;;) {
    if (steps === 1e6) return end(10);
    if (pc < 0 || pc >= n) return end(9);
    const o = p[pc], d = OPS[o];
    if (!d) return end(5);
    if (pc + d[0] >= n) return end(9);
    steps++;
    if (sp < d[1]) return end(2);
    if (sp - d[1] + d[2] > 256) return end(3);
    const nx = pc + 1 + d[0];
    pc = nx;
    if (d[1] === 2 && d[2] === 1) {
      const b = D[--sp], a = D[sp - 1];
      let r = 0;
      if (o >= 0x13 && o <= 0x16 && b === 0) return end(4);
      switch (o) {
        case 0x10: r = (a + b) | 0; break;
        case 0x11: r = (a - b) | 0; break;
        case 0x12: r = Math.imul(a, b); break;
        case 0x13: r = b === -1 ? -a | 0 : (a / b) | 0; break;
        case 0x14: r = b === -1 ? 0 : a % b | 0; break;
        case 0x15: r = Math.floor((a >>> 0) / (b >>> 0)) | 0; break;
        case 0x16: r = (a >>> 0) % (b >>> 0) | 0; break;
        case 0x18: r = a & b; break;
        case 0x19: r = a | b; break;
        case 0x1a: r = a ^ b; break;
        case 0x1c: r = a << (b & 31); break;
        case 0x1d: r = a >> (b & 31); break;
        case 0x1e: r = (a >>> (b & 31)) | 0; break;
        case 0x20: r = +(a === b); break;
        case 0x21: r = +(a < b); break;
        case 0x22: r = +(a >>> 0 < b >>> 0); break;
      }
      D[sp - 1] = r;
      continue;
    }
    switch (o) {
      case 0: return end(0);
      case 1: D[sp++] = (p[nx - 1] << 24) >> 24; break;
      case 2: D[sp++] = p[nx - 4] | (p[nx - 3] << 8) | (p[nx - 2] << 16) | (p[nx - 1] << 24); break;
      case 3: sp--; break;
      case 4: D[sp] = D[sp - 1]; sp++; break;
      case 5: { const t = D[sp - 1]; D[sp - 1] = D[sp - 2]; D[sp - 2] = t; break; }
      case 6: D[sp] = D[sp - 2]; sp++; break;
      case 7: { const a = D[sp - 3]; D[sp - 3] = D[sp - 2]; D[sp - 2] = D[sp - 1]; D[sp - 1] = a; break; }
      case 0x17: D[sp - 1] = -D[sp - 1] | 0; break;
      case 0x1b: D[sp - 1] = ~D[sp - 1]; break;
      case 0x30: case 0x31: case 0x32: {
        const rel = ((p[nx - 2] | (p[nx - 1] << 8)) << 16) >> 16;
        const take = o === 0x30 || (o === 0x31) === (D[--sp] === 0);
        if (take) pc = nx + rel;
        break;
      }
      case 0x33:
        if (C.length === 64) return end(7);
        C.push(nx);
        pc = p[nx - 2] | (p[nx - 1] << 8);
        break;
      case 0x34:
        if (!C.length) return end(8);
        pc = C.pop()!;
        break;
      case 0x40: {
        const a = D[sp - 1];
        if (a < 0 || a > 255) return end(6);
        D[sp - 1] = M[a];
        break;
      }
      case 0x41: {
        const a = D[sp - 1];
        if (a < 0 || a > 255) return end(6);
        M[a] = D[sp - 2];
        sp -= 2;
        break;
      }
      case 0x50:
        if (!emit(Array.from(String(D[sp - 1]), (ch) => ch.charCodeAt(0)))) return end(11);
        sp--;
        break;
      case 0x51:
        if (!emit([D[sp - 1] & 255])) return end(11);
        sp--;
        break;
      case 0x52: D[sp++] = ip < inp.length ? inp[ip++] : -1; break;
      case 0x53: return end(D[--sp] & 255);
    }
  }
}

for (const id of readdirSync(I).sort()) {
  const dir = join(O, id);
  mkdirSync(dir, { recursive: true });
  let res: [Uint8Array, number] = [new Uint8Array(0), 0];
  try {
    let inp = new Uint8Array(0);
    try { inp = readFileSync(join(I, id, 'input.bin')); } catch {}
    res = run(readFileSync(join(I, id, 'program.bin')), inp);
  } catch {}
  writeFileSync(join(dir, 'stdout.bin'), res[0]);
  writeFileSync(join(dir, 'exit.txt'), res[1] + '\n');
}
