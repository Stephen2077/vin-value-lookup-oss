import assert from 'node:assert/strict';
import test from 'node:test';

import { createStaticValueProvider } from '../src/providers/staticValueProvider.js';

test('returns a deterministic vehicle value from VIN and mileage', async () => {
  const provider = createStaticValueProvider();

  const first = await provider.lookup({ vin: '1HGCM82633A004352', mileage: 45250 });
  const second = await provider.lookup({ vin: '1HGCM82633A004352', mileage: 45250 });

  assert.equal(first.provider, 'static-demo-provider');
  assert.equal(first.baseValue, second.baseValue);
  assert.equal(first.currency, 'USD');
});

test('higher mileage lowers the demo value', async () => {
  const provider = createStaticValueProvider();

  const lowMileage = await provider.lookup({ vin: '1HGCM82633A004352', mileage: 10000 });
  const highMileage = await provider.lookup({ vin: '1HGCM82633A004352', mileage: 120000 });

  assert.ok(lowMileage.baseValue > highMileage.baseValue);
});
