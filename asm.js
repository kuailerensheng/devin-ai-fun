// The record loop as an asm.js module: the escaped JSON text of a case is read in the heap and its answer written there as JSON bytes.
export function CsvAsm(stdlib, foreign, heap) {
  'use asm';
  var H = new stdlib.Uint8Array(heap);
  var I = new stdlib.Int32Array(heap);
  var end = 0, p = 0, line = 0, recLine = 0, recRow = 0, ended = 0, added = 0;
  var o = 0, olim = 0, e = 0, elim = 0, ne = 0, ovf = 0;

  function needO(n) {
    n = n | 0;
    if ((((o + n) | 0) | 0) > (olim | 0)) {
      ovf = 1;
      return 0;
    }
    return 1;
  }
  function needE(n) {
    n = n | 0;
    if ((((e + n) | 0) | 0) > (elim | 0)) {
      ovf = 1;
      return 0;
    }
    return 1;
  }
  function put(c) {
    c = c | 0;
    if (needO(1) | 0) {
      H[o >> 0] = c;
      o = (o + 1) | 0;
    }
  }
  function eput(c) {
    c = c | 0;
    if (needE(1) | 0) {
      H[e >> 0] = c;
      e = (e + 1) | 0;
    }
  }
  function cp(a, b) {
    a = a | 0;
    b = b | 0;
    var k = 0;
    k = (b - a) | 0;
    added = (added + k) | 0;
    if (!(needO(k) | 0)) return;
    while ((a | 0) < (b | 0)) {
      H[o >> 0] = H[a >> 0] | 0;
      o = (o + 1) | 0;
      a = (a + 1) | 0;
    }
  }
  function str(i) {
    i = i | 0;
    var a = 0, b = 0;
    a = I[(512 + (i << 3)) >> 2] | 0;
    b = (a + (I[(516 + (i << 3)) >> 2] | 0)) | 0;
    if (!(needO((b - a) | 0) | 0)) return;
    while ((a | 0) < (b | 0)) {
      H[o >> 0] = H[a >> 0] | 0;
      o = (o + 1) | 0;
      a = (a + 1) | 0;
    }
  }
  function estr(i) {
    i = i | 0;
    var a = 0, b = 0;
    a = I[(512 + (i << 3)) >> 2] | 0;
    b = (a + (I[(516 + (i << 3)) >> 2] | 0)) | 0;
    if (!(needE((b - a) | 0) | 0)) return;
    while ((a | 0) < (b | 0)) {
      H[e >> 0] = H[a >> 0] | 0;
      e = (e + 1) | 0;
      a = (a + 1) | 0;
    }
  }
  function enumber(v) {
    v = v | 0;
    var t = 0, n = 0, q = 0;
    if ((v | 0) == 0) {
      eput(48);
      return;
    }
    t = v;
    while ((t | 0) > 0) {
      n = (n + 1) | 0;
      t = ((t | 0) / 10) | 0;
    }
    if (!(needE(n) | 0)) return;
    q = (e + n) | 0;
    e = q;
    while ((v | 0) > 0) {
      q = (q - 1) | 0;
      H[q >> 0] = (48 + (((v | 0) % 10) | 0)) | 0;
      v = ((v | 0) / 10) | 0;
    }
  }
  function errHead(code) {
    code = code | 0;
    if ((ne | 0) > 0) eput(44);
    ne = (ne + 1) | 0;
    estr(code);
    enumber(recLine);
    estr(11);
    if ((recRow | 0) < 0) estr(1);
    else enumber(recRow);
  }
  function err(code) {
    code = code | 0;
    errHead(code);
    eput(125);
  }
  function isLf(q) {
    q = q | 0;
    if ((((q + 1) | 0) | 0) >= (end | 0)) return 0;
    if ((H[q >> 0] | 0) != 92) return 0;
    return ((H[(q + 1) >> 0] | 0) == 110) | 0;
  }
  function unq() {
    var q = 0, c = 0, d = 0, o1 = 0;
    q = p;
    o1 = o;
    while ((q | 0) < (end | 0)) {
      c = H[q >> 0] | 0;
      if ((c | 0) == 44) {
        p = (q + 1) | 0;
        ended = 0;
        added = (o - o1) | 0;
        return;
      }
      if ((c | 0) == 92) {
        d = H[(q + 1) >> 0] | 0;
        if ((d | 0) == 110) {
          p = (q + 2) | 0;
          line = (line + 1) | 0;
          ended = 1;
          added = (o - o1) | 0;
          return;
        }
        if ((d | 0) == 114) {
          if (isLf((q + 2) | 0) | 0) {
            p = (q + 4) | 0;
            line = (line + 1) | 0;
            ended = 1;
            added = (o - o1) | 0;
            return;
          }
          err(6);
          q = (q + 2) | 0;
          continue;
        }
        if ((d | 0) == 117) ovf = 2;
        H[o >> 0] = 92;
        H[(o + 1) >> 0] = d;
        o = (o + 2) | 0;
        q = (q + 2) | 0;
        continue;
      }
      H[o >> 0] = c;
      o = (o + 1) | 0;
      q = (q + 1) | 0;
    }
    p = end;
    ended = 2;
    added = (o - o1) | 0;
  }
  function quo() {
    var open = 0, openLine = 0, o0 = 0, q = 0, c = 0, d = 0;
    open = p;
    openLine = line;
    o0 = o;
    q = (p + 2) | 0;
    for (;;) {
      if ((q | 0) >= (end | 0)) {
        o = o0;
        line = openLine;
        err(7);
        H[o >> 0] = 92;
        H[(o + 1) >> 0] = 34;
        o = (o + 2) | 0;
        p = (open + 2) | 0;
        unq();
        return;
      }
      c = H[q >> 0] | 0;
      if ((c | 0) != 92) {
        H[o >> 0] = c;
        o = (o + 1) | 0;
        q = (q + 1) | 0;
        continue;
      }
      d = H[(q + 1) >> 0] | 0;
      if ((d | 0) == 34) {
        if ((((q + 3) | 0) | 0) < (end | 0)) {
          if ((H[(q + 2) >> 0] | 0) == 92) {
            if ((H[(q + 3) >> 0] | 0) == 34) {
              H[o >> 0] = 92;
              H[(o + 1) >> 0] = 34;
              o = (o + 2) | 0;
              q = (q + 4) | 0;
              continue;
            }
          }
        }
        p = (q + 2) | 0;
        break;
      }
      if ((d | 0) == 114) {
        H[o >> 0] = 92;
        H[(o + 1) >> 0] = 110;
        o = (o + 2) | 0;
        line = (line + 1) | 0;
        q = (q + 2) | 0;
        if (isLf(q) | 0) q = (q + 2) | 0;
        continue;
      }
      if ((d | 0) == 110) line = (line + 1) | 0;
      if ((d | 0) == 117) ovf = 2;
      H[o >> 0] = 92;
      H[(o + 1) >> 0] = d;
      o = (o + 2) | 0;
      q = (q + 2) | 0;
    }
    if ((p | 0) >= (end | 0)) {
      ended = 2;
      return;
    }
    c = H[p >> 0] | 0;
    if ((c | 0) == 44) {
      p = (p + 1) | 0;
      ended = 0;
      return;
    }
    if ((c | 0) == 92) {
      d = H[(p + 1) >> 0] | 0;
      if ((d | 0) == 110) {
        p = (p + 2) | 0;
        line = (line + 1) | 0;
        ended = 1;
        return;
      }
      if ((d | 0) == 114) {
        if (isLf((p + 2) | 0) | 0) {
          p = (p + 4) | 0;
          line = (line + 1) | 0;
          ended = 1;
          return;
        }
      }
    }
    unq();
    if ((added | 0) > 0) err(8);
  }
  function answer(s, stop, hdr, o0, olim0, e0, elim0) {
    s = s | 0;
    stop = stop | 0;
    hdr = hdr | 0;
    o0 = o0 | 0;
    olim0 = olim0 | 0;
    e0 = e0 | 0;
    elim0 = elim0 | 0;
    var width = -1, nrows = 0, cols = 0, isHead = 0, r00 = 0, nf = 0, isQ = 0, cutAt = 0, len = 0, fs = 0, d = 0, k = 0;
    end = stop;
    o = o0;
    olim = olim0;
    e = e0;
    elim = elim0;
    ne = 0;
    ovf = 0;
    line = 1;
    p = s;
    if (((((o0 + ((stop - s) << 2)) | 0) + 256) | 0) > (olim0 | 0)) return -1;
    if ((((s + 2) | 0) | 0) < (end | 0))
      if ((H[s >> 0] | 0) == 0xef)
        if ((H[(s + 1) >> 0] | 0) == 0xbb)
          if ((H[(s + 2) >> 0] | 0) == 0xbf) p = (s + 3) | 0;
    str(0);
    if (!hdr) {
      str(1);
      str(3);
      cols = 1;
    }
    for (;;) {
      while ((p | 0) < (end | 0)) {
        if ((H[p >> 0] | 0) != 92) break;
        d = H[(p + 1) >> 0] | 0;
        if ((d | 0) == 110) {
          p = (p + 2) | 0;
          line = (line + 1) | 0;
        } else if ((d | 0) == 114) {
          if (!(isLf((p + 2) | 0) | 0)) break;
          p = (p + 4) | 0;
          line = (line + 1) | 0;
        } else break;
      }
      if ((p | 0) >= (end | 0)) break;
      recLine = line;
      isHead = cols ? 0 : 1;
      recRow = isHead ? -1 : nrows;
      r00 = o;
      if ((nrows | 0) > 0) {
        H[o >> 0] = 44;
        o = (o + 1) | 0;
      }
      H[o >> 0] = 91;
      o = (o + 1) | 0;
      nf = 0;
      isQ = 0;
      cutAt = -1;
      len = 0;
      do {
        if ((nf | 0) > 0) {
          H[o >> 0] = 44;
          o = (o + 1) | 0;
        }
        if ((nf | 0) == (width | 0)) cutAt = o;
        H[o >> 0] = 34;
        o = (o + 1) | 0;
        fs = o;
        isQ = 0;
        if ((((p + 1) | 0) | 0) < (end | 0))
          if ((H[p >> 0] | 0) == 92)
            if ((H[(p + 1) >> 0] | 0) == 34) isQ = 1;
        if (isQ) quo();
        else unq();
        len = (o - fs) | 0;
        H[o >> 0] = 34;
        o = (o + 1) | 0;
        nf = (nf + 1) | 0;
      } while ((ended | 0) == 0);
      if ((nf | 0) == 1)
        if ((len | 0) == 0)
          if (!isQ) {
            o = r00;
            continue;
          }
      if ((width | 0) < 0) width = nf;
      if (isHead) {
        put(93);
        str(3);
        cols = 1;
        continue;
      }
      if ((nf | 0) < (width | 0)) {
        errHead(9);
        estr(12);
        enumber(nf);
        eput(125);
        if (needO(imul3((width - nf) | 0) | 0) | 0) {
          for (k = nf; (k | 0) < (width | 0); k = (k + 1) | 0) {
            H[o >> 0] = 44;
            H[(o + 1) >> 0] = 34;
            H[(o + 2) >> 0] = 34;
            o = (o + 3) | 0;
          }
        }
        if (((((o + ((end - p) << 2)) | 0) + 256) | 0) > (olim | 0)) ovf = 1;
      } else if ((nf | 0) > (width | 0)) {
        errHead(10);
        estr(13);
        if (needE((o - cutAt) | 0) | 0) {
          for (k = cutAt; (k | 0) < (o | 0); k = (k + 1) | 0) {
            H[e >> 0] = H[k >> 0] | 0;
            e = (e + 1) | 0;
          }
        }
        eput(93);
        eput(125);
        o = (cutAt - 1) | 0;
      }
      H[o >> 0] = 93;
      o = (o + 1) | 0;
      nrows = (nrows + 1) | 0;
    }
    if (!cols) {
      str(2);
      str(3);
    }
    str(4);
    if (needO((e - e0) | 0) | 0) {
      for (k = e0; (k | 0) < (e | 0); k = (k + 1) | 0) {
        H[o >> 0] = H[k >> 0] | 0;
        o = (o + 1) | 0;
      }
    }
    str(5);
    if ((ovf | 0) == 2) return -2;
    if (ovf) return -1;
    return o | 0;
  }
  function imul3(x) {
    x = x | 0;
    return ((x << 1) + x) | 0;
  }
  return { answer: answer };
}
