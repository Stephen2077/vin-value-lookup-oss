export function roundToDollars(value) {
  return Math.round(Number(value));
}

export function applyDealerRule(baseValue, { mode = 'markup', percentage = 0 } = {}) {
  const value = Number(baseValue);
  const percent = Math.max(0, Number(percentage) || 0);
  const multiplier = mode === 'markdown'
    ? 1 - percent / 100
    : 1 + percent / 100;

  return Math.max(0, roundToDollars(value * multiplier));
}

export function applyDetailAdjustments(price, detailAdjustments = []) {
  const adjustments = detailAdjustments
    .map((item) => ({
      label: String(item.label || 'Adjustment').trim() || 'Adjustment',
      amount: Math.max(0, roundToDollars(item.amount || 0))
    }))
    .filter((item) => item.amount > 0);

  const totalAdjustment = adjustments.reduce((sum, item) => sum + item.amount, 0);

  return {
    finalPrice: Math.max(0, roundToDollars(Number(price) - totalAdjustment)),
    totalAdjustment,
    adjustments
  };
}
