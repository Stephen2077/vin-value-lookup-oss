import assert from 'node:assert/strict';
import test from 'node:test';

import { createApp } from '../src/server.js';

test('POST /api/quote returns a customer-safe quote', async (t) => {
  const app = createApp();
  await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve));
  t.after(() => app.close());

  const { port } = app.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/quote`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      vin: '1HGCM82633A004352',
      mileage: 45250,
      dealerRule: { mode: 'markup', percentage: 5 }
    })
  });

  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.provider, undefined);
  assert.equal(typeof payload.customerPrice, 'number');
});
