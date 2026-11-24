import {collateralHealth} from './fed-learn-risk.mjs';
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

const shockForm = document.getElementById('learn-shock-form');
if (shockForm) {
  shockForm.hidden = false;
  shockForm.addEventListener('submit', event => {
    event.preventDefault();
    const decline = Number(document.getElementById('learn-shock').value);
    const output = document.getElementById('learn-shock-result');
    if (![0, 20, 40].includes(decline)) { output.textContent = 'Choose one of the fictional scenarios.'; return; }
    const result = collateralHealth(2000, 1000, .8, decline);
    output.textContent = `Fictional health factor: ${result.factor.toFixed(2)}. ${result.state === 'below_boundary' ? 'Below the liquidation boundary in this model.' : 'Above the liquidation boundary in this model; not a safety guarantee.'} Debt is held fixed at $1,000.`;
  });
}
