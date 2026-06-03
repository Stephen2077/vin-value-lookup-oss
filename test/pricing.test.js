import assert from 'node:assert/strict';
import test from 'node:test';

import { applyDealerRule, applyDetailAdjustments, roundToDollars } from '../src/pricing.js';

test('applies dealer markup on a base value', () => {
  assert.equal(applyDealerRule(20000, { mode: 'markup', percentage: 7.5 }), 21500);
});

test('applies dealer markdown on a base value', () => {
  assert.equal(applyDealerRule(20000, { mode: 'markdown', percentage: 6 }), 18800);
});

test('applies itemized detail adjustments after the dealer rule', () => {
  const quote = applyDetailAdjustments(21500, [
    { label: 'Accident history', amount: 750 },
    { label: 'Tire replacement', amount: 300 }
  ]);

  assert.deepEqual(quote, {
    finalPrice: 20450,
    totalAdjustment: 1050,
    adjustments: [
      { label: 'Accident history', amount: 750 },
      { label: 'Tire replacement', amount: 300 }
    ]
  });
});

test('rounds calculated values to whole dollars', () => {
  assert.equal(roundToDollars(12000.51), 12001);
});
