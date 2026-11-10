---- MODULE QuoteFlow ----
\* One parsed POST /api/quote, from the VIN check through the customer response.
\* Each action is one branch of createQuote (src/quoteWorkflow.js), validateVin
\* (src/vin.js), normalizeMileage (src/mileage.js), the provider lookup, the two
\* pricing calls (src/pricing.js), or the HTTP mapping and catch in src/server.js.
\* The model starts after the body has parsed. A body that is not JSON is out of scope.

VARIABLES
  phase,
  vinOk,
  mileageOk,
  lookedUp,
  baseKind,
  priceIsDollars,
  response,
  failure,
  leaked,
  rawError

vars == <<phase, vinOk, mileageOk, lookedUp, baseKind, priceIsDollars, response, failure, leaked, rawError>>

TypeOK ==
  /\ phase \in {
       "ready",
       "vin_ok",
       "mileage_ok",
       "value_in_hand",
       "dealer_priced",
       "quoted",
       "vin_rejected",
       "mileage_rejected",
       "server_error"
     }
  /\ vinOk \in BOOLEAN
  /\ mileageOk \in BOOLEAN
  /\ lookedUp \in BOOLEAN
  /\ baseKind \in {"none", "dollars", "null", "other"}
  /\ priceIsDollars \in BOOLEAN
  /\ response \in {"none", "vin_error", "mileage_error", "quote", "server_error"}
  /\ failure \in {"none", "provider", "dealer_rule", "adjustments"}
  /\ leaked \in BOOLEAN
  /\ rawError \in BOOLEAN
  /\ (phase = "quoted") <=> (response = "quote")
  /\ (phase = "vin_rejected") <=> (response = "vin_error")
  /\ (phase = "mileage_rejected") <=> (response = "mileage_error")
  /\ (phase = "server_error") <=> (response = "server_error" /\ failure # "none" /\ rawError)
  /\ phase \in {"value_in_hand", "dealer_priced", "quoted"} => baseKind \in {"dollars", "null", "other"}
  /\ priceIsDollars => baseKind \in {"dollars", "null"}
  /\ lookedUp => phase \in {"value_in_hand", "dealer_priced", "quoted", "server_error"}

Init ==
  /\ phase = "ready"
  /\ vinOk = FALSE
  /\ mileageOk = FALSE
  /\ lookedUp = FALSE
  /\ baseKind = "none"
  /\ priceIsDollars = FALSE
  /\ response = "none"
  /\ failure = "none"
  /\ leaked = FALSE
  /\ rawError = FALSE

\* validateVin returns not ok. createQuote returns that object. server.js sends HTTP 400.
SubmitInvalidVin ==
  /\ phase = "ready"
  /\ phase' = "vin_rejected"
  /\ vinOk' = FALSE
  /\ response' = "vin_error"
  /\ UNCHANGED <<mileageOk, lookedUp, baseKind, priceIsDollars, failure, leaked, rawError>>

\* validateVin returns ok. createQuote continues to mileage.
SubmitValidVin ==
  /\ phase = "ready"
  /\ phase' = "vin_ok"
  /\ vinOk' = TRUE
  /\ UNCHANGED <<mileageOk, lookedUp, baseKind, priceIsDollars, response, failure, leaked, rawError>>

\* normalizeMileage with required: true returns not ok. createQuote returns it. HTTP 400.
SubmitInvalidMileage ==
  /\ phase = "vin_ok"
  /\ phase' = "mileage_rejected"
  /\ mileageOk' = FALSE
  /\ response' = "mileage_error"
  /\ UNCHANGED <<vinOk, lookedUp, baseKind, priceIsDollars, failure, leaked, rawError>>

SubmitValidMileage ==
  /\ phase = "vin_ok"
  /\ phase' = "mileage_ok"
  /\ mileageOk' = TRUE
  /\ UNCHANGED <<vinOk, lookedUp, baseKind, priceIsDollars, response, failure, leaked, rawError>>

\* No provider argument: createStaticValueProvider returns a safe whole-dollar baseValue.
DemoProviderReturnsDollars ==
  /\ phase = "mileage_ok"
  /\ phase' = "value_in_hand"
  /\ lookedUp' = TRUE
  /\ baseKind' = "dollars"
  /\ UNCHANGED <<vinOk, mileageOk, priceIsDollars, response, failure, leaked, rawError>>

\* baseValue null. Number(null) is 0, so the later pricing step treats it as zero dollars.
\* createQuote still returns ok: true and keeps baseValue null.
CustomProviderReturnsNull ==
  /\ phase = "mileage_ok"
  /\ phase' = "value_in_hand"
  /\ lookedUp' = TRUE
  /\ baseKind' = "null"
  /\ UNCHANGED <<vinOk, mileageOk, priceIsDollars, response, failure, leaked, rawError>>

\* baseValue is missing, NaN, Infinity, or another value that is not a safe integer
\* and is not null. Pricing does not turn these into a whole-dollar price.
\* Number.MAX_VALUE stays finite but is not a safe integer, so it is in this step.
CustomProviderReturnsNoDollars ==
  /\ phase = "mileage_ok"
  /\ phase' = "value_in_hand"
  /\ lookedUp' = TRUE
  /\ baseKind' = "other"
  /\ UNCHANGED <<vinOk, mileageOk, priceIsDollars, response, failure, leaked, rawError>>

\* provider.lookup throws. Over HTTP this is also a JSON provider value that is not a
\* function, because the default provider is used only when provider is undefined.
\* src/server.js catch sends error.message.
ProviderCallFails ==
  /\ phase = "mileage_ok"
  /\ phase' = "server_error"
  /\ lookedUp' = TRUE
  /\ response' = "server_error"
  /\ failure' = "provider"
  /\ rawError' = TRUE
  /\ UNCHANGED <<vinOk, mileageOk, baseKind, priceIsDollars, leaked>>

\* applyDealerRule. A dollar base stays a dollar price. null becomes 0, which is a
\* whole-dollar price. Any other non-dollar base stays not a whole-dollar price.
\* This step does not model overflow of a finite base below Number.MAX_VALUE.
ApplyDealerRule ==
  /\ phase = "value_in_hand"
  /\ phase' = "dealer_priced"
  /\ priceIsDollars' = (baseKind \in {"dollars", "null"})
  /\ UNCHANGED <<vinOk, mileageOk, lookedUp, baseKind, response, failure, leaked, rawError>>

\* dealerRule null. The {} default applies only when the argument is undefined.
\* Destructuring throws. The catch sends error.message.
DealerRuleUnusable ==
  /\ phase = "value_in_hand"
  /\ phase' = "server_error"
  /\ response' = "server_error"
  /\ failure' = "dealer_rule"
  /\ rawError' = TRUE
  /\ UNCHANGED <<vinOk, mileageOk, lookedUp, baseKind, priceIsDollars, leaked>>

\* applyDetailAdjustments, then the ok: true return. The return copies currency and
\* the priced fields. It does not copy provider, confidence, or providerRaw.
\* It does not check that the price is a safe integer, so a non-dollar price is still a quote.
ApplyAdjustmentsAndReturnQuote ==
  /\ phase = "dealer_priced"
  /\ phase' = "quoted"
  /\ response' = "quote"
  /\ leaked' = FALSE
  /\ UNCHANGED <<vinOk, mileageOk, lookedUp, baseKind, priceIsDollars, failure, rawError>>

\* detailAdjustments is null or not a list. .map throws. The catch sends error.message.
AdjustmentsUnusable ==
  /\ phase = "dealer_priced"
  /\ phase' = "server_error"
  /\ response' = "server_error"
  /\ failure' = "adjustments"
  /\ rawError' = TRUE
  /\ UNCHANGED <<vinOk, mileageOk, lookedUp, baseKind, priceIsDollars, leaked>>

\* End states of one request. The action changes nothing so TLC's deadlock check stays quiet.
Done ==
  /\ phase \in {"vin_rejected", "mileage_rejected", "quoted", "server_error"}
  /\ UNCHANGED vars

Next ==
  \/ SubmitInvalidVin
  \/ SubmitValidVin
  \/ SubmitInvalidMileage
  \/ SubmitValidMileage
  \/ DemoProviderReturnsDollars
  \/ CustomProviderReturnsNull
  \/ CustomProviderReturnsNoDollars
  \/ ProviderCallFails
  \/ ApplyDealerRule
  \/ DealerRuleUnusable
  \/ ApplyAdjustmentsAndReturnQuote
  \/ AdjustmentsUnusable
  \/ Done

Spec == Init /\ [][Next]_vars

\* The provider is called only after both checks have succeeded.
LookupOnlyAfterValidation ==
  lookedUp => (vinOk /\ mileageOk)

\* A validation failure is not a quote and did not call the provider.
RejectionSkipsLookup ==
  response \in {"vin_error", "mileage_error"} =>
    /\ ~lookedUp
    /\ response # "quote"

\* A quote the customer is shown has a whole-dollar price taken from a whole-dollar
\* base value, and it does not carry provider internals. null is not a whole-dollar
\* base, even though Number(null) prices it as zero.
QuotedPriceIsADollarAmount ==
  response = "quote" =>
    /\ priceIsDollars
    /\ baseKind = "dollars"
    /\ ~leaked

\* The success object leaves out provider, confidence, and providerRaw.
CustomerQuoteHidesProvider ==
  response = "quote" => ~leaked

\* A failed lookup or a failed pricing step is not shown as the thrown exception text.
FailureTextIsCustomerSafe ==
  response = "server_error" => ~rawError

====
