import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeMileage } from '../src/mileage.js';

test('normalizes mileage strings with separators', () => {
  assert.deepEqual(normalizeMileage('45,250'), { ok: true, mileage: 45250 });
});

test('rejects empty mileage when required', () => {
  assert.deepEqual(normalizeMileage('', { required: true }), {
    ok: false,
    code: 'mileage_required',
    message: 'Mileage is required.'
  });
});

test('rejects negative mileage', () => {
  const result = normalizeMileage('-20');

  assert.equal(result.ok, false);
  assert.equal(result.code, 'invalid_mileage');
});
