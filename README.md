# cyclic-redundancy-check-utils

Computes CRC-32 (IEEE 802.3, reflected) checksums over byte buffers.

```js
import { crc32, crc32Hex, crc32Update } from 'cyclic-redundancy-check-utils';

const data = new TextEncoder().encode('123456789');

crc32(data);      // 3421780262  (0xcbf43926)
crc32Hex(data);   // 'cbf43926'
```

Streaming a large buffer without concatenating it:

```js
import { crc32, crc32Update } from 'cyclic-redundancy-check-utils';

const chunkA = new TextEncoder().encode('1234');
const chunkB = new TextEncoder().encode('56789');

let register = 0xffffffff;
register = crc32Update(register, chunkA);
register = crc32Update(register, chunkB);
const checksum = (register ^ 0xffffffff) >>> 0;

// equivalent to crc32(concatenated) with no copy
```

## Why this exists

CRC-32 shows up in zip, gzip, and PNG, and the standard library surface for
it is inconsistent: Node has `zlib.crc32` only from 20.15 onward, browsers
have nothing, and the polyfills on npm tend to pull in a dependency tree or
ship a table per call. This module is a single file with no dependencies and
a table built once at load.

The trade-off is scope. Only the reflected IEEE polynomial is implemented,
because that is the one every file format in the wild uses. CRC-32C
(Castagnoli) and the non-reflected CRC-32/BZIP2 variant are deliberately
absent; adding them would mean either a second table or a parameterised
constructor, and neither pays for itself here. If you need them, this is the
wrong library.

## The awkward edge

Strings are rejected. `crc32('123456789')` throws a `TypeError`. A checksum
over text depends on the byte encoding, and silently assuming UTF-8 would
make two callers disagree without either noticing. Encode first:
`crc32(new TextEncoder().encode(text))`.

`crc32Update` also deals in the *unfinalised* register, not the final
checksum. That is what lets it stream, but it means the seed is `0xffffffff`,
not `0`, and the result must be XORed with `0xffffffff` before comparison.
Use `crc32` unless you actually need to stream.

## API

- `crc32(data)` — unsigned 32-bit checksum. Accepts `Uint8Array`,
  `ArrayBuffer`, or any `ArrayBufferView` (including Node `Buffer`).
- `crc32Hex(data)` — the same checksum as eight lowercase hex digits.
- `crc32Update(seed, data)` — folds a chunk into an unfinalised register and
  returns the new register. Seed the first call with `0xffffffff`.
