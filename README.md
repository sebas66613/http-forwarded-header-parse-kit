# http-forwarded-header-parse-kit

Parses the RFC 7239 `Forwarded` header into an ordered chain of proxy hops,
decoding quoted-string values and preserving the raw text of each parameter.

```js
import { parseForwarded } from 'http-forwarded-header-parse-kit';

const hops = parseForwarded(
  'for=192.0.2.60;proto=http;by=203.0.113.43, for="[2001:db8::1]:8080";proto=https'
);

hops[0].for;   // '192.0.2.60'
hops[0].proto; // 'http'
hops[1].for;   // '[2001:db8::1]:8080'  (brackets kept)
hops[1].raw.for; // '"[2001:db8::1]:8080"'  (as it appeared on the wire)
```

## Why this exists

The `Forwarded` header is a comma-separated list of hops, and each hop is a
semicolon-separated list of `name=value` pairs where a value is either a token
or a quoted-string. Splitting on commas breaks the moment a quoted-string
contains one, and naive `split(';')` loses the distinction between `for=::1`
and `for="::1"`. This library parses the grammar directly so those cases come
out right.

The trade-off: a malformed element throws a `SyntaxError` instead of being
skipped. A proxy chain with a silently dropped link is misleading, so the
library prefers a loud failure. Callers who want leniency can wrap the call in
try/catch.

## API

`parseForwarded(header)` (alias: `parseForwardedHeader`) returns an array of
`ForwardedHop` instances, in the order they appear in the header.

Each `ForwardedHop` has `by`, `for`, `host` and `proto` (or `null` when absent),
a `params` object for unknown parameters, and a `raw` object mapping each
parameter name to the undecoded text for that parameter. Parameter names are
lowercased; values are decoded. If a parameter appears twice in one hop, the
last occurrence wins.

An empty or whitespace-only header returns `[]`. A non-string argument throws
`TypeError`.

## The awkward edge

Quoted-string values are decoded, so `for="[2001:db8::1]:8080"` becomes the
string `[2001:db8::1]:8080` — the IPv6 brackets and port are preserved as-is,
because RFC 7239 does not ask the parser to split them apart. If you need the
address and port separately, split on the last colon yourself, and remember
that a bare IPv6 address contains colons too.
