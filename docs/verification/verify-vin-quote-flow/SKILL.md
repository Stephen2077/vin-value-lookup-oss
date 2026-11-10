---
name: verify-vin-quote-flow
description: "Check the VIN lookup, vehicle value, and dealer quote flow. Use when a change touches src/quoteWorkflow.js, src/vin.js, src/mileage.js, src/pricing.js, src/server.js, or src/providers/staticValueProvider.js, or when a quote might be shown before validation, without a whole-dollar price, or with provider internals."
---

# Verify the VIN quote flow

A customer quote is shown only after the VIN and the mileage are accepted, and only with a whole-dollar price from a whole-dollar vehicle value. A failed lookup or pricing step is shown as a plain failure, not as the program's own error text. The success payload leaves out the provider name, the provider confidence, and any raw provider payload.

The check is failing today on two rules. Those failures are findings in the current code. Do not weaken a rule, and do not change the model, to make them pass.

## When a change needs this check

Run it when a change touches any of these:

- `src/quoteWorkflow.js` `createQuote`
- `src/vin.js` `validateVin`
- `src/mileage.js` `normalizeMileage`
- `src/pricing.js` `applyDealerRule`, `applyDetailAdjustments`
- `src/server.js` the `POST /api/quote` branch and its `catch`
- `src/providers/staticValueProvider.js` `lookup`

A change to `public/app.js` is outside this check. That file has its own panel states. See the second target below.

## Run

From the repo root:

```bash
node docs/verification/verify-vin-quote-flow/check-quote-flow.mjs
```

Exit 0 means every rule held on the real functions. Exit 1 means at least one rule failed. The script prints `PASS` or `FAIL`, the rule in one sentence, and for a failure the steps that produced it.

The state space is `docs/verification/verify-vin-quote-flow/QuoteFlow.tla` with `QuoteFlow.cfg`. Read every TLC result with the pstack `/statechart` skill. The words on the chart are in `view.mjs`. `view.mjs` hides the `Done` step, which is a finished response staying on screen. This skill does not copy `/statechart`'s commands. They change between releases.

A TLC run that passes every rule, while `createQuote` still returns `ok: true` for a null base value, means the model was weakened. Treat that as a broken check.

## What the rules mean

- **LookupOnlyAfterValidation.** The value lookup runs only after the VIN and the mileage have both been accepted. Harm: an invalid VIN is sent to a provider.
- **RejectionSkipsLookup.** A rejected VIN or mileage is not returned as a customer quote. Harm: the customer is quoted a vehicle the check rejected.
- **PriceComposition.** The customer price is the dealer rule applied to the base value, then the condition adjustments, floored at zero dollars. A negative percentage counts as zero. A mode other than markdown counts as markup. Harm: the customer sees a price from the steps in the wrong order.
- **CustomerQuoteHidesProvider.** The success object has no `provider`, `confidence`, or `providerRaw`. Harm: a demo or vendor field is shown as part of the quote.
- **QuotedPriceIsADollarAmount.** `ok: true` is returned only when `baseValue` and `customerPrice` are safe whole dollars, zero or more. Harm: the customer is shown a quote whose price is null, `NaN`, or not a whole dollar amount.
- **FailureTextIsCustomerSafe.** When `createQuote` throws, the HTTP body does not copy `error.message`. Harm: the quote screen shows internal error text.
- **DemoHttpQuote.** The demo form body, posted to `/api/quote`, returns HTTP 200, the dealer-then-adjust price, and no provider fields. This is the path the page actually sends.

`TypeOK` in the TLA config is a check that the model is well typed. If `TypeOK` fails, the model is wrong. Fix the model. It is not a product bug.

## Coverage

Confirmed against commit `10c83536381b3d5cffc41425ece562fe6a05f421`. The covered source files at that commit are the ones listed above. Move this commit forward only after you have confirmed that the model and this script still describe the code at the new commit.

The model is one request, after the JSON body has parsed. One TLA action is one branch in the code:

| Action | Code |
| --- | --- |
| SubmitInvalidVin, SubmitValidVin | `validateVin` in `src/vin.js`, returned or continued by `createQuote` |
| SubmitInvalidMileage, SubmitValidMileage | `normalizeMileage` in `src/mileage.js`, with `required: true` |
| DemoProviderReturnsDollars | `createStaticValueProvider().lookup` when `provider` is omitted |
| CustomProviderReturnsNull | `provider.lookup` returns `baseValue: null`. `Number(null)` is 0, so the price becomes zero dollars |
| CustomProviderReturnsNoDollars | `provider.lookup` returns a base that is missing, `NaN`, `Infinity`, or not a safe integer |
| ProviderCallFails | `provider.lookup` throws, including a JSON `provider` that is not a function |
| ApplyDealerRule | `applyDealerRule` |
| DealerRuleUnusable | `dealerRule` is null, so the destructure in `applyDealerRule` throws |
| ApplyAdjustmentsAndReturnQuote | `applyDetailAdjustments`, then the `ok: true` object in `createQuote` |
| AdjustmentsUnusable | `detailAdjustments` is null or not a list, so `.map` throws |
| Done | the request is finished; the HTTP response stays as it is |

`src/server.js` maps `ok: true` to HTTP 200 and `ok: false` to HTTP 400, and the `catch` sends HTTP 500 with `error.message`.

## How to read a failure

Replay the printed steps with `createQuote` or with `POST /api/quote`. Use the real functions. If a step cannot happen in the code, the model or the script is wrong. Fix that, and say what was wrong. If every step happens, it is a bug in the product. Report it in the code's words. Do not change product code from this skill unless the user asks. Do not drop a rule to make the run pass.

A failure of `QuotedPriceIsADollarAmount` or `FailureTextIsCustomerSafe` is the known finding below, as long as the steps match. Any other failure is new. A pass of a known finding means the code changed or the check no longer describes it. Confirm which, with `/maintain-formal-verification-skill` if the code moved and this check was not updated in the same change.

## Known findings

These match the code at the sync commit. The script is expected to fail on them.

**QuotedPriceIsADollarAmount.** `createQuote` always returns `ok: true` after a lookup object comes back. It does not check that `baseValue` is a safe whole dollar. Two customer-visible results follow. A `baseValue` of `null` is priced as zero dollars, because `Number(null)` is 0, and the quote looks like a real $0 price while `baseValue` stays null. On the chart that state is "Zero-dollar quote from an empty value". The shortest path is: you submit a valid VIN, the mileage is a whole number, the value comes back empty, the dealer rule is applied, the quote is shown. A missing value, `NaN`, or `Infinity` is still returned as a quote; `JSON.stringify` writes those prices as `null`, and the quote id ends in `nan` or `infinity`. On the chart that state is "Quote shown without a dollar price". `Number.MAX_VALUE` stays a quote whose price is not a safe integer and is part of that same state. The bundled demo provider always returns a safe whole dollar, and a JSON POST cannot supply a lookup function, so the demo page does not take this path. A provider passed to `createQuote` does. Harm: the caller shows a quote that has no real vehicle value, including one that looks like a genuine zero-dollar price.

**FailureTextIsCustomerSafe.** The `catch` in `src/server.js` sends `error.message`. A parsed body with `provider: {}`, `provider: null`, `dealerRule: null`, or `detailAdjustments: null` reaches that catch on a valid VIN and mileage. The shortest path on the chart is: you submit a valid VIN, the mileage is a whole number, the value lookup fails. That state is "Lookup failed, error text shown". "Dealer rule failed, error text shown" and "Adjustments failed, error text shown" break the same rule by the same catch. The demo form does not send those bodies. Harm: the quote response shows text such as `provider.lookup is not a function` or `Cannot read properties of null (reading 'mode')`.

The chart's legend uses one mark for both broken rules. The quote states break `QuotedPriceIsADollarAmount`. The three error states break `FailureTextIsCustomerSafe`.

## Shown to catch a break

These edits were made in `src/quoteWorkflow.js`, the check was run, and the edits were removed. The source file is back to the sync commit.

- Removing `if (!vinResult.ok) return vinResult` made `LookupOnlyAfterValidation` and `RejectionSkipsLookup` fail. The lookup ran for VIN `BAD`, then `buildQuoteId` threw because the rejected result has no `vin`.
- Copying `providerResult.confidence` onto the success object made `CustomerQuoteHidesProvider` and `DemoHttpQuote` fail.
- Applying condition adjustments before the dealer rule, and using that as the customer price, made `PriceComposition` and `DemoHttpQuote` fail.

## What a pass does not cover

- The browser panel in `public/app.js`. Two submits can be in flight, and the later response overwrites the panel even when it belongs to the earlier submit. A failed `fetch` leaves the panel on `Creating quote...`.
- A request body that is not JSON. The `catch` also sends that parser message. The model starts after a successful parse.
- A finite base so large that `Math.round` in `applyDealerRule` overflows. The script treats `Number.MAX_VALUE` as not a whole-dollar price. The TLA step `ApplyDealerRule` does not model overflow of a smaller finite base.
- Check-digit validation of the VIN. `validateVin` checks length and the allowed characters only.
- Anything the static file server does.

## Second target

The panel in `public/app.js` is the nearest flow this check does not cover. A second check would be worth it if the page starts being used to read a price out loud or to copy one into a deal.
