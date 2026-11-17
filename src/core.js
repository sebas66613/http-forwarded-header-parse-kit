// Parsing for the RFC 7239 `Forwarded` header.
//
// The header is a comma-separated list of hops, each hop being a
// semicolon-separated list of `token=value` parameters. Values are either
// tokens or quoted-strings. We keep the raw text of every value alongside a
// best-effort decoded form because callers usually want the decoded form but
// occasionally need to know what was actually on the wire.

const TOKEN_RE = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

/**
 * One proxy hop from a Forwarded header.
 *
 * `by`, `for`, `host` and `proto` are the RFC 7239 parameters; anything else
 * lands in `params`. Values are the decoded strings (quoted-strings unescaped,
 * IPv6 bracket form preserved) and `raw` holds the undecoded text for each
 * parameter so a caller can distinguish `for="[::1]:80"` from the token form.
 */
export class ForwardedHop {
  constructor() {
    this.by = null;
    this.for = null;
    this.host = null;
    this.proto = null;
    this.params = Object.create(null);
    this.raw = Object.create(null);
  }
}

/**
 * Parse a Forwarded header value into an array of hops.
 *
 * An empty or whitespace-only value yields an empty array: RFC 7239 allows the
 * header to be present with no value, and callers generally want "no hops"
 * rather than an error for that case.
 *
 * A malformed element throws a SyntaxError. We do not silently skip bad hops
 * because a proxy chain that is missing a link is worse than a loud failure.
 *
 * @param {string} header
 * @returns {ForwardedHop[]}
 */
export function parseForwardedHeader(header) {
  if (typeof header !== 'string') {
    throw new TypeError('Forwarded header must be a string');
  }
  const hops = [];
  let i = 0;
  const n = header.length;

  // Skip leading optional whitespace.
  while (i < n && isOws(header[i])) i++;
  if (i === n) return hops;

  while (i < n) {
    const hop = new ForwardedHop();
    i = parseHop(header, i, hop);
    hops.push(hop);

    // After a hop we expect either end, or a comma followed by another hop.
    i = skipOws(header, i);
    if (i === n) break;
    if (header[i] !== ',') {
      throw new SyntaxError(`expected ',' at offset ${i}`);
    }
    i++;
    i = skipOws(header, i);
    if (i === n) {
      // Trailing comma with nothing after it is malformed.
      throw new SyntaxError('trailing comma in Forwarded header');
    }
  }
  return hops;
}

// Convenience alias matching the shorter name used in the README.
export const parseForwarded = parseForwardedHeader;

function parseHop(s, start, hop) {
  let i = start;
  const n = s.length;
  let first = true;
  for (;;) {
    if (!first) {
      // Between parameters we require a semicolon.
      if (i >= n || s[i] !== ';') {
        throw new SyntaxError(`expected ';' at offset ${i}`);
      }
      i++;
      i = skipOws(s, i);
    }
    first = false;

    const nameStart = i;
    while (i < n && isTokenChar(s[i])) i++;
    if (i === nameStart) {
      throw new SyntaxError(`expected parameter name at offset ${i}`);
    }
    const name = s.slice(nameStart, i).toLowerCase();

    i = skipOws(s, i);
    if (i >= n || s[i] !== '=') {
      throw new SyntaxError(`expected '=' at offset ${i}`);
    }
    i++;
    i = skipOws(s, i);

    const valueStart = i;
    let value;
    if (i < n && s[i] === '"') {
      const res = parseQuotedString(s, i);
      value = res.value;
      i = res.next;
    } else {
      const tokStart = i;
      while (i < n && isTokenChar(s[i])) i++;
      if (i === tokStart) {
        throw new SyntaxError(`expected parameter value at offset ${i}`);
      }
      value = s.slice(tokStart, i);
    }
    const raw = s.slice(valueStart, i);

    assignParam(hop, name, value, raw);

    const after = skipOws(s, i);
    if (after >= n) return after;
    const c = s[after];
    if (c === ';') {
      i = after;
      continue;
    }
    if (c === ',') {
      return after;
    }
    throw new SyntaxError(`unexpected character '${c}' at offset ${after}`);
  }
}

function assignParam(hop, name, value, raw) {
  hop.raw[name] = raw;
  switch (name) {
    case 'by':
      hop.by = value;
      return;
    case 'for':
      hop.for = value;
      return;
    case 'host':
      hop.host = value;
      return;
    case 'proto':
      hop.proto = value;
      return;
    default:
      // Unknown parameters are kept rather than dropped; RFC 7239 says
      // recipients should ignore them, and dropping them loses information
      // a caller might legitimately want.
      hop.params[name] = value;
  }
}

// Parse a quoted-string starting at the opening quote. Returns the decoded
// value and the index just past the closing quote. Backslash escapes are
// resolved as required by RFC 7230 quoted-string rules.
function parseQuotedString(s, start) {
  const n = s.length;
  let i = start + 1;
  let out = '';
  while (i < n) {
    const c = s[i];
    if (c === '\\') {
      if (i + 1 >= n) {
        throw new SyntaxError('unterminated escape in quoted-string');
      }
      out += s[i + 1];
      i += 2;
      continue;
    }
    if (c === '"') {
      return { value: out, next: i + 1 };
    }
    out += c;
    i++;
  }
  throw new SyntaxError('unterminated quoted-string');
}

function skipOws(s, i) {
  const n = s.length;
  while (i < n && isOws(s[i])) i++;
  return i;
}

function isOws(c) {
  return c === ' ' || c === '\t';
}

function isTokenChar(c) {
  return TOKEN_RE.test(c);
}
