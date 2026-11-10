import { createApp } from '../../../src/server.js';
import { createQuote } from '../../../src/quoteWorkflow.js';

const vin = '1HGCM82633A004352';
const results = [];

function record(name, sentence, ok, path) {
  results.push({ name, sentence, ok, path });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  console.log(sentence);
  if (!ok) {
    console.log(path);
  }
  console.log('');
}

function dollarPrice(baseValue, dealerRule = {}, detailAdjustments = []) {
  const percent = Math.max(0, Number(dealerRule.percentage) || 0);
  const multiplier = dealerRule.mode === 'markdown' ? 1 - percent / 100 : 1 + percent / 100;
  const dealerPrice = Math.max(0, Math.round(Number(baseValue) * multiplier));
  const totalAdjustment = detailAdjustments.reduce((sum, item) => {
    const amount = Math.max(0, Math.round(Number(item.amount) || 0));
    return amount > 0 ? sum + amount : sum;
  }, 0);
  return Math.max(0, Math.round(dealerPrice - totalAdjustment));
}

function swappedPrice(baseValue, dealerRule = {}, detailAdjustments = []) {
  const percent = Math.max(0, Number(dealerRule.percentage) || 0);
  const multiplier = dealerRule.mode === 'markdown' ? 1 - percent / 100 : 1 + percent / 100;
  const totalAdjustment = detailAdjustments.reduce((sum, item) => {
    const amount = Math.max(0, Math.round(Number(item.amount) || 0));
    return amount > 0 ? sum + amount : sum;
  }, 0);
  const adjustedBase = Math.max(0, Math.round(Number(baseValue) - totalAdjustment));
  return Math.max(0, Math.round(adjustedBase * multiplier));
}

function isWholeDollars(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function hidesProvider(quote) {
  return !('provider' in quote) && !('confidence' in quote) && !('providerRaw' in quote);
}

function spyProvider(lookup) {
  const calls = [];
  return {
    calls,
    async lookup(input) {
      calls.push(input);
      return lookup(input);
    }
  };
}

async function runQuote(input) {
  try {
    return { quote: await createQuote(input), thrown: null };
  } catch (error) {
    return { quote: null, thrown: error };
  }
}

async function post(port, body, raw) {
  const response = await fetch(`http://127.0.0.1:${port}/api/quote`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: raw ?? JSON.stringify(body)
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = null;
  }
  return { status: response.status, text, payload };
}

function outcomeText(result) {
  if (result.thrown) return `threw ${result.thrown.name}: ${result.thrown.message}`;
  return JSON.stringify(result.quote);
}

const badVin = spyProvider(async () => ({ baseValue: 1000, currency: 'USD' }));
const badVinRun = await runQuote({ vin: 'BAD', mileage: 10000, provider: badVin });
record(
  'LookupOnlyAfterValidation',
  'The value lookup runs only after the VIN and the mileage have both been accepted.',
  badVin.calls.length === 0 && badVinRun.quote?.ok === false && !badVinRun.thrown,
  [
    '1. You submit VIN "BAD" and mileage 10000.',
    `2. The lookup was called ${badVin.calls.length} time(s).`,
    `3. The result ${outcomeText(badVinRun)}.`
  ].join('\n')
);

const badMiles = spyProvider(async () => ({ baseValue: 1000, currency: 'USD' }));
const badMilesRun = await runQuote({ vin, mileage: '', provider: badMiles });
const badChars = spyProvider(async () => ({ baseValue: 1000, currency: 'USD' }));
const badCharsRun = await runQuote({
  vin: '1HGCM82633O004352',
  mileage: '10',
  provider: badChars
});
record(
  'RejectionSkipsLookup',
  'A rejected VIN or mileage is not a customer quote, and the lookup was not called.',
  badVin.calls.length === 0 &&
    !badVinRun.thrown &&
    badVinRun.quote?.ok === false &&
    badVinRun.quote.customerPrice === undefined &&
    badMiles.calls.length === 0 &&
    !badMilesRun.thrown &&
    badMilesRun.quote?.ok === false &&
    badChars.calls.length === 0 &&
    !badCharsRun.thrown &&
    badCharsRun.quote?.ok === false &&
    badCharsRun.quote.code === 'invalid_vin_characters',
  [
    '1. You submit a VIN that fails the check, or a mileage that is missing.',
    `2. VIN "BAD" called the lookup ${badVin.calls.length} time(s) and ${outcomeText(badVinRun)}.`,
    `3. An empty mileage called the lookup ${badMiles.calls.length} time(s) and ${outcomeText(badMilesRun)}.`,
    `4. A VIN with a forbidden letter called the lookup ${badChars.calls.length} time(s) and ${outcomeText(badCharsRun)}.`
  ].join('\n')
);

const priceCases = [
  {
    name: 'markup and a condition adjustment',
    baseValue: 20000,
    dealerRule: { mode: 'markup', percentage: 7.5 },
    detailAdjustments: [
      { label: 'Accident history', amount: 750 },
      { label: 'Tire replacement', amount: 300 }
    ]
  },
  {
    name: 'markdown',
    baseValue: 20000,
    dealerRule: { mode: 'markdown', percentage: 6 },
    detailAdjustments: []
  },
  {
    name: 'a negative percentage, which the pricing step treats as zero',
    baseValue: 20000,
    dealerRule: { mode: 'markup', percentage: -5 },
    detailAdjustments: []
  },
  {
    name: 'a mode other than markdown, which the pricing step treats as markup',
    baseValue: 10000,
    dealerRule: { mode: 'discount', percentage: 10 },
    detailAdjustments: [{ label: 'Wear', amount: 500 }]
  }
];

const priceFailures = [];
for (const item of priceCases) {
  const run = await runQuote({
    vin,
    mileage: 1000,
    dealerRule: item.dealerRule,
    detailAdjustments: item.detailAdjustments,
    provider: { async lookup() { return { baseValue: item.baseValue, currency: 'USD', provider: 'custom', confidence: 'demo' }; } }
  });
  const quote = run.quote;
  const expected = dollarPrice(item.baseValue, item.dealerRule, item.detailAdjustments);
  const swapped = swappedPrice(item.baseValue, item.dealerRule, item.detailAdjustments);
  const matches =
    !run.thrown &&
    quote?.ok === true &&
    quote.customerPrice === expected &&
    isWholeDollars(quote.customerPrice) &&
    (expected === swapped || quote.customerPrice !== swapped);
  if (!matches) {
    priceFailures.push(
      `${item.name}: ${run.thrown ? outcomeText(run) : `customer price ${quote.customerPrice}, dealer-then-adjust ${expected}, adjust-then-dealer ${swapped}, body ${JSON.stringify(quote)}`}`
    );
  }
}
record(
  'PriceComposition',
  'The customer price is the dealer rule applied to the base value, then the condition adjustments, floored at zero dollars.',
  priceFailures.length === 0,
  priceFailures.join('\n')
);

const hiddenRun = await runQuote({
  vin,
  mileage: 45250,
  dealerRule: { mode: 'markup', percentage: 5 },
  detailAdjustments: [{ label: 'Condition adjustment', amount: 250 }]
});
const hidden = hiddenRun.quote;
record(
  'CustomerQuoteHidesProvider',
  'A customer quote does not include the provider name, the provider confidence, or a raw provider payload.',
  !hiddenRun.thrown && hidden?.ok === true && hidesProvider(hidden) && hidden.currency === 'USD',
  `The demo quote ${outcomeText(hiddenRun)}.`
);

const badBases = [undefined, null, NaN, Infinity, Number.MAX_VALUE];
const badQuotes = [];
for (const baseValue of badBases) {
  const run = await runQuote({
    vin,
    mileage: 1000,
    provider: {
      async lookup() {
        return { baseValue, currency: 'USD', provider: 'custom', confidence: 'demo' };
      }
    }
  });
  const quote = run.quote;
  if (run.thrown || !quote) continue;
  const whole = isWholeDollars(quote.baseValue) && isWholeDollars(quote.customerPrice);
  if (quote.ok === true && !whole) {
    const note = quote.baseValue === null && quote.customerPrice === 0
      ? 'An empty base value is shown as a zero-dollar quote: '
      : 'A non-dollar base is still shown as a quote: ';
    badQuotes.push(note + JSON.stringify(quote));
  }
}
record(
  'QuotedPriceIsADollarAmount',
  'A customer quote is shown only when the base value and the customer price are whole dollar amounts.',
  badQuotes.length === 0,
  [
    '1. You submit a valid VIN and a whole-number mileage to a provider that returns no whole-dollar value.',
    '2. The dealer rule is applied and the condition adjustments are applied.',
    '3. The quote is shown anyway:',
    ...badQuotes.map((body) => `   ${body}`)
  ].join('\n')
);

const app = createApp();
await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve));
const { port } = app.address();

const demoBody = {
  vin,
  mileage: 45250,
  dealerRule: { mode: 'markup', percentage: 5 },
  detailAdjustments: [{ label: 'Condition adjustment', amount: 250 }]
};
const demoHttp = await post(port, demoBody);
const demoExpected = dollarPrice(
  demoHttp.payload?.baseValue,
  demoBody.dealerRule,
  demoBody.detailAdjustments
);
if (!(demoHttp.status === 200 && demoHttp.payload?.ok === true && demoHttp.payload.customerPrice === demoExpected && isWholeDollars(demoHttp.payload.customerPrice) && hidesProvider(demoHttp.payload))) {
  record(
    'DemoHttpQuote',
    'The demo form body returns a whole-dollar customer quote and hides provider internals.',
    false,
    `HTTP ${demoHttp.status} ${demoHttp.text}. The dealer-then-adjust price is ${demoExpected}.`
  );
} else {
  record(
    'DemoHttpQuote',
    'The demo form body returns a whole-dollar customer quote and hides provider internals.',
    true,
    ''
  );
}

const unsafeBodies = [
  {
    label: 'the JSON sets provider to an empty object',
    body: { vin, mileage: 1000, provider: {} }
  },
  {
    label: 'the JSON sets provider to null',
    body: { vin, mileage: 1000, provider: null }
  },
  {
    label: 'the JSON sets dealerRule to null',
    body: { vin, mileage: 1000, dealerRule: null }
  },
  {
    label: 'the JSON sets detailAdjustments to null',
    body: { vin, mileage: 1000, detailAdjustments: null }
  }
];
const unsafePaths = [];
for (const item of unsafeBodies) {
  let thrown = null;
  try {
    await createQuote(item.body);
  } catch (error) {
    thrown = error;
  }
  const http = await post(port, item.body);
  const echoed = thrown && http.payload && http.payload.message === thrown.message;
  if (echoed) {
    unsafePaths.push(
      `You submit a valid VIN and mileage, and ${item.label}. The response is HTTP ${http.status} with ${http.text}`
    );
  }
}
record(
  'FailureTextIsCustomerSafe',
  'When the lookup or the pricing step fails, the customer sees a plain failure, not the program error text.',
  unsafePaths.length === 0,
  unsafePaths.join('\n')
);

await new Promise((resolve) => app.close(resolve));

const failed = results.filter((item) => !item.ok);
console.log(`${failed.length} rule(s) failed: ${failed.map((item) => item.name).join(', ') || 'none'}`);
process.exit(failed.length === 0 ? 0 : 1);
