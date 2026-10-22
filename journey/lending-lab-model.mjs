// A small educational model. It does not execute or quote the lending program.
export const scenarios = Object.freeze({
  steady: Object.freeze({ name: 'Steady price', startPrice: 100, endPrice: 100, note: 'SOL stays at $100 in this example.' }),
  slide: Object.freeze({ name: 'Price slide', startPrice: 100, endPrice: 70, note: 'SOL falls from $100 to $70 before the repayment decision.' })
});

export const assumptions = Object.freeze({
  collateralSol: 2,
  maxLtvBps: 5_000,
  baseRateBps: 200,
  fullRateBps: 2_000,
  secondsPerYear: 31_536_000
});

export function initial(scenario = 'steady') {
  if (!Object.hasOwn(scenarios, scenario)) scenario = 'steady';
  return { scenario, stage: 'supply', supplied: 0, cash: 0, principal: 0, interest: 0, price: scenarios[scenario].startPrice, days: 0, borrowed: 0, repaid: 0, events: [] };
}

export function rateBps(state) {
  const assets = state.cash + state.principal;
  if (assets <= 0) return assumptions.baseRateBps;
  return assumptions.baseRateBps + Math.floor((assumptions.fullRateBps - assumptions.baseRateBps) * state.principal / assets);
}

export function snapshot(state) {
  const collateralValue = assumptions.collateralSol * state.price;
  const debt = state.principal + state.interest;
  const assets = state.cash + state.principal;
  return {
    cash: state.cash,
    principal: state.principal,
    interest: state.interest,
    debt,
    collateralValue,
    utilization: assets ? state.principal / assets : 0,
    rateBps: rateBps(state),
    debtToCollateral: debt / collateralValue,
    withinExampleLimit: debt <= collateralValue * assumptions.maxLtvBps / 10_000 + 1e-9
  };
}

export function reason(state, action, value) {
  if (action === 'supply') {
    if (state.stage !== 'supply') return 'The supply step is complete.';
    return [150, 200, 300].includes(value) ? '' : 'Choose one of the displayed supply amounts.';
  }
  if (action === 'draw') {
    if (state.stage !== 'draw') return 'Supply market cash before drawing.';
    if (![40, 80, 110].includes(value)) return 'Choose one of the displayed amounts.';
    if (value > state.cash) return 'The market does not have enough cash.';
    if (value > assumptions.collateralSol * state.price * assumptions.maxLtvBps / 10_000) return 'Above the example 50% borrowing limit.';
    return '';
  }
  if (action === 'wait') {
    if (state.stage !== 'wait') return 'Draw before advancing time.';
    return [30, 90].includes(value) ? '' : 'Choose 30 or 90 days.';
  }
  if (action === 'repay') {
    if (state.stage !== 'repay') return 'Advance time before repayment.';
    if (![0, 20, 40].includes(value)) return 'Choose one of the displayed amounts.';
    return value <= state.principal ? '' : 'Cannot repay more principal than is owed.';
  }
  return 'Unknown action.';
}

export function step(state, action, value) {
  if (reason(state, action, value)) return state;
  if (action === 'supply') return {
    ...state, stage: 'draw', supplied: value, cash: value,
    events: [...state.events, `Supplier placed $${value} fictional USDC into market cash. Borrower then posted 2 fictional SOL as collateral.`]
  };
  if (action === 'draw') return {
    ...state, stage: 'wait', cash: state.cash - value, principal: value, borrowed: value,
    events: [...state.events, `Borrowed $${value} USDC against 2 SOL at the example $100/SOL price.`]
  };
  if (action === 'wait') {
    const rate = rateBps(state);
    const interest = state.principal * rate / 10_000 * value / 365;
    const price = scenarios[state.scenario].endPrice;
    return {
      ...state, stage: 'repay', interest: state.interest + interest, price, days: value,
      events: [...state.events, `${value} days passed at an illustrative ${(rate / 100).toFixed(2)}% annual rate. SOL is now $${price}.`]
    };
  }
  return {
    ...state, stage: 'done', cash: state.cash + value, principal: state.principal - value, repaid: value,
    events: [...state.events, value ? `Returned $${value} principal to market cash. Accrued interest is still unpaid.` : 'No principal was repaid. Accrued interest is still unpaid.']
  };
}
