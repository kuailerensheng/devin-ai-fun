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
