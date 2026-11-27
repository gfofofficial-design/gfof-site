import {mountAllianceAccountMemberPage} from './fed-alliance-member-account.mjs';

// A publication candidate, not a browser flag. The server independently checks
// every session and owner permission. Preview and alternate hosts stay closed.
export function mountProductionAlliancePage(document, dependencies = {}) {
  const origin = document.location?.origin;
  const enabled = origin === 'https://galacticfederation.co';
  return mountAllianceAccountMemberPage(document, {
    ...dependencies, origin, enabled, collaborationEnabled: enabled,
    feedbackEnabled: enabled, reportReviewEnabled: enabled,
  });
}
