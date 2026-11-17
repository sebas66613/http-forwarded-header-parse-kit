import test from 'node:test';
import assert from 'node:assert/strict';

import { parseForwarded, parseForwardedHeader, ForwardedHop } from '../src/index.js';

test('empty header yields no hops', () => {
  assert.deepEqual(parseForwarded(''), []);
  assert.deepEqual(parseForwarded('   \t  '), []);
});

test('single hop with all four standard parameters', () => {
  const hops = parseForwarded('for=192.0.2.60;proto=http;by=203.0.113.43;host=example.org');
  assert.equal(hops.length, 1);
  const h = hops[0];
  assert.equal(h.for, '192.0.2.60');
  assert.equal(h.proto, 'http');
  assert.equal(h.by, '203.0.113.43');
  assert.equal(h.host, 'example.org');
  assert.equal(h.raw.for, '192.0.2.60');
});

test('parameter names are case-insensitive', () => {
  const hops = parseForwarded('For=192.0.2.1;PROTO=https');
  assert.equal(hops[0].for, '192.0.2.1');
  assert.equal(hops[0].proto, 'https');
});

test('multiple hops are separated and ordered', () => {
  const hops = parseForwarded('for=192.0.2.1, for=192.0.2.2;proto=https, for=192.0.2.3');
  assert.equal(hops.length, 3);
  assert.equal(hops[0].for, '192.0.2.1');
  assert.equal(hops[1].for, '192.0.2.2');
  assert.equal(hops[1].proto, 'https');
  assert.equal(hops[2].for, '192.0.2.3');
  assert.equal(hops[2].proto, null);
});

test('quoted-string values are decoded', () => {
  const hops = parseForwarded('for="[2001:db8::1]:8080";host="example.org:443"');
  assert.equal(hops[0].for, '[2001:db8::1]:8080');
  assert.equal(hops[0].host, 'example.org:443');
  // Raw text preserves the quotes so callers can tell them apart.
  assert.equal(hops[0].raw.for, '"[2001:db8::1]:8080"');
});

test('backslash escapes inside quoted-strings are resolved', () => {
  const hops = parseForwarded('host="a\\"b"');
  assert.equal(hops[0].host, 'a"b');
});

test('whitespace around separators is tolerated', () => {
  const hops = parseForwarded('  for=192.0.2.1 ; proto=https , for=192.0.2.2  ');
  assert.equal(hops.length, 2);
  assert.equal(hops[0].proto, 'https');
  assert.equal(hops[1].for, '192.0.2.2');
});

test('unknown parameters are retained in params', () => {
  const hops = parseForwarded('for=192.0.2.1;secret="x y"');
  assert.equal(hops[0].params.secret, 'x y');
  assert.equal(hops[0].raw.secret, '"x y"');
});

test('last occurrence of a duplicated parameter wins', () => {
  const hops = parseForwarded('for=192.0.2.1;for=192.0.2.2');
  assert.equal(hops[0].for, '192.0.2.2');
});

test('malformed inputs throw SyntaxError', () => {
  assert.throws(() => parseForwarded('for'), SyntaxError);
  assert.throws(() => parseForwarded('for='), SyntaxError);
  assert.throws(() => parseForwarded('for="unterminated'), SyntaxError);
  assert.throws(() => parseForwarded('for=192.0.2.1,'), SyntaxError);
  assert.throws(() => parseForwarded('for=192.0.2.1 for=192.0.2.2'), SyntaxError);
  assert.throws(() => parseForwarded('for=192.0.2.1;flag'), SyntaxError);
});

test('non-string input throws TypeError', () => {
  assert.throws(() => parseForwarded(null), TypeError);
  assert.throws(() => parseForwarded(42), TypeError);
});

test('ForwardedHop instances are produced', () => {
  const hops = parseForwarded('for=192.0.2.1');
  assert.ok(hops[0] instanceof ForwardedHop);
});

test('parseForwardedHeader is the long-form name for the same function', () => {
  assert.equal(parseForwarded, parseForwardedHeader);
});

test('params and raw use null-prototype objects', () => {
  const hops = parseForwarded('for=192.0.2.1');
  assert.equal(Object.getPrototypeOf(hops[0].params), null);
  assert.equal(Object.getPrototypeOf(hops[0].raw), null);
});
