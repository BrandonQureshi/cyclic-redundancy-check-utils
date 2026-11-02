import test from 'node:test';
import assert from 'node:assert/strict';

import { crc32, crc32Hex, crc32Update } from '../src/index.js';

// The reference vectors below are the published CRC-32/ISO-HDLC check
// values (the "CRC-32" in zip, gzip, and PNG). If the polynomial or the
// reflection direction were wrong, these would all fail.

test('empty input has the canonical CRC-32 value', () => {
  assert.equal(crc32(new Uint8Array(0)), 0x00000000);
});

test('check vector "123456789"', () => {
  const bytes = new TextEncoder().encode('123456789');
  assert.equal(crc32(bytes), 0xcbf43926);
  assert.equal(crc32Hex(bytes), 'cbf43926');
});

test('check vector "The quick brown fox jumps over the lazy dog"', () => {
  const bytes = new TextEncoder().encode(
    'The quick brown fox jumps over the lazy dog'
  );
  assert.equal(crc32Hex(bytes), '414fa339');
});

test('single zero byte is not the empty checksum', () => {
  assert.equal(crc32Hex(new Uint8Array([0x00])), 'd202ef8d');
  assert.notEqual(crc32Hex(new Uint8Array([0x00])), crc32Hex(new Uint8Array(0)));
});

test('hex output is always eight characters wide', () => {
  // 0x000000ff would be "ff" without padding.
  const bytes = new Uint8Array([0x00]);
  const hex = crc32Hex(bytes);
  assert.equal(hex.length, 8);
  assert.match(hex, /^[0-9a-f]{8}$/);
});

test('accepts an ArrayBuffer', () => {
  const buf = new Uint8Array([0x31, 0x32, 0x33, 0x34, 0x35]).buffer;
  assert.equal(crc32(buf), crc32(new TextEncoder().encode('12345')));
});

test('honours a typed array view with a byte offset', () => {
  const backing = new Uint8Array([0xff, 0xff, 0x31, 0x32, 0x33, 0x34, 0x35, 0xff]);
  const view = new Uint8Array(backing.buffer, 2, 5);
  assert.equal(crc32(view), crc32(new TextEncoder().encode('12345')));
});

test('streaming across chunks matches a single pass', () => {
  const whole = new TextEncoder().encode('123456789');
  const first = new TextEncoder().encode('1234');
  const second = new TextEncoder().encode('56789');

  let register = crc32Update(0xffffffff, first);
  register = crc32Update(register, second);
  const streamed = (register ^ 0xffffffff) >>> 0;

  assert.equal(streamed, crc32(whole));
});

test('streaming an empty chunk is a no-op', () => {
  const bytes = new TextEncoder().encode('123456789');
  const register = crc32Update(0xffffffff, bytes);
  assert.equal(crc32Update(register, new Uint8Array(0)), register);
});

test('rejects a seed outside the unsigned 32-bit range', () => {
  assert.throws(() => crc32Update(-1, new Uint8Array(0)), RangeError);
  assert.throws(() => crc32Update(2 ** 32, new Uint8Array(0)), RangeError);
  assert.throws(() => crc32Update(1.5, new Uint8Array(0)), RangeError);
});

test('rejects plain strings rather than guessing an encoding', () => {
  assert.throws(() => crc32('123456789'), TypeError);
});

test('rejects null and undefined', () => {
  assert.throws(() => crc32(null), TypeError);
  assert.throws(() => crc32(undefined), TypeError);
});

test('checksum is stable for a longer input', () => {
  const a = new Uint8Array(1024);
  for (let i = 0; i < a.length; i += 1) a[i] = i & 0xff;
  const b = a.slice();
  assert.equal(crc32(a), crc32(b));
  assert.equal(crc32Hex(a), crc32Hex(b));
});
