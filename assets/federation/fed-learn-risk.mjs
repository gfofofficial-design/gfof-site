export function collateralHealth(collateral, debt, threshold, declinePercent) {
  if (![collateral, debt, threshold, declinePercent].every(Number.isFinite) || collateral <= 0 || debt <= 0 || threshold <= 0 || threshold > 1 || declinePercent < 0 || declinePercent > 100) throw new RangeError('Unsupported fictional position');
  const factor = collateral * (1 - declinePercent / 100) * threshold / debt;
  if (!Number.isFinite(factor)) throw new RangeError('Unsupported fictional position');
  return {factor, state: factor < 1 ? 'below_boundary' : factor === 1 ? 'at_boundary' : 'above_boundary'};
}
