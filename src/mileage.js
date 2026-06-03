export function normalizeMileage(value, { required = false } = {}) {
  const raw = String(value ?? '').trim();

  if (!raw) {
    return required
      ? { ok: false, code: 'mileage_required', message: 'Mileage is required.' }
      : { ok: true, mileage: null };
  }

  const compact = raw.replace(/,/g, '');
  if (!/^\d+$/.test(compact)) {
    return {
      ok: false,
      code: 'invalid_mileage',
      message: 'Mileage must be a non-negative whole number.'
    };
  }

  const mileage = Number(compact);
  if (!Number.isSafeInteger(mileage)) {
    return {
      ok: false,
      code: 'invalid_mileage',
      message: 'Mileage is too large.'
    };
  }

  return { ok: true, mileage };
}
