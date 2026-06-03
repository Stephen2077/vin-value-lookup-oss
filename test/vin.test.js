import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeVin, validateVin } from '../src/vin.js';

test('normalizes VIN input to uppercase without spaces', () => {
  assert.equal(normalizeVin(' 1hgcm82633a004352 '), '1HGCM82633A004352');
});

test('accepts valid 17-character VINs', () => {
  const result = validateVin('1HGCM82633A004352');

  assert.deepEqual(result, { ok: true, vin: '1HGCM82633A004352' });
});

test('rejects VINs with forbidden letters', () => {
  const result = validateVin('1HGCM82633O004352');

  assert.equal(result.ok, false);
  assert.equal(result.code, 'invalid_vin_characters');
});

test('rejects VINs with the wrong length', () => {
  const result = validateVin('12345');

  assert.equal(result.ok, false);
  assert.equal(result.code, 'invalid_vin_length');
});
