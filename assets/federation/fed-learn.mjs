const example = document.getElementById('liquidity-example');
const size = document.getElementById('learn-trade-size');
const reserve = document.getElementById('learn-quote-reserve');
const output = document.getElementById('learn-impact');
const percent = new Intl.NumberFormat('en', {
  style: 'percent',
  maximumFractionDigits: 2,
});

example.addEventListener('submit', (event) => {
  event.preventDefault();
  const relativeImpact = Number(size.value) / Number(reserve.value);
  output.textContent = `The average buy price is ${percent.format(relativeImpact)} above the starting price before fees.`;
});

example.hidden = false;
