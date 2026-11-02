/**
 * CRC-32 (IEEE 802.3 polynomial, reflected) over byte buffers.
 *
 * Design notes that are not obvious from the code:
 *
 * - The polynomial is written in its reflected form (0xEDB88320). The
 *   non-reflected form is 0x04C11DB7. Reflecting lets us shift right and
 *   XOR the low byte, which is the layout every CRC-32 table you find in
 *   the wild uses. Mixing the two forms silently produces wrong checksums
 *   for every input, so the constant is named for what it is.
 *
 * - The table is built once at module load. It is 256 entries of 32-bit
 *   integers, which is small enough that the cost is irrelevant and large
 *   enough that rebuilding it per call would be wasteful.
 *
 * - `crc32Update` takes and returns the *unfinalised* register value
 *   (i.e. the value before the final XOR with 0xFFFFFFFF). This is the
 *   only way to stream a checksum across chunks without re-running the
 *   whole buffer. Callers who only want the final checksum should use
 *   `crc32`, which does the inversion for them.
 */

const POLYNOMIAL = 0xedb88320;
const INITIAL = 0xffffffff;
const FINAL_XOR = 0xffffffff;

/**
 * Precomputed lookup table for byte-at-a-time CRC-32.
 * @type {Uint32Array}
 */
const TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? POLYNOMIAL ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

/**
 * Coerce an arbitrary byte-like input into a Uint8Array view.
 *
 * We accept ArrayBuffer and any TypedArray (including Uint8Array) because
 * callers commonly have a Buffer (Node) or a slice of a larger buffer, and
 * forcing them to copy is unnecessary. Strings are rejected deliberately:
 * a CRC over "text" depends on the encoding, and guessing UTF-8 would be
 * a silent source of disagreement between callers. Encode explicitly.
 *
 * @param {Uint8Array|ArrayBuffer|ArrayBufferView} data
 * @returns {Uint8Array}
 */
function toBytes(data) {
  if (data instanceof Uint8Array) {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  throw new TypeError('crc32 expects a Uint8Array, ArrayBuffer, or ArrayBufferView');
}

/**
 * Fold one chunk of bytes into an existing CRC register.
 *
 * @param {number} seed Unfinalised register value from a previous call,
 *   or 0 to start a fresh checksum.
 * @param {Uint8Array|ArrayBuffer|ArrayBufferView} data
 * @returns {number} Unfinalised register value.
 */
export function crc32Update(seed, data) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError('seed must be an unsigned 32-bit integer');
  }
  const bytes = toBytes(data);
  let crc = seed >>> 0;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return crc >>> 0;
}

/**
 * Compute the CRC-32 checksum of a byte buffer.
 *
 * @param {Uint8Array|ArrayBuffer|ArrayBufferView} data
 * @returns {number} Unsigned 32-bit checksum.
 */
export function crc32(data) {
  const register = crc32Update(INITIAL, data);
  return (register ^ FINAL_XOR) >>> 0;
}

/**
 * Compute the CRC-32 checksum and format it as eight lowercase hex digits.
 *
 * Fixed width matters: `crc32([0x00]).toString(16)` is "d202ef8d" but a
 * checksum like 0x000000ff would otherwise render as "ff", which sorts and
 * compares badly against fixed-width values such as those in zip headers.
 *
 * @param {Uint8Array|ArrayBuffer|ArrayBufferView} data
 * @returns {string}
 */
export function crc32Hex(data) {
  return crc32(data).toString(16).padStart(8, '0');
}
