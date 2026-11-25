export const projectionMonths = Object.freeze([1, 3, 6]);

// Keep missing and malformed amounts distinct from an entered zero.
export function parseUsd(text) {
  const amount = text.trim();
  if (amount === '') return null;
  if (amount.length > 15 || !/^\$?(?:(?:\d{1,9}|\d{1,3}(?:,\d{3}){1,2})(?:\.\d{0,2})?|\.\d{1,2})$/.test(amount)) return NaN;
  const [dollars, cents = ''] = amount.replace(/[$,]/g, '').split('.');
  return Number(dollars) * 100 + Number(cents.padEnd(2, '0'));
}

export function projectCash({cash, receipts, spend, upfront = 0}) {
  const openingCash = cash - upfront;
  const monthlyNet = receipts - spend;

  return {
    openingCash,
    monthlyNet,
    // The model stays in integer cents and rounds the depletion estimate down.
    runwayTenths: openingCash > 0 && monthlyNet < 0
      ? Math.floor(openingCash * 10 / -monthlyNet)
      : null,
    months: projectionMonths.map(month => openingCash + month * monthlyNet)
  };
}
