/**
 * Public entry point for cyclic-redundancy-check-utils.
 *
 * The package exposes a single CRC-32 implementation. Keeping the barrel
 * file separate from the implementation means callers can import from the
 * package root without pulling in anything else, and the implementation
 * stays independently testable.
 */
export { crc32, crc32Hex, crc32Update } from './core.js';
