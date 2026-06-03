const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/;

export function normalizeVin(value) {
  return String(value || '').trim().replace(/\s+/g, '').toUpperCase();
}

export function validateVin(value) {
  const vin = normalizeVin(value);

  if (vin.length !== 17) {
    return {
      ok: false,
      code: 'invalid_vin_length',
      message: 'VIN must be exactly 17 characters.'
    };
  }

  if (!VIN_PATTERN.test(vin)) {
    return {
      ok: false,
      code: 'invalid_vin_characters',
      message: 'VIN can contain numbers and letters, but not I, O, or Q.'
    };
  }

  return { ok: true, vin };
}
