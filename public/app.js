const form = document.querySelector('#quoteForm');
const result = document.querySelector('#result');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  result.textContent = 'Creating quote...';

  const data = new FormData(form);
  const adjustment = Number(data.get('adjustment') || 0);
  const payload = {
    vin: data.get('vin'),
    mileage: data.get('mileage'),
    dealerRule: {
      mode: data.get('mode'),
      percentage: Number(data.get('percentage') || 0)
    },
    detailAdjustments: adjustment > 0
      ? [{ label: 'Condition adjustment', amount: adjustment }]
      : []
  };

  const response = await fetch('/api/quote', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const quote = await response.json();

  result.textContent = JSON.stringify(quote, null, 2);
});
