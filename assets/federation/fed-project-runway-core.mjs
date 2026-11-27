export const projectionMonths = Object.freeze([1, 3, 6]);
export const planFields = Object.freeze(['cash', 'receipts', 'spend', 'upfront', 'planned']);
export const planFileLimit = 4096;
const maxCents = 99_999_999_999;

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

export function monthlySpendingLimit({cash, receipts, upfront = 0}, months) {
  if (!Number.isSafeInteger(months) || months < 1) {
    throw new RangeError('Choose a whole number of months.');
  }
  const openingCash = cash - upfront;
  if (openingCash < 0) return null;
  return receipts + Math.floor(openingCash / months);
}

function validPlanAmounts(amounts) {
  return amounts && typeof amounts === 'object' && !Array.isArray(amounts) &&
    Object.keys(amounts).length === planFields.length &&
    planFields.every(key => {
      if (!Object.hasOwn(amounts, key)) return false;
      const amount = amounts[key];
      if ((key === 'upfront' || key === 'planned') && amount === null) return true;
      return Number.isSafeInteger(amount) && amount >= 0 && amount <= maxCents;
    });
}

export function writePlanFile(amounts, example) {
  if (typeof example !== 'boolean' || !validPlanAmounts(amounts)) {
    throw Error('Calculate a valid plan before downloading it.');
  }
  const plan = {tool: 'project-runway', version: 1, currency: 'USD', example, amounts};
  return JSON.stringify(plan, null, 2) + '\n';
}

export function readPlanFile(text) {
  if (typeof text !== 'string' || text.length > planFileLimit || new TextEncoder().encode(text).length > planFileLimit) {
    throw Error('Choose a Project Runway JSON file of 4 KB or less.');
  }
  let plan;
  try {
    plan = JSON.parse(text.trim());
  } catch {
    throw Error('This file cannot be read as JSON.');
  }
  if (!plan || typeof plan !== 'object' || Array.isArray(plan) || Object.keys(plan).length !== 5 ||
      plan.tool !== 'project-runway' || plan.version !== 1 || plan.currency !== 'USD' ||
      typeof plan.example !== 'boolean' || !validPlanAmounts(plan.amounts)) {
    throw Error('Choose a compatible Project Runway plan file in U.S. dollars.');
  }
  return {amounts: plan.amounts, example: plan.example};
}
