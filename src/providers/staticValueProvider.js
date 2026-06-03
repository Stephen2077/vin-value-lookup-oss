export function createStaticValueProvider() {
  return {
    name: 'static-demo-provider',
    async lookup({ vin, mileage = 0 }) {
      const seed = String(vin)
        .split('')
        .reduce((sum, character) => sum + character.charCodeAt(0), 0);
      const startingValue = 18000 + (seed % 18000);
      const mileagePenalty = Math.min(9000, Math.floor((Number(mileage) || 0) / 15));

      return {
        provider: 'static-demo-provider',
        baseValue: Math.max(2500, startingValue - mileagePenalty),
        currency: 'USD',
        confidence: 'demo'
      };
    }
  };
}
