// A faster reader with csv-reader 1.0.0's exact answers: fields are sliced from the text instead of built a character at a time.
const NL = 10, CR = 13, QU = 34, CO = 44;

export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const n = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;
  let pos = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  let line = 1;
  let recordLine = 1;
  let recordRow = null;
  let ended = 0; // 0 comma, 1 line break, 2 end
  let added = 0;

  function unquoted(value) {
    let start = pos;
    added = 0;
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === CO) {
        added += pos - start;
        value += text.slice(start, pos);
        pos += 1;
        ended = 0;
        return value;
      }
      if (c === NL) {
        added += pos - start;
        value += text.slice(start, pos);
        pos += 1;
        line += 1;
        ended = 1;
        return value;
      }
      if (c === CR) {
        added += pos - start;
        value += text.slice(start, pos);
        if (text.charCodeAt(pos + 1) === NL) {
          pos += 2;
          line += 1;
          ended = 1;
          return value;
        }
        errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
        pos += 1;
        start = pos;
        continue;
      }
      pos++;
    }
    added += pos - start;
    value += text.slice(start, pos);
    ended = 2;
    return value;
  }

  function segment(a, b) {
    let s = text.slice(a, b);
    if (s.indexOf('\r') >= 0) s = s.replace(/\r\n?/g, '\n');
    let k = s.indexOf('\n');
    while (k >= 0) {
      line++;
      k = s.indexOf('\n', k + 1);
    }
    return s;
  }

  function quoted() {
    const open = pos;
    const openLine = line;
    let value = '';
    let a = pos + 1;
    for (;;) {
      const q = text.indexOf('"', a);
      if (q < 0) {
        pos = open + 1;
        line = openLine;
        errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
        return unquoted('"');
      }
      value += segment(a, q);
      if (text.charCodeAt(q + 1) === QU) {
        value += '"';
        a = q + 2;
        continue;
      }
      pos = q + 1;
      break;
    }
    if (pos >= n) {
      ended = 2;
      return value;
    }
    const c = text.charCodeAt(pos);
    if (c === CO) {
      pos += 1;
      ended = 0;
      return value;
    }
    if (c === NL) {
      pos += 1;
      line += 1;
      ended = 1;
      return value;
    }
    if (c === CR && text.charCodeAt(pos + 1) === NL) {
      pos += 2;
      line += 1;
      ended = 1;
      return value;
    }
    value = unquoted(value);
    if (added > 0) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
    return value;
  }

  for (;;) {
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === NL) {
        pos += 1;
        line += 1;
      } else if (c === CR && text.charCodeAt(pos + 1) === NL) {
        pos += 2;
        line += 1;
      } else break;
    }
    if (pos >= n) break;
    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let isQ;
    do {
      isQ = text.charCodeAt(pos) === QU;
      fields.push(isQ ? quoted() : unquoted(''));
    } while (ended === 0);
    if (fields.length === 1 && fields[0] === '' && !isQ) continue;
    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}

import { CsvAsm } from './asm.js';
import { openSync, fstatSync, readSync, closeSync } from 'node:fs';

// The fast path: cases.json's bytes go into an asm.js heap, each case's text is answered there in its escaped form, and
// the answers come back as JSON bytes. A case whose text has a \u escape is answered by run(); anything unexpected throws.
const STR = ['{"columns":', 'null', '[]', ',"rows":[', '],"errors":[', ']}', '{"code":"stray_cr","line":',
  '{"code":"unterminated_quote","line":', '{"code":"quote_junk","line":', '{"code":"short_row","line":',
  '{"code":"long_row","line":', ',"row":', ',"fields":', ',"extra":['];
let B;

function heapSize(n) {
  if (n <= 1 << 24) {
    let s = 1 << 16;
    while (s < n) s *= 2;
    return s;
  }
  return Math.ceil(n / (1 << 24)) * (1 << 24);
}

function attempt(L, fill, mult, run) {
  const IN = 1024;
  const OUT = (IN + L + 64) & ~7;
  const outSize = (4 * L + (1 << 20)) * mult;
  const ERR = OUT + outSize;
  const errSize = (L + (1 << 16)) * mult;
  const heap = new ArrayBuffer(heapSize(ERR + errSize));
  const u8 = new Uint8Array(heap);
  const i32 = new Int32Array(heap);
  let at = 0;
  STR.forEach((s, k) => {
    i32[(512 + k * 8) >> 2] = at;
    i32[(516 + k * 8) >> 2] = s.length;
    for (let j = 0; j < s.length; j++) u8[at++] = s.charCodeAt(j);
  });
  fill(u8, IN);
  B = Buffer.from(heap, IN, L);
  const asm = CsvAsm(globalThis, {}, heap);
  let o = OUT;
  let i = ws(0);
  if (B[i] !== 91) throw new Error('not an array');
  u8[o++] = 91;
  i = ws(i + 1);
  if (B[i] === 93) i++;
  else
    for (let first = true; ; first = false) {
      let ts = -1, te = -1, hdr = false, seen = false;
      i = object(i, (k, j) => {
        if (k !== 'input') return skip(j);
        seen = true;
        ts = -1;
        hdr = false;
        return object(j, (k2, j2) => {
          if (k2 === 'text') {
            if (B[j2] !== 34) throw new Error('text not a string');
            ts = j2 + 1;
            te = strEnd(ts);
            return te + 1;
          }
          if (k2 === 'header') hdr = B[j2] === 116 && B[j2 + 1] === 114 && B[j2 + 2] === 117 && B[j2 + 3] === 101;
          return skip(j2);
        });
      });
      if (!seen || ts < 0) throw new Error('no text');
      if (!first) u8[o++] = 44;
      const o1 = asm.answer(IN + ts, IN + te, hdr ? 1 : 0, o, ERR - 2, ERR, ERR + errSize);
      if (o1 === -1) return null;
      if (o1 === -2) {
        const text = JSON.parse(B.toString('utf8', ts - 1, te + 1));
        const out = Buffer.from(JSON.stringify(run({ text, header: hdr })));
        if (o + out.length + 2 > ERR) return null;
        u8.set(out, o);
        o += out.length;
      } else o = o1;
      i = ws(i);
      if (B[i] === 44) i = ws(i + 1);
      else if (B[i] === 93) break;
      else throw new Error('bad array');
    }
  u8[o++] = 93;
  return u8.subarray(OUT, o);
}

function answerWith(L, fill, run) {
  for (let mult = 1; mult <= 256; mult *= 4) {
    const r = attempt(L, fill, mult, run);
    if (r) return r;
  }
  throw new Error('answers too large');
}

export function answerPath(path, run) {
  const fd = openSync(path, 'r');
  const L = fstatSync(fd).size;
  const r = answerWith(L, (u8, at) => {
    for (let off = 0; off < L; ) {
      const n = readSync(fd, u8, at + off, L - off, off);
      if (n <= 0) throw new Error('short read');
      off += n;
    }
  }, run);
  return r;
}

export function answerBuffer(buf, run) {
  return answerWith(buf.length, (u8, at) => u8.set(buf, at), run);
}

function ws(i) {
  for (;;) {
    const c = B[i];
    if (c === 32 || c === 10 || c === 13 || c === 9) i++;
    else return i;
  }
}
function strEnd(i) {
  let q = B.indexOf(34, i);
  for (;;) {
    if (q < 0) throw new Error('bad string');
    let k = q - 1, n = 0;
    while (k >= i && B[k] === 92) {
      k--;
      n++;
    }
    if ((n & 1) === 0) return q;
    q = B.indexOf(34, q + 1);
  }
}
function skip(i) {
  i = ws(i);
  const c = B[i];
  if (c === 34) return strEnd(i + 1) + 1;
  if (c === 123 || c === 91) {
    let depth = 0;
    for (;;) {
      const d = B[i];
      if (d === 34) i = strEnd(i + 1) + 1;
      else {
        if (d === 123 || d === 91) depth++;
        else if (d === 125 || d === 93) {
          depth--;
          if (depth === 0) return i + 1;
        } else if (d === undefined) throw new Error('bad json');
        i++;
      }
    }
  }
  while (i < B.length) {
    const d = B[i];
    if (d === 44 || d === 125 || d === 93 || d === 32 || d === 10 || d === 13 || d === 9) return i;
    i++;
  }
  return i;
}
function object(i, onKey) {
  i = ws(i);
  if (B[i] !== 123) throw new Error('not an object');
  i = ws(i + 1);
  if (B[i] === 125) return i + 1;
  for (;;) {
    if (B[i] !== 34) throw new Error('bad key');
    const ke = strEnd(i + 1);
    for (let k = i + 1; k < ke; k++) if (B[k] === 92) throw new Error('escaped key');
    const k = B.latin1Slice(i + 1, ke);
    i = ws(ke + 1);
    if (B[i] !== 58) throw new Error('bad colon');
    i = onKey(k, ws(i + 1));
    i = ws(i);
    if (B[i] === 44) i = ws(i + 1);
    else if (B[i] === 125) return i + 1;
    else throw new Error('bad object');
  }
}
