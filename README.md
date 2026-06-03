# VIN Value Lookup

VIN Value Lookup is an open-source starter toolkit for VIN-based vehicle value lookup and dealer quote workflows.

It gives maintainers a clean, provider-neutral foundation for this flow:

1. Enter a VIN and mileage.
2. Validate the request.
3. Get a vehicle value from a configurable data provider.
4. Apply dealer quote rules on the server.
5. Return a customer-safe quote result.

The demo provider is deterministic and local. It is only for development and tests. Real market-data integrations should be added through the provider adapter boundary.

## Features

- VIN normalization and validation
- Mileage normalization
- Dealer markup and markdown rules
- Itemized condition adjustments
- Provider adapter interface
- Customer-safe quote workflow
- Minimal HTTP API
- Browser demo page
- Node test suite
- Public safety scan for forbidden private artifacts

## Quick Start

```bash
npm install
npm test
npm start
```

Then open:

```text
http://127.0.0.1:4173
```

## API

`POST /api/quote`

```json
{
  "vin": "1HGCM82633A004352",
  "mileage": 45250,
  "dealerRule": {
    "mode": "markup",
    "percentage": 5
  },
  "detailAdjustments": [
    {
      "label": "Condition adjustment",
      "amount": 250
    }
  ]
}
```

Example response:

```json
{
  "ok": true,
  "quoteId": "004352-45250-27500",
  "vin": "1HGCM82633A004352",
  "mileage": 45250,
  "baseValue": 26500,
  "customerPrice": 27500,
  "currency": "USD",
  "adjustments": [],
  "totalAdjustment": 0
}
```

## Project Structure

```text
src/
  mileage.js
  pricing.js
  quoteWorkflow.js
  server.js
  vin.js
  providers/
    staticValueProvider.js
public/
  index.html
  app.js
  styles.css
test/
  *.test.js
```

## Provider Boundary

Real data integrations should implement a provider with this shape:

```js
const provider = {
  async lookup({ vin, mileage }) {
    return {
      provider: 'provider-name',
      baseValue: 25000,
      currency: 'USD'
    };
  }
};
```

The quote workflow intentionally does not expose provider internals in the customer response.

## Public Repository Rules

Do not commit:

- `.env` files
- credentials
- production database files
- screenshots
- browser profiles
- private deployment notes
- provider-specific selectors
- internal handoff documents

Run this before publishing changes:

```bash
npm run scan:public
npm test
```

## License

MIT
