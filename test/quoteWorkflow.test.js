import assert from 'node:assert/strict';
import test from 'node:test';

import { createQuote } from '../src/quoteWorkflow.js';

test('creates a customer-safe quote without exposing provider internals', async () => {
  const quote = await createQuote({
    vin: '1HGCM82633A004352',
    mileage: '45,250',
    dealerRule: { mode: 'markup', percentage: 5 },
    detailAdjustments: [{ label: 'Detail issue', amount: 250 }]
  });

  assert.equal(quote.ok, true);
  assert.equal(quote.vin, '1HGCM82633A004352');
  assert.equal(quote.currency, 'USD');
  assert.equal(typeof quote.quoteId, 'string');
  assert.equal(typeof quote.baseValue, 'number');
  assert.equal(typeof quote.customerPrice, 'number');
  assert.equal(quote.provider, undefined);
  assert.equal(quote.providerRaw, undefined);
});

test('returns validation errors before provider lookup', async () => {
  const quote = await createQuote({ vin: 'BAD', mileage: '10000' });

  assert.deepEqual(quote, {
    ok: false,
    code: 'invalid_vin_length',
    message: 'VIN must be exactly 17 characters.'
  });
});
