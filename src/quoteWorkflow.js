import { normalizeMileage } from './mileage.js';
import { applyDealerRule, applyDetailAdjustments } from './pricing.js';
import { createStaticValueProvider } from './providers/staticValueProvider.js';
import { validateVin } from './vin.js';

export async function createQuote({
  vin,
  mileage,
  dealerRule = {},
  detailAdjustments = [],
  provider = createStaticValueProvider()
} = {}) {
  const vinResult = validateVin(vin);
  if (!vinResult.ok) return vinResult;

  const mileageResult = normalizeMileage(mileage, { required: true });
  if (!mileageResult.ok) return mileageResult;

  const providerResult = await provider.lookup({
    vin: vinResult.vin,
    mileage: mileageResult.mileage
  });
  const dealerPrice = applyDealerRule(providerResult.baseValue, dealerRule);
  const detailQuote = applyDetailAdjustments(dealerPrice, detailAdjustments);

  return {
    ok: true,
    quoteId: buildQuoteId(vinResult.vin, mileageResult.mileage, detailQuote.finalPrice),
    vin: vinResult.vin,
    mileage: mileageResult.mileage,
    baseValue: providerResult.baseValue,
    customerPrice: detailQuote.finalPrice,
    currency: providerResult.currency || 'USD',
    adjustments: detailQuote.adjustments,
    totalAdjustment: detailQuote.totalAdjustment
  };
}

function buildQuoteId(vin, mileage, price) {
  return `${vin.slice(-6)}-${mileage}-${price}`.toLowerCase();
}
